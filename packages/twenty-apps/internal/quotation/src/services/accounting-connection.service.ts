import {
  ACCOUNTING_ADAPTER_CONTRACT_VERSION,
  type ConnectionSettings,
  type ConnectionVerificationState,
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
  buildCreateAccountingConnectionMutation,
  buildUpdateAccountingConnectionMutation,
} from 'src/data/accounting-queries';
import { type GraphqlValue } from 'src/data/graphql-literal';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { type AccountingAdapter } from 'src/domain/accounting/adapter-contract';

export type AccountingConnectionRecord = {
  id: string;
  name: string;
  adapterId: string;
  adapterVersion: string | null;
  isActive: boolean;
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
    isActive: readBoolean(node.isActive, true),
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
  const data = await execute(buildAccountingConnectionsQuery());

  return readRows(data, 'accountingConnections')
    .map(parseConnectionRecord)
    .filter((record): record is AccountingConnectionRecord => record !== null);
};

const activeConnection = (
  connections: AccountingConnectionRecord[],
): AccountingConnectionRecord | null =>
  connections.find((connection) => connection.isActive) ??
  connections[0] ??
  null;

export const resolveConnection = async (
  {
    connectionId,
  }: {
    connectionId?: string | null;
  },
  dependencies: ConnectionDependencies = {},
): Promise<Result<AccountingConnectionRecord>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(
    buildAccountingConnectionsQuery(
      connectionId === undefined || connectionId === null || connectionId === ''
        ? {}
        : { connectionId },
    ),
  );

  const connections = readRows(data, 'accountingConnections')
    .map(parseConnectionRecord)
    .filter((record): record is AccountingConnectionRecord => record !== null);

  const selected =
    connectionId === undefined || connectionId === null || connectionId === ''
      ? activeConnection(connections)
      : (connections.find((connection) => connection.id === connectionId) ??
        null);

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
): Result<AccountingAdapter> =>
  createAccountingAdapter({
    adapterId: record.adapterId,
    settings: record.settings,
    ...(secrets.tunnelToken === undefined
      ? {}
      : { tunnelToken: secrets.tunnelToken }),
    allowInsecureTransport: secrets.allowInsecureTransport,
  });

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

const verificationFor = (
  descriptor: AdapterDescriptor,
): ConnectionVerificationState =>
  descriptor.isLive ? 'LIVE_UNVERIFIED' : 'MOCK';

export const saveConnection = async (
  input: SaveConnectionInput,
  dependencies: ConnectionDependencies = {},
): Promise<SaveConnectionResult> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const name = input.name.trim();
  const descriptor = findAdapterDescriptor(input.adapterId.trim());

  if (name === '') {
    return refused('INVALID_INPUT', 'a connection needs a name');
  }

  if (descriptor === null) {
    return refused('ADAPTER_UNKNOWN', 'the selected accounting adapter is unknown');
  }

  const settings = parseConnectionSettings(input.settings);

  if (!settings.ok) {
    return settings;
  }

  const adapter = createAccountingAdapter({
    adapterId: descriptor.id,
    settings: settings.value,
    allowInsecureTransport: settings.value.transportApproved,
  });

  if (!adapter.ok) {
    return adapter;
  }

  const fields = {
    name,
    adapterId: descriptor.id,
    adapterVersion: ACCOUNTING_ADAPTER_CONTRACT_VERSION,
    capabilities: adapter.value.capabilities as unknown as Record<
      string,
      GraphqlValue
    >,
    baseUrl: settings.value.baseUrl,
    remoteUserId: settings.value.remoteUserId,
    defaultStorageId: settings.value.defaultStorageId,
    moneyUnit: settings.value.moneyUnit,
    transportApproved: settings.value.transportApproved,
    specialCodes: settings.value.specialCodes as unknown as Record<
      string,
      GraphqlValue
    >,
    verificationState: verificationFor(descriptor),
  };

  // A newly configured connection has not answered yet, so a previously verified state must
  // not survive a settings change. Anything that could alter the address or the credentials
  // goes back to "unverified" instead of inheriting an old green check.
  const data = await execute(
    input.id === undefined || input.id === null || input.id.trim() === ''
      ? buildCreateAccountingConnectionMutation(fields)
      : buildUpdateAccountingConnectionMutation(input.id.trim(), {
          ...fields,
          healthState: 'UNKNOWN',
          lastHealthMessage: 'تنظیمات اتصال تغییر کرد؛ آزمایش اتصال دوباره لازم است.',
        }),
  );

  const node = asRecord(
    input.id === undefined || input.id === null || input.id.trim() === ''
      ? data.createAccountingConnection
      : data.updateAccountingConnection,
  );

  if (node === null) {
    return refused('QUERY_ERROR', 'the connection was not saved');
  }

  const connection = parseConnectionRecord(node);

  if (connection === null) {
    return refused('QUERY_ERROR', 'the saved connection could not be read back');
  }

  return accepted({ connection, adapter: descriptor });
};

export type TestConnectionResult = {
  healthState: 'OK' | 'FAILED';
  message: string;
  verificationState: ConnectionVerificationState;
  latencyMs: number;
  detail: string;
  checkedAt: string;
};

export const testConnection = async (
  record: AccountingConnectionRecord,
  secrets: AdapterSecrets,
  { now = () => new Date() }: { now?: () => Date } = {},
): Promise<Result<TestConnectionResult>> => {
  const adapter = buildAdapter(record, secrets);

  if (!adapter.ok) {
    return adapter;
  }

  const health = await adapter.value.testConnection();

  if (!health.ok) {
    return health;
  }

  const checkedAt = health.value.checkedAt || now().toISOString();

  if (health.value.kind === 'REACHABLE') {
    return accepted({
      healthState: 'OK',
      message:
        'نرم‌افزار حسابداری به درخواست آزمایشی پاسخ داد. برای ارسال واقعی، تأیید انتقال امن و واحد مبلغ لازم است.',
      verificationState: adapter.value.isLive
        ? 'LIVE_VERIFIED'
        : 'MOCK',
      latencyMs: health.value.latencyMs,
      detail: health.value.detail,
      checkedAt,
    });
  }

  return accepted({
    healthState: 'FAILED',
    message:
      health.value.code === 'TIMEOUT'
        ? 'نرم‌افزار حسابداری در زمان مجاز پاسخ نداد؛ آدرس و دسترسی شبکه را بررسی کنید.'
        : 'ارتباط با نرم‌افزار حسابداری برقرار نشد؛ آدرس سرویس و تونل امن را بررسی کنید.',
    verificationState: 'LIVE_UNVERIFIED',
    latencyMs: health.value.latencyMs,
    detail: health.value.detail,
    checkedAt,
  });
};

export const persistHealth = async (
  connectionId: string,
  result: TestConnectionResult,
  dependencies: ConnectionDependencies = {},
): Promise<void> => {
  const execute = dependencies.execute ?? executeRecordGraphql;

  await execute(
    buildUpdateAccountingConnectionMutation(connectionId, {
      healthState: result.healthState,
      lastHealthMessage: `${result.message} (${result.detail})`,
      lastHealthCheckAt: result.checkedAt,
      verificationState: result.verificationState,
    }),
  );
};

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
