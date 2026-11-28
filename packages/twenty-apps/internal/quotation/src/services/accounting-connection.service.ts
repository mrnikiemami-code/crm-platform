import { createHash } from 'node:crypto';

import {
  ASAN_ADAPTER_CONTRACT_VERSION,
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';
import {
  ADAPTER_DESCRIPTORS,
  createAccountingAdapter,
  describeCapabilities,
  findAdapterDescriptor,
  type AdapterDescriptor,
} from 'src/domain/accounting/adapter-registry';
import {
  connectionSettingsFromRecord,
  parseConnectionSettings,
} from 'src/domain/accounting/connection-settings';
import {
  buildAccountingConnectionsQuery,
} from 'src/data/accounting-queries';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import {
  callAccountingSettingsAction,
  type AccountingSettingsApiOutcome,
} from 'src/data/accounting-settings-api';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { type AccountingAdapter } from 'src/domain/accounting/adapter-contract';
import { createApprovedAsanReadTransport, matchesAsanReadBinding, type AsanReadBinding } from 'src/domain/accounting/adapters/asan/asan-approved-transport';
import { resolveAccountingDestination } from 'src/domain/accounting/resolve-destination';

export type AccountingConnectionRecord = {
  id: string;
  name: string;
  adapterId: string;
  adapterVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
  settings: ConnectionSettings;
  capabilities: unknown;
  healthState: string;
  lastHealthCheckAt: string | null;
  lastHealthMessage: string | null;
  verificationState: string;
};

export type ConnectionDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
};

export type AdapterSecrets = {
  tunnelToken?: string;
  allowInsecureTransport: boolean;
  approvedRead?: AsanReadBinding;
  approvedReadGeneration?: string;
  approvedReadRemoteUserId?: string;
  approvedReadDatasetId?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

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

export const parseConnectionRecord = (
  node: Record<string, unknown>,
): AccountingConnectionRecord | null => {
  const id = readString(node.id);

  if (id === '') {
    return null;
  }

  return {
    id,
    name: readString(node.name),
    adapterId: readString(node.adapterId),
    adapterVersion: readString(node.adapterVersion) || null,
    isActive: node.isActive === true,
    isDefault: node.isDefault === true,
    settings: connectionSettingsFromRecord(node),
    capabilities: node.capabilities ?? null,
    healthState: readString(node.healthState) || 'UNKNOWN',
    lastHealthCheckAt: readString(node.lastHealthCheckAt) || null,
    lastHealthMessage: readString(node.lastHealthMessage) || null,
    verificationState: readString(node.verificationState) || 'LIVE_UNVERIFIED',
  };
};

export const loadConnections = async (
  dependencies: ConnectionDependencies = {},
): Promise<AccountingConnectionRecord[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const result: AccountingConnectionRecord[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let afterCursor: string | null = null;
  for (;;) {
    const data = await execute(buildAccountingConnectionsQuery({ afterCursor }));
    const root = asRecord(data.accountingConnections);
    const rows = readRows(data, 'accountingConnections');
    const page = asRecord(root?.pageInfo);
    if (!Array.isArray(root?.edges) || root.edges.length !== rows.length || typeof page?.hasNextPage !== 'boolean') {
      throw new RecordApiError('INVALID_RESPONSE', 'Incomplete accounting connection listing');
    }
    for (const row of rows) {
      const parsed = parseConnectionRecord(row);
      if (!parsed || ids.has(parsed.id) || typeof row.isActive !== 'boolean') {
        throw new RecordApiError('INVALID_RESPONSE', 'Invalid or duplicate accounting connection identity');
      }
      ids.add(parsed.id);
      result.push(parsed);
    }
    if (!page.hasNextPage) return result;
    const next = readString(page.endCursor);
    if (!next || cursors.has(next) || cursors.size >= 100) {
      throw new RecordApiError('INVALID_RESPONSE', 'Incomplete accounting connection listing');
    }
    cursors.add(next);
    afterCursor = next;
  }
};

// Load a stored connection by id for history / ledger reads. Retired rows are returned
// as-is: this must never be used to authorize preview or execute of new outbound work.
export const loadConnectionByIdForHistory = async (
  connectionId: string,
  dependencies: ConnectionDependencies = {},
): Promise<Result<AccountingConnectionRecord>> => {
  const id = connectionId.trim();

  if (id === '') {
    return refused('CONNECTION_NOT_FOUND', 'no accounting connection is configured');
  }

  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildAccountingConnectionsQuery({ connectionId: id }));
  const connections = readRows(data, 'accountingConnections')
    .map(parseConnectionRecord)
    .filter((record): record is AccountingConnectionRecord => record !== null);
  const root = asRecord(data.accountingConnections);
  const page = asRecord(root?.pageInfo);
  // A scoped query may return zero or exactly one matching row, never an arbitrary first match.
  if (!Array.isArray(root?.edges) || root.edges.length !== connections.length ||
      page?.hasNextPage === true || connections.length > 1) {
    return refused('INVALID_RESPONSE', 'connection identity is incomplete or ambiguous');
  }
  const selected = connections.length === 1 && connections[0].id === id ? connections[0] : null;

  if (selected === null) {
    return refused('CONNECTION_NOT_FOUND', 'no accounting connection is configured');
  }

  return accepted(selected);
};

// Gate for new outbound / import work: the destination must still be active at check time.
// Call again immediately before side effects when a concurrent retire is possible.
export const requireActiveAccountingConnection = async (
  connectionId: string,
  dependencies: ConnectionDependencies = {},
): Promise<Result<AccountingConnectionRecord>> => {
  const loaded = await loadConnectionByIdForHistory(connectionId, dependencies);

  if (!loaded.ok) {
    return loaded;
  }

  if (loaded.value.isActive !== true) {
    return refused(
      'CONNECTION_INACTIVE',
      'retired accounting connections cannot accept new work',
    );
  }

  return loaded;
};

export const resolveConnection = async (
  {
    connectionId,
  }: {
    connectionId?: string | null;
  },
  dependencies: ConnectionDependencies = {},
): Promise<Result<AccountingConnectionRecord>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const explicit = connectionId?.trim();
  if (explicit) return requireActiveAccountingConnection(explicit, { execute });
  // Default resolution needs a complete list, not the first page.
  let connections: AccountingConnectionRecord[];
  try { connections = await loadConnections({ execute }); }
  catch { return refused('INVALID_RESPONSE', 'default destination could not be resolved from a complete connection list'); }

  const resolved = resolveAccountingDestination({ connections, connectionId });

  if (resolved.kind === 'REFUSED') {
    return refused(
      resolved.code,
      resolved.code === 'ACCOUNTING_DESTINATION_REQUIRED'
        ? 'no workspace default accounting destination is configured'
        : 'no accounting connection is configured',
    );
  }

  const selected =
    connections.find((connection) => connection.id === resolved.connectionId) ??
    null;

  if (selected === null) {
    return refused('CONNECTION_NOT_FOUND', 'no accounting connection is configured');
  }

  return accepted(selected);
};

