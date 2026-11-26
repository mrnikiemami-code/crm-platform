import { createHash } from 'node:crypto';
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
  buildCatalogItemByIdQuery,
  buildUpdateCatalogItemMutation,
  buildCreateCatalogItemMutation,
  buildCreatePriceMutation,
  buildDefaultPriceListQuery,
} from 'src/data/quotation-queries';
import { RecordApiError, executeCallerRecordGraphql, executeRecordGraphql } from 'src/data/record-api';
import {
  type AccountingAdapter,
  type AccountingMoneyUnit,
  type RemoteParty,
} from 'src/domain/accounting/adapter-contract';
import {
  planItemImport,
  planPartyImport,
  resolveItemApplyPlan,
  type CrmPartyCandidate,
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
import { crmPartyFields, enrichPartyRows, loadCrmPartyIdentities, resolvePartyIdentity, stableCustomerRecordId } from 'src/services/accounting-party-identity.service';
import { partyDisplayName, partyNationalIdentity, normalizeEconomicCode } from 'src/domain/accounting/party-identity';
import { mergeSourcePartyProfile } from 'src/domain/accounting/party-profile';
import { verifyCustomerRecord } from 'src/services/customer-picker.service';
import { isPriceValidOnDay } from 'src/domain/catalog/price-snapshot';
import { parseMicrosExact } from 'src/domain/money/micros';
import { accepted, type Result } from 'src/domain/shared/result';

export type ImportDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
  executeCustomer?: (query: string) => Promise<Record<string, unknown>>;
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
  const links: ExistingItemLink[] = [];
  let afterCursor: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    const data = await execute(buildAccountingItemLinksQuery({ connectionId, afterCursor }));
    for (const node of readRows(data, 'accountingItemLinks')) {
      const linkId = readString(node.id);
      if (!linkId) continue;
      links.push({ linkId, externalItemId: readString(node.externalItemId) || null,
        internalItemId: readString(asRecord(node.item)?.id) || null,
        remoteVersion: readString(node.remoteVersion) || null, syncStatus: readString(node.syncStatus) || 'LINKED' });
    }
    const page = asRecord(asRecord(data.accountingItemLinks)?.pageInfo);
    if (page?.hasNextPage !== true) break;
    const next = readString(page.endCursor);
    if (!next || seen.has(next) || seen.size >= 1000) throw new RecordApiError('INVALID_RESPONSE', 'Incomplete item links');
    seen.add(next); afterCursor = next;
  }
  return links;
};

export const loadPartyLinks = async (
  connectionId: string,
  dependencies: ImportDependencies = {},
): Promise<ExistingPartyLink[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const links: ExistingPartyLink[] = [];
  let afterCursor: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    const data = await execute(buildAccountingPartyLinksQuery({ connectionId, afterCursor }));
    for (const node of readRows(data, 'accountingPartyLinks')) {
      const linkId = readString(node.id);
      if (linkId === '') continue;
      const kind = readString(node.partyType);
      links.push({
        linkId,
        externalPartyId: readString(node.externalPartyId) || null,
        internalPartyId: readString(node.internalPartyId) || null,
        remoteVersion: readString(node.remoteVersion) || null,
        sourceProfile: readString(node.sourceProfile) || null,
        syncStatus: readString(node.syncStatus) || 'LINKED',
        ...(kind === 'PERSON' || kind === 'COMPANY' ? { partyType: kind } : {}),
      });
    }
    const page = asRecord(asRecord(data.accountingPartyLinks)?.pageInfo);
    if (page?.hasNextPage !== true) break;
    const next = readString(page.endCursor);
    if (!next || seen.has(next) || seen.size >= 1000) {
      throw new RecordApiError('INVALID_RESPONSE', 'Accounting party links could not be read completely');
    }
    seen.add(next);
    afterCursor = next;
  }
  return links;
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

// Stable IDs are scoped to the workspace database and source connection.
const stableImportId = (...parts: string[]): string => {
  const hex = createHash('sha256').update('quotation/accounting-import:' + JSON.stringify(parts)).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};

