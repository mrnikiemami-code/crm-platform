import { isNonEmptyString } from '@sniptt/guards';
import { Not } from 'typeorm';

import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { isNonEmptyAccountingCodeSnapshot } from 'src/modules/quotation/utils/quotation-accounting-snapshot.util';

type SnapshotUsageRow = {
  id: string;
  taxAccountingCode?: string | null;
  currencyAccountingCode?: string | null;
  taxPolicyRecordId?: string | null;
  quotationCurrencyRecordId?: string | null;
};

const quotationRepository = (
  scope: WorkspaceTransactionScope,
): WorkspaceRepository<SnapshotUsageRow> =>
  scope.getRepository<SnapshotUsageRow>('quotation', {
    shouldBypassPermissionChecks: true,
  });

const quotationLineRepository = (
  scope: WorkspaceTransactionScope,
): WorkspaceRepository<SnapshotUsageRow> =>
  scope.getRepository<SnapshotUsageRow>('quotationLine', {
    shouldBypassPermissionChecks: true,
  });

// C4 Option A + lock-by-reference-id: any quotation (header) or line that stored
// this tax-policy row id with a non-empty taxAccountingCode freezes further
// accountingCode edits on that policy.
export const isTaxPolicyAccountingCodeLocked = async ({
  scope,
  taxPolicyRecordId,
}: {
  scope: WorkspaceTransactionScope;
  taxPolicyRecordId: string;
}): Promise<boolean> => {
  if (!isNonEmptyString(taxPolicyRecordId)) {
    return false;
  }

  const headerRows = await quotationRepository(scope).find({
    where: {
      taxPolicyRecordId,
      taxAccountingCode: Not(''),
    },
    select: {
      id: true,
      taxAccountingCode: true,
      taxPolicyRecordId: true,
    },
    take: 20,
  });

  if (
    headerRows.some((row) =>
      isNonEmptyAccountingCodeSnapshot(row.taxAccountingCode),
    )
  ) {
    return true;
  }

  // WS3: multi-policy drafts lock every line policy that carried a non-empty code.
  try {
    const lineRows = await quotationLineRepository(scope).find({
      where: {
        taxPolicyRecordId,
        taxAccountingCode: Not(''),
      },
      select: {
        id: true,
        taxAccountingCode: true,
        taxPolicyRecordId: true,
      },
      take: 20,
    });

    return lineRows.some((row) =>
      isNonEmptyAccountingCodeSnapshot(row.taxAccountingCode),
    );
  } catch {
    // Pre-WS3 workspaces may lack line snapshot columns until schema apply.
    return false;
  }
};

export const isQuotationUnitAccountingCodeLocked = async ({
  scope,
  quotationUnitRecordId,
}: {
  scope: WorkspaceTransactionScope;
  quotationUnitRecordId: string;
}): Promise<boolean> => {
  if (!isNonEmptyString(quotationUnitRecordId)) {
    return false;
  }

  const catalogRepository = scope.getRepository<{
    id: string;
    unitRecordId?: string | null;
    accountingCode?: string | null;
  }>('catalogItem', {
    shouldBypassPermissionChecks: true,
  });

  try {
    const rows = await catalogRepository.find({
      where: { unitRecordId: quotationUnitRecordId },
      select: { id: true, unitRecordId: true },
      take: 20,
    });

    return rows.length > 0;
  } catch {
    return false;
  }
};

export const isCurrencyAccountingCodeLocked = async ({
  scope,
  quotationCurrencyRecordId,
}: {
  scope: WorkspaceTransactionScope;
  quotationCurrencyRecordId: string;
}): Promise<boolean> => {
  if (!isNonEmptyString(quotationCurrencyRecordId)) {
    return false;
  }

  const rows = await quotationRepository(scope).find({
    where: {
      quotationCurrencyRecordId,
      currencyAccountingCode: Not(''),
    },
    select: {
      id: true,
      currencyAccountingCode: true,
      quotationCurrencyRecordId: true,
    },
    take: 20,
  });

  return rows.some((row) =>
    isNonEmptyAccountingCodeSnapshot(row.currencyAccountingCode),
  );
};
