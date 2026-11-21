// Endpoint paths exactly as the Asan API guide (LinqToAsan.Web) documents them. Kept in one
// place so a change to a path is a visible change to a documented surface, not a string
// edited somewhere inside a service.
//
// The guide describes no authentication mechanism and no versioned base path, so the base
// address is configuration and the connector refuses writes over a transport nobody
// approved.
export const ASAN_ENDPOINTS = {
  // Cheap read used as the health probe: it exercises address, transport and response shape
  // without touching a document or a counter.
  lastProducts: 'ProductsNew/LastProducts',
  allProducts: 'ProductsNew/AllProducts',
  oneProduct: 'ProductsNew/OneProduct',
  addProduct: 'Products4/AddProduct',
  editProduct: 'Products3/EditProduct',
  allCustomers: 'CustomersNew/AllCustomers',
  oneCustomer: 'CustomersNew/OneCustomer',
  customerByNationalCode: 'CustomersNew/CustomerWithNationalCode',
  addCustomer: 'Customers/postCustomer',
  editCustomer: 'Customers2/postCustomer',
  registerProforma: 'PishFactors/RegisterPishFactor',
  lastPishFactors: 'PishFactorsNew/LastPishFactors',
} as const;

export const buildAsanUrl = ({
  baseUrl,
  path,
  query,
}: {
  baseUrl: string;
  path: string;
  query?: Record<string, string>;
}): string => {
  const root = baseUrl.trim().replace(/\/+$/, '');
  const suffix =
    query === undefined || Object.keys(query).length === 0
      ? ''
      : `?${Object.entries(query)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join('&')}`;

  return `${root}/${path.replace(/^\/+/, '')}${suffix}`;
};
