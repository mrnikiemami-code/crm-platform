import {
  buildAccountingItemLinksQuery,
  buildAccountingPartyLinksQuery,
  buildAccountingCatalogItemsQuery,
  buildCreateAccountingItemLinkMutation,
  buildCreateAccountingPartyLinkMutation,
  buildUpdateAccountingItemLinkMutation,
  buildUpdateAccountingPartyLinkMutation,
} from 'src/data/accounting-queries';
import {
  buildCreateCatalogItemMutation,
  buildCreatePriceMutation,
  buildDefaultPriceListQuery,
} from 'src/data/quotation-queries';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import {
  type AccountingAdapter,
  type AccountingMoneyUnit,
} from 'src/domain/accounting/adapter-contract';
import {
  planItemImport,
  planPartyImport,
  resolveItemApplyPlan,
  type CrmItemSummary,
  type CrmPartySummary,
  type ExistingItemLink,
  type ExistingPartyLink,
  type ItemApplySelection,
  type ItemImportPreview,
  type PartyImportPreview,
} from 'src/domain/accounting/import-plan';
import { accepted, type Result } from 'src/domain/shared/result';

export type ImportDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

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

const readCreatedId = (
  data: Record<string, unknown>,
  root: string,
): string => {
  const node = asRecord(data[root]);

  return node === null ? '' : readString(node.id);
};

export const loadItemLinks = async (
  connectionId: string,
  dependencies: ImportDependencies = {},
): Promise<ExistingItemLink[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildAccountingItemLinksQuery({ connectionId }));

  return readRows(data, 'accountingItemLinks').flatMap((node) => {
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
        syncStatus: readString(node.syncStatus) || 'LINKED',
      },
    ];
  });
};

export const loadPartyLinks = async (
  connectionId: string,
  dependencies: ImportDependencies = {},
): Promise<ExistingPartyLink[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildAccountingPartyLinksQuery({ connectionId }));

  return readRows(data, 'accountingPartyLinks').flatMap((node) => {
    const linkId = readString(node.id);

    if (linkId === '') {
      return [];
    }

    return [
      {
        linkId,
        externalPartyId: readString(node.externalPartyId) || null,
        internalPartyId: readString(node.internalPartyId) || null,
        remoteVersion: readString(node.remoteVersion) || null,
        syncStatus: readString(node.syncStatus) || 'LINKED',
      },
    ];
  });
};

const loadCrmItems = async (
  dependencies: ImportDependencies,
): Promise<CrmItemSummary[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildAccountingCatalogItemsQuery());

  return readRows(data, 'catalogItems').flatMap((node) => {
    const id = readString(node.id);

    if (id === '') {
      return [];
    }

    return [
      {
        id,
        name: readString(node.name),
        sku: readString(node.sku) || null,
      },
    ];
  });
};

export const previewItemImport = async (
  {
    connectionId,
    adapter,
    moneyUnit,
  }: {
    connectionId: string;
    adapter: AccountingAdapter;
    moneyUnit: AccountingMoneyUnit;
  },
  dependencies: ImportDependencies = {},
): Promise<Result<ItemImportPreview>> => {
  const remote = await adapter.listItems();

  if (!remote.ok) {
    return remote;
  }

  const [links, crmItems] = await Promise.all([
    loadItemLinks(connectionId, dependencies),
    loadCrmItems(dependencies),
  ]);

  return accepted(
    planItemImport({
      remoteItems: remote.value,
      links,
      crmItems,
      moneyUnit,
    }),
  );
};

export type ItemApplyOutcome = {
  createdLinks: number;
  createdItems: number;
  updatedLinks: number;
  createdPrices: number;
  refused: { externalItemId: string; code: string; detail: string }[];
};