const syncAccountingItemPrice = async (
  execute: (query: string) => Promise<Record<string, unknown>>,
  itemId: string, priceListId: string, amount: string,
): Promise<boolean> => {
  const day = new Date().toISOString().slice(0, 10);
  const prices: { id: string; unitPriceExact: string; validFrom: string | null; validTo: string | null }[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (;;) {
    const after: string = cursor === null ? '' : `, after: ${toGraphqlLiteral(cursor)}`;
    const data = await execute(`query AccountingItemPrices { prices(first: 100${after}, filter: { itemId: { eq: ${toGraphqlLiteral(itemId)} }, priceListId: { eq: ${toGraphqlLiteral(priceListId)} } }) { edges { node { id unitPriceExact validFrom validTo } } pageInfo { hasNextPage endCursor } } }`);
    if (!Array.isArray(asRecord(data.prices)?.edges)) throw new RecordApiError('INVALID_RESPONSE', 'Missing price records');
    for (const node of readRows(data, 'prices')) {
      prices.push({ id: readString(node.id), unitPriceExact: readString(node.unitPriceExact), validFrom: readString(node.validFrom) || null, validTo: readString(node.validTo) || null });
    }
    const page = asRecord(asRecord(data.prices)?.pageInfo);
    if (page?.hasNextPage !== true) break;
    const next = readString(page.endCursor);
    if (!next || seen.has(next) || seen.size >= 100) throw new RecordApiError('INVALID_RESPONSE', 'Incomplete price history');
    seen.add(next); cursor = next;
  }
  const active = prices.filter((price) => isPriceValidOnDay(price, day)).sort((a,b) => (b.validFrom ?? '').localeCompare(a.validFrom ?? ''));
  const current = active[0];
  const sameDay = active.filter((price) => price.validFrom?.slice(0, 10) === day);
  const proposed = parseMicrosExact(amount);
  if (!proposed.ok) throw new RecordApiError('INVALID_RESPONSE', 'Invalid accounting price');
  if (sameDay.length > 1) throw new RecordApiError('QUERY_ERROR', 'Ambiguous current price');
  const existing = current ? parseMicrosExact(current.unitPriceExact) : null;
  if (existing?.ok && existing.value === proposed.value) return false;
  if (sameDay.length === 1) {
    const id = sameDay[0].id;
    if (!id) throw new RecordApiError('INVALID_RESPONSE', 'Price identity missing');
    const result = await execute(`mutation UpdateAccountingPrice { updatePrice(id: ${toGraphqlLiteral(id)}, data: { unitPriceExact: ${toGraphqlLiteral(amount)} }) { id } }`);
    if (readCreatedId(result, 'updatePrice') !== id) throw new RecordApiError('QUERY_ERROR', 'Price update not confirmed');
    return true;
  }
  const result = await execute(buildCreatePriceMutation({ id: stableImportId('price', itemId, priceListId, day), itemId, priceListId, unitPriceExact: amount, validFrom: day }));
  if (!readCreatedId(result, 'createPrice')) throw new RecordApiError('QUERY_ERROR', 'Price creation not confirmed');
  return true;
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

  const processed = new Set<string>();
  for (const row of plan.rows) {
    const refuse = (code: string, detail: string) => outcome.refused.push({ externalItemId: row.externalItemId, code, detail });
    if (processed.has(row.externalItemId)) { refuse('ALREADY_SUCCEEDED', 'Duplicate selection'); continue; }
    processed.add(row.externalItemId);
    if (applyPrices && row.priceMicros !== null && priceListId === null) {
      refuse('INVALID_INPUT', 'Default IRR price list is required'); continue;
    }
    const previewRow = preview.rows.find((candidate) => candidate.externalItemId === row.externalItemId);
    const linkId = previewRow?.existingLinkId ?? null;
    if (linkId !== null && row.action !== 'UPDATE_LINK_VERSION') {
      refuse('INVALID_INPUT', 'Existing mapping cannot be reassigned'); continue;
    }
    try {
      let itemId = row.internalItemId;
      if (row.action === 'CREATE_CATALOG_ITEM') {
        const created = await execute(buildCreateCatalogItemMutation({
          id: stableImportId('item', connectionId, row.externalItemId),
          name: row.name, sku: row.code, unit: 'عدد',
          description: row.secondaryName, kind: 'PRODUCT', isActive: true,
        }));
        itemId = readCreatedId(created, 'createCatalogItem');
        if (!itemId) { refuse('QUERY_ERROR', 'Catalog creation not confirmed'); continue; }
        outcome.createdItems += 1;
      } else {
        if (!itemId || (row.action === 'UPDATE_LINK_VERSION' && linkId === null)) {
          refuse('INVALID_INPUT', 'Mapped item is missing'); continue;
        }
        const data = await execute(buildCatalogItemByIdQuery(itemId));
        const current = asRecord(data.catalogItem);
        if (current === null || readString(current.id) !== itemId ||
            (row.action === 'CREATE_LINK' && readString(current.sku) !== row.code.trim())) {
          refuse('INVALID_INPUT', 'Catalog identity could not be verified'); continue;
        }
        if (readString(current.name) !== row.name.trim()) {
          const changed = await execute(buildUpdateCatalogItemMutation(itemId, { name: row.name }));
          if (readCreatedId(changed, 'updateCatalogItem') !== itemId) {
            refuse('QUERY_ERROR', 'Catalog update not confirmed'); continue;
          }
        }
      }
      if (!itemId) { refuse('INVALID_INPUT', 'Missing CRM item'); continue; }
      // Commit the price before advancing the mapping version. A failed price
      // write remains retryable; historical price records are not deleted.
      if (applyPrices && priceListId !== null && row.priceMicros !== null) {
        if (await syncAccountingItemPrice(execute, itemId, priceListId, row.priceMicros)) outcome.createdPrices += 1;
      }
      const linkFields = {
        externalCode: row.code, remoteVersion: row.remoteVersion,
        lastSyncedAt: new Date().toISOString(), syncStatus: 'LINKED',
      };
      if (linkId !== null) {
        const result = await execute(buildUpdateAccountingItemLinkMutation(linkId, linkFields));
        if (readCreatedId(result, 'updateAccountingItemLink') !== linkId) {
          refuse('QUERY_ERROR', 'Mapping update not confirmed'); continue;
        }
        outcome.updatedLinks += 1;
      } else {
        const result = await execute(buildCreateAccountingItemLinkMutation({
          id: stableImportId('item-link', connectionId, row.externalItemId),
          name: row.name + ' @ ' + connectionId.slice(0, 8),
          externalItemId: row.externalItemId, itemId, connectionId, ...linkFields,
        }));
        if (!readCreatedId(result, 'createAccountingItemLink')) {
          refuse('QUERY_ERROR', 'Mapping create not confirmed'); continue;
        }
        outcome.createdLinks += 1;
      }
    } catch (error) {
      refuse(error instanceof RecordApiError ? error.code : 'QUERY_ERROR', 'Catalog synchronization not confirmed');
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
  const preview = planPartyImport({
    remoteParties: remote.value,
    links,
    crmParties: [],
    crmCandidates: candidates,
  });
  const rows = await enrichPartyRows(preview.rows, dependencies.execute ?? executeRecordGraphql, connectionId);
  const summary = { ...preview.summary };
  for (const key of Object.keys(summary) as (keyof typeof summary)[]) summary[key] = 0;
  for (const row of rows) summary[row.decision] += 1;
  return accepted({ ...preview, rows, summary });
};

export type PartyApplySelection = {
  externalPartyId: string;
  internalPartyId?: string;
  partyType?: 'PERSON' | 'COMPANY';
  // Create a CRM person/company from the remote party when no unique match exists.
  // Party kind is resolved server-side from the national identifier contract.
  createNew?: boolean;
};

// An external id belongs to one connection. A deterministic record id protects a
// simultaneous first link creation without hashing any national identity or contact data.
const partyLinkRecordId = (connectionId: string, externalPartyId: string): string => {
  const hex = createHash('sha256').update('quotation/accounting-party-link:' + JSON.stringify([connectionId, externalPartyId])).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};

export const applyPartyImport = async (
  { connectionId, selections, allowRemoteVersionUpdate, remoteParties }: {
    connectionId: string;
    selections: PartyApplySelection[];
    allowRemoteVersionUpdate: boolean;
    remoteParties: RemoteParty[];
  },
  dependencies: ImportDependencies = {},
): Promise<{
  createdLinks: number;
  updatedLinks: number;
  createdParties: number;
  refused: { externalPartyId: string; code: string; detail: string }[];
}> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const executeCustomer = dependencies.executeCustomer ?? dependencies.execute ?? executeCallerRecordGraphql;
  const links = await loadPartyLinks(connectionId, dependencies);
  const requested = new Set(selections.map((selection) => selection.externalPartyId));
  const selectedRemote = remoteParties.filter((party) => requested.has(party.externalPartyId));
  const identities = await loadCrmPartyIdentities(
    selectedRemote,
    [...links.filter((link) => link.externalPartyId !== null && requested.has(link.externalPartyId)).flatMap((link) => link.internalPartyId ? [link.internalPartyId] : []),
      ...selections.flatMap((selection) => selection.internalPartyId ? [selection.internalPartyId] : []),
      ...selectedRemote.map((party) => stableCustomerRecordId(connectionId, party.externalPartyId))],
    execute,
  );
  const plan = planPartyImport({ remoteParties, links, crmParties: [] });
  let createdLinks = 0;
  let updatedLinks = 0;
  let createdParties = 0;
  const refused: { externalPartyId: string; code: string; detail: string }[] = [];
  const processed = new Set<string>();
  for (const selection of selections) {
    const externalPartyId = selection.externalPartyId;
    const refuse = (code: string, detail: string) => refused.push({ externalPartyId, code, detail });
    if (processed.has(externalPartyId)) { refuse('ALREADY_SUCCEEDED', 'Duplicate selection'); continue; }
    processed.add(externalPartyId);
    const row = plan.rows.find((candidate) => candidate.externalPartyId === externalPartyId);
    const remote = selectedRemote.find((candidate) => candidate.externalPartyId === externalPartyId);
    const matchingLinks = links.filter((link) => link.externalPartyId === externalPartyId);
    if (!row || !remote || row.decision === 'DUPLICATE_REMOTE_CODE' || matchingLinks.length > 1) {
      refuse('INVALID_INPUT', 'Missing or duplicate destination identity');
      continue;
    }
    const existing = matchingLinks[0] ?? null;
    if (existing !== null && (!existing.internalPartyId || !existing.partyType)) { refuse('INVALID_INPUT', 'Existing customer mapping is incomplete'); continue; }
    const automatic = selection.createNew === true;
    if (existing !== null && (!automatic || !allowRemoteVersionUpdate)) {
      refuse('ALREADY_SUCCEEDED', 'This customer is already linked');
      continue;
    }
    try {
      const stableId = stableCustomerRecordId(connectionId, externalPartyId);
      const recovered = identities.some((entry) => entry.id === stableId) ? stableId : null;
      const resolved = resolvePartyIdentity(remote, identities, existing?.internalPartyId ?? recovered, existing?.partyType);
      const sourceProfile = mergeSourcePartyProfile(remote, existing?.sourceProfile);
      let target = resolved.kind === 'MATCH' ? resolved.target : null;
      if (!automatic) {
        const selected = identities.find((entry) => entry.id === selection.internalPartyId && entry.partyType === selection.partyType);
        // Explicit selection cannot override a contradictory strong identifier.
        if (!selected || resolvePartyIdentity(remote, identities, selected.id, selected.partyType).kind !== 'MATCH') {
          refuse('INVALID_INPUT', 'Selected CRM identity conflicts with accounting');
          continue;
        }
        target = selected;
      } else if (resolved.kind === 'CONFLICT' || resolved.kind === 'MISSING_IDENTITY') {
        refuse('INVALID_INPUT', 'CRM identity needs manual review');
        continue;
      }
      let partyType: 'PERSON' | 'COMPANY';
      let internalPartyId: string;
      if (target !== null) {
        partyType = target.partyType;
        internalPartyId = target.id;
        const visible = await verifyCustomerRecord({ customerType: partyType, recordId: internalPartyId }, { execute: executeCustomer });
        if (!visible.ok) { refuse(visible.refusal.code, 'Customer is not visible to caller'); continue; }
        const fields = crmPartyFields(remote, partyType, target);
        if (Object.keys(fields).length > 0) {
          const root = partyType === 'PERSON' ? 'updatePerson' : 'updateCompany';
          const updated = await executeCustomer(`mutation SyncAccountingParty { ${root}(id: ${toGraphqlLiteral(internalPartyId)}, data: ${toGraphqlLiteral(fields)}) { id } }`);
          if (readCreatedId(updated, root) !== internalPartyId) { refuse('QUERY_ERROR', 'CRM update not confirmed'); continue; }
        } else if (existing !== null && existing.remoteVersion === remote.remoteVersion && (existing.sourceProfile ?? null) === sourceProfile) {
          refuse('ALREADY_SUCCEEDED', 'CRM customer already synchronized');
          continue;
        }
      } else if (automatic && resolved.kind === 'CREATE' && partyDisplayName(remote)) {
        partyType = resolved.partyType;
        const root = partyType === 'PERSON' ? 'createPerson' : 'createCompany';
        const fields = { ...crmPartyFields(remote, partyType, null), id: stableId };
        const created = await executeCustomer(`mutation CreateAccountingCustomer { ${root}(data: ${toGraphqlLiteral(fields)}) { id } }`);
        internalPartyId = readCreatedId(created, root);
        if (!internalPartyId) { refuse('QUERY_ERROR', 'CRM create not confirmed'); continue; }
        createdParties += 1;
        // A retry after link failure resolves the canonical unique code; it must
        // never create a second customer. Include this successful write in the batch index.
        identities.push({ id: internalPartyId, partyType, name: partyDisplayName(remote), nationalCode: partyNationalIdentity(remote), economicCode: normalizeEconomicCode(remote.economicCode), mobile: remote.mobile, phones: null });
      } else {
        refuse('INVALID_INPUT', 'A verified CRM identity is required');
        continue;
      }
      const linkFields = {
        externalCode: remote.code,
        ...(sourceProfile === null ? {} : { sourceProfile }),
        remoteVersion: remote.remoteVersion,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'LINKED',
        partyType,
        internalPartyId,
      };
      if (existing !== null) {
        const updated = await execute(buildUpdateAccountingPartyLinkMutation(existing.linkId, linkFields));
        if (readCreatedId(updated, 'updateAccountingPartyLink') !== existing.linkId) {
          refuse('QUERY_ERROR', 'Mapping update not confirmed');
          continue;
        }
        updatedLinks += 1;
      } else {
        const created = await execute(buildCreateAccountingPartyLinkMutation({
          id: partyLinkRecordId(connectionId, externalPartyId),
          name: remote.fullName + ' @ ' + connectionId.slice(0, 8),
          externalPartyId,
          connectionId,
          ...linkFields,
        }));
        if (!readCreatedId(created, 'createAccountingPartyLink')) { refuse('QUERY_ERROR', 'Mapping create not confirmed'); continue; }
        createdLinks += 1;
      }
    } catch (error) {
      // A refused row must not abort the rest of the batch. Never echo tokens,
      // national identifiers, GraphQL bodies or vendor errors to the browser.
      refuse(error instanceof RecordApiError ? error.code : 'QUERY_ERROR', 'CRM synchronization not confirmed');
    }
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
