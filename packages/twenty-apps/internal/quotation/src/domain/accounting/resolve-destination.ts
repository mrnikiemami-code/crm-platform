// Shared destination pick for settings, mappings, and quotation preview.
//
// Workspace default comes from the server `isDefault` flag on an active connection.
// This module never falls back to "first row" or "first active".

export type AccountingDestinationCandidate = {
  id: string;
  isActive: boolean;
  isDefault: boolean;
};

export type ResolvedAccountingDestination =
  | {
      kind: 'OK';
      connectionId: string;
      source: 'explicit' | 'workspace-default';
    }
  | {
      kind: 'REFUSED';
      code:
        | 'ACCOUNTING_DESTINATION_REQUIRED'
        | 'CONNECTION_NOT_FOUND'
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
    const chosen = connections.find((row) => row.id === explicitId);

    if (chosen === undefined) {
      return { kind: 'REFUSED', code: 'CONNECTION_NOT_FOUND' };
    }

    if (chosen.isActive !== true) {
      return { kind: 'REFUSED', code: 'CONNECTION_INACTIVE' };
    }

    return {
      kind: 'OK',
      connectionId: chosen.id,
      source: 'explicit',
    };
  }

  const workspaceDefault = findValidWorkspaceDefaultConnection(connections);

  if (workspaceDefault === null) {
    return { kind: 'REFUSED', code: 'ACCOUNTING_DESTINATION_REQUIRED' };
  }

  return {
    kind: 'OK',
    connectionId: workspaceDefault.id,
    source: 'workspace-default',
  };
};