export const readAdapterSecrets = (env: Record<string, string | undefined>): AdapterSecrets => ({
  ...(env.ASAN_TUNNEL_TOKEN === undefined || env.ASAN_TUNNEL_TOKEN === ''
    ? {}
    : { tunnelToken: env.ASAN_TUNNEL_TOKEN }),
  allowInsecureTransport: env.ASAN_TRANSPORT_APPROVED === 'true',
  ...(env.ASAN_APPROVED_READ_GENERATION ? { approvedReadGeneration: env.ASAN_APPROVED_READ_GENERATION } : {}),
  ...(env.ASAN_APPROVED_READ_REMOTE_USER_ID !== undefined ? { approvedReadRemoteUserId: env.ASAN_APPROVED_READ_REMOTE_USER_ID.trim() } : {}),
  ...(env.ASAN_APPROVED_READ_DATASET_ID ? { approvedReadDatasetId: env.ASAN_APPROVED_READ_DATASET_ID.trim() } : {}),
  ...(env.ASAN_APPROVED_READ_CONNECTION_ID && env.ASAN_APPROVED_READ_BASE_URL && env.ASAN_APPROVED_READ_IPV4
    ? { approvedRead: { connectionId: env.ASAN_APPROVED_READ_CONNECTION_ID,
      baseUrl: env.ASAN_APPROVED_READ_BASE_URL, ipv4: env.ASAN_APPROVED_READ_IPV4 } } : {}),
});

export const describeSecretStatus = (secrets: AdapterSecrets): {
  tunnelTokenConfigured: boolean;
  insecureWritesApproved: boolean;
} => ({
  tunnelTokenConfigured: secrets.tunnelToken !== undefined,
  insecureWritesApproved: secrets.allowInsecureTransport,
});

