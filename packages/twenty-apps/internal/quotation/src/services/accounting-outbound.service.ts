import { createHash, randomUUID } from 'node:crypto';

import {
  buildAccountingItemLinksQuery,
  buildAccountingOperationsQuery,
  buildCreateAccountingOperationMutation,
  buildExportableQuotationsQuery,
  buildUpdateAccountingItemLinkMutation,
  buildUpdateAccountingOperationMutation,
} from 'src/data/accounting-queries';
import { buildExportHeaderAndLinesQuery, buildExportIssuedRevisionQuery, buildExportLinksQuery,
  buildQuotationClaimMutation, buildQuotationFinishMutation, buildSealedRevisionListQuery } from 'src/data/quotation-export-queries';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import { requireActiveAccountingConnection } from 'src/services/accounting-connection.service';
import {
  type AccountingAdapter,
  type AccountingMoneyUnit,
} from 'src/domain/accounting/adapter-contract';
import { crmMicrosToAsanUnits } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { type AsanFactorViewModel } from 'src/domain/accounting/adapters/asan/asan-factor';
import {
  type QuotationDocumentPreview,
  buildQuotationDocumentPreview,
} from 'src/domain/accounting/document-preview';
import {
  planItemPush,
  planQuotationExport,
  QUOTATION_EXPORTABLE_STATUSES,
  type ItemPushDecision,
  type OperationSnapshot,
  type QuotationExportDecision,
} from 'src/domain/accounting/outbound-plan';
import {
  buildAccountingOperationId,
  type AccountingOperationKind,
  type AccountingOperationState,
} from 'src/domain/accounting/sync-operation';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import { canonicalizeForHash, hashQuotationRevision, parseRevisionMicros, validateRevisionFinancialFacts, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';

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
  const operations: OperationSnapshot[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let afterCursor: string | null = null;
  for (;;) {
    const data = await execute(buildAccountingOperationsQuery({
      connectionId, afterCursor,
      ...(internalEntityId === undefined || internalEntityId.trim() === '' ? {} : { internalEntityId }),
    }));
    const root = asRecord(data.accountingSyncOperations);
    if (!Array.isArray(root?.edges)) throw new RecordApiError('INVALID_RESPONSE', 'Operation history unavailable');
    const page = parseOperations(data);
    if (page.length !== root.edges.length || new Set(page.map((entry) => entry.id)).size !== page.length ||
        page.some((entry) => ids.has(entry.id))) {
      throw new RecordApiError('INVALID_RESPONSE', 'Operation history has invalid or repeated identities');
    }
    for (const entry of page) { ids.add(entry.id); operations.push(entry); }
    const pageInfo = asRecord(root.pageInfo);
    if (pageInfo?.hasNextPage !== true) return operations;
    const next = readString(pageInfo.endCursor);
    if (!next || cursors.has(next) || cursors.size >= 1000) {
      throw new RecordApiError('INVALID_RESPONSE', 'Incomplete operation history');
    }
    cursors.add(next);
    afterCursor = next;
  }
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
    requireExactReceipt = false,
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
    requireExactReceipt?: boolean;
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

  const mutation = isNew ? 'createAccountingSyncOperation' : 'updateAccountingSyncOperation';
  const result = await execute(isNew
    ? buildCreateAccountingOperationMutation({ ...data, id })
    : buildUpdateAccountingOperationMutation(id, data));
  // A transport success is not a durable claim. Live writes must see the
  // precise identity and state returned by the persistence authority.
  if (requireExactReceipt) {
    const receipt = asRecord(result[mutation]);
    if (receipt === null || receipt.id !== id || receipt.kind !== kind ||
        receipt.internalEntityId !== internalEntityId || receipt.internalRevision !== internalRevision ||
        receipt.state !== state || receipt.attempts !== attempts ||
        receipt.externalDocumentId !== externalDocumentId || receipt.errorCode !== errorCode ||
        receipt.correlationId !== correlationId) {
      throw new RecordApiError('INVALID_RESPONSE', 'Accounting operation persistence receipt differs from the intended claim');
    }
  }
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
  requireExactReceipt = false,
}: {
  id: string;
  connectionId: string;
  kind: AccountingOperationKind;
  internalEntityId: string;
  internalRevision: number | null;
  attempts: number;
  isNew: boolean;
  execute: (query: string) => Promise<Record<string, unknown>>;
  requireExactReceipt?: boolean;
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
        requireExactReceipt,
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
  requireExactReceipt = false,
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
  requireExactReceipt?: boolean;
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
      requireExactReceipt,
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
    loadOperations(connectionId, dependencies, internalItemId),
  ]);

  const link =
    links.find((row) => row.internalItemId === internalItemId) ?? null;

  if (adapter.writesEnabled === false) {
    return accepted({ link, decision: { kind: 'BLOCKED', code: 'ASAN_LIVE_WRITE_NOT_APPROVED',
      detail: 'the configured adapter is read-only', operationId: null } });
  }

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
      // A browser assertion is not vendor reconciliation evidence.
      reconciled: adapter.isLive && !adapter.capabilities.documents.remoteIdempotency ? false : flags.reconciled,
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

  if (adapter.writesEnabled === false) {
    return refused('ASAN_LIVE_WRITE_NOT_APPROVED', 'the configured adapter is read-only');
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
    (await loadOperations(connectionId, dependencies, internalItemId)).find(
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
    requireExactReceipt: adapter.isLive,
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
      requireExactReceipt: adapter.isLive,
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
      requireExactReceipt: adapter.isLive,
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
      adapter.isLive && !adapter.capabilities.documents.remoteIdempotency
        ? 'MANUAL_EXPORT_REQUIRED'
        : attempts + 1 >= flags.maxAttempts ? 'FAILED_FINAL' : 'FAILED_RETRYABLE';

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
      requireExactReceipt: adapter.isLive,
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
      requireExactReceipt: adapter.isLive,
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
    snapshotHash: string;
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

const completePage = (data: Record<string, unknown>, rootName: string) => {
  const root = asRecord(data[rootName]);
  const info = asRecord(root?.pageInfo);
  const rows = readRows(data, rootName);
  if (!Array.isArray(root?.edges) || root.edges.length !== rows.length ||
      typeof info?.hasNextPage !== 'boolean') {
    throw new RecordApiError('INVALID_RESPONSE', 'Incomplete ' + rootName + ' response');
  }
  return { rows, hasNextPage: info.hasNextPage, cursor: readString(info.endCursor) };
};

const loadQuotationContext = async (
  quotationId: string,
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<Result<QuotationContext>> => {
  const data = await execute(buildExportHeaderAndLinesQuery(quotationId));
  const quotation = asRecord(data.quotation);
  if (!quotation || readString(quotation.id) !== quotationId) {
    return refused('QUOTATION_NOT_FOUND', 'quotation not found');
  }
  const header: QuotationContext['quotation'] = {
    id: quotationId, name: readString(quotation.name), status: readString(quotation.status),
    version: readNumber(quotation.version) ?? 0, currencyCode: readString(quotation.currencyCode),
    personId: readString(asRecord(quotation.person)?.id) || null,
    companyId: readString(asRecord(quotation.company)?.id) || null,
  };
  if (!QUOTATION_EXPORTABLE_STATUSES.has(header.status)) {
    return accepted({ quotation: header, lineItemIds: [], revision: null });
  }
  const first = completePage(data, 'quotationLines');
  const rows = [...first.rows];
  let page = first;
  const cursors = new Set<string>();
  while (page.hasNextPage) {
    if (!page.cursor || cursors.has(page.cursor) || rows.length >= 2000 || cursors.size >= 20) {
      return refused('INVALID_RESPONSE', 'quotation line retrieval incomplete or above supported limit');
    }
    cursors.add(page.cursor);
    const next = await execute(buildExportHeaderAndLinesQuery(quotationId, page.cursor));
    const nextHeader = asRecord(next.quotation);
    if (readString(nextHeader?.id) !== quotationId || readNumber(nextHeader?.version) !== header.version) {
      return refused('REVISION_MISMATCH', 'quotation changed while reading lines');
    }
    page = completePage(next, 'quotationLines');
    rows.push(...page.rows);
  }
  const lineItemIds = rows.map((node) => ({
    lineId: readString(node.id), itemId: readString(asRecord(node.item)?.id) || null,
  }));
  if (lineItemIds.length > 2000 || lineItemIds.some(line => !line.lineId) ||
      new Set(lineItemIds.map(line => line.lineId)).size !== lineItemIds.length) {
    return refused('INVALID_RESPONSE', 'quotation lines have invalid or repeated identities');
  }
  const revisionData = await execute(buildExportIssuedRevisionQuery(quotationId));
  const revisions = completePage(revisionData, 'quotationRevisions');
  if (revisions.hasNextPage || revisions.rows.length > 1) {
    return refused('REVISION_MISMATCH', 'multiple issued revisions are not exportable');
  }
  const node = revisions.rows[0];
  if (!node) return accepted({ quotation: header, lineItemIds, revision: null });
  const snapshot = parseSnapshot(node.snapshotJson);
  const revisionNumber = readNumber(node.version);
  const snapshotHash = readString(node.snapshotHash);
  if (!snapshot || !snapshotHash || hashQuotationRevision(snapshot) !== snapshotHash) {
    return refused('REVISION_IMMUTABLE', 'issued revision hash is missing or mismatched');
  }
  const customerId = header.companyId ?? header.personId;
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber === null || revisionNumber < 1 ||
      !Number.isSafeInteger(snapshot.version) || snapshot.version < 1 ||
      snapshot.quotationId !== quotationId || snapshot.currencyCode !== header.currencyCode ||
      !customerId || (!!header.companyId === !!header.personId) || snapshot.customerRef !== customerId ||
      (snapshot.schemaVersion === 2 && (snapshot.revisionNumber !== revisionNumber ||
        snapshot.version > header.version || snapshot.customerSnapshot?.id !== customerId ||
        snapshot.customerSnapshot?.kind !== (header.companyId ? 'COMPANY' : 'PERSON'))) ||
      (snapshot.schemaVersion === undefined && snapshot.version > header.version + 1)) {
    return refused('REVISION_MISMATCH', 'issued revision, quotation or customer identity differs');
  }
  const amounts = validateRevisionFinancialFacts(snapshot);
  if (!amounts.ok) return amounts;
  const current = new Map(lineItemIds.map(line => [line.lineId, line.itemId]));
  if (snapshot.lines.length !== lineItemIds.length || snapshot.lines.some(line =>
      !current.has(line.lineId) || (snapshot.schemaVersion === 2 && (line.itemId === undefined || current.get(line.lineId) !== line.itemId)))) {
    return refused('REVISION_MISMATCH', 'issued line identity differs from current quotation');
  }
  return accepted({ quotation: header, lineItemIds,
    revision: { version: revisionNumber, snapshot, snapshotHash } });
};

type ExportBinding = { id: string; internalId: string; externalId: string; syncStatus: string; remoteVersion: string; partyType: string };

const loadExportBindings = async (
  connectionId: string, kind: 'item' | 'party', ids: string[],
  byExternal: boolean, execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<ExportBinding[]> => {
  const requested = [...new Set(ids)];
  const results: ExportBinding[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < requested.length; offset += 100) {
    const batch = requested.slice(offset, offset + 100);
    let after: string | null = null;
    const cursors = new Set<string>();
    for (;;) {
      const data = await execute(buildExportLinksQuery({ connectionId, kind, ids: batch, byExternal, after }));
      const page = completePage(data, kind === 'item' ? 'accountingItemLinks' : 'accountingPartyLinks');
      for (const node of page.rows) {
        const row: ExportBinding = {
          id: readString(node.id), syncStatus: readString(node.syncStatus), remoteVersion: readString(node.remoteVersion),
          internalId: kind === 'item' ? readString(asRecord(node.item)?.id) : readString(node.internalPartyId),
          externalId: readString(kind === 'item' ? node.externalItemId : node.externalPartyId),
          partyType: kind === 'party' ? readString(node.partyType) : '',
        };
        if (!row.id || seen.has(row.id) || readString(asRecord(node.connection)?.id) !== connectionId ||
            !batch.includes(byExternal ? row.externalId : row.internalId)) {
          throw new RecordApiError('INVALID_RESPONSE', 'Accounting binding response differs from requested identity');
        }
        seen.add(row.id); results.push(row);
      }
      if (!page.hasNextPage) break;
      if (!page.cursor || cursors.has(page.cursor) || cursors.size >= 20) {
        throw new RecordApiError('INVALID_RESPONSE', 'Incomplete accounting binding history');
      }
      cursors.add(page.cursor); after = page.cursor;
    }
  }
  return results;
};

const selectExportBindings = async (
  connectionId: string, context: QuotationContext,
  execute: (query: string) => Promise<Record<string, unknown>>,
) => {
  const customerId = context.quotation.companyId ?? context.quotation.personId;
  const kind = context.quotation.companyId ? 'COMPANY' : 'PERSON';
  const itemIds = context.lineItemIds.flatMap(line => line.itemId ? [line.itemId] : []);
  const [items, parties] = await Promise.all([
    loadExportBindings(connectionId, 'item', itemIds, false, execute),
    loadExportBindings(connectionId, 'party', customerId ? [customerId] : [], false, execute),
  ]);
  const valid = (row: ExportBinding) => row.syncStatus === 'LINKED' &&
    /^[1-9]\d*$/.test(row.externalId) && BigInt(row.externalId) <= 2147483647n;
  // Reverse check prevents two CRM identities from claiming the same remote record.
  const [reverseItems, reverseParties] = await Promise.all([
    loadExportBindings(connectionId, 'item', items.filter(valid).map(row => row.externalId), true, execute),
    loadExportBindings(connectionId, 'party', parties.filter(valid).map(row => row.externalId), true, execute),
  ]);
  const unique = (rows: ExportBinding[], reverse: ExportBinding[], internalId: string | null) => {
    const matches = rows.filter(row => row.internalId === internalId);
    if (matches.length !== 1 || !valid(matches[0])) return null;
    const row = matches[0];
    const back = reverse.filter(other => other.externalId === row.externalId);
    return back.length === 1 && back[0].id === row.id &&
      back[0].internalId === row.internalId && back[0].syncStatus === row.syncStatus &&
      back[0].remoteVersion === row.remoteVersion && back[0].partyType === row.partyType ? row : null;
  };
  const candidate = unique(parties, reverseParties, customerId);
  const party = candidate?.partyType === kind ? candidate : null;
  const lineBindings = context.lineItemIds.map(line => ({
    lineId: line.lineId, binding: unique(items, reverseItems, line.itemId),
  }));
  return { party, lineBindings };
};

export type QuotationExportPreview = {
  decision: QuotationExportDecision;
  quotationStatus: string;
  revisionVersion: number | null;
  lineItemIds: { lineId: string; itemId: string | null }[];
  documentPreview: QuotationDocumentPreview;
  // Internal claim inputs, removed from public preview at the route boundary.
  claim: { fingerprint: string; snapshot: string; payload: AsanFactorViewModel } | null;
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

  const [bindings, operations] = await Promise.all([
    context.value.revision === null ? Promise.resolve({ party: null, lineBindings: [] }) :
      selectExportBindings(connectionId, context.value, execute),
    loadOperations(connectionId, dependencies, quotationId),
  ]);
  const customerExternalId = bindings.party?.externalId ?? null;
  const lineLinks = bindings.lineBindings.map(line => ({
    lineId: line.lineId, externalItemId: line.binding?.externalId ?? null,
  }));

  let decision = planQuotationExport({
    connectionId,
    quotation: context.value.quotation,
    revision: context.value.revision,
    customerExternalId,
    lineLinks,
    capabilities: adapter.capabilities,
    settings,
    outboundEnabled: flags.outboundEnabled && adapter.writesEnabled !== false,
    documentExportEnabled: flags.documentExportEnabled && adapter.writesEnabled !== false,
    existingOperations: operations,
    maxAttempts: flags.maxAttempts,
    // A browser assertion is not vendor reconciliation evidence.
      reconciled: adapter.isLive && !adapter.capabilities.documents.remoteIdempotency ? false : flags.reconciled,
  });

  const documentPreview = buildQuotationDocumentPreview({
    revision: context.value.revision?.snapshot ?? null,
    quotationStatus: context.value.quotation.status,
    quotationName: context.value.revision?.snapshot.documentTitle ?? context.value.quotation.name,
    asanWire: adapter.id === 'asan',
    ...(context.value.revision && adapter.id === 'asan' ? {
      descriptionOverride: (context.value.revision.snapshot.documentTitle || context.value.revision.snapshot.quotationNumber) +
        ' [CRM:' + buildAccountingOperationId({ connectionId, kind: 'QUOTATION_REVISION_PUSH',
          internalEntityId: quotationId, internalRevision: context.value.revision.version }) + ']',
    } : {}),
    settings,
    capabilities: adapter.capabilities,
    flags: {
      outboundEnabled: flags.outboundEnabled && adapter.writesEnabled !== false,
      documentExportEnabled: flags.documentExportEnabled && adapter.writesEnabled !== false,
    },
    customerExternalId,
    lineLinks,
  });

  const sealed = context.value.revision;
  if ((decision.kind === 'READY' || decision.kind === 'RETRY') && adapter.isLive && sealed?.snapshot.schemaVersion !== 2) {
    decision = { kind: 'BLOCKED', code: 'REVISION_MISMATCH', detail: 'historical seal has no complete item/customer identity; reissue before live export', operationId: decision.operationId };
  }
  if ((decision.kind === 'READY' || decision.kind === 'RETRY') && documentPreview.document === null) {
    decision = { kind: 'BLOCKED', code: documentPreview.documentError?.code ?? 'INVALID_INPUT',
      detail: documentPreview.documentError?.detail ?? 'no exact vendor payload', operationId: decision.operationId };
  }
  const payload = documentPreview.document;
  const snapshot = sealed && payload ? canonicalizeForHash({
    schemaVersion: 1, connectionId, adapterId: adapter.id, adapterVersion: adapter.contractVersion,
    baseUrl: settings.baseUrl, remoteUserId: settings.remoteUserId, moneyUnit: settings.moneyUnit,
    revisionNumber: sealed.version, revisionHash: sealed.snapshotHash,
    party: bindings.party, lineBindings: bindings.lineBindings, payload,
  }) : null;
  const claim = snapshot && payload ? {
    snapshot, payload, fingerprint: createHash('sha256').update(snapshot, 'utf8').digest('hex'),
  } : null;

  return accepted({
    decision,
    quotationStatus: context.value.quotation.status,
    revisionVersion: context.value.revision?.version ?? null,
    lineItemIds: context.value.lineItemIds,
    documentPreview,
    claim,
  });
};

type QuotationClaimIdentity = { id: string; connectionId: string; quotationId: string; revisionNumber: number; fingerprint: string };

const verifyClaimReceipt = (node: unknown, claim: QuotationClaimIdentity, state: AccountingOperationState,
  externalDocumentId: string | null, errorCode: string | null): boolean => {
  const row = asRecord(node);
  return !!row && row.id === claim.id && row.kind === 'QUOTATION_REVISION_PUSH' &&
    row.internalEntityId === claim.quotationId && row.internalRevision === claim.revisionNumber &&
    row.state === state && row.attempts === 1 && row.externalDocumentId === externalDocumentId &&
    row.errorCode === errorCode && row.correlationId === claim.id &&
    row.payloadFingerprint === claim.fingerprint && asRecord(row.connection)?.id === claim.connectionId;
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

  if (adapter.writesEnabled === false) {
    return refused('ASAN_LIVE_WRITE_NOT_APPROVED', 'the configured adapter is read-only');
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

  // There is no documented Asan idempotency, and a generic update is not a
  // compare-and-swap claim. Never replay an uncertain document on a browser assertion.
  if (decision.kind === 'RETRY') return refused('RECONCILIATION_REQUIRED', 'a previous attempt requires authorized reconciliation; no automatic replay');
  const execute = dependencies.execute ?? executeRecordGraphql;
  const initial = preview.value.claim;
  const revisionNumber = preview.value.revisionVersion;
  if (initial === null || revisionNumber === null) return refused('REVISION_MISMATCH', 'no verified payload to claim');
  const fresh = await previewQuotationExport({ connectionId, quotationId, adapter, settings, flags }, dependencies);
  if (!fresh.ok) return fresh;
  if (fresh.value.decision.kind !== 'READY' || fresh.value.decision.operationId !== decision.operationId ||
      fresh.value.revisionVersion !== revisionNumber || fresh.value.claim?.fingerprint !== initial.fingerprint) {
    return refused('REVISION_MISMATCH', 'document or destination binding changed before claim');
  }
  const claim: QuotationClaimIdentity = {
    id: decision.operationId, connectionId, quotationId, revisionNumber, fingerprint: initial.fingerprint,
  };
  // The deterministic primary key gives a single insert winner. There is NO
  // second write path and no update-in-place retry for an uncertain request.
  try {
    const created = await execute(buildQuotationClaimMutation({
      id: claim.id, connectionId, name: operationName({ kind: 'QUOTATION_REVISION_PUSH', internalEntityId: quotationId, revision: revisionNumber }),
      kind: 'QUOTATION_REVISION_PUSH', internalEntityId: quotationId, internalRevision: revisionNumber,
      state: 'IN_FLIGHT', attempts: 1, correlationId: claim.id, externalDocumentId: null, errorCode: null,
      payloadFingerprint: initial.fingerprint, payloadSnapshot: initial.snapshot,
    }));
    if (!verifyClaimReceipt(created.createAccountingSyncOperation, claim, 'IN_FLIGHT', null, null)) {
      return refused('RECONCILIATION_REQUIRED', 'claim persistence not confirmed; no vendor call made');
    }
  } catch {
    return refused('RECONCILIATION_REQUIRED', 'operation claim not confirmed; do not replay');
  }
  const finish = async (state: AccountingOperationState, externalDocumentId: string | null, errorCode: string | null) => {
    const result = await execute(buildQuotationFinishMutation(claim.id, { state, externalDocumentId, errorCode }));
    if (!verifyClaimReceipt(result.updateAccountingSyncOperation, claim, state, externalDocumentId, errorCode)) {
      throw new RecordApiError('INVALID_RESPONSE', 'Accounting document outcome persistence not confirmed');
    }
  };
  const operationId = claim.id;
  const vendorResult = await adapter.registerProforma({
    payload: initial.payload,
    description: initial.payload.Description,
  });

  if (!vendorResult.ok) {
    // Preserve the exact claim and force reconciliation after any uncertain result.
    await finish('MANUAL_EXPORT_REQUIRED', null, vendorResult.refusal.code);
    return vendorResult;
  }

  if (adapter.isLive) {
    const evidence = vendorResult.value.registrationEvidence;
    await finish('MANUAL_EXPORT_REQUIRED', vendorResult.value.externalDocumentId,
      evidence === 'IDENTITY_OBSERVED' ? 'ASAN_FISCAL_READBACK_REQUIRED' : 'ASAN_DOCUMENT_READBACK_REQUIRED');
    return refused('RECONCILIATION_REQUIRED', 'the acknowledged document number is retained for authorized reconciliation; do not replay');
  }

  await finish('SUCCEEDED', vendorResult.value.externalDocumentId, null);

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


export type ExportableQuotationRow = {
  quotationId: string;
  quotationNumber: string;
  status: string;
  customerName: string;
  issuedAt: string | null;
  totalExact: string | null;
  revisionVersion: number | null;
  sendState: 'PENDING' | 'SENT' | 'IN_FLIGHT' | 'FAILED';
  lastErrorCode: string | null;
  externalDocumentId: string | null;
};

const readCustomerName = (node: Record<string, unknown>): string => {
  const company = asRecord(node.company);
  if (company !== null) {
    const name = readString(company.name);
    if (name !== '') {
      return name;
    }
  }
  const person = asRecord(node.person);
  if (person !== null) {
    const name = asRecord(person.name);
    const full = `${readString(name?.firstName)} ${readString(name?.lastName)}`.trim();
    if (full !== '') {
      return full;
    }
  }
  return readString(node.name) || '-';
};

export const listExportableQuotations = async (
  {
    connectionId,
    cursor = null,
    pageSize = 25,
  }: {
    connectionId: string;
    cursor?: string | null;
    pageSize?: number;
  },
  dependencies: OutboundDependencies = {},
): Promise<{
  rows: ExportableQuotationRow[];
  nextCursor: string | null;
  hasNextPage: boolean;
}> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const statuses = [...QUOTATION_EXPORTABLE_STATUSES];
  const listed = await execute(
    buildExportableQuotationsQuery({
      statuses,
      first: pageSize,
      afterCursor: cursor,
    }),
  );

  const quotationRoot = asRecord(listed.quotations);
  const edges = Array.isArray(quotationRoot?.edges) ? quotationRoot.edges : [];
  const pageInfo = asRecord(quotationRoot?.pageInfo);

  const quotations = edges.flatMap((edge) => {
    const record = asRecord(edge);
    const node = record === null ? null : asRecord(record.node);
    if (node === null) {
      return [] as { id: string; node: Record<string, unknown> }[];
    }
    const id = readString(node.id);
    if (id === '') {
      return [];
    }
    return [{ id, node }];
  });

  if (quotations.length === 0) {
    return { rows: [], nextCursor: null, hasNextPage: false };
  }

  const quotationIds = quotations.map((row) => row.id);
  const revisionsData = await execute(buildSealedRevisionListQuery(quotationIds));
  const revisionPage = completePage(revisionsData, 'quotationRevisions');
  if (revisionPage.hasNextPage) throw new RecordApiError('INVALID_RESPONSE', 'Incomplete issued revision list');
  const operationRows: Record<string, unknown>[] = [];
  let operationCursor: string | null = null;
  const operationCursors = new Set<string>();
  for (;;) {
    const operationsData = await execute(buildAccountingOperationsQuery({ connectionId, internalEntityIds: quotationIds, limit: 100, afterCursor: operationCursor }));
    if (!Array.isArray(asRecord(operationsData.accountingSyncOperations)?.edges)) {
      throw new RecordApiError('INVALID_RESPONSE', 'Document operation history unavailable');
    }
    operationRows.push(...readRows(operationsData, 'accountingSyncOperations'));
    const page = asRecord(asRecord(operationsData.accountingSyncOperations)?.pageInfo);
    if (page?.hasNextPage !== true) break;
    const next = readString(page.endCursor);
    if (!next || operationCursors.has(next) || operationCursors.size >= 1000) throw new RecordApiError('INVALID_RESPONSE', 'Incomplete document operation history');
    operationCursors.add(next); operationCursor = next;
  }

  const revisionByQuotation = new Map<
    string,
    { version: number; totalExact: string | null; issuedAt: string | null }
  >();
  for (const node of revisionPage.rows) {
    const quotationId = readString(node.quotationId);
    if (!quotationIds.includes(quotationId) || revisionByQuotation.has(quotationId)) {
      throw new RecordApiError('INVALID_RESPONSE', 'Repeated or unexpected issued revision');
    }
    const seal = parseSnapshot(node.snapshotJson);
    if (!seal || seal.quotationId !== quotationId || hashQuotationRevision(seal) !== readString(node.snapshotHash) ||
        !validateRevisionFinancialFacts(seal).ok) throw new RecordApiError('INVALID_RESPONSE', 'Issued revision seal is invalid');
    const total = parseRevisionMicros(seal.totals.totalMicros);
    revisionByQuotation.set(quotationId, {
      version: readNumber(node.version) ?? 0,
      totalExact: total.ok ? formatMicrosExact(total.value) : null,
      issuedAt: readString(node.issuedAt) || null,
    });
  }

  const rows: ExportableQuotationRow[] = [];
  for (const quotation of quotations) {
    const revision = revisionByQuotation.get(quotation.id);
    if (revision === undefined) {
      continue;
    }

    const matching = operationRows.filter(
      (operation) =>
        readString(operation.kind) === 'QUOTATION_REVISION_PUSH' &&
        readString(operation.internalEntityId) === quotation.id &&
        readNumber(operation.internalRevision) === revision.version,
    );

    const succeeded = matching.find(
      (operation) => readString(operation.state) === 'SUCCEEDED',
    );
    const inFlight = matching.find((operation) => {
      const state = readString(operation.state);
      return state === 'IN_FLIGHT' || state === 'PENDING';
    });
    const failed = matching.find((operation) => {
      const state = readString(operation.state);
      return (
        state === 'FAILED_RETRYABLE' ||
        state === 'FAILED_FINAL' ||
        state === 'MANUAL_EXPORT_REQUIRED'
      );
    });

    let sendState: ExportableQuotationRow['sendState'] = 'PENDING';
    if (succeeded !== undefined) {
      sendState = 'SENT';
    } else if (inFlight !== undefined) {
      sendState = 'IN_FLIGHT';
    } else if (failed !== undefined) {
      sendState = 'FAILED';
    }

    rows.push({
      quotationId: quotation.id,
      quotationNumber:
        readString(quotation.node.quotationNumber) ||
        readString(quotation.node.name) ||
        quotation.id.slice(0, 8),
      status: readString(quotation.node.status),
      customerName: readCustomerName(quotation.node),
      issuedAt: revision.issuedAt,
      totalExact: revision.totalExact,
      revisionVersion: revision.version,
      sendState,
      lastErrorCode:
        failed === undefined ? null : readString(failed.errorCode) || null,
      externalDocumentId:
        succeeded === undefined
          ? null
          : readString(succeeded.externalDocumentId) || null,
    });
  }

  return {
    rows,
    nextCursor: readString(pageInfo?.endCursor) || null,
    hasNextPage: pageInfo?.hasNextPage === true,
  };
};
