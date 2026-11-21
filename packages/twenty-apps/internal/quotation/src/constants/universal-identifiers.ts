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
export const QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER =
  'e106e576-13f6-59f3-9620-d842dc269f20';
export const QUOTATION_SHARE_OBJECT_UNIVERSAL_IDENTIFIER =
  'b32a8e14-f12c-5745-a38b-69f83627f06b';
export const ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER =
  'dab886b2-ef12-53e7-93ca-505db4ea16fe';
export const ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER =
  'bd2952f8-d37d-52f7-b22b-35a4bc761864';
export const ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER =
  'a3c7e1d5-6b2f-5c48-9d10-4f8e2a7b6c31';
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
  // Read-only projections for the list table. They never replace the exact or
  // relation fields above; the server keeps them in step on write.
  quotationNumberLabel: '4c6e8f90-2153-5d74-be96-5071829304a6',
  customerName: '5d7f9012-3264-5e85-9fa7-6182930415b7',
  totalDisplay: '6e809123-4375-5f96-a0b8-7293041526c8',
  status: 'd86c1624-f482-5290-ba9c-6bf575ed4025',
  customerType: 'a9152a49-0707-5141-990e-a801e9fef017',
  person: 'e6030469-996b-5dea-8203-06c46173ee7a',
  company: '15781f44-4cee-55d3-add1-d7e6c4aa5a84',
  opportunity: '91b58882-98e7-5c05-9095-2ce463f2ff11',
  currencyCode: 'a0916c12-9176-5674-a363-a65964a4d308',
  taxPolicy: 'b0bf0dd6-17dd-5c24-b34d-dfd9da1727ee',
  // The rate the stored tax was computed with. Frozen with the document so a
  // later settings change cannot make a stored amount unexplainable.
  taxRateBasisPoints: 'fc24bf2c-1fd2-5228-bb1c-9fe4450996d5',
  paymentTerms: 'cf04f6e1-8c8a-5097-9e1e-8139bfdfcb96',
  expiresAt: 'c32e9743-fd46-58ce-a4fa-9833a1e871ad',
  totalExact: '30552386-2860-5833-9731-0082e6e1ed16',
  // S2-R8 stored breakdown (IRR micros text) + document discount input.
  // Variant nibble of group 4 must be 8|9|a|b (UUID RFC).
  grossExact: 'a7c4e1b2-9d3f-5a18-8b26-4e5f60718293',
  lineDiscountExact: 'b8d5f2c3-0e40-5b29-9c37-5f6071829304',
  documentDiscountExact: 'c9e603d4-1f51-5c3a-ad48-607182930415',
  netExact: 'daf714e5-2062-5d4b-be59-718293041526',
  taxExact: 'eb0825f6-3173-5e5c-8f6a-829304152637',
  // Independent whole-rial payable adjustment; never folded into taxExact.
  roundingExact: '01920588-313c-536a-b432-13ffc6fd57c5',
  documentDiscountKind: 'fc193607-4284-5f6d-907b-930415263748',
  documentDiscountInputExact: '0d2a4718-5395-507e-a18c-a41526374859',
  version: '20b59a68-8057-5acd-bdb4-f3fdc163d246',
  sentAt: '94934cd7-6b14-5553-ae4a-027bc45c1ae6',
  decidedAt: 'ff678603-1400-543b-b864-a640d3de18ef',
} as const;