export const buildAdapter = (
  record: AccountingConnectionRecord,
  secrets: AdapterSecrets,
): Result<AccountingAdapter> => {
  if (record.adapterId === 'asan' && record.settings.baseUrl.trim() !== '' &&
      record.adapterVersion !== ASAN_ADAPTER_CONTRACT_VERSION) {
    return refused('ASAN_CONTRACT_RECHECK_REQUIRED', 'save and recheck the Asan connection against the current contract');
  }
  const binding = secrets.approvedRead;
  const generation = secrets.approvedReadGeneration;
  const datasetId = secrets.approvedReadDatasetId;
  const approved = record.adapterId === 'asan' && record.isActive && binding !== undefined &&
    generation !== undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(generation) &&
    secrets.approvedReadRemoteUserId !== undefined && secrets.approvedReadRemoteUserId === record.settings.remoteUserId &&
    typeof datasetId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(datasetId) &&
    matchesAsanReadBinding(binding, record.id, record.settings.baseUrl);
  // Never store the token or a token-derived digest in the snapshot. The operator
  // must clear approval and rotate this non-secret UUID whenever credentials rotate.
  // Dataset ID is an administrator-attested non-secret label, not proof from the vendor.
  // G1 must independently verify the actual tenant/database before enabling any reads.
  const readAccessScope = approved && binding !== undefined
    ? createHash('sha256').update(JSON.stringify([record.id, record.adapterVersion,
      binding.baseUrl, binding.ipv4, generation, datasetId, record.settings.remoteUserId,
      record.settings.moneyUnit])).digest('hex') : undefined;
  return createAccountingAdapter({
    adapterId: record.adapterId,
    settings: record.settings,
    readOnly: true,
    ...(approved && secrets.tunnelToken !== undefined ? { tunnelToken: secrets.tunnelToken } : {}),
    ...(approved && binding !== undefined && readAccessScope !== undefined
      ? { fetchImpl: createApprovedAsanReadTransport(binding), readAccessScope } : {}),
  });
};

export type SaveConnectionInput = {
  id?: string | null;
  name: string;
  adapterId: string;
  settings: unknown;
};

export type SaveConnectionResult = Result<{
  connection: AccountingConnectionRecord;
  adapter: AdapterDescriptor;
}>;

// The record is written only through the settings route; there is deliberately no
// GraphQL write helper here, because the public mutations are closed and the app identity
// must not be usable as a bypass.

export type ConnectionPanelView = {
  connection: AccountingConnectionRecord;
  adapters: readonly AdapterDescriptor[];
  capabilities: ReturnType<typeof describeCapabilities>;
  credentials: ReturnType<typeof describeSecretStatus>;
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
};

export const buildConnectionPanelView = ({
  connection,
  descriptor,
  secrets,
  outboundEnabled,
  documentExportEnabled,
}: {
  connection: AccountingConnectionRecord;
  descriptor: AdapterDescriptor;
  secrets: AdapterSecrets;
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
}): ConnectionPanelView => ({
  connection,
  adapters: ADAPTER_DESCRIPTORS,
  capabilities: describeCapabilities(descriptor),
  credentials: describeSecretStatus(secrets),
  outboundEnabled,
  documentExportEnabled,
});

export const connectionFailureMessage = (error: unknown): string => {
  if (error instanceof RecordApiError) {
    if (error.code === 'FORBIDDEN') {
      return 'دسترسی لازم برای مدیریت اتصال حسابداری وجود ندارد.';
    }

    return 'خواندن یا ذخیرهٔ تنظیمات اتصال انجام نشد.';
  }

  return 'ارتباط با سرور برقرار نشد.';
};

// ---------------------------------------------------------------------------
// The settings write, decided at the server boundary.
//
// The public GraphQL mutations on `accountingConnection` are closed, and a logic
// function's own token is the app's: writing with it would let any member's panel
// change a workspace-wide destination. The save therefore travels to the REST route
// with the CALLER's bearer, where the workspace role is resolved, and the caller
// reads back what the server stored.

export type AccountingSettingsDependencies = {
  authorizationHeader?: string | null;
};

const parseServerConnectionView = (
  value: unknown,
): AccountingConnectionRecord | null => {
  const row = asRecord(value);
  const id = readString(row?.recordId);

  if (id === '') {
    return null;
  }

  return {
    id,
    name: readString(row?.name),
    adapterId: readString(row?.adapterId),
    adapterVersion: readString(row?.adapterVersion) || null,
    isActive: readBoolean(row?.isActive, true),
    isDefault: row?.isDefault === true,
    // The server view nests the settings under `settings`; the reader below expects them on
    // the record it is given, so it gets that node rather than the envelope. Handing it the
    // envelope made every save read back as "unit unconfirmed, no address, default profile",
    // which looked like the settings never persisted.
    settings: connectionSettingsFromRecord(asRecord(row?.settings) ?? row),
    capabilities: row?.capabilities ?? null,
    healthState: readString(row?.healthState) || 'UNKNOWN',
    lastHealthCheckAt: readString(row?.lastHealthCheckAt) || null,
    lastHealthMessage: readString(row?.lastHealthMessage) || null,
    verificationState: readString(row?.verificationState) || 'LIVE_UNVERIFIED',
  };
};

