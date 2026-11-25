import { randomUUID } from 'node:crypto';

import {
  buildAccountingItemLinksQuery,
  buildAccountingOperationsQuery,
  buildAccountingPartyLinksQuery,
  buildCreateAccountingOperationMutation,
  buildQuotationForAccountingQuery,
  buildQuotationRevisionForAccountingQuery,
  buildUpdateAccountingItemLinkMutation,
  buildUpdateAccountingOperationMutation,
} from 'src/data/accounting-queries';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import { requireActiveAccountingConnection } from 'src/services/accounting-connection.service';
import {
  type AccountingAdapter,
  type AccountingMoneyUnit,
} from 'src/domain/accounting/adapter-contract';
import { crmMicrosToAsanUnits } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { mapRevisionToAsanFactor } from 'src/domain/accounting/adapters/asan/asan-factor';
import {
  type QuotationDocumentPreview,
  buildQuotationDocumentPreview,
} from 'src/domain/accounting/document-preview';
import {
  planItemPush,
  planQuotationExport,
  type ItemPushDecision,
  type OperationSnapshot,
  type QuotationExportDecision,
} from 'src/domain/accounting/outbound-plan';
import {
  type AccountingOperationKind,
  type AccountingOperationState,
} from 'src/domain/accounting/sync-operation';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { parseMicrosExact } from 'src/domain/money/micros';

export type OutboundDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
  now?: () => Date;
};

export type OutboundFlags = {
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  maxAttempts: number;
  reconciled: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const readRows = (
  data: Record<string, unknown>,
  root: string,
): Record<string, unknown>[] => {
  const connection = asRecord(data[root]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    return node === null ? [] : [node];
  });
};

export const parseOperations = (
  data: Record<string, unknown>,
): OperationSnapshot[] =>
  readRows(data, 'accountingSyncOperations').flatMap((node) => {
    const id = readString(node.id);
    const kind = readString(node.kind);
    const state = readString(node.state);

    if (id === '' || kind === '' || state === '') {
      return [];
    }

    return [
      {
        id,
        kind: kind as AccountingOperationKind,
        state: state as AccountingOperationState,
        attempts: readNumber(node.attempts) ?? 0,
        internalRevision: readNumber(node.internalRevision),
        externalDocumentId: readString(node.externalDocumentId) || null,
      },
    ];
  });

export const loadOperations = async (
  connectionId: string,
  dependencies: OutboundDependencies = {},
  internalEntityId?: string,
): Promise<OperationSnapshot[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(
    buildAccountingOperationsQuery({
      connectionId,
      ...(internalEntityId === undefined || internalEntityId.trim() === ''
        ? {}
        : { internalEntityId }),
    }),
  );

  return parseOperations(data);
};

type ItemLinkRow = {
  linkId: string;
  externalItemId: string | null;
  internalItemId: string | null;
  remoteVersion: string | null;
};

