import { describe, expect, it } from 'vitest';

import { type AdapterCapabilities, NO_CAPABILITIES } from 'src/domain/accounting/capabilities';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import {
  planItemPush,
  planQuotationExport,
  QUOTATION_EXPORTABLE_STATUSES,
  type QuotationExportInput,
} from 'src/domain/accounting/outbound-plan';
import { buildAccountingOperationId } from 'src/domain/accounting/sync-operation';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

const FULL: AdapterCapabilities = {
  items: {
    list: true,
    read: true,
    create: true,
    updateFields: 'ALL',
    delete: true,
    listPrices: true,
    readStock: true,
  },
  parties: {
    list: true,
    read: true,
    create: true,
    update: true,
    assignsOwnCode: true,
    returnsAssignedCode: true,
  },
  documents: {
    createProforma: true,
    createInvoice: true,
    readDocuments: true,
    readById: true,
    updateDocument: true,
    cancelDocument: true,
    remoteIdempotency: true,
    acceptsCallerDocumentNumber: true,
  },
  requiresSpecialItemCodes: false,
  transportIsSecure: true,
  taxHandling: 'TAX_RATE',
  dutyHandling: 'DUTY_RATE',
  currencyHandling: 'SINGLE_CURRENCY',
  baseCurrency: 'IRR',
  readStrategy: 'REMOTE_PAGED',
};

const settings = (overrides: Partial<ConnectionSettings> = {}): ConnectionSettings => ({
  baseUrl: 'https://accounting.example',
  remoteUserId: '7',
  defaultStorageId: '',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: true },
  taxPolicyMappings: { IR_VAT_9: '64' },
  ...overrides,
});

