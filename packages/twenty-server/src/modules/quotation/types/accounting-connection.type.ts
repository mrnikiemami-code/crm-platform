import { type AccountingConnectionSettings } from 'src/modules/quotation/utils/accounting-connection-settings.util';

// A stored destination as the settings page reads it. No credential is part of this
// shape: secrets live in the platform's encrypted application variables.
export type WorkspaceAccountingConnectionRow = {
  id: string;
  name: string | null;
  adapterId: string | null;
  adapterVersion: string | null;
  capabilities: unknown;
  isActive: boolean | null;
  isDefault: boolean | null;
  baseUrl: string | null;
  remoteUserId: string | null;
  defaultStorageId: string | null;
  moneyUnit: string | null;
  transportApproved: boolean | null;
  specialCodes: unknown;
  financialSettings: unknown;
  healthState: string | null;
  lastHealthCheckAt: string | null;
  lastHealthMessage: string | null;
  verificationState: string | null;
};

export type AccountingConnectionView = {
  recordId: string;
  name: string;
  adapterId: string;
  adapterVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
  settings: AccountingConnectionSettings;
  capabilities: unknown;
  healthState: string;
  lastHealthCheckAt: string | null;
  lastHealthMessage: string | null;
  verificationState: string;
};

export type SaveAccountingConnectionInput = {
  recordId: string | null;
  name: string;
  adapterId: string;
  settings: unknown;
};

// What the trusted probe proved, as the page displays it. No field here is read from a
// request: the server produced all of them.
export type AccountingHealthView = {
  healthState: string;
  message: string;
  detail: string;
  checkedAt: string;
  latencyMs: number;
};

export type AccountingConnectionOutcome =
  | {
      kind: 'OK';
      connections: AccountingConnectionView[];
      message: string;
      // The authoritative id of the row created/updated by a save; a new record
      // must never be selected by matching its name or by list position.
      affectedRecordId?: string;
      health?: AccountingHealthView;
    }
  | { kind: 'REFUSED'; code: string; message: string };
