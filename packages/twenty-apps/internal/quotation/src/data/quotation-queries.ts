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
