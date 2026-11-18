// Stable universal identifiers for the quotation app.
//
// These are generated once and must never change: the platform keys the metadata
// sync on them, so editing one is treated as a different object or field. Values are
// UUID v5 of the app name and the entity path, which makes them reproducible and
// obviously not hand-typed guesses.
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';

export const CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER =
  'b8f829cd-59da-547a-85d8-5fde66aa4bfe';
export const PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER =
  'a60d3be8-9e7b-556c-9129-960671a95d89';
export const PRICE_OBJECT_UNIVERSAL_IDENTIFIER =
  '4a0a3ab4-4740-5b2f-a7b8-ee5fc2ce5cfc';
export const QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER =
  'afaa9a02-5e61-5ba8-8d78-902a057ef187';
export const QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER =
  '0f253c33-b8ec-5450-8c76-4030c607e00e';
export const QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER =
  'b0fe2590-f5b5-58a0-b7dc-0493ee35917d';
export const QUOTATION_SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER =
  'e859ac57-43dc-54ab-a1d2-03fc8ed34a10';
export const ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER =
  'dab886b2-ef12-53e7-93ca-505db4ea16fe';
export const ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER =
  'bd2952f8-d37d-52f7-b22b-35a4bc761864';
export const ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER =
  '2fb711ff-a9c4-5886-81b7-c747b9306c7a';

export const CATALOG_ITEM_FIELDS = {
  name: '50704e35-a848-5ece-a458-7e62b581274f',
  kind: 'c99c7424-6211-5784-8f89-eedf38264123',
  sku: '63ca111f-9a29-573b-9e54-be54dbe491b9',
  unit: '449dc01c-cebc-5569-a9ea-9911dd29cfbb',
  isActive: '86622cae-9041-5a26-80f2-5cf238591f94',
  description: '609565c6-b1ed-5653-b6eb-b2f2e6f9a6cc',
} as const;

export const PRICE_LIST_FIELDS = {
  name: '2e130e0a-93e1-5deb-a362-9c40fd33d099',
  currencyCode: '766451dd-4c95-55f1-bf27-2f96f0cf09e0',
  isDefault: 'c567b7e9-c23c-5061-80ad-0f2a11e5e66d',
} as const;

export const PRICE_FIELDS = {
  item: '61bafa6b-8e95-5738-a7ca-4831a71f8d38',
  priceList: '10288e27-e44a-53e1-9c19-1390ec6234aa',
  unitPriceExact: '2f0d1e01-38f4-5c70-aee5-c971c648508d',
  validFrom: '78c48b86-927b-57e8-b6bb-850e4df92cdf',
  validTo: '135ca101-e5db-535b-81e6-f5be7f8d1262',
} as const;

export const QUOTATION_FIELDS = {
  name: '60155b6e-8458-5387-adcf-770e753410df',
  quotationNumber: '2241c56a-c284-5853-98d2-13f70c258197',
  status: 'd86c1624-f482-5290-ba9c-6bf575ed4025',
  customerType: 'a9152a49-0707-5141-990e-a801e9fef017',
  person: 'e6030469-996b-5dea-8203-06c46173ee7a',
  company: '15781f44-4cee-55d3-add1-d7e6c4aa5a84',
  opportunity: '91b58882-98e7-5c05-9095-2ce463f2ff11',
  currencyCode: 'a0916c12-9176-5674-a363-a65964a4d308',
  taxPolicy: 'b0bf0dd6-17dd-5c24-b34d-dfd9da1727ee',
  paymentTerms: 'cf04f6e1-8c8a-5097-9e1e-8139bfdfcb96',
  expiresAt: 'c32e9743-fd46-58ce-a4fa-9833a1e871ad',
  totalExact: '30552386-2860-5833-9731-0082e6e1ed16',
  version: '20b59a68-8057-5acd-bdb4-f3fdc163d246',
  sentAt: '94934cd7-6b14-5553-ae4a-027bc45c1ae6',
  decidedAt: 'ff678603-1400-543b-b864-a640d3de18ef',
} as const;

