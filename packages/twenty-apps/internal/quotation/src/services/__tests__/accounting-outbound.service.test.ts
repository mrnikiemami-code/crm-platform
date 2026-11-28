import { describe, expect, it, vi } from 'vitest';

import { RecordApiError } from 'src/data/record-api';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import { hashQuotationRevision, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import {
  executeItemPush,
  executeQuotationExport,
  loadOperations,
  parseOperations,
  previewItemPush,
  previewQuotationExport,
  verifyAsanPrimaryUnit,
} from 'src/services/accounting-outbound.service';

const edges = (root: string, rows: Record<string, unknown>[]) => ({
  [root]: { edges: rows.map((node) => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } },
});

const connectionNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'conn-1',
  name: 'آزمایشی',
  adapterId: 'mock',
  adapterVersion: '2026-11-1',
  isActive: true,
  isDefault: true,
  baseUrl: 'http://mock.invalid',
  remoteUserId: '7',
  defaultStorageId: '2',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: true },
  healthState: 'UNKNOWN',
  lastHealthCheckAt: null,
  lastHealthMessage: null,
  verificationState: 'MOCK',
  ...overrides,
});

const accountingConnections = (...rows: Record<string, unknown>[]) =>
  edges('accountingConnections', rows);

const settings = (overrides: Partial<ConnectionSettings> = {}): ConnectionSettings => ({
  baseUrl: 'https://accounting.example',
  remoteUserId: '7',
  defaultStorageId: '2',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: true },
  taxPolicyMappings: { IR_VAT_9: '64' },
  ...overrides,
});

const flags = (overrides: Record<string, unknown> = {}) => ({
  outboundEnabled: true,
  documentExportEnabled: true,
  maxAttempts: 3,
  reconciled: false,
  ...overrides,
});

