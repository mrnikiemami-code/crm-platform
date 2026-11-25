import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

// Reads the two customer records a quotation may point at. Kept apart from the
// quotation queries because these objects belong to the CRM, not to this app:
// nothing here writes, and only the fields the picker shows are selected.

export type CustomerKind = 'PERSON' | 'COMPANY';

// First page ceiling for the quotation customer picker (server-side pages only).
export const CUSTOMER_PICKER_PAGE_SIZE = 100;

const PERSON_FIELDS = 'id name { firstName lastName } jobTitle emails { primaryEmail }';
const COMPANY_FIELDS = 'id name';

const buildPersonFilterLiteral = (
  search: string,
  recordId: string | null,
): string => {
  if (recordId !== null) {
    return toGraphqlLiteral({ id: { eq: recordId } });
  }

  const trimmed = search.trim();

  if (trimmed === '') {
    return '';
  }

  return toGraphqlLiteral({
    or: [
      { name: { firstName: { ilike: `%${trimmed}%` } } },
      { name: { lastName: { ilike: `%${trimmed}%` } } },
      { emails: { primaryEmail: { ilike: `%${trimmed}%` } } },
    ],
  } as GraphqlValue);
};

const buildCompanyFilterLiteral = (
  search: string,
  recordId: string | null,
): string => {
  if (recordId !== null) {
    return toGraphqlLiteral({ id: { eq: recordId } });
  }

  const trimmed = search.trim();

  return trimmed === ''
    ? ''
    : toGraphqlLiteral({ name: { ilike: `%${trimmed}%` } });
};

const withFilter = (filterLiteral: string): string =>
  filterLiteral === '' ? '' : `filter: ${filterLiteral}, `;

export const buildCustomerPickerQuery = ({
  customerType,
  search,
  recordId = null,
  first = CUSTOMER_PICKER_PAGE_SIZE,
  afterCursor = null,
}: {
  customerType: CustomerKind;
  search: string;
  recordId?: string | null;
  first?: number;
  afterCursor?: string | null;
}): string => {
  // `after` is only appended when a cursor exists: an `after: null` literal is rejected by
  // the schema, and an empty string is a cursor the server cannot resolve.
  const afterArg =
    afterCursor === null || afterCursor === ''
      ? ''
      : `after: ${toGraphqlLiteral(afterCursor)}, `;

  if (customerType === 'COMPANY') {
    return `query CustomerCompanies {
      companies(${withFilter(buildCompanyFilterLiteral(search, recordId))}${afterArg}first: ${first}) {
        edges { cursor node { ${COMPANY_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  }

  return `query CustomerPeople {
    people(${withFilter(buildPersonFilterLiteral(search, recordId))}${afterArg}first: ${first}) {
      edges { cursor node { ${PERSON_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
};

// One round-trip for "does this id still exist, and what is it called". A save
// uses the same query shape, so a customer that the form shows but the server
// cannot read is refused by the same rule instead of being written blind.
export const buildCustomerByIdQuery = ({
  customerType,
  recordId,
}: {
  customerType: CustomerKind;
  recordId: string;
}): string =>
  buildCustomerPickerQuery({ customerType, search: '', recordId, first: 1 });