export const QUOTATION_LINE_FIELDS = {
  name: '74a6f93d-84f6-5ebe-8b2d-51f65dc6a9a7',
  quotation: '9c6b0729-04e9-5001-a3c3-32b8aec1976f',
  item: 'd13bf4dd-1a9f-527e-940e-5a923a1235ae',
  description: '993ce0c8-f0a6-5408-bdc9-aa81917fc722',
  unit: '3f7ec605-292f-5383-bad8-2f793d40d2c3',
  quantityMilli: '22d64c2f-2a4b-5d7b-9983-be2ef599b2e3',
  unitPriceExact: '65709ed5-88af-5eba-b81a-67547894a274',
  discountExact: 'e2ae7f84-6a92-598d-a168-3d086c3c4d9d',
  taxExact: '2f3ce772-0169-5895-b580-8aa6c7be41ec',
  totalExact: '58d8751e-476a-501c-9cdb-6bf88162598a',
  sortOrder: 'bf46f321-d0a6-5f77-a80c-1738a9044df1',
} as const;

export const QUOTATION_REVISION_FIELDS = {
  name: 'a97ef40e-cc40-5ed1-a309-be383dbc651a',
  quotation: 'c4bb5680-2e95-5058-9a17-a6eaa239d6a6',
  version: '5df63179-5931-573a-9791-df95622e4189',
  status: '7122fdde-7b06-57d5-9751-4d8516db2586',
  snapshotJson: '0e2c1864-fa7a-553c-a358-1e26575a7559',
  snapshotHash: 'e0d2fc20-1cb1-53b0-84e3-360441747929',
  totalExact: '268b58a4-5b4c-5b7d-b121-bf88be19a9b6',
  issuedAt: '5ea5fc9e-3a50-5442-8f58-39df1cc0ba10',
  issuedBy: 'd39cb4d5-5fb8-5013-97a6-8b9ba8dede9b',
} as const;

export const QUOTATION_SEQUENCE_FIELDS = {
  name: 'eaa5d3bb-03ae-55fd-83a5-702d522f877a',
  scopeKey: '2f19974c-36c1-56ae-a157-15ccd468772f',
  lastIssued: '1eee96fd-67fe-5ca7-96d7-71db6c3a6e7b',
  width: '676e31bc-28db-5612-b9a2-ae0c7b7df5bb',
} as const;

export const ACCOUNTING_CONNECTION_FIELDS = {
  name: 'c6868a67-5ff5-5485-8cfc-acd3f83296e6',
  adapterId: '299ce88f-9a97-5712-a14c-b4c4dc994f19',
  adapterVersion: '4b43f20f-f1a6-5176-b531-6b8cd8aa09fd',
  capabilities: '00247aaa-1647-59e2-9d8b-184d16263f7c',
  isActive: '5a2511cb-f67f-531b-91ef-1bb871a927c4',
  lastHealthCheckAt: '3100cdfc-79d2-5cfa-be34-4313b9b8a8cf',
} as const;

export const ACCOUNTING_ITEM_LINK_FIELDS = {
  name: '3e9cd605-732b-5b0d-80fe-61886b0e0127',
  connection: 'f92d430d-9d45-5266-b10a-c8541483c11b',
  item: '39e28383-9d6d-5ea3-a89c-e05e92d4e1c9',
  externalItemId: '5ef9a90d-157b-5c48-b93c-ff725aef115d',
  externalCode: '3bdfae2e-b26f-5933-91c0-c1773c1681d1',
  remoteVersion: '12855f1e-4456-5366-afcf-393a5f1951f4',
  lastSyncedAt: 'ee2ff19b-63fe-5682-8131-29fedfb29262',
  syncStatus: '9c4399a3-62f2-5653-a581-f1e1fc8e19ae',
} as const;

export const ACCOUNTING_SYNC_OPERATION_FIELDS = {
  name: 'f036cc0a-db85-54a7-9460-14d5aa308f6a',
  connection: '56e4f90a-0374-56fa-8342-2b171589d415',
  kind: 'b6731bd2-a951-5884-9bd5-674b879ce254',
  internalEntityId: 'f267f78f-d98a-5761-9bc6-9232315030ac',
  internalRevision: '2b2e1f8b-01a0-53dd-ac63-8a6cce4e86dc',
  state: '1dc3dda5-2d58-54b8-9806-3c895590d006',
  attempts: 'f71620e7-6640-59cd-9c6d-237703c67ab6',
  externalDocumentId: '3adea04d-c79b-567c-b1ff-0398ad6c5a8c',
  errorCode: '0ed0d4b6-44e1-5bf5-bd0b-8d902e604415',
  correlationId: '2c7a62b8-c7a1-582a-a785-21a2d13f5a6b',
} as const;

