import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

export const buildCreateCatalogItemMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateCatalogItem { createCatalogItem(data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildUpdateCatalogItemMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateCatalogItem { updateCatalogItem(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildCreatePriceListMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreatePriceList { createPriceList(data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildCreatePriceMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreatePrice { createPrice(data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildDefaultPriceListQuery = (): string =>
  `query DefaultPriceList { priceLists(filter: { and: [{ currencyCode: { eq: "IRR" } }, { isDefault: { eq: true } }] }, first: 1) { edges { node { id } } } }`;

export const buildAnyIrrPriceListQuery = (): string =>
  `query IrrPriceList { priceLists(filter: { currencyCode: { eq: "IRR" } }, first: 1) { edges { node { id } } } }`;

export const buildCreateQuotationMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateQuotation { createQuotation(data: ${toGraphqlLiteral(data)}) { id status version } }`;

export const buildUpdateQuotationMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateQuotation { updateQuotation(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { id status version } }`;

export const buildCreateQuotationLineMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateQuotationLine { createQuotationLine(data: ${toGraphqlLiteral(data)}) { id } }`;

// Editing a line in place keeps its id (and therefore its history) instead of
// deleting and recreating the row on every draft save.
export const buildUpdateQuotationLineMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateQuotationLine { updateQuotationLine(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildDeleteQuotationLineMutation = (id: string): string =>
  `mutation DeleteQuotationLine { deleteQuotationLine(id: ${toGraphqlLiteral(id)}) { id } }`;

export const buildQuotationByIdQuery = (id: string): string =>
  `query QuotationById { quotation(filter: { id: { eq: ${toGraphqlLiteral(id)} } }) { id status version name } }`;

// One round-trip for everything the edit form needs: the header plus every line,
// in document order. Relations are read through their nodes (`person { id }`)
// because the join column names are a storage detail of the platform.
export const buildQuotationDraftEditQuery = (quotationId: string): string =>
  `query QuotationDraftEdit {
    quotation(filter: { id: { eq: ${toGraphqlLiteral(quotationId)} } }) {
      id
      status
      version
      name
      customerType
      paymentTerms
      taxPolicy
      taxRateBasisPoints
      dutyRateBasisPoints
      currencyCode
      roundingRuleCode
      roundingRuleName
      roundingStepRials
      roundingRuleRecordId
      preRoundTotalExact
      documentDiscountKind
      documentDiscountInputExact
      documentDiscountExact
      person { id name { firstName lastName } }
      company { id name }
    }
    quotationLines(
      filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} } }
      orderBy: [{ sortOrder: AscNullsLast }]
      first: 200
    ) {
      edges {
        node {
          id
          name
          kind
          description
          unit
          quantityExact
          unitPriceExact
          discountExact
          discountKind
          discountInputExact
          taxPolicy
          taxRateBasisPoints
          dutyRateBasisPoints
          sortOrder
          item { id }
        }
      }
    }
  }`;

export const buildQuotationLinesByQuotationQuery = (
  quotationId: string,
): string =>
  `query QuotationLinesByQuotation { quotationLines(filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} } }, orderBy: [{ sortOrder: AscNullsLast }], first: 200) { edges { node { id } } } }`;

export const buildQuotationUnitByIdQuery = (id: string): string =>
  `query QuotationUnitById { quotationUnit(filter: { id: { eq: ${toGraphqlLiteral(id)} } }) { id name isActive accountingCode code } }`;

export const buildCatalogItemByIdQuery = (id: string): string =>
  `query CatalogItemById { catalogItem(filter: { id: { eq: ${toGraphqlLiteral(id)} } }) { id name kind sku unit isActive } }`;

export const CATALOG_PICKER_PAGE_SIZE = 100;

const buildActiveCatalogItemsFilterLiteral = (search: string): string => {
  const trimmed = search.trim();
  const activeFilter = { isActive: { eq: true } };
  const filter =
    trimmed === ''
      ? activeFilter
      : {
          and: [
            activeFilter,
            {
              or: [
                { name: { ilike: `%${trimmed}%` } },
                { sku: { ilike: `%${trimmed}%` } },
              ],
            },
          ],
        };

  return toGraphqlLiteral(filter);
};

export const buildActiveCatalogItemsPageQuery = ({
  search,
  afterCursor,
  first = CATALOG_PICKER_PAGE_SIZE,
}: {
  search: string;
  afterCursor: string | null;
  first?: number;
}): string => {
  const afterArg =
    afterCursor === null || afterCursor === ''
      ? ''
      : `, after: ${toGraphqlLiteral(afterCursor)}`;

  // orderBy enums must stay unquoted GraphQL enums (not JSON strings).
  return `query ActiveCatalogItemsPage {
    catalogItems(
      filter: ${buildActiveCatalogItemsFilterLiteral(search)}
      orderBy: [{ name: AscNullsLast }, { id: AscNullsLast }]
      first: ${first}${afterArg}
    ) {
      edges {
        cursor
        node {
          id
          name
          kind
          sku
          unit
          description
          isActive
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;
};

// One GraphQL round-trip for the catalog page + default IRR price list.
// Logic-function isolates do not reliably keep process cache across HTTP calls,
// so combining roots is the durable win over sequential queries.
export const buildCatalogPageWithDefaultPriceListQuery = ({
  search,
  afterCursor,
  first = CATALOG_PICKER_PAGE_SIZE,
}: {
  search: string;
  afterCursor: string | null;
  first?: number;
}): string => {
  const afterArg =
    afterCursor === null || afterCursor === ''
      ? ''
      : `, after: ${toGraphqlLiteral(afterCursor)}`;

  return `query CatalogPageWithDefaultPriceList {
    catalogItems(
      filter: ${buildActiveCatalogItemsFilterLiteral(search)}
      orderBy: [{ name: AscNullsLast }, { id: AscNullsLast }]
      first: ${first}${afterArg}
    ) {
      edges {
        cursor
        node {
          id
          name
          kind
          sku
          unit
          description
          isActive
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    priceLists(filter: { and: [{ currencyCode: { eq: "IRR" } }, { isDefault: { eq: true } }] }, first: 1) {
      edges { node { id } }
    }
  }`;
};

export const buildPricesForItemsOnListQuery = ({
  itemIds,
  priceListId,
}: {
  itemIds: string[];
  priceListId: string;
}): string => {
  if (itemIds.length === 0) {
    return `query PricesForItemsOnList { prices(first: 0) { edges { node { id } } } }`;
  }

  return `query PricesForItemsOnList {
    prices(
      filter: {
        and: [
          { itemId: { in: ${toGraphqlLiteral(itemIds)} } }
          { priceListId: { eq: ${toGraphqlLiteral(priceListId)} } }
        ]
      }
      first: ${Math.max(itemIds.length * 5, 50)}
    ) {
      edges {
        node {
          unitPriceExact
          validFrom
          validTo
          itemId
        }
      }
    }
  }`;
};

export const buildQuotationForCustomerLinkQuery = (
  quotationId: string,
): string =>
  `query QuotationForCustomerLink {
    quotations(filter: { id: { eq: ${toGraphqlLiteral(quotationId)} } }, first: 1) {
      edges {
        node {
          id
          status
          quotationNumber
          name
        }
      }
    }
  }`;

export const buildCreateQuotationCustomerLinkMutation = (data: {
  name: string;
  tokenHash: string;
  revisionHash: string;
  expiresAt: string;
  issuedAt: string;
  quotationId: string;
}): string =>
  `mutation CreateQuotationCustomerLink {
    createQuotationCustomerLink(data: ${toGraphqlLiteral({
      name: data.name,
      tokenHash: data.tokenHash,
      revisionHash: data.revisionHash,
      expiresAt: data.expiresAt,
      issuedAt: data.issuedAt,
      quotationId: data.quotationId,
    })}) { id expiresAt revisionHash }
  }`;

export const buildRevokeQuotationCustomerLinkMutation = ({
  linkId,
  revokedAt,
}: {
  linkId: string;
  revokedAt: string;
}): string =>
  `mutation RevokeQuotationCustomerLink {
    updateQuotationCustomerLink(
      id: ${toGraphqlLiteral(linkId)}
      data: ${toGraphqlLiteral({ revokedAt })}
    ) { id revokedAt }
  }`;

export const buildQuotationCustomerLinkByHashQuery = (
  tokenHash: string,
): string =>
  `query QuotationCustomerLinkByHash {
    quotationCustomerLinks(
      filter: { tokenHash: { eq: ${toGraphqlLiteral(tokenHash)} } }
      first: 1
    ) {
      edges {
        node {
          id
          tokenHash
          revisionHash
          issuedAt
          expiresAt
          revokedAt
          quotationId
          quotation { id }
        }
      }
    }
  }`;

// One round-trip for the display name of whichever relation the quotation points at.
// Returns null when the quotation has no customer yet, so callers never issue an
// empty selection set (which GraphQL rejects).
export const buildQuotationCustomerNameQuery = ({
  personId,
  companyId,
}: {
  personId: string | null;
  companyId: string | null;
}): string | null => {
  const roots: string[] = [];

  if (personId !== null && personId.trim() !== '') {
    roots.push(
      `person(filter: { id: { eq: ${toGraphqlLiteral(personId)} } }) { id name { firstName lastName } }`,
    );
  }

  if (companyId !== null && companyId.trim() !== '') {
    roots.push(
      `company(filter: { id: { eq: ${toGraphqlLiteral(companyId)} } }) { id name }`,
    );
  }

  return roots.length === 0
    ? null
    : `query QuotationCustomerName { ${roots.join('\n')} }`;
};

export const buildQuotationCustomerViewQuery = (quotationId: string): string =>
  `query QuotationCustomerView {
    quotation(filter: { id: { eq: ${toGraphqlLiteral(quotationId)} } }) {
      id status
    }
  }`;
