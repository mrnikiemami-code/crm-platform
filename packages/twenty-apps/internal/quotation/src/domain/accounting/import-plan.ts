import {
  type AccountingMoneyUnit,
  type RemoteCatalogItem,
  type RemoteParty,
} from 'src/domain/accounting/adapter-contract';
import { mergeSourcePartyProfile, type AccountingPartyProfile } from 'src/domain/accounting/party-profile';
import { normalizeNationalCode, normalizeEconomicCode, normalizeIranMobile, partyNationalIdentity } from 'src/domain/accounting/party-identity';
import { asanUnitsToCrmMicros } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';

// The preview is a PLAN, not an import. A person looks at it, confirms what to bring in, and
// only the confirmed rows are applied. The rules below exist to make the dangerous cases
// visible BEFORE a row is written:
//
//   - a vendor code that appears twice cannot be linked, because two remote products would
//     claim the same identity;
//   - a CRM item is never matched by name (names are edited and reused); a shared SKU is
//     offered as a suggestion that a person must confirm;
//   - what is already linked is reported as such instead of being created again, which is
//     the duplicate this preview exists to prevent.
export type ExistingItemLink = {
  linkId: string;
  externalItemId: string | null;
  internalItemId: string | null;
  remoteVersion: string | null;
  syncStatus: string;
};

export type CrmItemSummary = {
  id: string;
  name: string;
  sku: string | null;
  // The item's current default price, as exact micros text. Reported next to the destination
  // price so a person sees the difference BEFORE linking; it is display evidence, not a write.
  priceMicros?: string | null;
};

export type CrmPartySummary = {
  id: string;
  name: string;
  nationalCode: string | null;
};

// A CRM record a person may attach a destination customer to. The type travels with the
// candidate because the vendor has no person/company entity: the CRM is the only place the
// distinction is recorded.
export type CrmPartyCandidate = {
  id: string;
  name: string;
  partyType: 'PERSON' | 'COMPANY';
};

export type ImportWarning =
  | 'DUPLICATE_REMOTE_NAME'
  | 'DUPLICATE_REMOTE_NATIONAL_CODE'
  | 'DUPLICATE_REMOTE_ECONOMIC_CODE'
  | 'DUPLICATE_REMOTE_MOBILE'
  | 'PRICE_UNIT_UNCONFIRMED'
  | 'NO_CRM_CANDIDATE'
  | 'REMOTE_ID_NOT_NUMERIC'
  | 'REMOTE_ITEM_INACTIVE'
  | 'REMOTE_PRICE_MISSING';

export type ItemImportDecision =
  | 'CREATE'
  | 'LINK_SUGGESTED'
  | 'LINK_AMBIGUOUS'
  | 'IN_SYNC'
  | 'REMOTE_CHANGED'
  | 'DUPLICATE_REMOTE_CODE';

export type ItemImportRow = {
  externalItemId: string;
  // The vendor change marker captured at preview time, so apply writes what was previewed
  // rather than re-reading and racing.
  remoteVersion: string;
  code: string;
  name: string;
  secondaryName: string | null;
  decision: ItemImportDecision;
  // The link this row would update, when one exists.
  existingLinkId: string | null;
  // A CRM item this row could attach to. Only ever a SUGGESTION unless a person confirms it.
  suggestedInternalItemId: string | null;
  // The suggested item's name, so the screen never has to translate an id into a name it
  // does not have. Optional because the apply plan speaks ids only.
  suggestedInternalItemName?: string | null;
  priceMicros: string | null;
  priceUnits: number | null;
  planPrice: string;
  // The linked/suggested CRM item's own price and the signed difference to the destination
  // price. `null` means "not comparable" (no candidate, no price on either side) and is shown
  // as such rather than as zero.
  crmPriceMicros: string | null;
  priceDifferenceMicros: string | null;
  warnings: ImportWarning[];
};

export type ItemImportPreview = {
  moneyUnit: AccountingMoneyUnit;
  rows: ItemImportRow[];
  summary: Record<ItemImportDecision, number>;
  totalRemoteItems: number;
};

const normalizeName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const countBy = (values: string[]): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
};