const snapshot = (
  overrides: Partial<QuotationRevisionSnapshot> = {},
): QuotationRevisionSnapshot => ({
  quotationId: 'q-1',
  version: 2,
  quotationNumber: 'Q-0001',
  currencyCode: 'IRR',
  customerRef: 'company:c-1',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: '900',
  paymentTerms: null,
  lines: [
    {
      lineId: 'line-1',
      description: 'کالا',
      unit: 'عدد',
      quantityScaled: '1',
      unitPriceMicros: '1100000000000',
      discountMicros: '0',
      taxMicros: '100000000000',
      totalMicros: '1100000000000',
    },
  ],
  totals: {
    grossMicros: '1100000000000',
    discountMicros: '0',
    netMicros: '1000000000000',
    taxMicros: '100000000000',
    totalMicros: '1100000000000',
  },
  issuedAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

const exportInput = (
  overrides: Partial<QuotationExportInput> = {},
): QuotationExportInput => ({
  connectionId: 'conn-1',
  quotation: { id: 'q-1', status: 'READY_TO_SEND', version: 2, currencyCode: 'IRR' },
  revision: { version: 2, snapshot: snapshot() },
  customerExternalId: '101',
  lineLinks: [{ lineId: 'line-1', externalItemId: '1001' }],
  capabilities: FULL,
  settings: settings(),
  outboundEnabled: true,
  documentExportEnabled: true,
  existingOperations: [],
  maxAttempts: 3,
  reconciled: false,
  ...overrides,
});

describe('item push planning', () => {
  const base = {
    connectionId: 'conn-1',
    internalItemId: 'item-1',
    changedFields: ['price'],
    capabilities: FULL,
    link: null,
    existingOperations: [],
    maxAttempts: 3,
    reconciled: false,
  };

  it('creates when there is no link, with a deterministic operation id', () => {
    const decision = planItemPush(base);

    expect(decision).toMatchObject({ kind: 'CREATE', kindOfOperation: 'CATALOG_ITEM_CREATE' });
    expect(decision.kind === 'CREATE' && decision.operationId).toBe(
      buildAccountingOperationId({
        connectionId: 'conn-1',
        kind: 'CATALOG_ITEM_CREATE',
        internalEntityId: 'item-1',
        internalRevision: null,
      }),
    );
  });

  it('updates prices when a link exists', () => {
    expect(
      planItemPush({ ...base, link: { externalItemId: '1001', remoteVersion: 'v1' } }),
    ).toMatchObject({ kind: 'UPDATE_PRICES' });
  });

  it('does not repeat a succeeded operation', () => {
    const operationId = buildAccountingOperationId({
      connectionId: 'conn-1',
      kind: 'CATALOG_ITEM_CREATE',
      internalEntityId: 'item-1',
      internalRevision: null,
    });

    expect(
      planItemPush({
        ...base,
        existingOperations: [
          {
            id: operationId,
            kind: 'CATALOG_ITEM_CREATE',
            state: 'SUCCEEDED',
            attempts: 1,
            internalRevision: null,
            externalDocumentId: '1009',
          },
        ],
      }),
    ).toEqual({ kind: 'ALREADY_SUCCEEDED', operationId });
  });

  it('reports an in-flight operation instead of sending twice', () => {
    const operationId = buildAccountingOperationId({
      connectionId: 'conn-1',
      kind: 'CATALOG_ITEM_CREATE',
      internalEntityId: 'item-1',
      internalRevision: null,
    });

    expect(
      planItemPush({
        ...base,
        existingOperations: [
          {
            id: operationId,
            kind: 'CATALOG_ITEM_CREATE',
            state: 'IN_FLIGHT',
            attempts: 1,
            internalRevision: null,
            externalDocumentId: null,
          },
        ],
      }).kind,
    ).toBe('IN_PROGRESS');
  });

  it('stops retrying once attempts are exhausted', () => {
    const operationId = buildAccountingOperationId({
      connectionId: 'conn-1',
      kind: 'CATALOG_ITEM_CREATE',
      internalEntityId: 'item-1',
      internalRevision: null,
    });

    expect(
      planItemPush({
        ...base,
        existingOperations: [
          {
            id: operationId,
            kind: 'CATALOG_ITEM_CREATE',
            state: 'FAILED_RETRYABLE',
            attempts: 3,
            internalRevision: null,
            externalDocumentId: null,
          },
        ],
      }),
    ).toMatchObject({ kind: 'BLOCKED', code: 'RETRY_NOT_ALLOWED' });
  });

  it('refuses when the remote record moved under us', () => {
    expect(
      planItemPush({
        ...base,
        link: { externalItemId: '1001', remoteVersion: 'v1' },
        observedRemoteVersion: 'v2',
      }),
    ).toMatchObject({ kind: 'CONFLICT', code: 'CONFLICT_REMOTE_CHANGED' });
  });

  it('refuses a rename when the vendor only edits prices', () => {
    const priceOnly: AdapterCapabilities = {
      ...FULL,
      items: { ...FULL.items, updateFields: 'PRICE_ONLY' },
    };

    expect(
      planItemPush({
        ...base,
        link: { externalItemId: '1001', remoteVersion: 'v1' },
        changedFields: ['name'],
        capabilities: priceOnly,
      }),
    ).toMatchObject({ kind: 'BLOCKED', code: 'FIELD_SCOPE_EXCLUDES_FIELDS' });
  });

  it('reports manual export instead of pretending an unsupported create happened', () => {
    expect(
      planItemPush({ ...base, capabilities: NO_CAPABILITIES }),
    ).toMatchObject({ kind: 'BLOCKED', code: 'CAPABILITY_MISSING' });
  });
});

describe('quotation export gate', () => {
  it('never exports a draft', () => {
    expect(
      planQuotationExport(
        exportInput({
          quotation: { id: 'q-1', status: 'DRAFT', version: 2, currencyCode: 'IRR' },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'QUOTATION_NOT_APPROVED' });
  });

  it('never exports pending internal approval', () => {
    expect(
      planQuotationExport(
        exportInput({
          quotation: {
            id: 'q-1',
            status: 'PENDING_INTERNAL_APPROVAL',
            version: 2,
            currencyCode: 'IRR',
          },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'QUOTATION_NOT_APPROVED' });
  });

  it('knows exactly which statuses are exportable', () => {
    expect([...QUOTATION_EXPORTABLE_STATUSES]).toEqual([
      'READY_TO_SEND',
      'SENT',
      'CUSTOMER_ACCEPTED',
    ]);
  });

  it('is READY for an approved rial quotation with linked customer and lines', () => {
    const decision = planQuotationExport(exportInput());

    expect(decision).toMatchObject({
      kind: 'READY',
      amountLines: [{ lineId: 'line-1', priceUnits: 1_000_000 }],
    });
  });

  it('blocks multi-policy revisions until an adapter proves MULTI_TAX support', () => {
    expect(
      planQuotationExport(
        exportInput({
          revision: {
            version: 2,
            snapshot: snapshot({
              lines: [
                {
                  lineId: 'line-1',
                  description: 'کالا',
                  unit: 'عدد',
                  quantityScaled: '1',
                  unitPriceMicros: '1000000000000',
                  discountMicros: '0',
                  taxMicros: '90000000000',
                  totalMicros: '1090000000000',
                  taxPolicy: 'IR_VAT_9',
                  taxRateBasisPoints: '900',
                  dutyRateBasisPoints: '0',
                },
                {
                  lineId: 'line-2',
                  description: 'خدمت',
                  unit: 'ساعت',
                  quantityScaled: '1',
                  unitPriceMicros: '1000000000000',
                  discountMicros: '0',
                  taxMicros: '90000000000',
                  totalMicros: '1090000000000',
                  taxPolicy: 'SPLIT_6_3',
                  taxRateBasisPoints: '600',
                  dutyRateBasisPoints: '300',
                },
              ],
            }),
          },
          lineLinks: [
            { lineId: 'line-1', externalItemId: '1001' },
            { lineId: 'line-2', externalItemId: '1002' },
          ],
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'MULTI_TAX_UNSUPPORTED' });
  });

  it('blocks while outbound writes are off', () => {
    expect(planQuotationExport(exportInput({ outboundEnabled: false }))).toMatchObject({
      kind: 'BLOCKED',
      code: 'OUTBOUND_DISABLED',
    });
  });

  it('blocks while document export lacks its own approval', () => {
    expect(
      planQuotationExport(exportInput({ documentExportEnabled: false })),
    ).toMatchObject({ kind: 'BLOCKED', code: 'DOCUMENT_EXPORT_DISABLED' });
  });

  it('blocks without an approved transport', () => {
    expect(
      planQuotationExport(
        exportInput({ settings: settings({ transportApproved: false }) }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'TRANSPORT_NOT_APPROVED' });
  });

  it('blocks a non-rial quotation', () => {
    expect(
      planQuotationExport(
        exportInput({
          quotation: { id: 'q-1', status: 'READY_TO_SEND', version: 2, currencyCode: 'USD' },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'CURRENCY_NOT_IRR' });
  });

  it('blocks an unconfirmed money unit before any amount is transferred', () => {
    expect(
      planQuotationExport(
        exportInput({ settings: settings({ moneyUnit: 'UNCONFIRMED' }) }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'MONEY_UNIT_UNCONFIRMED' });
  });

  it('does not ask a rate destination for a fiscal code', () => {
    expect(
      planQuotationExport(
        exportInput({ settings: settings({ taxPolicyMappings: {} }) }),
      ),
    ).toMatchObject({ kind: 'READY' });
  });

  it('refuses a taxed document when the destination has no tax contract', () => {
    expect(
      planQuotationExport(
        exportInput({ capabilities: { ...FULL, taxHandling: 'UNSUPPORTED' } }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'TAX_UNSUPPORTED' });
  });

  it('does not ask a single-currency destination for a currency code', () => {
    expect(
      planQuotationExport(
        exportInput({
          capabilities: { ...FULL, currencyHandling: 'SINGLE_CURRENCY' },
          settings: settings({ financial: { ...settings().financial!, currencyMappings: {} } }),
        }),
      ),
    ).toMatchObject({ kind: 'READY' });
  });

  it('blocks a code-based destination until the document currency is mapped', () => {
    expect(
      planQuotationExport(
        exportInput({ capabilities: { ...FULL, currencyHandling: 'CURRENCY_CODE' } }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'CURRENCY_CODE_MAPPING_REQUIRED' });
  });

  it('blocks a taxed document whose policy has no vendor tax code', () => {
    expect(
      planQuotationExport(
        exportInput({
          // A code-based destination is the only one that can miss a fiscal mapping.
          capabilities: { ...FULL, taxHandling: 'TAX_CODE' },
          settings: settings({ taxPolicyMappings: {} }),
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'TAX_POLICY_NOT_MAPPED' });
  });

  it('blocks when the mapping exists only for a different policy code', () => {
    expect(
      planQuotationExport(
        exportInput({
          capabilities: { ...FULL, taxHandling: 'TAX_CODE' },
          settings: settings({ taxPolicyMappings: { TAX_1000: '999142' } }),
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'TAX_POLICY_NOT_MAPPED' });
  });

  it('maps the policy actually sealed on the document, not the legacy default', () => {
    const decision = planQuotationExport(
      exportInput({
        settings: settings({ taxPolicyMappings: { TAX_1000: '999142' } }),
        revision: {
          version: 2,
          snapshot: snapshot({ taxPolicy: 'TAX_1000', taxRateBasisPoints: '1000' }),
        },
      }),
    );

    expect(decision).toMatchObject({ kind: 'READY' });
  });

  it('needs no mapping for an exempt document that carries no tax', () => {
    const decision = planQuotationExport(
      exportInput({
        settings: settings({ taxPolicyMappings: {} }),
        revision: {
          version: 2,
          snapshot: snapshot({
            taxPolicy: 'TAX_0',
            taxRateBasisPoints: '0',
            lines: [
              {
                lineId: 'line-1',
                description: 'کالا',
                unit: 'عدد',
                quantityScaled: '1',
                unitPriceMicros: '1000000000000',
                discountMicros: '0',
                taxMicros: '0',
                totalMicros: '1000000000000',
              },
            ],
            totals: {
              grossMicros: '1000000000000',
              discountMicros: '0',
              netMicros: '1000000000000',
              taxMicros: '0',
              totalMicros: '1000000000000',
            },
          }),
        },
      }),
    );

    expect(decision).toMatchObject({ kind: 'READY' });
  });

  it('blocks when the customer has no vendor id', () => {
    expect(
      planQuotationExport(exportInput({ customerExternalId: null })),
    ).toMatchObject({ kind: 'BLOCKED', code: 'CUSTOMER_NOT_LINKED' });
  });

  it('blocks when a line has no linked product', () => {
    expect(
      planQuotationExport(exportInput({ lineLinks: [] })),
    ).toMatchObject({ kind: 'BLOCKED', code: 'LINE_HAS_NO_PRODUCT_LINK' });
  });

  it('blocks when the revision belongs to another quotation', () => {
    expect(
      planQuotationExport(
        exportInput({
          revision: { version: 2, snapshot: snapshot({ quotationId: 'q-2' }) },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'REVISION_MISMATCH' });
  });

  it('blocks a discount when the vendor special code is not configured', () => {
    expect(
      planQuotationExport(
        exportInput({
          settings: settings({ specialCodes: { discount: false, duty: false, tax: true } }),
          revision: {
            version: 2,
            snapshot: snapshot({
              totals: {
                grossMicros: '1100000000000',
                discountMicros: '50000000000',
                netMicros: '1000000000000',
                taxMicros: '100000000000',
                totalMicros: '1050000000000',
              },
            }),
          },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'SPECIAL_CODE_NOT_CONFIGURED' });
  });

  it('refuses an amount with a fraction of a rial', () => {
    expect(
      planQuotationExport(
        exportInput({
          revision: {
            version: 2,
            snapshot: snapshot({
              lines: [
                {
                  lineId: 'line-1',
                  description: 'کالا',
                  unit: 'عدد',
                  quantityScaled: '1',
                  unitPriceMicros: '500000',
                  discountMicros: '0',
                  taxMicros: '0',
                  totalMicros: '500000',
                },
              ],
            }),
          },
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'AMOUNT_NOT_WHOLE_UNIT' });
  });

  it('reports an already exported revision instead of duplicating the document', () => {
    const operationId = buildAccountingOperationId({
      connectionId: 'conn-1',
      kind: 'QUOTATION_REVISION_PUSH',
      internalEntityId: 'q-1',
      internalRevision: 2,
    });

    expect(
      planQuotationExport(
        exportInput({
          existingOperations: [
            {
              id: operationId,
              kind: 'QUOTATION_REVISION_PUSH',
              state: 'SUCCEEDED',
              attempts: 1,
              internalRevision: 2,
              externalDocumentId: '500',
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'ALREADY_EXPORTED', operationId, externalDocumentId: '500' });
  });

  it('requires reconciliation before retrying a vendor without idempotency', () => {
    const operationId = buildAccountingOperationId({
      connectionId: 'conn-1',
      kind: 'QUOTATION_REVISION_PUSH',
      internalEntityId: 'q-1',
      internalRevision: 2,
    });

    const noIdempotency: AdapterCapabilities = {
      ...FULL,
      documents: { ...FULL.documents, remoteIdempotency: false },
    };

    expect(
      planQuotationExport(
        exportInput({
          capabilities: noIdempotency,
          existingOperations: [
            {
              id: operationId,
              kind: 'QUOTATION_REVISION_PUSH',
              state: 'FAILED_RETRYABLE',
              attempts: 1,
              internalRevision: 2,
              externalDocumentId: null,
            },
          ],
        }),
      ),
    ).toMatchObject({ kind: 'BLOCKED', code: 'RECONCILIATION_REQUIRED' });

    expect(
      planQuotationExport(
        exportInput({
          capabilities: noIdempotency,
          reconciled: true,
          existingOperations: [
            {
              id: operationId,
              kind: 'QUOTATION_REVISION_PUSH',
              state: 'FAILED_RETRYABLE',
              attempts: 1,
              internalRevision: 2,
              externalDocumentId: null,
            },
          ],
        }),
      ),
    ).toMatchObject({ kind: 'RETRY', requiresReconciliationBeforeRetry: true });
  });

  // The same control the preview runs. A code that disagrees with the sealed policy is a
  // refusal at dispatch, not a warning someone can scroll past.
  describe('destination tax code verification', () => {
    const coded: AdapterCapabilities = {
      ...FULL,
      taxHandling: 'TAX_CODE',
      dutyHandling: 'DUTY_WITHIN_POLICY',
    };
    const ninePercent = (overrides: Partial<QuotationRevisionSnapshot> = {}) =>
      snapshot({
        taxRateBasisPoints: '600',
        dutyRateBasisPoints: '300',
        ...overrides,
      });

    it('sends a document whose code matches the sealed rate and split', () => {
      expect(
        planQuotationExport(
          exportInput({
            capabilities: {
              ...coded,
              taxCodeCatalog: [
                {
                  code: '64',
                  label: '۹٪ (۶ + ۳)',
                  totalRateBasisPoints: '900',
                  taxRateBasisPoints: '600',
                  dutyRateBasisPoints: '300',
                },
              ],
            },
            revision: { version: 2, snapshot: ninePercent() },
          }),
        ),
      ).toMatchObject({ kind: 'READY' });
    });

    it('blocks a 9% document mapped to a 10% code', () => {
      expect(
        planQuotationExport(
          exportInput({
            capabilities: {
              ...coded,
              taxCodeCatalog: [
                {
                  code: '64',
                  label: '۱۰٪ (۷ + ۳)',
                  totalRateBasisPoints: '1000',
                  taxRateBasisPoints: '700',
                  dutyRateBasisPoints: '300',
                },
              ],
            },
            revision: { version: 2, snapshot: ninePercent() },
          }),
        ),
      ).toMatchObject({ kind: 'BLOCKED', code: 'TAX_CODE_RATE_MISMATCH' });
    });

    it('blocks a document whose 6+3 policy is mapped to a 5+4 code', () => {
      expect(
        planQuotationExport(
          exportInput({
            capabilities: {
              ...coded,
              taxCodeCatalog: [
                {
                  code: '64',
                  label: '۹٪ (۵ + ۴)',
                  totalRateBasisPoints: '900',
                  taxRateBasisPoints: '500',
                  dutyRateBasisPoints: '400',
                },
              ],
            },
            revision: { version: 2, snapshot: ninePercent() },
          }),
        ),
      ).toMatchObject({ kind: 'BLOCKED', code: 'TAX_CODE_COMPOSITION_MISMATCH' });
    });

    it('still sends when the destination publishes no catalog', () => {
      expect(
        planQuotationExport(
          exportInput({
            capabilities: coded,
            revision: { version: 2, snapshot: ninePercent() },
          }),
        ),
      ).toMatchObject({ kind: 'READY' });
    });
  });
});
