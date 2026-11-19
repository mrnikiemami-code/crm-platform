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

export const buildDeleteQuotationLineMutation = (id: string): string =>
  `mutation DeleteQuotationLine { deleteQuotationLine(id: ${toGraphqlLiteral(id)}) { id } }`;

export const buildQuotationByIdQuery = (id: string): string =>
  `query QuotationById { quotation(filter: { id: { eq: ${toGraphqlLiteral(id)} } }) { id status version name } }`;

export const buildQuotationLinesByQuotationQuery = (
  quotationId: string,
): string =>
  `query QuotationLinesByQuotation { quotationLines(filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} } }) { edges { node { id } } } }`;

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