export const planItemImport = ({
  remoteItems,
  links,
  crmItems,
  moneyUnit,
}: {
  remoteItems: RemoteCatalogItem[];
  links: ExistingItemLink[];
  crmItems: CrmItemSummary[];
  moneyUnit: AccountingMoneyUnit;
}): ItemImportPreview => {
  const linkByExternalId = new Map<string, ExistingItemLink>();

  for (const link of links) {
    if (link.externalItemId !== null) {
      linkByExternalId.set(link.externalItemId, link);
    }
  }

  const itemsBySku = new Map<string, CrmItemSummary[]>();

  for (const item of crmItems) {
    const sku = item.sku?.trim() ?? '';

    if (sku === '') {
      continue;
    }

    itemsBySku.set(sku, [...(itemsBySku.get(sku) ?? []), item]);
  }

  const remoteCodeCounts = countBy(remoteItems.map((item) => item.code));
  const remoteIdCounts = countBy(remoteItems.map((item) => item.externalItemId));
  const remoteNameCounts = countBy(
    remoteItems.map((item) => normalizeName(item.name)),
  );

  const crmPriceById = new Map(
    crmItems.flatMap((crmItem) =>
      crmItem.priceMicros === undefined || crmItem.priceMicros === null
        ? []
        : ([[crmItem.id, crmItem.priceMicros]] as const),
    ),
  );

  // Signed difference, in the same exact representation as a stored amount. A comparison
  // that cannot be made exactly returns null instead of a rounded hint.
  const priceDifference = (
    destinationPriceMicros: string | null,
    crmPriceMicros: string | null,
  ): string | null => {
    if (destinationPriceMicros === null || crmPriceMicros === null) {
      return null;
    }

    const destination = parseMicrosExact(destinationPriceMicros);
    const crm = parseMicrosExact(crmPriceMicros);

    return destination.ok && crm.ok
      ? formatMicrosExact(destination.value - crm.value)
      : null;
  };

  const rows: ItemImportRow[] = remoteItems.map((item) => {
    const warnings: ImportWarning[] = [];

    if ((remoteNameCounts.get(normalizeName(item.name)) ?? 0) > 1) {
      warnings.push('DUPLICATE_REMOTE_NAME');
    }

    // A vendor product code has to be a positive integer to become a document line; a
    // non-numeric identifier can be previewed but never sent, so it is said here.
    if (!/^\d+$/.test(item.externalItemId) || Number(item.externalItemId) <= 0) {
      warnings.push('REMOTE_ID_NOT_NUMERIC');
    }

    if (!item.isActive) {
      warnings.push('REMOTE_ITEM_INACTIVE');
    }

    const price =
      item.sellPriceUnits === null
        ? null
        : asanUnitsToCrmMicros(item.sellPriceUnits, moneyUnit);

    if (moneyUnit === 'UNCONFIRMED') {
      warnings.push('PRICE_UNIT_UNCONFIRMED');
    }

    if (item.sellPriceUnits === null) {
      warnings.push('REMOTE_PRICE_MISSING');
    }

    const priceMicros = price?.ok === true ? formatMicrosExact(price.value) : null;
    const planPrice =
      priceMicros !== null
        ? `${priceMicros} (${moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'})`
        : 'قیمت بدون تأیید واحد قابل تبدیل نیست';

    const existingLink = linkByExternalId.get(item.externalItemId) ?? null;
    const skuMatches = itemsBySku.get(item.code) ?? [];
    const comparableInternalItemId =
      existingLink !== null
        ? existingLink.internalItemId
        : skuMatches.length === 1
          ? skuMatches[0].id
          : null;
    const crmPriceMicros =
      comparableInternalItemId === null
        ? null
        : (crmPriceById.get(comparableInternalItemId) ?? null);
    const priceDifferenceMicros = priceDifference(priceMicros, crmPriceMicros);

    if ((remoteCodeCounts.get(item.code) ?? 0) > 1 || (remoteIdCounts.get(item.externalItemId) ?? 0) > 1) {
      return {
        externalItemId: item.externalItemId,
        remoteVersion: item.remoteVersion,
        code: item.code,
        name: item.name,
        secondaryName: item.secondaryName,
        decision: 'DUPLICATE_REMOTE_CODE',
        existingLinkId: existingLink?.linkId ?? null,
        suggestedInternalItemId: null,
        priceMicros,
        priceUnits: item.sellPriceUnits,
        planPrice,
        crmPriceMicros: null,
        priceDifferenceMicros: null,
        warnings,
      };
    }

    if (existingLink !== null) {
      const changed =
        existingLink.remoteVersion !== item.remoteVersion;

      return {
        externalItemId: item.externalItemId,
        remoteVersion: item.remoteVersion,
        code: item.code,
        name: item.name,
        secondaryName: item.secondaryName,
        decision: changed ? 'REMOTE_CHANGED' : 'IN_SYNC',
        existingLinkId: existingLink.linkId,
        suggestedInternalItemId: existingLink.internalItemId,
        priceMicros,
        priceUnits: item.sellPriceUnits,
        planPrice,
        crmPriceMicros,
        priceDifferenceMicros,
        warnings,
      };
    }

    if (skuMatches.length === 1) {
      return {
        externalItemId: item.externalItemId,
        remoteVersion: item.remoteVersion,
        code: item.code,
        name: item.name,
        secondaryName: item.secondaryName,
        decision: 'LINK_SUGGESTED',
        existingLinkId: null,
        suggestedInternalItemId: skuMatches[0].id,
        priceMicros,
        priceUnits: item.sellPriceUnits,
        planPrice,
        crmPriceMicros,
        priceDifferenceMicros,
        warnings,
      };
    }

    if (skuMatches.length > 1) {
      return {
        externalItemId: item.externalItemId,
        remoteVersion: item.remoteVersion,
        code: item.code,
        name: item.name,
        secondaryName: item.secondaryName,
        decision: 'LINK_AMBIGUOUS',
        existingLinkId: null,
        suggestedInternalItemId: null,
        priceMicros,
        priceUnits: item.sellPriceUnits,
        planPrice,
        crmPriceMicros: null,
        priceDifferenceMicros: null,
        warnings,
      };
    }

    return {
      externalItemId: item.externalItemId,
      remoteVersion: item.remoteVersion,
      code: item.code,
      name: item.name,
      secondaryName: item.secondaryName,
      decision: 'CREATE',
      existingLinkId: null,
      suggestedInternalItemId: null,
      priceMicros,
      priceUnits: item.sellPriceUnits,
      planPrice,
      crmPriceMicros: null,
      priceDifferenceMicros: null,
      warnings,
    };
  });

  const summary: Record<ItemImportDecision, number> = {
    CREATE: 0,
    LINK_SUGGESTED: 0,
    LINK_AMBIGUOUS: 0,
    IN_SYNC: 0,
    REMOTE_CHANGED: 0,
    DUPLICATE_REMOTE_CODE: 0,
  };

  for (const row of rows) {
    summary[row.decision] += 1;
  }

  return { moneyUnit, rows, summary, totalRemoteItems: remoteItems.length };
};