// Reciprocal relation fields. A relation is declared on both objects, so the "many"
// side in the constants above always has a partner here. Each one contributes a field
// to the target object, which is why adding a relation is two identifiers, not one.
export const RELATION_FIELDS = {
  personQuotations: 'ba1c70b7-e58a-5db6-9580-49ff1eae54fe',
  companyQuotations: 'f64b356d-537e-50ab-a368-bc693484a403',
  opportunityQuotations: 'c2e9805b-d303-57d3-9edb-eaf336e105b6',
  quotationLines: 'f409170f-11d6-5ca1-9d3d-adfc1c21454b',
  quotationRevisions: '8f10d5a0-ca85-57c8-ab6a-f531935cfc30',
  catalogItemQuotationLines: '56b6c96d-e4fa-58f2-ab0e-30172b48e577',
  catalogItemPrices: '2d808b0d-7715-508f-ab08-21776e9fe45b',
  catalogItemAccountingLinks: '8e1f288e-279f-5b57-8c83-5e6e3afebcd3',
  priceListPrices: '6f799474-1cc7-5be0-aaac-0e836cea03b3',
  accountingConnectionItemLinks: '08d76d75-1026-5e01-864c-6e643cff85dc',
  accountingConnectionSyncOperations: '2b9e64a2-8aa6-5471-9431-6a2217658d8d',
} as const;

// SELECT option ids. The `value` of an option is the machine identity and must never
// change; the `label` is workspace-facing copy, authored in Persian because the
// platform has no per-locale label mechanism for app-defined options.
export const SELECT_OPTION_IDS = {
  catalogItemKindProduct: '1c0a9d81-097e-520a-ade1-8dc3cf8a71e3',
  catalogItemKindService: 'e3780965-2438-5ffc-b47f-85b80cb4256c',
  quotationStatusDraft: '4bc09b9f-c854-543d-9e83-897c619750f5',
  quotationStatusPendingApproval: 'a1af64e4-c860-563f-a69f-49f354b96399',
  quotationStatusReadyToSend: '1b1cbd3b-56a5-599b-939c-1adaa460d143',
  quotationStatusSent: 'de48acf0-7ed8-539f-afbf-fc7d833d62c5',
  quotationStatusAccepted: 'f938f00f-d45b-5f7c-ab68-71972010eea2',
  quotationStatusRejected: '88eb944d-5c30-5fbd-a57e-11b6e21e18e5',
  quotationStatusExpired: '55a9b6ef-da61-544d-92e7-eab0ad15a58d',
  quotationStatusCancelled: '21b58d1f-c850-5a84-8979-95b732d9ef05',
  quotationStatusConverted: 'f7212ad1-5cac-5b5c-aead-b2d36c6a85a3',
  quotationCustomerTypePerson: '2cc01117-d477-5e32-8ba0-08329f50e792',
  quotationCustomerTypeCompany: 'f88a61dc-3960-5368-ae01-e26f286709bf',
  revisionStatusIssued: '3eed0515-b2cf-5f0c-96f8-f753e891b985',
  revisionStatusSuperseded: 'f40ae125-cdff-53b3-9119-962633819dea',
  syncStatusLinked: 'ccfb175a-2a65-5560-adf3-c7a7316976df',
  syncStatusPendingPush: '92b26e67-b4dc-50c8-a82c-cfac7bd78ce2',
  syncStatusPendingImport: 'de27325a-7a7f-5ab9-9175-49d4897846c1',
  syncStatusConflict: 'fd24a1b9-4980-5fd7-a647-93afc9ce5fab',
  syncStatusManualExport: 'fbe5b1f5-d9a1-5722-99c9-985fb0fa6854',
  syncStatusRemoteDeleted: 'dc48d848-2665-5acb-ae30-85b473cea6fa',
  operationKindItemCreate: '26eb69e4-06c1-5b4b-9036-74e0dd08b446',
  operationKindItemUpdate: 'b023c85d-d094-5ce4-ac02-82447e546140',
  operationKindItemDeactivate: 'ce9a8bb0-dd32-5a4c-90d8-5771764abce7',
  operationKindRevisionPush: '308faacc-847f-5907-b6eb-f95ec9a84693',
  operationStatePending: '27bb9cb9-4ad7-5f0f-808a-2c5b9e65c40f',
  operationStateInFlight: '3f3cb494-f059-5e24-b58a-d2dbd97dcc59',
  operationStateSucceeded: 'c839d228-2b3d-550d-9fa6-b814ac873d78',
  operationStateFailedRetryable: 'f5b052c8-a70b-516d-a2dd-fdfc6c574fae',
  operationStateFailedFinal: '72437aae-5972-5f40-990b-ab02956cab60',
  operationStateManualExport: '3ace57df-83e8-5d7e-8e0f-db9db5b82e7d',
  operationStateCancelled: 'c02d9586-da59-504b-9341-686632494a55',
} as const;
