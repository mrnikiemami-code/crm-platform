// Pure destination resolution for the workspace accounting default.
//
// Temporary UI selection is not represented here: a caller that already chose a connection
// id passes that id explicitly. When no id is named, only a row that is both marked default
// and still active is accepted. Row order and "first active" are never consulted — an old
// workspace with no default stays DESTINATION_REQUIRED until an authorized set-default.

export type AccountingDestinationCandidate = {
  recordId: string;
  isActive: boolean;
  isDefault: boolean;
};

export type ResolvedAccountingDestination =
  | {
      kind: 'OK';
      recordId: string;
      source: 'explicit' | 'workspace-default';
    }
  | {
      kind: 'REFUSED';
      code:
        | 'ACCOUNTING_DESTINATION_REQUIRED'
        | 'ACCOUNTING_CONNECTION_NOT_FOUND'
        | 'CONNECTION_INACTIVE';
    };

export const isValidWorkspaceDefaultConnection = (
  row: AccountingDestinationCandidate,
): boolean => row.isDefault === true && row.isActive === true;

export const findValidWorkspaceDefaultConnection = <
  TRow extends AccountingDestinationCandidate,
>(
  rows: readonly TRow[],
): TRow | null =>
  rows.find((row) => isValidWorkspaceDefaultConnection(row)) ?? null;

export const resolveAccountingDestination = ({
  connections,
  connectionId,
}: {
  connections: readonly AccountingDestinationCandidate[];
  connectionId?: string | null;
}): ResolvedAccountingDestination => {
  const explicitId =
    typeof connectionId === 'string' && connectionId.trim() !== ''
      ? connectionId.trim()
      : null;

  if (explicitId !== null) {
    const chosen = connections.find((row) => row.recordId === explicitId);

    if (chosen === undefined) {
      return { kind: 'REFUSED', code: 'ACCOUNTING_CONNECTION_NOT_FOUND' };
    }

    if (chosen.isActive !== true) {
      return { kind: 'REFUSED', code: 'CONNECTION_INACTIVE' };
    }

    return {
      kind: 'OK',
      recordId: chosen.recordId,
      source: 'explicit',
    };
  }

  const workspaceDefault = findValidWorkspaceDefaultConnection(connections);

  if (workspaceDefault === null) {
    return { kind: 'REFUSED', code: 'ACCOUNTING_DESTINATION_REQUIRED' };
  }

  return {
    kind: 'OK',
    recordId: workspaceDefault.recordId,
    source: 'workspace-default',
  };
};