const resolvePriceListId = async (
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<string | null> => {
  const data = await execute(buildDefaultPriceListQuery());
  const edge = readRows(data, 'priceLists')[0];

  return edge === undefined ? null : readString(edge.id) || null;
};

export const applyItemImport = async (
  {
    connectionId,
    preview,
    selections,
    allowRemoteVersionUpdate,
    applyPrices,
  }: {
    connectionId: string;
    preview: ItemImportPreview;
    selections: ItemApplySelection[];
    allowRemoteVersionUpdate: boolean;
    applyPrices: boolean;
  },
  dependencies: ImportDependencies = {},
): Promise<ItemApplyOutcome> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const plan = resolveItemApplyPlan({
    preview,
    selections,
    allowRemoteVersionUpdate,
  });

  const outcome: ItemApplyOutcome = {
    createdLinks: 0,
    createdItems: 0,
    updatedLinks: 0,
    createdPrices: 0,
    refused: [...plan.refused.map((row) => ({ ...row }))],
  };

  const priceListId = applyPrices ? await resolvePriceListId(execute) : null;

  for (const row of plan.rows) {
    if (row.action === 'UPDATE_LINK_VERSION') {
      const linkId = preview.rows.find(
        (previewRow) => previewRow.externalItemId === row.externalItemId,
      )?.existingLinkId;

      if (linkId === null || linkId === undefined) {
        outcome.refused.push({
          externalItemId: row.externalItemId,
          code: 'TARGET_NOT_LINKED',
          detail: 'the link disappeared between preview and apply',
        });
        continue;
      }

      await execute(
        buildUpdateAccountingItemLinkMutation(linkId, {
          remoteVersion: row.remoteVersion,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'LINKED',
        }),
      );
      outcome.updatedLinks += 1;
      continue;
    }

    let itemId = row.internalItemId;

    if (row.action === 'CREATE_CATALOG_ITEM') {
      const created = await execute(
        buildCreateCatalogItemMutation({
          name: row.name,
          sku: row.code,
          unit: 'عدد',
          description: row.secondaryName,
          kind: 'PRODUCT',
          isActive: true,
        }),
      );
      itemId = readCreatedId(created, 'createCatalogItem');

      if (itemId === '') {
        outcome.refused.push({
          externalItemId: row.externalItemId,
          code: 'QUERY_ERROR',
          detail: 'the catalog item was not created',
        });
        continue;
      }

      outcome.createdItems += 1;
    }

    if (itemId === null || itemId.trim() === '') {
      outcome.refused.push({
        externalItemId: row.externalItemId,
        code: 'INVALID_INPUT',
        detail: 'no CRM item was chosen for this row',
      });
      continue;
    }

    await execute(
      buildCreateAccountingItemLinkMutation({
        name: `${row.name} @ ${connectionId.slice(0, 8)}`,
        externalItemId: row.externalItemId,
        externalCode: row.code,
        remoteVersion: row.remoteVersion,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'LINKED',
        itemId,
        connectionId,
      }),
    );
    outcome.createdLinks += 1;

    if (applyPrices && priceListId !== null && row.priceMicros !== null) {
      await execute(
        buildCreatePriceMutation({
          itemId,
          priceListId,
          unitPriceExact: row.priceMicros,
        }),
      );
      outcome.createdPrices += 1;
    }
  }

  return outcome;
};

export const previewPartyImport = async (
  {
    connectionId,
    adapter,
  }: {
    connectionId: string;
    adapter: AccountingAdapter;
  },
  dependencies: ImportDependencies = {},
): Promise<Result<PartyImportPreview>> => {
  const remote = await adapter.listParties();

  if (!remote.ok) {
    return remote;
  }

  const links = await loadPartyLinks(connectionId, dependencies);
  // A CRM party's national code is not a standard CRM field, so no automatic candidate is
  // proposed. The preview still reports duplicates inside the vendor and every already-linked
  // customer; linking a new one requires choosing a CRM record explicitly.
  const crmParties: CrmPartySummary[] = [];

  return accepted(
    planPartyImport({ remoteParties: remote.value, links, crmParties }),
  );
};

export type PartyApplySelection = {
  externalPartyId: string;
  internalPartyId: string;
  partyType: 'PERSON' | 'COMPANY';
};

export const applyPartyImport = async (
  {
    connectionId,
    selections,
    allowRemoteVersionUpdate,
  }: {
    connectionId: string;
    selections: PartyApplySelection[];
    allowRemoteVersionUpdate: boolean;
  },
  dependencies: ImportDependencies = {},
): Promise<{
  createdLinks: number;
  updatedLinks: number;
  refused: { externalPartyId: string; code: string; detail: string }[];
}> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const links = await loadPartyLinks(connectionId, dependencies);
  const byExternalId = new Map(
    links
      .filter((link): link is ExistingPartyLink & { externalPartyId: string } =>
        link.externalPartyId !== null,
      )
      .map((link) => [link.externalPartyId, link]),
  );

  let createdLinks = 0;
  let updatedLinks = 0;
  const refused: { externalPartyId: string; code: string; detail: string }[] = [];

  for (const selection of selections) {
    const existing = byExternalId.get(selection.externalPartyId) ?? null;

    if (existing !== null) {
      if (!allowRemoteVersionUpdate) {
        refused.push({
          externalPartyId: selection.externalPartyId,
          code: 'ALREADY_SUCCEEDED',
          detail: 'this customer is already linked',
        });
        continue;
      }

      await execute(
        buildUpdateAccountingPartyLinkMutation(existing.linkId, {
          internalPartyId: selection.internalPartyId,
          partyType: selection.partyType,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'LINKED',
        }),
      );
      updatedLinks += 1;
      continue;
    }

    await execute(
      buildCreateAccountingPartyLinkMutation({
        name: `${selection.internalPartyId.slice(0, 8)} @ ${connectionId.slice(0, 8)}`,
        externalPartyId: selection.externalPartyId,
        externalCode: selection.externalPartyId,
        syncStatus: 'LINKED',
        partyType: selection.partyType,
        internalPartyId: selection.internalPartyId,
        lastSyncedAt: new Date().toISOString(),
        connectionId,
      }),
    );
    createdLinks += 1;
  }

  return { createdLinks, updatedLinks, refused };
};

export const importFailureMessage = (error: unknown): string => {
  if (error instanceof RecordApiError) {
    return error.code === 'FORBIDDEN'
      ? 'دسترسی لازم برای وارد کردن داده‌های حسابداری وجود ندارد.'
      : 'خواندن یا ذخیرهٔ داده‌های وارداتی انجام نشد.';
  }

  return 'ارتباط با سرور برقرار نشد.';
};