const snapshot = (): QuotationRevisionSnapshot => ({
  quotationId: 'q-1',
  version: 2,
  quotationNumber: 'Q-0001',
  currencyCode: 'IRR',
  customerRef: 'company-1',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: '0',
  paymentTerms: null,
  lines: [
    {
      lineId: 'line-1',
      description: 'کالا',
      unit: 'عدد',
      quantityScaled: '1000000',
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
  issuedAt: '2026-11-20T10:00:00.000Z',
});

type QuotationFixture = {
  status?: string;
  quotationId?: string;
  companyId?: string | null;
  personId?: string | null;
  retireAfterClaim?: boolean;
  changeLinkAfterClaim?: boolean;
  loseClaimAfterInsert?: boolean;
  changeClaimFingerprint?: boolean;
};

const quotationExecute = ({
  status = 'READY_TO_SEND',
  quotationId = 'q-1',
  companyId = 'company-1',
  personId = null,
  retireAfterClaim = false,
  changeLinkAfterClaim = false,
  loseClaimAfterInsert = false,
  changeClaimFingerprint = false,
}: QuotationFixture = {}) => {
  let claimed: Record<string, unknown> | null = null;
  return vi.fn(async (query: string) => {
    if (query.includes('QuotationForAccounting')) {
      return {
        quotation: {
          id: quotationId,
          name: 'پیش‌فاکتور آزمون',
          status,
          version: 2,
          currencyCode: 'IRR',
          person: personId === null ? null : { id: personId },
          company: companyId === null ? null : { id: companyId },
        },
        quotationLines: {
          edges: [{ node: { id: 'line-1', item: { id: 'item-1' } } }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    }

    if (query.includes('QuotationRevisionForAccounting')) {
      const seal = { ...snapshot(), customerRef: companyId ?? personId ?? '' };
      return edges('quotationRevisions', [
        { id: 'rev-1', version: 2, snapshotJson: JSON.stringify(seal), snapshotHash: hashQuotationRevision(seal) },
      ]);
    }

    if (query.includes('accountingItemLinks')) {
      return edges('accountingItemLinks', [
        {
          id: 'link-1',
          connection: { id: 'conn-1' },
          externalItemId: changeLinkAfterClaim && claimed ? '1002' : '1001',
          remoteVersion: 'v1',
          syncStatus: 'LINKED',
          item: { id: 'item-1' },
        },
      ]);
    }

    if (query.includes('accountingPartyLinks')) {
      return edges('accountingPartyLinks', companyId !== 'company-1' ? [] : [
        {
          id: 'party-link-1',
          connection: { id: 'conn-1' },
          partyType: 'COMPANY',
          remoteVersion: 'v1',
          externalPartyId: '101',
          internalPartyId: 'company-1',
          syncStatus: 'LINKED',
        },
      ]);
    }

    if (query.includes('accountingSyncOperations')) {
      return edges('accountingSyncOperations', claimed && !loseClaimAfterInsert ?
        [changeClaimFingerprint && query.includes('ReadQuotationClaim') ? { ...claimed, payloadFingerprint: 'tampered' } : claimed] : []);
    }

    if (query.includes('accountingConnections')) {
      return accountingConnections(connectionNode({ isActive: !(retireAfterClaim && claimed) }));
    }

    if (query.includes('CreateQuotationClaim')) {
      const id = /id: "([^"]+)"/.exec(query)?.[1];
      const fingerprint = /payloadFingerprint: "([^"]+)"/.exec(query)?.[1];
      const snapshotLiteral = /payloadSnapshot: ("(?:\\.|[^"\\])*")/.exec(query)?.[1];
      const payloadSnapshot = snapshotLiteral ? JSON.parse(snapshotLiteral) : null;
      claimed = { id, payloadSnapshot, kind: 'QUOTATION_REVISION_PUSH', state: 'IN_FLIGHT',
        internalEntityId: quotationId, internalRevision: 2, attempts: 1, correlationId: id,
        connection: { id: 'conn-1' }, externalDocumentId: null, errorCode: null, payloadFingerprint: fingerprint };
      return { createAccountingSyncOperation: claimed };
    }
    if (query.includes('FinishQuotationClaim')) {
      const state = /state: "([^"]+)"/.exec(query)?.[1];
      const externalDocumentId = /externalDocumentId: "([^"]+)"/.exec(query)?.[1] ?? null;
      const errorCode = /errorCode: "([^"]+)"/.exec(query)?.[1] ?? null;
      claimed = { ...claimed, state, externalDocumentId, errorCode };
      return { updateAccountingSyncOperation: claimed };
    }
    return {};
  });
};

const item = {
  code: '1001',
  name: 'کالای CRM',
  secondaryName: null,
  sellPriceMicros: '1000000.000000',
  salesPriceMicros: [],
};

describe('operation parsing', () => {
  it('reads the ledger rows and ignores incomplete ones', () => {
    expect(
      parseOperations(
        edges('accountingSyncOperations', [
          {
            id: 'op-1',
            kind: 'CATALOG_ITEM_CREATE',
            state: 'SUCCEEDED',
            attempts: 1,
            internalRevision: null,
            externalDocumentId: '1001',
          },
          { id: '', kind: 'X', state: 'Y' },
        ]),
      ),
    ).toEqual([
      {
        id: 'op-1',
        kind: 'CATALOG_ITEM_CREATE',
        state: 'SUCCEEDED',
        attempts: 1,
        internalRevision: null,
        externalDocumentId: '1001',
      },
    ]);
  });

  it('walks the entire ledger with the connection and entity filter and refuses cursor loops', async () => {
    const row = (id: string) => ({ id, kind: 'QUOTATION_REVISION_PUSH', state: 'SUCCEEDED', attempts: 1, internalRevision: 2 });
    const execute = vi.fn(async (query: string) => ({
      accountingSyncOperations: { edges: [{ node: row(query.includes('after:') ? 'second' : 'first') }],
        pageInfo: query.includes('after:') ? { hasNextPage: false } : { hasNextPage: true, endCursor: 'next' } },
    }));
    expect((await loadOperations('conn-1', { execute }, 'q-1')).map((entry) => entry.id)).toEqual(['first','second']);
    expect(execute.mock.calls.every(([query]) => query.includes('conn-1') && query.includes('q-1'))).toBe(true);
    const stuck = vi.fn(async () => ({ accountingSyncOperations: { edges: [],
      pageInfo: { hasNextPage: true, endCursor: 'same' } } }));
    await expect(loadOperations('conn-1', { execute: stuck })).rejects.toThrow('Incomplete operation history');
  });

  it('loads the ledger scoped to the connection', async () => {
    const execute = vi.fn(async (query: string) => {
      expect(query).toContain('accountingSyncOperations');

      return edges('accountingSyncOperations', []);
    });

    expect(await loadOperations('conn-1', { execute })).toEqual([]);
  });
});