const loadItemLinks = async (
  connectionId: string,
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<ItemLinkRow[]> =>
  readRows(
    await execute(buildAccountingItemLinksQuery({ connectionId })),
    'accountingItemLinks',
  ).flatMap((node) => {
    const linkId = readString(node.id);

    if (linkId === '') {
      return [];
    }

    return [
      {
        linkId,
        externalItemId: readString(node.externalItemId) || null,
        internalItemId: readString(asRecord(node.item)?.id) || null,
        remoteVersion: readString(node.remoteVersion) || null,
      },
    ];
  });

export const operationName = ({
  kind,
  internalEntityId,
  revision,
}: {
  kind: AccountingOperationKind;
  internalEntityId: string;
  revision: number | null;
}): string =>
  `${kind} ${internalEntityId}${revision === null ? '' : ` rev ${revision}`}`;

const recordOperation = async (
  {
    id,
    connectionId,
    kind,
    internalEntityId,
    internalRevision,
    state,
    attempts,
    externalDocumentId,
    errorCode,
    correlationId,
    isNew,
  }: {
    id: string;
    connectionId: string;
    kind: AccountingOperationKind;
    internalEntityId: string;
    internalRevision: number | null;
    state: AccountingOperationState;
    attempts: number;
    externalDocumentId: string | null;
    errorCode: string | null;
    correlationId: string;
    isNew: boolean;
  },
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<void> => {
  const data = {
    name: operationName({ kind, internalEntityId, revision: internalRevision }),
    kind,
    state,
    internalEntityId,
    internalRevision,
    attempts,
    externalDocumentId,
    errorCode,
    correlationId,
    connectionId,
  };

  if (isNew) {
    await execute(
      buildCreateAccountingOperationMutation({ ...data, id }),
    );
    return;
  }

  await execute(buildUpdateAccountingOperationMutation(id, data));
};

// The operation row exists BEFORE the vendor call, so a crash mid-write leaves an IN_FLIGHT
// record rather than no trace at all. A retry that finds a non-terminal row will not send a
// second write blind.
const beginOperation = async ({
  id,
  connectionId,
  kind,
  internalEntityId,
  internalRevision,
  attempts,
  isNew,
  execute,
}: {
  id: string;
  connectionId: string;
  kind: AccountingOperationKind;
  internalEntityId: string;
  internalRevision: number | null;
  attempts: number;
  isNew: boolean;
  execute: (query: string) => Promise<Record<string, unknown>>;
}): Promise<Result<true>> => {
  try {
    await recordOperation(
      {
        id,
        connectionId,
        kind,
        internalEntityId,
        internalRevision,
        state: 'IN_FLIGHT',
        attempts,
        externalDocumentId: null,
        errorCode: null,
        correlationId: randomUUID(),
        isNew,
      },
      execute,
    );
    return accepted(true);
  } catch (error) {
    if (error instanceof RecordApiError) {
      if (error.code === 'QUERY_ERROR') {
        // A duplicate primary key means another attempt already owns this intended write.
        // Treating that as an ordinary error would hide the mutex that prevents duplicates.
        return refused(
          'DUPLICATE_OPERATION',
          'another attempt already owns this accounting operation',
        );
      }

      // Auth and transport failures are NOT duplicates; reporting them as one would tell a
      // retry to reconcile a write that was never even recorded.
      return refused(
        error.code,
        'the accounting operation could not be recorded',
      );
    }

    return refused('QUERY_ERROR', 'the operation record was not written');
  }
};

const finishOperation = async ({
  id,
  connectionId,
  kind,
  internalEntityId,
  internalRevision,
  state,
  attempts,
  externalDocumentId,
  errorCode,
  execute,
}: {
  id: string;
  connectionId: string;
  kind: AccountingOperationKind;
  internalEntityId: string;
  internalRevision: number | null;
  state: AccountingOperationState;
  attempts: number;
  externalDocumentId: string | null;
  errorCode: string | null;
  execute: (query: string) => Promise<Record<string, unknown>>;
}): Promise<void> => {
  await recordOperation(
    {
      id,
      connectionId,
      kind,
      internalEntityId,
      internalRevision,
      state,
      attempts,
      externalDocumentId,
      errorCode,
      correlationId: randomUUID(),
      isNew: false,
    },
    execute,
  );
};

export type ItemPushPreview = {
  decision: ItemPushDecision;
  link: ItemLinkRow | null;
};

export const previewItemPush = async (
  {
    connectionId,
    internalItemId,
    changedFields,
    adapter,
    observedRemoteVersion = null,
    flags,
  }: {
    connectionId: string;
    internalItemId: string;
    changedFields: string[];
    adapter: AccountingAdapter;
    settings: ConnectionSettings;
    observedRemoteVersion?: string | null;
    flags: OutboundFlags;
  },
  dependencies: OutboundDependencies = {},
): Promise<Result<ItemPushPreview>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const [links, operations] = await Promise.all([
    loadItemLinks(connectionId, execute),
    loadOperations(connectionId, dependencies),
  ]);

  const link =
    links.find((row) => row.internalItemId === internalItemId) ?? null;

  return accepted({
    link,
    decision: planItemPush({
      connectionId,
      internalItemId,
      changedFields,
      capabilities: adapter.capabilities,
      link:
        link === null
          ? null
          : {
              externalItemId: link.externalItemId,
              remoteVersion: link.remoteVersion,
            },
      observedRemoteVersion,
      existingOperations: operations,
      maxAttempts: flags.maxAttempts,
      reconciled: flags.reconciled,
    }),
  });
};

export type ItemPushExecution = {
  operationId: string;
  outcome: 'SUCCEEDED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'MANUAL_EXPORT_REQUIRED';
  externalItemId: string | null;
  errorCode: string | null;
};

export const executeItemPush = async (
  {
    connectionId,
    internalItemId,
    changedFields,
    adapter,
    settings,
    flags,
    item,
    observedRemoteVersion = null,
  }: {
    connectionId: string;
    internalItemId: string;
    changedFields: string[];
    adapter: AccountingAdapter;
    settings: ConnectionSettings;
    flags: OutboundFlags;
    item: {
      code: string;
      name: string;
      secondaryName: string | null;
      sellPriceMicros: string;
      salesPriceMicros: string[];
    };
    observedRemoteVersion?: string | null;
  },
  dependencies: OutboundDependencies = {},
): Promise<Result<ItemPushExecution>> => {
  // Cutoff for concurrent retire vs send: refuse before any ledger write if the
  // destination was soft-retired after the caller resolved it as active.
  const active = await requireActiveAccountingConnection(connectionId, {
    execute: dependencies.execute,
  });

  if (!active.ok) {
    return active;
  }

  if (!flags.outboundEnabled) {
    return refused(
      'OUTBOUND_DISABLED',
      'outbound accounting writes are disabled for this workspace',
    );
  }

  const preview = await previewItemPush(
    {
      connectionId,
      internalItemId,
      changedFields,
      adapter,
      settings,
      observedRemoteVersion,
      flags,
    },
    dependencies,
  );

  if (!preview.ok) {
    return preview;
  }

  const { decision } = preview.value;

  if (decision.kind === 'BLOCKED' || decision.kind === 'CONFLICT') {
    return refused(decision.code, decision.detail);
  }

  if (decision.kind === 'ALREADY_SUCCEEDED') {
    return refused('ALREADY_SUCCEEDED', 'this write already succeeded');
  }

  if (decision.kind === 'IN_PROGRESS') {
    return refused('OPERATION_IN_PROGRESS', 'the write is already in flight');
  }

  const operationKind =
    decision.kind === 'CREATE' ? 'CATALOG_ITEM_CREATE' : 'CATALOG_ITEM_UPDATE';
  const attempts =
    (await loadOperations(connectionId, dependencies)).find(
      (operation) => operation.id === decision.operationId,
    )?.attempts ?? 0;

  const started = await beginOperation({
    id: decision.operationId,
    connectionId,
    kind: operationKind,
    internalEntityId: internalItemId,
    internalRevision: null,
    attempts: attempts + 1,
    isNew: decision.kind !== 'RETRY',
    execute: dependencies.execute ?? executeRecordGraphql,
  });

  if (!started.ok) {
    return started;
  }

  // An unreadable amount must never become 0: that would publish a free product as a real
  // price. The operation is closed as FAILED_FINAL so a retry cannot silently price it later.
  const parsedSellPrice = parseMicrosExact(item.sellPriceMicros);
  const parsedSalesPrices = item.salesPriceMicros.map((text) =>
    parseMicrosExact(text),
  );
  const unreadableAmount = !parsedSellPrice.ok
    ? parsedSellPrice
    : parsedSalesPrices.find((result) => !result.ok);

  if (unreadableAmount !== undefined) {
    await finishOperation({
      id: decision.operationId,
      connectionId,
      kind: operationKind,
      internalEntityId: internalItemId,
      internalRevision: null,
      state: 'FAILED_FINAL',
      attempts: attempts + 1,
      externalDocumentId: null,
      errorCode: !unreadableAmount.ok ? unreadableAmount.refusal.code : null,
      execute: dependencies.execute ?? executeRecordGraphql,
    });

    return unreadableAmount;
  }

  const price = crmMicrosToAsanUnits(
    parsedSellPrice.ok ? parsedSellPrice.value : 0n,
    settings.moneyUnit,
  );
  const salesPrices = parsedSalesPrices.map((result) =>
    crmMicrosToAsanUnits(result.ok ? result.value : 0n, settings.moneyUnit),
  );

  const conversionFailure =
    price.ok === false
      ? price
      : salesPrices.find((result) => !result.ok);

  if (conversionFailure !== undefined) {
    await finishOperation({
      id: decision.operationId,
      connectionId,
      kind: operationKind,
      internalEntityId: internalItemId,
      internalRevision: null,
      state: 'FAILED_FINAL',
      attempts: attempts + 1,
      externalDocumentId: null,
      errorCode: !conversionFailure.ok ? conversionFailure.refusal.code : null,
      execute: dependencies.execute ?? executeRecordGraphql,
    });

    return conversionFailure;
  }

  const payload = {
    externalItemId: preview.value.link?.externalItemId ?? item.code,
    code: item.code,
    name: item.name,
    secondaryName: item.secondaryName,
    sellPriceUnits: price.ok ? price.value : 0,
    salesPriceUnits: salesPrices.flatMap((result) =>
      result.ok ? [result.value] : [],
    ),
  };

  const vendorResult =
    decision.kind === 'CREATE'
      ? await adapter.createItem(payload)
      : await adapter.updateItemPrices(payload);

  const execute = dependencies.execute ?? executeRecordGraphql;

  if (!vendorResult.ok) {
    const state: AccountingOperationState =
      attempts + 1 >= flags.maxAttempts ? 'FAILED_FINAL' : 'FAILED_RETRYABLE';

    await finishOperation({
      id: decision.operationId,
      connectionId,
      kind: operationKind,
      internalEntityId: internalItemId,
      internalRevision: null,
      state,
      attempts: attempts + 1,
      externalDocumentId: null,
      errorCode: vendorResult.refusal.code,
      execute,
    });

    return vendorResult;
  }

  const linkRows = await loadItemLinks(connectionId, execute);
  const existingLink =
    linkRows.find((row) => row.internalItemId === internalItemId) ?? null;

  if (existingLink !== null) {
    await execute(
      buildUpdateAccountingItemLinkMutation(existingLink.linkId, {
        remoteVersion: vendorResult.value.remoteVersion,
        lastSyncedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
        syncStatus: 'LINKED',
      }),
    );
  }

  await finishOperation({
    id: decision.operationId,
    connectionId,
    kind: operationKind,
    internalEntityId: internalItemId,
    internalRevision: null,
    state: 'SUCCEEDED',
    attempts: attempts + 1,
    externalDocumentId: vendorResult.value.externalItemId || null,
    errorCode: null,
    execute,
  });

  return accepted({
    operationId: decision.operationId,
    outcome: 'SUCCEEDED',
    externalItemId: vendorResult.value.externalItemId || null,
    errorCode: null,
  });
};

type QuotationContext = {
  quotation: {
    id: string;
    name: string;
    status: string;
    version: number;
    currencyCode: string;
    personId: string | null;
    companyId: string | null;
  };
  lineItemIds: { lineId: string; itemId: string | null }[];
  revision: {
    version: number;
    snapshot: QuotationRevisionSnapshot;
  } | null;
};

const parseSnapshot = (value: unknown): QuotationRevisionSnapshot | null => {
  const record = typeof value === 'string' ? safeJson(value) : asRecord(value);

  if (record === null) {
    return null;
  }

  const snapshot = record as unknown as QuotationRevisionSnapshot;

  return typeof snapshot.quotationId === 'string' &&
    Array.isArray(snapshot.lines) &&
    asRecord(snapshot.totals) !== null
    ? snapshot
    : null;
};

const safeJson = (text: string): Record<string, unknown> | null => {
  try {
    return asRecord(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
};

const loadQuotationContext = async (
  quotationId: string,
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<Result<QuotationContext>> => {
  const data = await execute(buildQuotationForAccountingQuery(quotationId));
  const quotation = asRecord(data.quotation);

  if (quotation === null) {
    return refused('QUOTATION_NOT_FOUND', 'quotation not found');
  }

  const revisionData = await execute(
    buildQuotationRevisionForAccountingQuery(quotationId),
  );
  const revisionNode = readRows(revisionData, 'quotationRevisions')[0] ?? null;
  const snapshot =
    revisionNode === null ? null : parseSnapshot(revisionNode.snapshotJson);

  return accepted({
    quotation: {
      id: readString(quotation.id),
      name: readString(quotation.name),
      status: readString(quotation.status),
      version: readNumber(quotation.version) ?? 0,
      currencyCode: readString(quotation.currencyCode) || 'IRR',
      personId: readString(asRecord(quotation.person)?.id) || null,
      companyId: readString(asRecord(quotation.company)?.id) || null,
    },
    lineItemIds: readRows(data, 'quotationLines').flatMap((node) => {
      const lineId = readString(node.id);

      return lineId === ''
        ? []
        : [
            {
              lineId,
              itemId: readString(asRecord(node.item)?.id) || null,
            },
          ];
    }),
    revision:
      revisionNode === null || snapshot === null
        ? null
        : {
            version: readNumber(revisionNode.version) ?? 0,
            snapshot,
          },
  });
};

export type QuotationExportPreview = {
  decision: QuotationExportDecision;
  quotationStatus: string;
  revisionVersion: number | null;
  lineItemIds: { lineId: string; itemId: string | null }[];
  documentPreview: QuotationDocumentPreview;
};

export const previewQuotationExport = async (
  {
    connectionId,
    quotationId,
    adapter,
    settings,
    flags,
  }: {
    connectionId: string;
    quotationId: string;
    adapter: AccountingAdapter;
    settings: ConnectionSettings;
    flags: OutboundFlags;
  },
  dependencies: OutboundDependencies = {},
): Promise<Result<QuotationExportPreview>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const context = await loadQuotationContext(quotationId, execute);

  if (!context.ok) {
    return context;
  }

  const [itemLinks, partyLinks, operations] = await Promise.all([
    loadItemLinks(connectionId, execute),
    readRows(
      await execute(buildAccountingPartyLinksQuery({ connectionId })),
      'accountingPartyLinks',
    ),
    loadOperations(connectionId, dependencies),
  ]);

  const linkByInternalItemId = new Map(
    itemLinks.flatMap((link) =>
      link.internalItemId === null
        ? []
        : ([[link.internalItemId, link.externalItemId]] as const),
    ),
  );

  const internalPartyId =
    context.value.quotation.companyId ?? context.value.quotation.personId;
  const customerLink =
    internalPartyId === null
      ? null
      : (partyLinks.find(
          (node) => readString(node.internalPartyId) === internalPartyId,
        ) ?? null);
  const customerExternalId =
    customerLink === null ? null : readString(customerLink.externalPartyId) || null;

  const lineLinks = context.value.lineItemIds.map((line) => ({
    lineId: line.lineId,
    externalItemId:
      line.itemId === null
        ? null
        : (linkByInternalItemId.get(line.itemId) ?? null),
  }));

  const decision = planQuotationExport({
    connectionId,
    quotation: context.value.quotation,
    revision: context.value.revision,
    customerExternalId:
      customerLink === null ? null : readString(customerLink.externalPartyId),
    lineLinks,
    capabilities: adapter.capabilities,
    settings,
    outboundEnabled: flags.outboundEnabled,
    documentExportEnabled: flags.documentExportEnabled,
    existingOperations: operations,
    maxAttempts: flags.maxAttempts,
    reconciled: flags.reconciled,
  });

  const documentPreview = buildQuotationDocumentPreview({
    revision: context.value.revision?.snapshot ?? null,
    quotationStatus: context.value.quotation.status,
    quotationName: context.value.quotation.name,
    settings,
    capabilities: adapter.capabilities,
    flags: {
      outboundEnabled: flags.outboundEnabled,
      documentExportEnabled: flags.documentExportEnabled,
    },
    customerExternalId,
    lineLinks,
  });

  return accepted({
    decision,
    quotationStatus: context.value.quotation.status,
    revisionVersion: context.value.revision?.version ?? null,
    lineItemIds: context.value.lineItemIds,
    documentPreview,
  });
};

export const executeQuotationExport = async (
  {
    connectionId,
    quotationId,
    adapter,
    settings,
    flags,
  }: {
    connectionId: string;
    quotationId: string;
    adapter: AccountingAdapter;
    settings: ConnectionSettings;
    flags: OutboundFlags;
  },
  dependencies: OutboundDependencies = {},
): Promise<
  Result<{
    operationId: string;
    externalDocumentId: string;
    documentNumber: string;
  }>
> => {
  const active = await requireActiveAccountingConnection(connectionId, {
    execute: dependencies.execute,
  });

  if (!active.ok) {
    return active;
  }

  const preview = await previewQuotationExport(
    { connectionId, quotationId, adapter, settings, flags },
    dependencies,
  );

  if (!preview.ok) {
    return preview;
  }

  const { decision } = preview.value;

  if (decision.kind === 'BLOCKED') {
    return refused(decision.code, decision.detail);
  }

  if (decision.kind === 'ALREADY_EXPORTED') {
    return refused('ALREADY_SUCCEEDED', 'this revision already has a document');
  }

  if (decision.kind === 'IN_PROGRESS') {
    return refused('OPERATION_IN_PROGRESS', 'the document is already in flight');
  }

  const execute = dependencies.execute ?? executeRecordGraphql;
  const context = await loadQuotationContext(quotationId, execute);

  if (!context.ok) {
    return context;
  }

  if (context.value.revision === null) {
    return refused(
      'REVISION_NOT_FOUND',
      'no sealed revision exists; the export path needs an issued revision',
    );
  }

  const itemLinks = await loadItemLinks(connectionId, execute);
  const linkByInternalItemId = new Map(
    itemLinks.flatMap((link) =>
      link.internalItemId === null || link.externalItemId === null
        ? []
        : ([[link.internalItemId, link.externalItemId]] as const),
    ),
  );

  const productCodeByLineId: Record<string, number> = {};

  for (const line of context.value.lineItemIds) {
    const externalItemId =
      line.itemId === null
        ? null
        : (linkByInternalItemId.get(line.itemId) ?? null);
    const productCode =
      externalItemId === null ? null : Number(externalItemId);

    if (productCode === null || !Number.isSafeInteger(productCode)) {
      return refused(
        'LINE_HAS_NO_PRODUCT_LINK',
        `line ${line.lineId} has no usable vendor product code`,
      );
    }

    productCodeByLineId[line.lineId] = productCode;
  }

  const internalPartyId =
    context.value.quotation.companyId ?? context.value.quotation.personId;
  const partyRows = readRows(
    await execute(buildAccountingPartyLinksQuery({ connectionId })),
    'accountingPartyLinks',
  );
  const partyRow =
    internalPartyId === null
      ? null
      : (partyRows.find(
          (node) => readString(node.internalPartyId) === internalPartyId,
        ) ?? null);
  const customerCode =
    partyRow === null ? null : Number(readString(partyRow.externalPartyId));

  if (customerCode === null || !Number.isSafeInteger(customerCode)) {
    return refused(
      'CUSTOMER_NOT_LINKED',
      'the quotation customer has no usable vendor id',
    );
  }

  const userId = Number(settings.remoteUserId);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return refused(
      'ADAPTER_NOT_CONFIGURED',
      'the vendor user id is required for document registration',
    );
  }

  const snapshotPolicyCode = context.value.revision.snapshot.taxPolicy ?? '';
  const taxVendorCode = settings.taxPolicyMappings[snapshotPolicyCode];
  const factor = mapRevisionToAsanFactor({
    revision: context.value.revision.snapshot,
    customerCode,
    userId,
    productCodeByLineId,
    specialCodesInUse: settings.specialCodes,
    ...(settings.specialItemCodes === undefined
      ? {}
      : { specialItemCodes: settings.specialItemCodes }),
    dutyHandling: adapter.capabilities.dutyHandling,
    ...(taxVendorCode === undefined ? {} : { taxVendorCode }),
    description:
      context.value.quotation.name === ''
        ? context.value.quotation.id
        : context.value.quotation.name,
    ...(settings.defaultStorageId === ''
      ? {}
      : { storageId: Number(settings.defaultStorageId) }),
    moneyUnit: settings.moneyUnit,
  });

  if (!factor.ok) {
    return factor;
  }

  const operationId = decision.operationId;
  const attempts =
    (await loadOperations(connectionId, dependencies)).find(
      (operation) => operation.id === operationId,
    )?.attempts ?? 0;

  const started = await beginOperation({
    id: operationId,
    connectionId,
    kind: 'QUOTATION_REVISION_PUSH',
    internalEntityId: quotationId,
    internalRevision: context.value.revision.version,
    attempts: attempts + 1,
    isNew: decision.kind !== 'RETRY',
    execute,
  });

  if (!started.ok) {
    return started;
  }

  const vendorResult = await adapter.registerProforma({
    payload: factor.value,
    description: context.value.quotation.name,
  });

  if (!vendorResult.ok) {
    // A documented "did not register" is retryable as-is. A timeout or transport failure is
    // too, but only through the reconciliation gate in the planner, because Asan has no
    // idempotency key and the document may already exist.
    const retryable =
      vendorResult.refusal.code === 'ASAN_DOCUMENT_NOT_REGISTERED' ||
      vendorResult.refusal.code === 'TIMEOUT' ||
      vendorResult.refusal.code === 'TRANSPORT_ERROR' ||
      vendorResult.refusal.code === 'INVALID_RESPONSE';

    const state: AccountingOperationState =
      retryable && attempts + 1 < flags.maxAttempts
        ? 'FAILED_RETRYABLE'
        : 'FAILED_FINAL';

    await finishOperation({
      id: operationId,
      connectionId,
      kind: 'QUOTATION_REVISION_PUSH',
      internalEntityId: quotationId,
      internalRevision: context.value.revision.version,
      state,
      attempts: attempts + 1,
      externalDocumentId: null,
      errorCode: vendorResult.refusal.code,
      execute,
    });

    return vendorResult;
  }

  await finishOperation({
    id: operationId,
    connectionId,
    kind: 'QUOTATION_REVISION_PUSH',
    internalEntityId: quotationId,
    internalRevision: context.value.revision.version,
    state: 'SUCCEEDED',
    attempts: attempts + 1,
    externalDocumentId: vendorResult.value.externalDocumentId,
    errorCode: null,
    execute,
  });

  return accepted({
    operationId,
    externalDocumentId: vendorResult.value.externalDocumentId,
    documentNumber: vendorResult.value.documentNumber,
  });
};

export const outboundFailureMessage = (error: unknown): string => {
  if (error instanceof RecordApiError) {
    return error.code === 'FORBIDDEN'
      ? 'دسترسی لازم برای همگام‌سازی حسابداری وجود ندارد.'
      : 'خواندن یا ثبت عملیات همگام‌سازی انجام نشد.';
  }

  return 'ارتباط با سرور برقرار نشد.';
};

export const asMoneyUnit = (value: unknown): AccountingMoneyUnit =>
  value === 'RIAL' || value === 'TOMAN' ? value : 'UNCONFIRMED';