const readServerConnections = (
  data: Record<string, unknown>,
): AccountingConnectionRecord[] => {
  const rows = Array.isArray(data.connections) ? data.connections : [];

  return rows
    .map(parseServerConnectionView)
    .filter((row): row is AccountingConnectionRecord => row !== null);
};

const refusedOutcome = (
  outcome: Extract<AccountingSettingsApiOutcome, { kind: 'REFUSED' }>,
): Result<never> => refused(outcome.code, outcome.message);

// Whether this person may change the destination at all. A refusal is the answer, never
// an invitation to try the write and see.
export const readAccountingSettingsAuthority = async (
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<boolean>> => {
  const outcome = await callAccountingSettingsAction({
    body: { action: 'accounting-settings-authority' },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  return accepted(outcome.data.canManage === true);
};

export const loadConnectionsThroughServer = async (
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<AccountingConnectionRecord[]>> => {
  const outcome = await callAccountingSettingsAction({
    body: { action: 'accounting-connection-list' },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  return accepted(readServerConnections(outcome.data));
};

export const saveConnectionThroughServer = async (
  input: SaveConnectionInput,
  dependencies: AccountingSettingsDependencies = {},
): Promise<SaveConnectionResult> => {
  const name = input.name.trim();
  const descriptor = findAdapterDescriptor(input.adapterId.trim());

  if (name === '') {
    return refused('INVALID_INPUT', 'نام اتصال را وارد کنید');
  }

  if (descriptor === null) {
    return refused('ADAPTER_UNKNOWN', 'نرم‌افزار انتخاب‌شده آداپتور عملیاتی ندارد');
  }

  const settings = parseConnectionSettings(input.settings, {
    adapterId: descriptor.id,
  });

  if (!settings.ok) {
    return settings;
  }

  // No `capabilities` field is sent: the server derives them from the adapter contract,
  // and a body-supplied object would be ignored anyway.
  const outcome = await callAccountingSettingsAction({
    body: {
      action: 'accounting-connection-save',
      recordId: input.id ?? null,
      name,
      adapterId: descriptor.id,
      settings: settings.value,
    },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  const connections = readServerConnections(outcome.data);
  const saved =
    connections.find((connection) => connection.id === input.id) ??
    connections.find(
      (connection) =>
        connection.adapterId === descriptor.id && connection.name === name,
    ) ??
    null;

  if (saved === null) {
    return refused('QUERY_ERROR', 'the saved connection could not be read back');
  }

  return accepted({ connection: saved, adapter: descriptor });
};

// The probe runs on the server against the address it validates for this request; this
// route only asks for it and reads back the stored evidence. No health state, message or
// timestamp is sent, so a caller cannot post a green result.
export type ConnectionTestOutcome = {
  healthState: string;
  message: string;
  detail: string;
  verificationState: string;
  latencyMs: number;
  checkedAt: string;
  connection: AccountingConnectionRecord;
};

export const setDefaultConnectionThroughServer = async (
  connectionId: string,
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<AccountingConnectionRecord[]>> => {
  const outcome = await callAccountingSettingsAction({
    body: {
      action: 'accounting-connection-set-default',
      recordId: connectionId,
    },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  return accepted(readServerConnections(outcome.data));
};

export const deactivateConnectionThroughServer = async (
  connectionId: string,
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<AccountingConnectionRecord[]>> => {
  const outcome = await callAccountingSettingsAction({
    body: {
      action: 'accounting-connection-deactivate',
      recordId: connectionId,
    },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  return accepted(readServerConnections(outcome.data));
};

export const reactivateConnectionThroughServer = async (
  connectionId: string,
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<AccountingConnectionRecord[]>> => {
  const outcome = await callAccountingSettingsAction({
    body: {
      action: 'accounting-connection-reactivate',
      recordId: connectionId,
    },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  return accepted(readServerConnections(outcome.data));
};

export const testConnectionThroughServer = async (
  connectionId: string,
  dependencies: AccountingSettingsDependencies = {},
): Promise<Result<ConnectionTestOutcome>> => {
  const outcome = await callAccountingSettingsAction({
    body: {
      action: 'accounting-connection-test',
      recordId: connectionId,
    },
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refusedOutcome(outcome);
  }

  const connections = readServerConnections(outcome.data);
  const connection =
    connections.find((row) => row.id === connectionId) ?? null;
  const health = asRecord(outcome.data.health);

  if (connection === null || health === null) {
    return refused('QUERY_ERROR', 'the test result could not be read back');
  }

  return accepted({
    healthState: readString(health.healthState) || 'FAILED',
    message: readString(health.message),
    detail: readString(health.detail),
    verificationState: connection.verificationState,
    latencyMs:
      typeof health.latencyMs === 'number' ? health.latencyMs : 0,
    checkedAt: readString(health.checkedAt),
    connection,
  });
};