describe('item push preview', () => {
  it('plans a create for an unlinked item', async () => {
    const execute = vi.fn(async (query: string) =>
      query.includes('accountingItemLinks')
        ? edges('accountingItemLinks', [])
        : edges('accountingSyncOperations', []),
    );

    const preview = await previewItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute },
    );

    expect(preview).toMatchObject({
      ok: true,
      value: { decision: { kind: 'CREATE' }, link: null },
    });
  });
});

describe('item push execution', () => {
  const ledgerExecute = (overrides: { failCreate?: Error } = {}) => {
    const events: string[] = [];
    let operationExists = false;

    const execute = vi.fn(async (query: string) => {
      if (query.includes('createAccountingSyncOperation')) {
        events.push('begin');
        operationExists = true;

        if (overrides.failCreate !== undefined) {
          throw overrides.failCreate;
        }

        return { createAccountingSyncOperation: { id: 'op-1' } };
      }

      if (query.includes('updateAccountingSyncOperation')) {
        events.push(
          query.includes('FAILED_FINAL') ? 'finish-failed' : 'finish-succeeded',
        );

        return { updateAccountingSyncOperation: { id: 'op-1' } };
      }

      if (query.includes('accountingItemLinks')) {
        return edges('accountingItemLinks', []);
      }

      if (query.includes('accountingSyncOperations')) {
        return edges(
          'accountingSyncOperations',
          operationExists ? [] : [],
        );
      }

      if (query.includes('accountingConnections')) {
        return accountingConnections(connectionNode());
      }

      return {};
    });

    return { execute, events };
  };

  it('records the intent before the vendor call and closes it as succeeded', async () => {
    const { execute, events } = ledgerExecute();
    const adapter = new MockAccountingAdapter();
    const originalCreate = adapter.createItem.bind(adapter);

    adapter.createItem = async (input) => {
      events.push('vendor');
      expect(events).toEqual(['begin', 'vendor']);

      return originalCreate(input);
    };

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter,
        settings: settings(),
        flags: flags(),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: true,
      value: { outcome: 'SUCCEEDED', externalItemId: '1001' },
    });
    expect(events).toEqual(['begin', 'vendor', 'finish-succeeded']);
  });

  it('never calls a live vendor if the persistence authority returns the wrong claim identity', async () => {
    const { execute } = ledgerExecute();
    const adapter = new MockAccountingAdapter();
    Object.defineProperty(adapter, 'isLive', { value: true });
    const create = vi.spyOn(adapter, 'createItem');
    const outcome = await executeItemPush({ connectionId: 'conn-1', internalItemId: 'item-1',
      changedFields: ['price'], adapter, settings: settings(), flags: flags(), item }, { execute });
    expect(outcome).toMatchObject({ ok: false, refusal: { code: 'INVALID_RESPONSE' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses before any write when outbound is off', async () => {
    const execute = vi.fn(async (query: string) =>
      query.includes('accountingConnections')
        ? accountingConnections(connectionNode())
        : {},
    );
    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags({ outboundEnabled: false }),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'OUTBOUND_DISABLED' },
    });
    expect(
      execute.mock.calls.some(([query]) =>
        String(query).includes('createAccountingSyncOperation'),
      ),
    ).toBe(false);
  });

  it('refuses execute when the destination was retired before the write cutoff', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('accountingConnections')) {
        return accountingConnections(connectionNode({ isActive: false }));
      }

      if (query.includes('createAccountingSyncOperation')) {
        throw new Error('ledger must not start for a retired destination');
      }

      return {};
    });

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_INACTIVE' },
    });
    expect(
      execute.mock.calls.some(([query]) =>
        String(query).includes('createAccountingSyncOperation'),
      ),
    ).toBe(false);
  });

  it('closes the operation as failed-final when the unit is unconfirmed', async () => {
    const { execute } = ledgerExecute();
    const adapter = new MockAccountingAdapter();
    adapter.createItem = async () => {
      throw new Error('the vendor must not be called');
    };

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter,
        settings: settings({ moneyUnit: 'UNCONFIRMED' }),
        flags: flags(),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'MONEY_UNIT_UNCONFIRMED' },
    });
    expect(
      execute.mock.calls.some(([query]) => String(query).includes('FAILED_FINAL')),
    ).toBe(true);
  });

  it('refuses an unreadable amount instead of publishing a free product', async () => {
    const { execute } = ledgerExecute();
    const adapter = new MockAccountingAdapter();
    adapter.createItem = async () => {
      throw new Error('the vendor must not be called');
    };

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter,
        settings: settings(),
        flags: flags(),
        item: { ...item, sellPriceMicros: 'not a number' },
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'AMOUNT_NOT_A_DECIMAL' },
    });
  });

  it('reports a duplicate primary key as a duplicate operation, not a generic error', async () => {
    const { execute } = ledgerExecute({
      failCreate: new RecordApiError('QUERY_ERROR', 'duplicate key'),
    });

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'DUPLICATE_OPERATION' },
    });
  });

  it('keeps an auth failure distinguishable from a duplicate', async () => {
    const { execute } = ledgerExecute({
      failCreate: new RecordApiError('FORBIDDEN', 'denied'),
    });

    const outcome = await executeItemPush(
      {
        connectionId: 'conn-1',
        internalItemId: 'item-1',
        changedFields: ['price'],
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
        item,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'FORBIDDEN' },
    });
  });
});

