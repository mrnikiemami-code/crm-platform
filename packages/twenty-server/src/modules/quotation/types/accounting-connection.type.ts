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
  baseUrl: string | null;
  remoteUserId: string | null;
  defaultStorageId: string | null;
  moneyUnit: string | null;
  transportApproved: boolean | null;
  specialCodes: unknown;
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
  capabilities?: unknown;
};

export type AccountingHealthInput = {
  recordId: string;
  healthState: string;
  message: string;
  checkedAt: string;
};

export type AccountingConnectionOutcome =
  | {
      kind: 'OK';
      connections: AccountingConnectionView[];
      message: string;
    }
  | { kind: 'REFUSED'; code: string; message: string };
