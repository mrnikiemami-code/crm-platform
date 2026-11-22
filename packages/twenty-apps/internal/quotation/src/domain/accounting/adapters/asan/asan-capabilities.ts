import { type AdapterCapabilities } from 'src/domain/accounting/capabilities';

// Asan (LinqToAsan.Web) capabilities, derived ENDPOINT BY ENDPOINT from the API guide at
// D:\HaniReference\LinqToAsan-API-Guide.pdf. Nothing here is inferred from the vendor's
// general reputation, and nothing was tested against a live server.
//
// The four limits that shape the whole integration:
//
//  1. NO ITEM FIELD UPDATE, ONLY PRICES. `Products3/EditProduct` is documented as changing
//     only `SellPrice` and the two `SalesPrice` entries, and the guide says name, second
//     line and serial are read and preserved — there is no endpoint that renames a product.
//     So an item rename in the CRM is NOT publishable, and must be reported as manual.
//
//  2. NO ITEM DELETE. No endpoint removes or deactivates a product. Deactivation is a human
//     action inside Asan.
//
//  3. PREREQUISITES ARE REAL. Registering a pro-forma requires the customer AND every
//     product to already exist in Asan; the failure signal is a bare `0`, which the caller
//     cannot distinguish from other refusals without extra checks.
//
//  4. NO DOCUMENTED IDEMPOTENCY. The guide documents no idempotency key and no
//     read-by-request-id. A retried `RegisterPishFactor` after a timeout may therefore
//     create a second pro-forma, so a retry must be reconciled, never blind.
export const ASAN_CAPABILITIES: AdapterCapabilities = {
  items: {
    list: true, // GET ProductsNew/AllProducts, ProductsNew/LastProducts?Count=
    read: true, // GET ProductsNew/OneProduct?ProductCode=
    create: true, // POST Products4/AddProduct with a caller-assigned ProductCode
    // Price-only, per Products3/EditProduct. This is the single most important value in
    // this file: it is what stops a rename being reported as published.
    updateFields: 'PRICE_ONLY',
    delete: false, // no documented delete or deactivate endpoint
    listPrices: true, // GET ProductPriceNew/GetPrice, ProductPriceNew/GetAllPrice
    readStock: true, // GET ProductStatisticsNew/AmarKala, ProductStatisticsNew/ProductStock
  },
  parties: {
    list: true, // GET CustomersNew/AllCustomers, CustomerWithNationalCode, LastCustomers
    read: true, // GET CustomersNew/OneCustomer?CustomerCode=
    create: true, // POST Customers/postCustomer
    update: true, // POST Customers2/postCustomer, keyed by PersonCode
    // PersonCode = 0 makes the server assign the code (max group code + 1, above 101).
    assignsOwnCode: true,
    // The documented create response is only a result code, NOT the assigned PersonCode, so
    // the caller must re-read to learn it. Treating the result code as the identifier would
    // silently store "1" as a customer id.
    returnsAssignedCode: false,
  },
  documents: {
    createProforma: true, // POST PishFactors/RegisterPishFactor
    // Asan's sales invoice exists but is a SEPARATE posted fiscal document. Exposed as a
    // capability so the adapter can describe it, NEVER enabled by a quotation action.
    createInvoice: true,
    readDocuments: true, // POST PishFactorsNew/LastPishFactors, LastCustomerPishFactors
    // The guide documents listing the LAST n documents, not fetching one by id. So a
    // status poll for a specific document is not supported and must not be assumed.
    readById: false,
    updateDocument: false, // only factor STATE can be written, not its lines
    cancelDocument: false, // no documented cancel
    remoteIdempotency: false, // undocumented; assumed absent, which is the safe assumption
    // FactorNumber = 0 means auto-number. The guide documents that a non-zero value
    // DISABLES auto-numbering, so the field accepts a caller number — but Asan's numbering
    // is the one an accountant reconciles against, so this adapter always sends 0.
    acceptsCallerDocumentNumber: true,
  },
  // Asan needs discount, duty and tax as SEPARATE lines carrying the pre-existing item
  // codes 999123 / 999140 / 999141 with Count = 0 — they are not fields on a normal line.
  requiresSpecialItemCodes: true,
  // The guide documents `ProductsNew/AllProducts` and `CustomersNew/AllCustomers` with NO
  // input parameters, and `LastProducts`/`LastCustomers` accept only `Count` — "the last N".
  // There is no offset, page number or cursor anywhere in the guide, so there is no page 2 to
  // ask for. Declaring this as paged would re-download the whole catalog per page.
  readStrategy: 'REMOTE_UNPAGED',
  // The guide documents plain HTTP over a service address with no authentication
  // mechanism. Treated as insecure: a connector must not carry credentials over it without
  // an approved tunnel.
  transportIsSecure: false,
};

// The pre-existing item codes Asan uses for non-product amounts. They must exist in the
// installation before any document that uses them is registered, which is why sending them
// is gated on configuration rather than on a guess.
export const ASAN_SPECIAL_ITEM_CODES = {
  discount: '999123',
  duty: '999140',
  tax: '999141',
} as const;

export type AsanSpecialItemCode =
  (typeof ASAN_SPECIAL_ITEM_CODES)[keyof typeof ASAN_SPECIAL_ITEM_CODES];

// Statuses Asan exposes for a factor's lifecycle. The guide documents the writable
// `Status` parameter of FactorInformation/UpdateFactorState as an int without enumerating
// its values, so the mapping stays explicit and configuration-driven rather than invented.
export const ASAN_MONEY_UNIT_NOTE =
  'The guide shows integer amounts with no currency statement. Confirm the installation unit (rial or toman) before mapping; the CRM stores IRR and must not guess.' as const;