describe('Asan primary unit authority', () => {
  const line = { unitRecordId: 'crm-unit', unitCode: 'UNIT_1', unitAccountingCode: '00100' };
  const observation = { version: '1', externalItemId: '42', crmUnitRecordId: 'crm-unit', vendorUnitId: '7', vendorUnitName: 'عدد' };
  const binding = { externalId: '42', remoteVersion: 'v1', observationVersion: '1', observationJson: JSON.stringify(observation) };
  const remote = { externalItemId: '42', isActive: true, remoteVersion: 'v1', observation: { unitId: '7', unitName: 'عدد' } };
  it('does not confuse CRM accounting code with vendor ProductUnitID', () => {
    expect(verifyAsanPrimaryUnit(line, binding, remote)).toBe(true);
    expect(verifyAsanPrimaryUnit({ ...line, unitAccountingCode: '' }, binding, remote)).toBe(false);
  });
  it('rejects unknown/changed mappings, remote versions and primary units', () => {
    expect(verifyAsanPrimaryUnit({ ...line, unitRecordId: 'other' }, binding, remote)).toBe(false);
    expect(verifyAsanPrimaryUnit(line, { ...binding, observationJson: null }, remote)).toBe(false);
    expect(verifyAsanPrimaryUnit(line, binding, { ...remote, remoteVersion: 'v2' })).toBe(false);
    expect(verifyAsanPrimaryUnit(line, binding, { ...remote, observation: { unitId: '8', unitName: 'کیلو' } })).toBe(false);
    expect(verifyAsanPrimaryUnit(line, binding, { ...remote, isActive: false })).toBe(false);
  });
});