export const QUOTATION_LINE_FIELDS = {
  name: '74a6f93d-84f6-5ebe-8b2d-51f65dc6a9a7',
  quotation: '9c6b0729-04e9-5001-a3c3-32b8aec1976f',
  item: 'd13bf4dd-1a9f-527e-940e-5a923a1235ae',
  kind: '6e4c1a8f-2b90-5d41-9c7e-0a1f3b5d7e9c',
  description: '993ce0c8-f0a6-5408-bdc9-aa81917fc722',
  unit: '3f7ec605-292f-5383-bad8-2f793d40d2c3',
  quantityMilli: '22d64c2f-2a4b-5d7b-9983-be2ef599b2e3',
  unitPriceExact: '65709ed5-88af-5eba-b81a-67547894a274',
  grossExact: '1e3b5829-64a6-518f-a29d-b5263748596a',
  discountExact: 'e2ae7f84-6a92-598d-a168-3d086c3c4d9d',
  // The operator's original discount instruction, kept next to the amount it
  // produced so reopening a draft shows "10%" again instead of an amount that
  // silently changes meaning when the quantity is edited later.
  discountKind: 'b7c1d2e3-4f50-5a61-8b72-93a4c5d6e7f8',
  discountInputExact: 'c8d2e3f4-5a61-5b72-9c83-a4b5c6d7e8f9',
  documentDiscountExact: '2f4c693a-75b7-5290-a3ae-c63748596a7b',
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

export const QUOTATION_CUSTOMER_LINK_FIELDS = {
  name: '53b22ea2-1795-5620-b164-56d808f31f8c',
  tokenHash: '1c16db88-0015-5441-8ee5-599154e7d563',
  expiresAt: '5bba7509-f259-5f07-8e8a-a8857027e956',
  revokedAt: '41260cfb-e1c6-5a92-8b89-7e87619a700f',
  issuedAt: 'ac17f8b9-f039-5da7-a603-8f3ceddc331f',
  quotation: '27592826-4e33-572b-9509-69b78e190395',
} as const;

export const QUOTATION_SHARE_FIELDS = {
  name: '8a237b9a-ef45-55ae-8cac-8250384fdf3d',
  channel: 'bea5e0e6-a2ec-533a-9bce-8392bc34284f',
  outcome: 'c08b573f-ead5-5dd9-a2f9-397da39f6aaa',
  customerLabel: '1bc0a5e1-faee-59d5-9d2f-da71f1a5b01b',
  customerPersonId: '9b87635e-4935-5846-9d72-5bed2d161d02',
  customerCompanyId: '45669096-553d-5ccd-ac52-d4516c3e7430',
  linkId: '9e9e58ed-5eeb-5b3c-968b-4461e5c2c235',
  communicationId: 'b3e9a0ac-d8f3-508f-8f47-eecd024d6126',
  providerId: 'ac83c4d1-6370-53e0-82e9-ac6be43b4bee',
  detail: '360c771c-7961-5093-ae2d-9e613ea6af64',
  occurredAt: '615f537b-4164-5fb5-a9e4-1be1cadea442',
  quotation: '37570b0a-a74f-5ab0-aaa0-f07cb5436d24',
} as const;

export const ACCOUNTING_CONNECTION_FIELDS = {
  name: 'c6868a67-5ff5-5485-8cfc-acd3f83296e6',
  adapterId: '299ce88f-9a97-5712-a14c-b4c4dc994f19',
  adapterVersion: '4b43f20f-f1a6-5176-b531-6b8cd8aa09fd',
  capabilities: '00247aaa-1647-59e2-9d8b-184d16263f7c',
  isActive: '5a2511cb-f67f-531b-91ef-1bb871a927c4',
  lastHealthCheckAt: '3100cdfc-79d2-5cfa-be34-4313b9b8a8cf',
  baseUrl: '0ac5e8f1-3b16-5e20-8f71-6a9b2c4d5e01',
  remoteUserId: '1bd6f902-4c27-5f31-9a82-7b0c3d5e6f12',
  defaultStorageId: '2ce70a13-5d38-5042-ab93-8c1d4e6f7013',
  moneyUnit: '3df81b24-6e49-5153-bca4-9d2e5f708114',
  transportApproved: '4e092c35-7f5a-5264-8db5-ae3f60918225',
  specialCodes: '5f1a3d46-806b-5375-9ec6-bf4071a29336',
  healthState: '602b4e57-917c-5486-8fd7-c05182b3a447',
  lastHealthMessage: '713c5f68-a28d-5597-9ae8-d16293c4b558',
  verificationState: '824d6079-b39e-56a8-8bf9-e273a4d5c669',
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

export const ACCOUNTING_PARTY_LINK_FIELDS = {
  name: 'b4d8f2e6-7c30-5d59-ae21-5a9f3b8c7d42',
  externalPartyId: 'c5e9a3f7-8d41-5e6a-bf32-6b0a4c9d8e53',
  externalCode: 'd6f0b4a8-9e52-5f7b-8a43-7c1b5d0e9f64',
  remoteVersion: 'e7a1c5b9-af63-5a8c-9b54-8d2c6e1f0a75',
  lastSyncedAt: 'f8b2d6ca-b074-5b9d-ac65-9e3d7f2a1b86',
  syncStatus: '09c3e7db-c185-5cae-bd76-af4e803b2c97',
  partyType: '1ad4f8ec-d296-5dbf-8e87-b05f914c3da8',
  internalPartyId: '2be509fd-e3a7-5ec0-9f98-c160a25d4eb9',
  connection: '3cf61a0e-f4b8-5fd1-8aa9-d271b36e5fca',
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
  quotationCustomerLinks: '92ea0130-9db1-5e46-a855-6386468dc811',
  quotationShares: '3328de2e-b023-53e0-a299-5419f007a3d6',
  catalogItemQuotationLines: '56b6c96d-e4fa-58f2-ab0e-30172b48e577',
  catalogItemPrices: '2d808b0d-7715-508f-ab08-21776e9fe45b',
  catalogItemAccountingLinks: '8e1f288e-279f-5b57-8c83-5e6e3afebcd3',
  priceListPrices: '6f799474-1cc7-5be0-aaac-0e836cea03b3',
  accountingConnectionItemLinks: '08d76d75-1026-5e01-864c-6e643cff85dc',
  accountingConnectionSyncOperations: '2b9e64a2-8aa6-5471-9431-6a2217658d8d',
  accountingConnectionPartyLinks: '4d072b1f-05c9-50e2-9bba-e382c47f60db',
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
  quotationLineKindProduct: 'a91b2c3d-4e5f-5601-8790-1a2b3c4d5e6f',
  quotationLineKindService: 'b02c3d4e-5f60-5712-9801-2b3c4d5e6f70',
  quotationShareChannelBale: '9b420ba4-d490-5de0-ab5a-a9bfcb2f3315',
  quotationShareChannelWhatsapp: '479ef3ce-8b29-5544-979c-8268d6cff8ed',
  quotationShareChannelTelegram: 'c244c78a-c0e1-5266-9894-be252adce339',
  quotationShareChannelInstagram: '24c881d0-4aad-59db-8a2b-9e16ad307d33',
  quotationShareChannelEitaa: 'de0fe1a6-398b-5fe1-9f94-82a62862abe5',
  quotationShareChannelRubika: '3c237c5c-039c-5c64-87ac-e5942835c453',
  quotationShareChannelSoroush: 'a84d45a2-0cb3-5953-80ea-dbe9bde651e0',
  quotationShareOutcomeManual: 'a7abd2c8-0fae-5de6-bd62-70e92183ede8',
  quotationShareOutcomeSent: '1b2c07f8-250b-5476-8cca-c60fc9080b17',
  quotationShareOutcomeFailed: '5653ba7c-f124-5266-ba71-82a9a10562ed',
  quotationShareOutcomeRefused: 'f9e744ef-b026-5ba0-8aa1-4d945669dda4',
  accountingMoneyUnitUnconfirmed: '5e183c20-16da-51f3-accb-f493d58071ec',
  accountingMoneyUnitRial: '6f294d31-27eb-52a4-bddc-05a4e69182fd',
  accountingMoneyUnitToman: '703a5e42-38fc-53b5-8eed-16b5f7a2930e',
  accountingHealthUnknown: '814b6f53-490d-54c6-9ffe-27c608b3a41f',
  accountingHealthOk: '925c7064-5a1e-55d7-800f-38d719c4b520',
  accountingHealthFailed: 'a36d8175-6b2f-56e8-9110-49e82ad5c631',
  accountingVerificationMock: 'b47e9286-7c30-57f9-a221-5af93be6d742',
  accountingVerificationLiveUnverified:
    'c58fa397-8d41-58aa-b332-6b0a4cf7e853',
  accountingVerificationLiveVerified: 'd690b4a8-9e52-59bb-8443-7c1b5d08f964',
  accountingPartyTypePerson: 'e7a1c5ba-af63-5acc-9554-8d2c6e190a75',
  accountingPartyTypeCompany: 'f8b2d6cb-b074-5bdd-a665-9e3d7f201b86',
} as const;

// S2 UI / runtime entry points. Stable once installed. Variant nibble is 8|9|a|b.
export const QUOTATION_APP_ROLE_UNIVERSAL_IDENTIFIER =
  'c1d2e3f4-a5b6-5789-9012-3456789abcde';

export const CATALOG_ITEMS_VIEW_UNIVERSAL_IDENTIFIER =
  'd2e3f4a5-b6c7-5890-a123-456789bcdef0';
export const QUOTATIONS_VIEW_UNIVERSAL_IDENTIFIER =
  'e3f4a5b6-c7d8-5901-b234-56789cdef012';

export const QUOTATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'a7a2e51f-3a24-53da-b03d-a9984e7a98dc';

export const QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'f4a5b6c7-d8e9-5012-8345-6789def01234';
export const CATALOG_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'a5b6c7d8-e9f0-5123-9456-789ef0123456';

export const CREATE_QUOTATION_FROM_PERSON_COMMAND_UNIVERSAL_IDENTIFIER =
  'b6c7d8e9-f0a1-5234-a567-89f012345678';
export const CREATE_QUOTATION_FROM_COMPANY_COMMAND_UNIVERSAL_IDENTIFIER =
  'c7d8e9f0-a1b2-5345-b678-90123456789a';
export const EDIT_CATALOG_ITEM_COMMAND_UNIVERSAL_IDENTIFIER =
  'd8e9f0a1-b2c3-5456-8789-0123456789ab';
export const NEW_CATALOG_ITEM_COMMAND_UNIVERSAL_IDENTIFIER =
  'e9f0a1b2-c3d4-5567-9890-123456789abc';

export const PREPARE_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'f0a1b2c3-d4e5-5678-8901-23456789abcd';
export const SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a1b2c3d4-e5f6-5789-9012-3456789abcde';
export const SAVE_CATALOG_ITEM_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'b2c3d4e5-f607-5890-a123-456789bcdef0';
export const SEARCH_CATALOG_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '2550d0b0-a3f2-5371-88ef-b0a1f5cc0fa5';
export const CREATE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '802ddc48-2a18-5381-891b-512061cee0dd';
export const REVOKE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a70fdff0-8f75-5356-940d-3acf28d037ad';
export const SHARE_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a4261e8a-5fdd-566d-a713-251dab5a046c';
export const VIEW_CUSTOMER_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '6fd15134-15e6-5885-b861-18a5ab2c22e3';

export const QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'c3d4e5f6-a7b8-5901-8234-56789cdef012';

export const QUOTATION_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  'd4e5f6a7-b8c9-5012-8345-6789def01234';
export const QUOTATION_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER =
  'e5f6a7b8-c9d0-5123-9456-789ef0123456';
export const QUOTATION_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER =
  'f6a7b8c9-d0e1-5234-a567-89f012345678';
export const QUOTATION_ACTIONS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER =
  'a7b8c9d0-e1f2-5345-b678-9f0123456789';
export const QUOTATION_ACTIONS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER =
  'b8c9d0e1-f2a3-5456-8789-0123456789ab';

export const EDIT_QUOTATION_DRAFT_COMMAND_UNIVERSAL_IDENTIFIER =
  'c9d0e1f2-a3b4-5567-9891-0123456789ac';
// The quotation index page has no record selection, so the create entry point is
// its own object-context command; the platform's generic create is closed for
// quotation (isUICreatable: false) precisely so this becomes the only door.
export const CREATE_QUOTATION_FROM_QUOTATIONS_COMMAND_UNIVERSAL_IDENTIFIER =
  'd1e2f3a4-b5c6-5780-a123-456789abcdef';
export const SEARCH_CUSTOMERS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'e2f3a4b5-c6d7-5891-8234-56789abcdef0';

// Accounting bridge entry points. UUID v5 of the app namespace and the entity
// path, same derivation as the identifiers above.
export const ACCOUNTING_CONNECTION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'cddbc58c-4fb2-578d-bd99-9e3dccc51440';
export const ACCOUNTING_IMPORT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'b257fa8c-38a4-5cec-ba65-0cf27634abf9';
export const ACCOUNTING_OUTBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'f55e7a5a-81af-562c-b96b-1f95fb102ec7';

export const ACCOUNTING_CONNECTION_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'e6e84e4a-7fdd-5ea9-87ae-9415927dc0eb';

export const ACCOUNTING_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER =
  'a81f1eb0-1993-5743-bf8f-e71c13cfe7a6';
export const ACCOUNTING_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER =
  'b4b47ec1-1241-5e73-ac9e-28642de2a481';

// Tax policy configuration. Also UUID v5 of the app namespace and the entity
// path; the initial 9% policy is DATA in this object, not a rate in code.
export const TAX_POLICY_OBJECT_UNIVERSAL_IDENTIFIER =
  'cd118c37-176e-5398-9ab9-bd94a050360a';

export const TAX_POLICY_FIELDS = {
  name: '2ee75ed2-95da-55fc-b065-effce219240b',
  code: '6a158a02-5cb2-52a0-b5fc-b8e1bd7f25b6',
  rateBasisPoints: '978bc29a-6dc7-52b6-9710-1f466696cead',
  isDefault: 'c56c91eb-166a-583b-a518-3a5f207b2dc7',
  isActive: '6544a8f9-7dca-5d94-a89f-6198e390f912',
  isExempt: '9fab9fe7-53f3-5c4f-a705-1e2a273dfa9a',
} as const;

export const TAX_POLICY_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '09605adf-c6e9-5f95-98b1-5258c2e633a3';
// The settings surface above only renders from Settings → Applications, which this
// fork hides. The same panel is therefore also registered as a normal front
// component and mounted on a standalone page so administrators can actually reach
// it; the rate logic lives in the panel, not in either host.
export const TAX_POLICY_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '56fc29a2-894a-56ce-acd8-fd6c044b06a4';
export const TAX_POLICY_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  '52593f93-b553-541f-9860-dea946189880';
export const TAX_POLICY_SETTINGS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER =
  '39221868-2df5-526b-b47c-843c28f7e72c';
export const TAX_POLICY_SETTINGS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER =
  'd1739cf5-09b8-563c-a2f6-dfa3143ef4c6';
export const TAX_POLICY_SETTINGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'cf90d325-8207-58fb-b1bd-32e7ea768f4a';
export const TAX_POLICIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '8520069f-3d4f-5b37-85fa-7d170dd67038';
