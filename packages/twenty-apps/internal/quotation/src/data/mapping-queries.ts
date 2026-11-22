import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

// Reads a bounded page of CRM records for the accounting mapping screens.
//
// WHY BY IDS AND SKUs AND NOT A SCAN: the mapping screen compares a page of destination
// rows against the CRM records they could attach to. The only CRM records that matter for
// a page are the ones whose SKU or id appears in that page. Asking for "the first N of the
// catalog" instead would couple the screen to the size of the catalog: correct at 500
// items, useless at 100 000, and never a comparison against the row actually displayed.
export const MAPPING_LOOKUP_MAX_IDS = 100;

const DEFAULT_PRICE_LISTS_FILTER =
  'filter: { and: [{ currencyCode: { eq: "IRR" } }, { isDefault: { eq: true } }] }, first: 1';

const PRICE_SELECTION = `
  prices(first: 20) {
    edges {
      node {
        unitPriceExact
        validFrom
        validTo
        priceList { id isDefault }
      }
    }
  }
`;

// Both arms are optional so a page that only needs SKU suggestions does not also pay for an
// id lookup. An empty arm is dropped from the filter instead of becoming `in: []`, which
// some resolvers treat as "no rows" and others as "all rows".
export const buildMappingCrmItemsQuery = ({
  skus,
  ids,
  priceListId,
}: {
  skus: string[];
  ids: string[];
  priceListId: string | null;
}): string => {
  const arms: GraphqlValue[] = [];

  if (skus.length > 0) {
    arms.push({ sku: { in: skus } });
  }

  if (ids.length > 0) {
    arms.push({ id: { in: ids } });
  }

  const filter =
    arms.length === 1
      ? toGraphqlLiteral(arms[0])
      : toGraphqlLiteral({ or: arms } as GraphqlValue);

  const priceListRoot =
    priceListId === null
      ? `priceLists(${DEFAULT_PRICE_LISTS_FILTER}) { edges { node { id } } }`
      : '';

  return `query MappingCrmItems {
    catalogItems(filter: ${filter}, first: ${MAPPING_LOOKUP_MAX_IDS}) {
      edges {
        node {
          id
          name
          sku
          ${PRICE_SELECTION}
        }
      }
    }
    ${priceListRoot}
  }`;
};

// The CRM customers a page of destination customers may be attached to. Search runs on the
// server against the indexed name/email columns; the page is capped, so typing never
// becomes a table read.
export const buildMappingPartyCandidatesQuery = ({
  partyType,
  search,
  first,
}: {
  partyType: 'PERSON' | 'COMPANY';
  search: string;
  first: number;
}): string => {
  const trimmed = search.trim();

  if (partyType === 'COMPANY') {
    const filter =
      trimmed === ''
        ? ''
        : `filter: ${toGraphqlLiteral({ name: { ilike: `%${trimmed}%` } })}, `;

    return `query MappingCompanyCandidates {
      companies(${filter}first: ${first}) {
        edges { cursor node { id name } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  }

  const filter =
    trimmed === ''
      ? ''
      : `filter: ${toGraphqlLiteral({
          or: [
            { name: { firstName: { ilike: `%${trimmed}%` } } },
            { name: { lastName: { ilike: `%${trimmed}%` } } },
            { emails: { primaryEmail: { ilike: `%${trimmed}%` } } },
          ],
        } as GraphqlValue)}, `;

  return `query MappingPersonCandidates {
    people(${filter}first: ${first}) {
      edges { cursor node { id name { firstName lastName } jobTitle } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
};
