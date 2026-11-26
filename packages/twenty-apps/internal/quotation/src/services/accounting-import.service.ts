import {
  buildAccountingItemLinksQuery,
  buildAccountingPartyCandidatesQuery,
  buildAccountingPartyLinksQuery,
  buildCreateAccountingItemLinkMutation,
  buildCreateAccountingPartyLinkMutation,
  buildUpdateAccountingItemLinkMutation,
  buildUpdateAccountingPartyLinkMutation,
} from 'src/data/accounting-queries';
import { toGraphqlLiteral } from 'src/data/graphql-literal';
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
  type CrmPartyCandidate,
  type CrmPartySummary,
  type ExistingItemLink,
  type ExistingPartyLink,
  type ItemApplySelection,
  type ItemImportPreview,
  type PartyImportPreview,
} from 'src/domain/accounting/import-plan';
import {
  countItemDecisions,
  enrichItemPage,
} from 'src/domain/accounting/mapping-page';
import { loadCrmItemIndex } from 'src/services/accounting-crm-lookup.service';
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

// A person's full name is stored as two fields; the candidate list is displayed, never used
// to match, so a joined label is enough.
const loadCrmPartyCandidates = async (
  dependencies: ImportDependencies,
): Promise<CrmPartyCandidate[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildAccountingPartyCandidatesQuery());

  const people = readRows(data, 'people').flatMap((node) => {
    const id = readString(node.id);
    const name = asRecord(node.name);
    const fullName = `${readString(name?.firstName)} ${readString(name?.lastName)}`.trim();

    return id === ''
      ? []
      : [{ id, name: fullName || id, partyType: 'PERSON' as const }];
  });
  const companies = readRows(data, 'companies').flatMap((node) => {
    const id = readString(node.id);

    return id === ''
      ? []
      : [
          {
            id,
            name: readString(node.name) || id,
            partyType: 'COMPANY' as const,
          },
        ];
  });

  return [...people, ...companies];
};

export const previewItemImport = async (
  {
    connectionId,
    adapter,
    moneyUnit,
    // Set by the apply path: only the selected rows need their CRM side resolved, so a
    // confirmation of 3 rows costs one lookup and not one per row in the catalog.
    onlyExternalIds = null,
  }: {
    connectionId: string;
    adapter: AccountingAdapter;
    moneyUnit: AccountingMoneyUnit;
    onlyExternalIds?: string[] | null;
  },
  dependencies: ImportDependencies = {},
): Promise<Result<ItemImportPreview>> => {
  const remote = await adapter.listItems();

  if (!remote.ok) {
    return remote;
  }

  const links = await loadItemLinks(connectionId, dependencies);

  // Planned WITHOUT the CRM catalog: the plan's destination-side facts (duplicate codes,
  // numeric ids, price units) do not depend on it, and reading the catalog to find them was
  // the unbounded scan this replaces.
  const planned = planItemImport({
    remoteItems: remote.value,
    links,
    crmItems: [],
    moneyUnit,
  });

  const selected =
    onlyExternalIds === null
      ? planned.rows
      : planned.rows.filter((row) =>
          onlyExternalIds.includes(row.externalItemId),
        );

  const index = await loadCrmItemIndex(
    {
      skus: selected.map((row) => row.code),
      ids: selected.flatMap((row) =>
        row.suggestedInternalItemId === null
          ? []
          : [row.suggestedInternalItemId],
      ),
    },
    { execute: dependencies.execute },
  );
  const rows = enrichItemPage({ rows: selected, index });

  const summary = countItemDecisions(rows);

  return accepted({
    moneyUnit,
    rows,
    summary,
    totalRemoteItems: remote.value.length,
  });
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
  const candidates = await loadCrmPartyCandidates(dependencies);
  // A CRM party's national code is not a standard CRM field, so no automatic candidate is
  // proposed. The preview still reports duplicates inside the vendor and every already-linked
  // customer; linking a new one requires choosing a CRM record explicitly.
  const crmParties: CrmPartySummary[] = [];

  return accepted(
    planPartyImport({
      remoteParties: remote.value,
      links,
      crmParties,
      crmCandidates: candidates,
    }),
  );
};

export type PartyApplySelection = {
  externalPartyId: string;
  internalPartyId?: string;
  partyType?: 'PERSON' | 'COMPANY';
  // Create a CRM person/company from the remote party when no unique match exists.
  // Party kind is resolved server-side from the national identifier contract.
  createNew?: boolean;
};

const partyTypeFromNationalCode = (
  nationalCode: string | null | undefined,
): 'PERSON' | 'COMPANY' | null => {
  const digits = (nationalCode ?? '').replace(/\D/g, '');
  if (digits.length === 10) {
    return 'PERSON';
  }
  if (digits.length === 11) {
    return 'COMPANY';
  }
  return null;
};