export type ItemApplySelection = {
  externalItemId: string;
  // Required for a LINK_SUGGESTED row when the caller chose a different item than the one
  // suggested; ignored for CREATE.
  internalItemId?: string;
};

export type ItemApplyRow = {
  externalItemId: string;
  action: 'CREATE_CATALOG_ITEM' | 'CREATE_LINK' | 'UPDATE_LINK_VERSION';
  internalItemId: string | null;
  remoteVersion: string;
  code: string;
  name: string;
  secondaryName: string | null;
  priceMicros: string | null;
  warnings: ImportWarning[];
};

export type ItemApplyPlan = {
  rows: ItemApplyRow[];
  refused: { externalItemId: string; code: string; detail: string }[];
};

// Confirmation is where a preview becomes writes. A row that cannot be applied is REFUSED
// with a reason rather than skipped silently, because "the preview said 4 and 3 arrived" is
// an accounting discrepancy the user must see.
export const resolveItemApplyPlan = ({
  preview,
  selections,
  allowRemoteVersionUpdate,
}: {
  preview: ItemImportPreview;
  selections: ItemApplySelection[];
  allowRemoteVersionUpdate: boolean;
}): ItemApplyPlan => {
  const rowByExternalId = new Map(
    preview.rows.map((row) => [row.externalItemId, row]),
  );
  const rows: ItemApplyRow[] = [];
  const refused: ItemApplyPlan['refused'] = [];

  for (const selection of selections) {
    const row = rowByExternalId.get(selection.externalItemId);

    if (row === undefined) {
      refused.push({
        externalItemId: selection.externalItemId,
        code: '',
        detail: 'this row is not part of the preview',
      });
      continue;
    }

    if (row.decision === 'DUPLICATE_REMOTE_CODE') {
      refused.push({
        externalItemId: row.externalItemId,
        code: row.code,
        detail: 'a vendor code appears twice; resolve it in the vendor first',
      });
      continue;
    }

    if (row.decision === 'IN_SYNC') {
      refused.push({
        externalItemId: row.externalItemId,
        code: row.code,
        detail: 'already linked and unchanged',
      });
      continue;
    }

    if (row.decision === 'REMOTE_CHANGED') {
      if (!allowRemoteVersionUpdate) {
        refused.push({
          externalItemId: row.externalItemId,
          code: row.code,
          detail: 'the vendor record changed; confirm the version update explicitly',
        });
        continue;
      }

      rows.push({
        externalItemId: row.externalItemId,
        action: 'UPDATE_LINK_VERSION',
        internalItemId: row.suggestedInternalItemId,
        remoteVersion: row.remoteVersion,
        code: row.code,
        name: row.name,
        secondaryName: row.secondaryName,
        priceMicros: row.priceMicros,
        warnings: row.warnings,
      });
      continue;
    }

    if (row.decision === 'CREATE') {
      rows.push({
        externalItemId: row.externalItemId,
        action: 'CREATE_CATALOG_ITEM',
        internalItemId: null,
        remoteVersion: row.remoteVersion,
        code: row.code,
        name: row.name,
        secondaryName: row.secondaryName,
        priceMicros: row.priceMicros,
        warnings: row.warnings,
      });
      continue;
    }

    const internalItemId =
      selection.internalItemId?.trim() ?? row.suggestedInternalItemId ?? '';

    if (internalItemId === '') {
      refused.push({
        externalItemId: row.externalItemId,
        code: row.code,
        detail:
          row.decision === 'LINK_AMBIGUOUS'
            ? 'several CRM items share this SKU; choose one explicitly'
            : 'choose the CRM item to link',
      });
      continue;
    }

    rows.push({
      externalItemId: row.externalItemId,
      action: 'CREATE_LINK',
      internalItemId,
      remoteVersion: row.remoteVersion,
      code: row.code,
      name: row.name,
      secondaryName: row.secondaryName,
      priceMicros: row.priceMicros,
      warnings: row.warnings,
    });
  }

  return { rows, refused };
};

