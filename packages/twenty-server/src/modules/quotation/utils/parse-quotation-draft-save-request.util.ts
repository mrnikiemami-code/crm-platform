import { isNonEmptyString } from '@sniptt/guards';
import { isPlainObject } from 'twenty-shared/utils';

import {
  QUOTATION_DRAFT_CUSTOMER_TYPES,
  QUOTATION_DRAFT_DISCOUNT_KINDS,
  QUOTATION_DRAFT_LINE_KINDS,
  QUOTATION_DRAFT_MAX_LINES,
  type QuotationDraftCustomerType,
  type QuotationDraftDiscountKind,
  type QuotationDraftLineKind,
  type QuotationDraftSaveHeader,
  type QuotationDraftSaveLine,
  type QuotationDraftSaveRequest,
} from 'src/modules/quotation/types/quotation-draft-save.type';
import { findClientAccountingSnapshotOverrides } from 'src/modules/quotation/utils/quotation-accounting-snapshot.util';
import { isExactAmountText } from 'src/modules/quotation/utils/quotation-draft-totals.util';

export type QuotationDraftSaveParseOutcome =
  | { ok: true; value: QuotationDraftSaveRequest }
  | { ok: false; code: string; message: string };

const MAX_TEXT_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

const refused = (
  code: string,
  message: string,
): QuotationDraftSaveParseOutcome => ({ ok: false, code, message });

const readText = (
  value: unknown,
  maxLength = MAX_TEXT_LENGTH,
): string | null =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= maxLength
    ? value.trim()
    : null;

const readNullableText = (
  value: unknown,
  maxLength = MAX_TEXT_LENGTH,
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 || trimmed.length > maxLength ? null : trimmed;
};

type NullableIdOutcome = { ok: true; value: string | null } | { ok: false };

// Absent (`null`) and malformed are different answers: an absent relation is a
// valid draft, a malformed id is a request the server must not guess at.
const readNullableId = (value: unknown): NullableIdOutcome => {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (isNonEmptyString(value) && value.trim().length <= 64) {
    return { ok: true, value: value.trim() };
  }

  return { ok: false };
};

const readDiscountKind = (value: unknown): QuotationDraftDiscountKind | null =>
  (QUOTATION_DRAFT_DISCOUNT_KINDS as readonly unknown[]).includes(value)
    ? (value as QuotationDraftDiscountKind)
    : null;

const readLineKind = (value: unknown): QuotationDraftLineKind | null =>
  (QUOTATION_DRAFT_LINE_KINDS as readonly unknown[]).includes(value)
    ? (value as QuotationDraftLineKind)
    : null;

const readCustomerType = (value: unknown): QuotationDraftCustomerType | null =>
  (QUOTATION_DRAFT_CUSTOMER_TYPES as readonly unknown[]).includes(value)
    ? (value as QuotationDraftCustomerType)
    : null;

const readVersion = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
};

// Absent is legitimate for a client that predates configurable tax; a present but
// unreadable rate is not, because the server would then be unable to check the tax
// it is asked to store.
const readTaxRateBasisPoints = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return /^\d{1,5}$/.test(trimmed) ? trimmed : undefined;
};

const parseLine = (raw: unknown): QuotationDraftSaveLine | null => {
  if (!isPlainObject(raw)) {
    return null;
  }

  const name = readText(raw.name, MAX_TITLE_LENGTH);
  const kind = readLineKind(raw.kind);
  const unit = readText(raw.unit, 32);
  const discountKind = readDiscountKind(raw.discountKind);
  const itemId = readNullableId(raw.itemId);

  if (
    name === null ||
    kind === null ||
    unit === null ||
    discountKind === null ||
    !itemId.ok
  ) {
    return null;
  }

  const exactFields = [
    raw.quantityExact,
    raw.unitPriceExact,
    raw.grossExact,
    raw.discountExact,
    raw.discountInputExact,
    raw.documentDiscountExact,
    raw.taxExact,
    raw.totalExact,
  ];

  if (!exactFields.every((value) => typeof value === 'string')) {
    return null;
  }

  const taxRateBasisPoints = readTaxRateBasisPoints(raw.taxRateBasisPoints);
  const dutyRateBasisPoints = readTaxRateBasisPoints(raw.dutyRateBasisPoints);

  if (taxRateBasisPoints === undefined || dutyRateBasisPoints === undefined) {
    return null;
  }

  // Snapshot codes on lines are server-owned (C3); refuse client supply.
  if (
    raw.taxAccountingCode !== undefined ||
    raw.taxPolicyRecordId !== undefined
  ) {
    return null;
  }

  return {
    name,
    kind,
    description: readNullableText(raw.description),
    unit,
    quantityExact: raw.quantityExact as string,
    unitPriceExact: raw.unitPriceExact as string,
    grossExact: raw.grossExact as string,
    discountExact: raw.discountExact as string,
    discountKind,
    discountInputExact: raw.discountInputExact as string,
    documentDiscountExact: raw.documentDiscountExact as string,
    taxExact: raw.taxExact as string,
    totalExact: raw.totalExact as string,
    itemId: itemId.value,
    taxPolicy: readNullableText(raw.taxPolicy, 64),
    taxRateBasisPoints,
    dutyRateBasisPoints,
  };
};