const buildCreatePersonMutation = (data: {
  firstName: string;
  lastName: string;
}): string =>
  `mutation CreatePersonFromAccounting {
    createPerson(data: ${toGraphqlLiteral({
      name: { firstName: data.firstName, lastName: data.lastName },
    })}) { id }
  }`;

const buildCreateCompanyMutation = (name: string): string =>
  `mutation CreateCompanyFromAccounting {
    createCompany(data: ${toGraphqlLiteral({ name })}) { id }
  }`;

const splitPersonName = (
  fullName: string,
): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { firstName: 'بدون‌نام', lastName: '-' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '-' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

export const applyPartyImport = async (
  {
    connectionId,
    selections,
    allowRemoteVersionUpdate,
    remoteParties = [],
  }: {
    connectionId: string;
    selections: PartyApplySelection[];
    allowRemoteVersionUpdate: boolean;
    remoteParties?: {
      externalPartyId: string;
      fullName: string;
      nationalCode: string | null;
      mobile: string | null;
    }[];
  },
  dependencies: ImportDependencies = {},
): Promise<{
  createdLinks: number;
  updatedLinks: number;
  createdParties: number;
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
  const remoteById = new Map(
    remoteParties.map((party) => [party.externalPartyId, party]),
  );

  let createdLinks = 0;
  let updatedLinks = 0;
  let createdParties = 0;
  const refused: { externalPartyId: string; code: string; detail: string }[] = [];

  const processedExternalIds = new Set<string>();
  for (const selection of selections) {
    if (processedExternalIds.has(selection.externalPartyId)) {
      refused.push({ externalPartyId: selection.externalPartyId, code: 'ALREADY_SUCCEEDED', detail: 'duplicate selection' });
      continue;
    }
    processedExternalIds.add(selection.externalPartyId);
    const existing = byExternalId.get(selection.externalPartyId) ?? null;
    let internalPartyId = selection.internalPartyId?.trim() ?? '';
    let partyType = selection.partyType;

    // Never create another CRM record for an already mapped external identity.
    if (selection.createNew === true && existing !== null) {
      refused.push({
        externalPartyId: selection.externalPartyId,
        code: 'ALREADY_SUCCEEDED',
        detail: 'this customer is already linked',
      });
      continue;
    }

    if (selection.createNew === true && internalPartyId === '') {
      const remote = remoteById.get(selection.externalPartyId);
      if (remote === undefined || remote.fullName.trim() === '') {
        refused.push({
          externalPartyId: selection.externalPartyId,
          code: 'INSUFFICIENT_PARTY_DATA',
          detail: 'remote party data is missing for create',
        });
        continue;
      }
      const resolvedType = partyTypeFromNationalCode(remote.nationalCode);
      if (resolvedType === null) {
        refused.push({
          externalPartyId: selection.externalPartyId,
          code: 'PARTY_KIND_UNKNOWN',
          detail:
            'person/company cannot be inferred without a valid national identifier',
        });
        continue;
      }
      partyType = resolvedType;
      if (resolvedType === 'PERSON') {
        const names = splitPersonName(remote.fullName);
        const created = await execute(buildCreatePersonMutation(names));
        internalPartyId = readString(asRecord(created.createPerson)?.id);
      } else {
        const created = await execute(
          buildCreateCompanyMutation(remote.fullName.trim()),
        );
        internalPartyId = readString(asRecord(created.createCompany)?.id);
      }
      if (internalPartyId === '') {
        refused.push({
          externalPartyId: selection.externalPartyId,
          code: 'PARTY_CREATE_FAILED',
          detail: 'CRM create returned no id',
        });
        continue;
      }
      createdParties += 1;
    }

    if (internalPartyId === '' || partyType === undefined) {
      refused.push({
        externalPartyId: selection.externalPartyId,
        code: 'INVALID_INPUT',
        detail: 'internal party id and type are required',
      });
      continue;
    }

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
          internalPartyId,
          partyType,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'LINKED',
        }),
      );
      updatedLinks += 1;
      continue;
    }

    await execute(
      buildCreateAccountingPartyLinkMutation({
        name: `${internalPartyId.slice(0, 8)} @ ${connectionId.slice(0, 8)}`,
        externalPartyId: selection.externalPartyId,
        externalCode: selection.externalPartyId,
        syncStatus: 'LINKED',
        partyType,
        internalPartyId,
        lastSyncedAt: new Date().toISOString(),
        connectionId,
      }),
    );
    createdLinks += 1;
  }

  return { createdLinks, updatedLinks, createdParties, refused };
};

export const importFailureMessage = (error: unknown): string => {
  if (error instanceof RecordApiError) {
    return error.code === 'FORBIDDEN'
      ? 'دسترسی لازم برای وارد کردن داده‌های حسابداری وجود ندارد.'
      : 'خواندن یا ذخیرهٔ داده‌های وارداتی انجام نشد.';
  }

  return 'ارتباط با سرور برقرار نشد.';
};
