import {
  type CustomerKind,
  buildCustomerPickerQuery,
  CUSTOMER_PICKER_PAGE_SIZE,
} from 'src/data/customer-queries';
import { RecordApiError } from 'src/data/record-api';
import { clampPageSize } from 'src/domain/accounting/pagination';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Reads the records a quotation can point at. The picker and the save-time check
// share this parser, so what an operator selected and what the server accepted are
// the same row read the same way.

export type CustomerPickerRow = {
  id: string;
  label: string;
  detail: string | null;
};

export type CustomerPickerPage = {
  rows: CustomerPickerRow[];
  hasNextPage: boolean;
  // Passed back verbatim on "next page". Twenty's cursor is opaque: it encodes the sort
  // position, so re-using it across a different search term is rejected by the server
  // instead of silently returning rows from the previous term.
  endCursor: string | null;
  // The server does not aggregate a count on this connection, so the total is honestly
  // unknown rather than a guess.
  totalKnown: number | null;
};

export type CustomerDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readPersonName = (node: Record<string, unknown>): string => {
  const name = asRecord(node.name);

  return `${readText(name?.firstName)} ${readText(name?.lastName)}`.trim();
};

const readPersonDetail = (node: Record<string, unknown>): string | null => {
  const jobTitle = readText(node.jobTitle);

  if (jobTitle !== '') {
    return jobTitle;
  }

  const email = readText(asRecord(node.emails)?.primaryEmail);

  return email === '' ? null : email;
};

const readRow = (
  node: Record<string, unknown>,
  customerType: CustomerKind,
): CustomerPickerRow | null => {
  const id = readText(node.id);

  if (id === '') {
    return null;
  }

  if (customerType === 'PERSON') {
    const label = readPersonName(node);

    // A person without any name is still a real record; hiding it would leave the
    // operator unable to pick a customer that exists, and inventing a name would
    // make two different people look identical.
    return {
      id,
      label: label === '' ? 'شخص بدون نام' : label,
      detail: readPersonDetail(node),
    };
  }

  const companyName = readText(node.name);

  return {
    id,
    label: companyName === '' ? 'شرکت بدون نام' : companyName,
    detail: null,
  };
};

const connectionNameFor = (customerType: CustomerKind): string =>
  customerType === 'COMPANY' ? 'companies' : 'people';

export const parseCustomerPickerPage = (
  data: Record<string, unknown>,
  customerType: CustomerKind,
): CustomerPickerPage => {
  const connection = asRecord(data[connectionNameFor(customerType)]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return { rows: [], hasNextPage: false, endCursor: null, totalKnown: null };
  }

  const rows = edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    if (node === null) {
      return [];
    }

    const row = readRow(node, customerType);

    return row === null ? [] : [row];
  });

  const pageInfo = asRecord(connection?.pageInfo);
  const endCursor =
    typeof pageInfo?.endCursor === 'string' && pageInfo.endCursor !== ''
      ? pageInfo.endCursor
      : null;

  return {
    rows,
    hasNextPage: pageInfo?.hasNextPage === true,
    endCursor,
    totalKnown: null,
  };
};

export const searchCustomersForPicker = async (
  {
    customerType,
    search,
    recordId = null,
    afterCursor = null,
    pageSize = CUSTOMER_PICKER_PAGE_SIZE,
  }: {
    customerType: CustomerKind;
    search: string;
    recordId?: string | null;
    afterCursor?: string | null;
    pageSize?: number;
  },
  dependencies: CustomerDependencies,
): Promise<CustomerPickerPage> => {
  const data = await dependencies.execute(
    buildCustomerPickerQuery({
      customerType,
      search,
      recordId,
      afterCursor,
      first: clampPageSize(pageSize),
    }),
  );

  return parseCustomerPickerPage(data, customerType);
};

// A write must name a customer that exists and that this app may read. The domain
// already refuses "no customer" and "both sides at once"; this is the part only a
// round-trip can answer. A refusal (not-found or no-permission) is returned rather
// than thrown so the save reports a Persian reason instead of a generic failure.
export const verifyCustomerRecord = async (
  {
    customerType,
    recordId,
  }: {
    customerType: CustomerKind;
    recordId: string;
  },
  dependencies: CustomerDependencies,
): Promise<Result<CustomerPickerRow>> => {
  const trimmedId = recordId.trim();

  if (trimmedId === '') {
    return refused(
      customerType === 'PERSON'
        ? 'CUSTOMER_PERSON_REQUIRED'
        : 'CUSTOMER_COMPANY_REQUIRED',
      customerType === 'PERSON'
        ? 'شخص مشتری را انتخاب کنید'
        : 'شرکت مشتری را انتخاب کنید',
    );
  }

  try {
    const page = await searchCustomersForPicker(
      { customerType, search: '', recordId: trimmedId },
      dependencies,
    );
    const row = page.rows.find((candidate) => candidate.id === trimmedId);

    if (row === undefined) {
      return refused(
        'CUSTOMER_NOT_FOUND',
        customerType === 'PERSON'
          ? 'شخص انتخاب‌شده پیدا نشد؛ دوباره انتخاب کنید'
          : 'شرکت انتخاب‌شده پیدا نشد؛ دوباره انتخاب کنید',
      );
    }

    return accepted(row);
  } catch (error) {
    if (error instanceof RecordApiError && error.code === 'FORBIDDEN') {
      return refused(
        'PERMISSION_DENIED',
        customerType === 'PERSON'
          ? 'دسترسی لازم برای خواندن اشخاص وجود ندارد'
          : 'دسترسی لازم برای خواندن شرکت‌ها وجود ندارد',
      );
    }

    return refused(
      'CUSTOMER_LOOKUP_FAILED',
      'بررسی مشتری انتخاب‌شده انجام نشد؛ دوباره تلاش کنید',
    );
  }
};