export type ExistingPartyLink = {
  linkId: string;
  partyType?: 'PERSON' | 'COMPANY';
  sourceProfile?: string | null;
  externalPartyId: string | null;
  internalPartyId: string | null;
  remoteVersion: string | null;
  syncStatus: string;
};

export type PartyImportDecision =
  | 'IN_SYNC'
  | 'REMOTE_CHANGED'
  | 'LINK_SUGGESTED'
  | 'NEEDS_CRM_RECORD'
  | 'AMBIGUOUS_CRM_MATCH'
  | 'DUPLICATE_REMOTE_CODE';

export type PartyImportRow = AccountingPartyProfile & {
  autoEligible?: boolean;
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  decision: PartyImportDecision;
  existingLinkId: string | null;
  suggestedInternalPartyId: string | null;
  warnings: ImportWarning[];
};

export type PartyImportPreview = {
  rows: PartyImportRow[];
  summary: Record<PartyImportDecision, number>;
  totalRemoteParties: number;
  // CRM records a person can choose from. Empty is valid (and is what the current CRM
  // exposes), but the list travels with the preview so the UI never invents a candidate.
  crmCandidates: CrmPartyCandidate[];
};

export const planPartyImport = ({
  remoteParties,
  links,
  crmParties,
  crmCandidates = [],
}: {
  remoteParties: RemoteParty[];
  links: ExistingPartyLink[];
  crmParties: CrmPartySummary[];
  crmCandidates?: CrmPartyCandidate[];
}): PartyImportPreview => {
  const linkByExternalId = new Map<string, ExistingPartyLink>();

  for (const link of links) {
    if (link.externalPartyId !== null) {
      linkByExternalId.set(link.externalPartyId, link);
    }
  }

  const partiesByNationalCode = new Map<string, CrmPartySummary[]>();

  for (const party of crmParties) {
    const nationalCode = normalizeNationalCode(party.nationalCode) ?? '';

    if (nationalCode === '') {
      continue;
    }

    partiesByNationalCode.set(nationalCode, [
      ...(partiesByNationalCode.get(nationalCode) ?? []),
      party,
    ]);
  }

  const remoteCodeCounts = countBy(
    remoteParties.map((party) => party.externalPartyId),
  );
  const remoteNationalCounts = countBy(
    remoteParties
      .map((party) => partyNationalIdentity(party) ?? '')
      .filter((code) => code !== ''),
  );

  const remoteEconomicCounts = countBy(remoteParties.map((party) => normalizeEconomicCode(party.economicCode) ?? '').filter(Boolean));
  const remoteMobileCounts = countBy(remoteParties.map((party) => normalizeIranMobile(party.mobile) ?? '').filter(Boolean));
  const duplicateLinks = countBy(links.flatMap((link) => link.externalPartyId ? [link.externalPartyId] : []));
  const rows: PartyImportRow[] = remoteParties.map((party) => {
    const warnings: ImportWarning[] = [];
    const nationalCode = partyNationalIdentity(party) ?? '';

    if (nationalCode !== '' && (remoteNationalCounts.get(nationalCode) ?? 0) > 1) {
      warnings.push('DUPLICATE_REMOTE_NATIONAL_CODE');
    }

    const economicCode = normalizeEconomicCode(party.economicCode);
    if (economicCode !== null && (remoteEconomicCounts.get(economicCode) ?? 0) > 1) warnings.push('DUPLICATE_REMOTE_ECONOMIC_CODE');
    // Vendor-neutral IDs can be alphanumeric. Document constraints belong to the adapter.

    if (!party.externalPartyId.trim() || (remoteCodeCounts.get(party.externalPartyId) ?? 0) > 1 || (duplicateLinks.get(party.externalPartyId) ?? 0) > 1 || warnings.includes('DUPLICATE_REMOTE_NATIONAL_CODE') || warnings.includes('DUPLICATE_REMOTE_ECONOMIC_CODE')) {
      return {
        ...party,
        decision: 'DUPLICATE_REMOTE_CODE',
        existingLinkId: null,
        suggestedInternalPartyId: null,
        warnings,
      };
    }

    const existingLink = linkByExternalId.get(party.externalPartyId) ?? null;
    const mobile = normalizeIranMobile(party.mobile);
    if (existingLink === null && nationalCode === '' && economicCode === null && mobile !== null && (remoteMobileCounts.get(mobile) ?? 0) > 1) {
      return { ...party, decision: 'AMBIGUOUS_CRM_MATCH', existingLinkId: null, suggestedInternalPartyId: null, warnings: [...warnings, 'DUPLICATE_REMOTE_MOBILE'] };
    }

    if (existingLink !== null) {
      const changed =
        existingLink.remoteVersion !== party.remoteVersion || mergeSourcePartyProfile(party, existingLink.sourceProfile) !== (existingLink.sourceProfile ?? null);

      return {
        ...party,
        decision: changed ? 'REMOTE_CHANGED' : 'IN_SYNC',
        existingLinkId: existingLink.linkId,
        suggestedInternalPartyId: existingLink.internalPartyId,
        warnings,
      };
    }

    const matches =
      nationalCode === ''
        ? []
        : (partiesByNationalCode.get(nationalCode) ?? []);

    if (matches.length === 1) {
      return {
        ...party,
        decision: 'LINK_SUGGESTED',
        existingLinkId: null,
        suggestedInternalPartyId: matches[0].id,
        warnings,
      };
    }

    if (matches.length === 0) {
      warnings.push('NO_CRM_CANDIDATE');
    }

    return {
      ...party,
      decision: matches.length > 1 ? 'AMBIGUOUS_CRM_MATCH' : 'NEEDS_CRM_RECORD',
      existingLinkId: null,
      suggestedInternalPartyId: null,
      warnings,
    };
  });

  const summary: Record<PartyImportDecision, number> = {
    IN_SYNC: 0,
    REMOTE_CHANGED: 0,
    LINK_SUGGESTED: 0,
    NEEDS_CRM_RECORD: 0,
    AMBIGUOUS_CRM_MATCH: 0,
    DUPLICATE_REMOTE_CODE: 0,
  };

  for (const row of rows) {
    summary[row.decision] += 1;
  }

  return {
    rows,
    summary,
    totalRemoteParties: remoteParties.length,
    crmCandidates,
  };
};