const parseHeader = (raw: unknown): QuotationDraftSaveHeader | null => {
  if (!isPlainObject(raw)) {
    return null;
  }

  const name = readText(raw.name, MAX_TITLE_LENGTH);
  const customerType = readCustomerType(raw.customerType);
  const currencyCode = readText(raw.currencyCode, 8)?.toUpperCase() ?? null;
  const documentDiscountKind = readDiscountKind(raw.documentDiscountKind);
  const personId = readNullableId(raw.personId);
  const companyId = readNullableId(raw.companyId);
  const taxPolicy = readNullableText(raw.taxPolicy, 64);
  const taxRateBasisPoints = readTaxRateBasisPoints(raw.taxRateBasisPoints);
  const dutyRateBasisPoints = readTaxRateBasisPoints(raw.dutyRateBasisPoints);

  if (
    name === null ||
    customerType === null ||
    currencyCode === null ||
    !/^[A-Z]{3}$/.test(currencyCode) ||
    documentDiscountKind === null ||
    taxRateBasisPoints === undefined ||
    dutyRateBasisPoints === undefined ||
    !personId.ok ||
    !companyId.ok
  ) {
    return null;
  }

  // An absent duty field is a caller that predates the split, not a zero it asserted.
  // Leaving it absent keeps a legacy document's stored breakdown exactly as it was; the
  // totals check still re-derives every line's tax from the declared rates, so a document
  // whose tax carries duty while declaring no duty is refused there rather than relabelled.
  const rawDutyExact = raw.dutyExact;
  const dutyExact =
    rawDutyExact === undefined
      ? undefined
      : typeof rawDutyExact === 'string' && isExactAmountText(rawDutyExact)
        ? rawDutyExact
        : null;

  const exactFields = [
    raw.documentDiscountInputExact,
    raw.grossExact,
    raw.lineDiscountExact,
    raw.documentDiscountExact,
    raw.netExact,
    raw.taxExact,
    raw.roundingExact,
    raw.totalExact,
  ];

  if (!exactFields.every((value) => typeof value === 'string')) {
    return null;
  }

  if (dutyExact === null) {
    return null;
  }

  return {
    name,
    customerType,
    personId: personId.value,
    companyId: companyId.value,
    currencyCode,
    taxPolicy,
    taxRateBasisPoints,
    dutyRateBasisPoints,
    paymentTerms: readNullableText(raw.paymentTerms),
    documentDiscountKind,
    documentDiscountInputExact: raw.documentDiscountInputExact as string,
    grossExact: raw.grossExact as string,
    lineDiscountExact: raw.lineDiscountExact as string,
    documentDiscountExact: raw.documentDiscountExact as string,
    netExact: raw.netExact as string,
    taxExact: raw.taxExact as string,
    ...(dutyExact === undefined ? {} : { dutyExact }),
    roundingExact: raw.roundingExact as string,
    totalExact: raw.totalExact as string,
  };
};

export const parseQuotationDraftSaveRequest = (
  body: unknown,
): QuotationDraftSaveParseOutcome => {
  if (!isPlainObject(body)) {
    return refused('INVALID_INPUT', 'request body is not an object');
  }

  // C3: snapshot codes are resolved server-side; any client supply is refused.
  if (findClientAccountingSnapshotOverrides(body).length > 0) {
    return refused(
      'ACCOUNTING_SNAPSHOT_CLIENT_FORBIDDEN',
      'tax/currency accounting snapshots cannot be supplied by the client',
    );
  }

  if (
    isPlainObject(body.header) &&
    findClientAccountingSnapshotOverrides(body.header).length > 0
  ) {
    return refused(
      'ACCOUNTING_SNAPSHOT_CLIENT_FORBIDDEN',
      'tax/currency accounting snapshots cannot be supplied by the client',
    );
  }

  const quotationId = readNullableId(body.quotationId);
  const expectedVersion = readVersion(body.expectedVersion);

  if (!quotationId.ok || expectedVersion === undefined) {
    return refused(
      'INVALID_INPUT',
      'quotationId or expectedVersion is invalid',
    );
  }

  const header = parseHeader(body.header);

  if (header === null) {
    return refused('INVALID_INPUT', 'header is incomplete');
  }

  if (header.customerType === 'PERSON') {
    if (!isNonEmptyString(header.personId) || header.companyId !== null) {
      return refused(
        'CUSTOMER_INVALID',
        'a person quotation needs exactly one person',
      );
    }
  } else if (!isNonEmptyString(header.companyId) || header.personId !== null) {
    return refused(
      'CUSTOMER_INVALID',
      'a company quotation needs exactly one company',
    );
  }

  if (quotationId.value === null && expectedVersion !== null) {
    return refused('INVALID_INPUT', 'a new quotation cannot carry a version');
  }

  // Editing without a version would silently skip the concurrency claim, so an
  // update that omits it is refused here, before any connection is opened.
  if (quotationId.value !== null && expectedVersion === null) {
    return refused(
      'QUOTATION_VERSION_REQUIRED',
      'editing a quotation requires expectedVersion',
    );
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return refused(
      'DOCUMENT_HAS_NO_LINES',
      'a quotation needs at least one line',
    );
  }

  if (body.lines.length > QUOTATION_DRAFT_MAX_LINES) {
    return refused(
      'INVALID_INPUT',
      `a quotation cannot carry more than ${QUOTATION_DRAFT_MAX_LINES} lines`,
    );
  }

  const lines: QuotationDraftSaveLine[] = [];

  for (const [index, rawLine] of body.lines.entries()) {
    if (
      isPlainObject(rawLine) &&
      findClientAccountingSnapshotOverrides(rawLine).length > 0
    ) {
      return refused(
        'ACCOUNTING_SNAPSHOT_CLIENT_FORBIDDEN',
        'tax/currency accounting snapshots cannot be supplied by the client',
      );
    }

    const line = parseLine(rawLine);

    if (line === null) {
      return refused('LINE_INVALID', `line ${index + 1} is incomplete`);
    }

    lines.push(line);
  }

  return {
    ok: true,
    value: { quotationId: quotationId.value, expectedVersion, header, lines },
  };
};