describe('quotation export', () => {
  it('previews a ready, approved, rial quotation without writing', async () => {
    const execute = quotationExecute();
    const preview = await previewQuotationExport(
      {
        connectionId: 'conn-1',
        quotationId: 'q-1',
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute },
    );

    expect(preview).toMatchObject({
      ok: true,
      value: {
        decision: { kind: 'READY' },
        quotationStatus: 'READY_TO_SEND',
        revisionVersion: 2,
      },
    });
    expect(execute.mock.calls.every(([query]) => !String(query).includes('mutation'))).toBe(
      true,
    );
  });

  it('never previews a draft as exportable', async () => {
    const preview = await previewQuotationExport(
      {
        connectionId: 'conn-1',
        quotationId: 'q-1',
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute: quotationExecute({ status: 'DRAFT' }) },
    );

    expect(preview).toMatchObject({
      ok: true,
      value: { decision: { kind: 'BLOCKED', code: 'QUOTATION_NOT_APPROVED' } },
    });
  });

  it('blocks when the customer has no vendor link', async () => {
    const execute = quotationExecute({ companyId: 'company-unlinked' });

    const preview = await previewQuotationExport(
      {
        connectionId: 'conn-1',
        quotationId: 'q-1',
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute },
    );

    expect(preview).toMatchObject({
      ok: true,
      value: { decision: { kind: 'BLOCKED', code: 'CUSTOMER_NOT_LINKED' } },
    });
  });

  it('registers the document only for an approved quotation and records the operation', async () => {
    const execute = quotationExecute();

    const outcome = await executeQuotationExport(
      {
        connectionId: 'conn-1',
        quotationId: 'q-1',
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: true,
      value: { externalDocumentId: '500', documentNumber: '500' },
    });
    expect(
      execute.mock.calls.some(([query]) => String(query).includes('IN_FLIGHT')),
    ).toBe(true);
    expect(
      execute.mock.calls.some(([query]) => String(query).includes('"SUCCEEDED"')),
    ).toBe(true);
  });

  it.each([
    [{ retireAfterClaim: true }, 'CONNECTION_INACTIVE'],
    [{ changeLinkAfterClaim: true }, 'REVISION_MISMATCH'],
    [{ loseClaimAfterInsert: true }, 'RECONCILIATION_REQUIRED'],
    [{ changeClaimFingerprint: true }, 'RECONCILIATION_REQUIRED'],
  ] as const)('never dispatches after the claim cutoff changes: %j', async (fixture, code) => {
    const execute = quotationExecute(fixture);
    const adapter = new MockAccountingAdapter();
    const dispatch = vi.spyOn(adapter, 'registerProforma');
    const outcome = await executeQuotationExport({
      connectionId: 'conn-1', quotationId: 'q-1', adapter, settings: settings(), flags: flags(),
    }, { execute });
    expect(outcome).toMatchObject({ ok: false, refusal: { code } });
    expect(dispatch).not.toHaveBeenCalled();
    expect(execute.mock.calls.some(([query]) => query.includes('CreateQuotationClaim'))).toBe(true);
    expect(execute.mock.calls.some(([query]) => query.includes('FinishQuotationClaim') && query.includes('"CANCELLED"'))).toBe(!('loseClaimAfterInsert' in fixture) && !('changeClaimFingerprint' in fixture));
  });

  it('retains an uncertain dispatch as reconciliation required and does not replay it', async () => {
    const execute = quotationExecute();
    const adapter = new MockAccountingAdapter();
    const dispatch = vi.spyOn(adapter, 'registerProforma').mockRejectedValueOnce(new Error('transport disconnected'));
    const input = { connectionId: 'conn-1', quotationId: 'q-1', adapter, settings: settings(), flags: flags() };
    const outcome = await executeQuotationExport(input, { execute });
    expect(outcome).toMatchObject({ ok: false, refusal: { code: 'RECONCILIATION_REQUIRED' } });
    expect(execute.mock.calls.some(([query]) => query.includes('FinishQuotationClaim') && query.includes('"MANUAL_EXPORT_REQUIRED"'))).toBe(true);
    expect((await executeQuotationExport(input, { execute })).ok).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('refuses a draft before reading a revision or writing an operation', async () => {
    const execute = quotationExecute({ status: 'DRAFT' });

    const outcome = await executeQuotationExport(
      {
        connectionId: 'conn-1',
        quotationId: 'q-1',
        adapter: new MockAccountingAdapter(),
        settings: settings(),
        flags: flags(),
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'QUOTATION_NOT_APPROVED' },
    });
    expect(
      execute.mock.calls.some(([query]) => String(query).includes('mutation')),
    ).toBe(false);
  });
});
