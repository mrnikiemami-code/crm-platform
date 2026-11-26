import {
  type ConnectionRecord,
  type PanelData,
  asRecord,
  readString,
} from 'src/components/accounting/accounting-shared';
import { ADAPTER_DESCRIPTORS } from 'src/domain/accounting/adapter-registry';
import { connectionSettingsFromRecord } from 'src/domain/accounting/connection-settings';

// Nest owns identity, permissions and the actual adapter contract. Local descriptors are
// ONLY Persian presentation metadata and can be used after the server has explicitly
// announced the same adapter id, contract version and live/simulated mode.
const verifiedAdapterDescriptors = (value: unknown): PanelData['adapters'] => {
  if (!Array.isArray(value)) {
    throw new Error('ACCOUNTING_ADAPTER_CONTRACT_UNAVAILABLE');
  }

  return value.flatMap((item) => {
    const server = asRecord(item);
    const id = readString(server?.id);
    const contractVersion = readString(server?.contractVersion);
    const local = ADAPTER_DESCRIPTORS.find((entry) => entry.id === id);

    if (
      local === undefined ||
      contractVersion === '' ||
      local.contractVersion !== contractVersion ||
      typeof server?.isLive !== 'boolean' ||
      server.isLive !== local.isLive
    ) {
      return [];
    }

    return [local];
  });
};

// The Nest DTO stores historical tax mappings and special-item codes inside
// settings.specialCodes, whereas the older app view expects them as independent
// properties. Use the existing domain parser, which explicitly supports both layouts.
// Never deduce an id from name/list position, and never discard malformed rows.
export const parseAccountingNestConnections = (value: unknown): ConnectionRecord[] => {
  if (!Array.isArray(value)) {
    throw new Error('ACCOUNTING_CONNECTION_LIST_INVALID');
  }

  return value.map((item) => {
    const raw = asRecord(item);

    if (raw === null) {
      throw new Error('ACCOUNTING_CONNECTION_RECORD_INVALID');
    }

    const id = readString(raw.recordId) || readString(raw.id);
    const name = readString(raw.name);
    const adapterId = readString(raw.adapterId);
    const settings = asRecord(raw.settings);

    if (id === '' || name === '' || adapterId === '' || settings === null) {
      throw new Error('ACCOUNTING_CONNECTION_RECORD_INVALID');
    }

    return {
      id,
      name,
      adapterId,
      adapterVersion: readString(raw.adapterVersion) || null,
      isActive: raw.isActive === true,
      isDefault: raw.isDefault === true,
      settings: connectionSettingsFromRecord(settings),
      healthState: readString(raw.healthState) || 'UNKNOWN',
      lastHealthCheckAt: readString(raw.lastHealthCheckAt) || null,
      lastHealthMessage: readString(raw.lastHealthMessage) || null,
      verificationState: readString(raw.verificationState) || 'LIVE_UNVERIFIED',
    };
  });
};

export const parseAccountingNestPanel = (data: Record<string, unknown>): PanelData => {
  if (data.success !== true || typeof data.canManage !== 'boolean') {
    throw new Error('ACCOUNTING_AUTHORITY_RESPONSE_INVALID');
  }

  return {
    connections: parseAccountingNestConnections(data.connections),
    adapters: verifiedAdapterDescriptors(data.supportedAdapters),
    canManage: data.canManage,
    // The old /s worker read different runtime environment variables. The Nest
    // connection endpoint cannot attest to those secrets or export switches.
    // Unknown is NOT configured/disabled proof; downstream actions remain closed.
    credentials: {
      tunnelTokenConfigured: false,
      insecureWritesApproved: false,
    },
    flags: {
      outboundEnabled: false,
      documentExportEnabled: false,
    },
    metadataVerified: false,
  };
};

// A transaction's affectedRecordId is explicit server evidence. In particular a
// new connection must never be chosen by name, "last row", or another caller's insert.
export const savedAccountingRecordFromNest = (
  data: Record<string, unknown>,
  expectedId: string | null,
): ConnectionRecord => {
  if (data.success !== true) {
    throw new Error('ACCOUNTING_SAVE_FAILED');
  }

  const affectedId = readString(data.affectedRecordId);

  if (affectedId === '' || (expectedId !== null && expectedId !== affectedId)) {
    throw new Error('ACCOUNTING_SAVED_ID_MISSING_OR_CHANGED');
  }

  const matches = parseAccountingNestConnections(data.connections).filter(
    (row) => row.id === affectedId,
  );

  if (matches.length !== 1) {
    throw new Error('ACCOUNTING_SAVED_ROW_NOT_FOUND');
  }

  return matches[0];
};

export const readAccountingNestHealth = (
  data: Record<string, unknown>,
): { healthState: string; message: string; detail: string } => {
  if (data.success !== true) {
    throw new Error('ACCOUNTING_TEST_FAILED');
  }

  const health = asRecord(data.health);
  const healthState = readString(health?.healthState);
  const message = readString(health?.message);

  if (healthState === '' || message === '') {
    throw new Error('ACCOUNTING_HEALTH_RESPONSE_INVALID');
  }

  return {
    healthState,
    message,
    detail: readString(health?.detail),
  };
};
