import { asRecord, readString } from 'src/components/accounting/accounting-shared';
import {
  formatMicrosExact,
  parseMicrosExact,
  MICROS_PER_UNIT,
} from 'src/domain/money/micros';
import { formatExactDecimalForPeople } from 'src/domain/money/display-format';

// The wire shape of one page of the accounting screens, parsed once so a malformed response
// produces an empty page instead of a crash halfway through rendering a table.

export type SnapshotTruncationView =
  | { kind: 'NONE'; declaredTotal: number | null }
  | {
      kind: 'BOUNDED';
      taken: number;
      limit: number;
      declaredTotal: number | null;
    };

export type SnapshotView = {
  snapshotId: string;
  createdAtMs: number;
  reused: boolean;
  ageMs: number;
  vendorPagination: 'CURSOR' | 'NONE';
  readStrategy: 'REMOTE_PAGED' | 'REMOTE_UNPAGED';
  // `INCOMPLETE` means only a bounded prefix of the destination is on screen; every count
  // shown next to it describes that prefix, and the screen says so.
  syncStatus: 'COMPLETE' | 'INCOMPLETE';
  incompleteReason: 'SNAPSHOT_LIMIT_REACHED' | null;
  // Set when the destination failed and the last whole snapshot was served instead.
  degradedReason: string | null;
  truncation: SnapshotTruncationView;
};

export type ItemMappingRow = {
  externalItemId: string;
  code: string;
  name: string;
  secondaryName: string | null;
  decision: string;
  existingLinkId: string | null;
  suggestedInternalItemId: string | null;
  suggestedInternalItemName: string | null;
  priceMicros: string | null;
  planPrice: string;
  crmPriceMicros: string | null;
  priceDifferenceMicros: string | null;
  warnings: string[];
};

export type PartyMappingRow = {
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  decision: string;
  existingLinkId: string | null;
  suggestedInternalPartyId: string | null;
  warnings: string[];
};

export type ItemSummaryView = {
  linked: number;
  unlinked: number;
  blocked: number;
  needsAttention: number;
};

export type MappingPage<TRow> = {
  rows: TRow[];
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
  search: string;
  pageSize: number;
  snapshot: SnapshotView;
  summary: Record<string, number>;
  timings: Record<string, number>;
};

export type PartyCandidateRow = {
  id: string;
  label: string;
  detail: string | null;
};

export type ItemMappingPage = MappingPage<ItemMappingRow>;
export type PartyMappingPage = MappingPage<PartyMappingRow>;

export type PartyCandidatePage = {
  rows: PartyCandidateRow[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalKnown: number | null;
};

const readNullableString = (value: unknown): string | null => {
  const text = readString(value);

  return text === '' ? null : text;
};

const readNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []))
    : [];

const parseTruncation = (value: unknown): SnapshotTruncationView => {
  const record = asRecord(value);

  if (record?.kind === 'BOUNDED') {
    return {
      kind: 'BOUNDED',
      taken: readNumber(record.taken),
      limit: readNumber(record.limit),
      declaredTotal:
        typeof record.declaredTotal === 'number' ? record.declaredTotal : null,
    };
  }

  return {
    kind: 'NONE',
    declaredTotal:
      typeof record?.declaredTotal === 'number' ? record.declaredTotal : null,
  };
};

const parseSnapshot = (value: unknown): SnapshotView => {
  const record = asRecord(value);

  return {
    snapshotId: readString(record?.snapshotId),
    createdAtMs: readNumber(record?.createdAtMs),
    reused: record?.reused === true,
    ageMs: readNumber(record?.ageMs),
    vendorPagination: record?.vendorPagination === 'CURSOR' ? 'CURSOR' : 'NONE',
    // An older server that sends no strategy is safe to read as unpaged: the snapshot path
    // is the bounded one, so the fallback never implies more capability than exists.
    readStrategy:
      record?.readStrategy === 'REMOTE_PAGED' ? 'REMOTE_PAGED' : 'REMOTE_UNPAGED',
    syncStatus: record?.syncStatus === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE',
    incompleteReason:
      record?.incompleteReason === 'SNAPSHOT_LIMIT_REACHED'
        ? 'SNAPSHOT_LIMIT_REACHED'
        : null,
    degradedReason: readNullableString(record?.degradedReason),
    truncation: parseTruncation(record?.truncation),
  };
};

const parseSummary = (value: unknown): Record<string, number> => {
  const record = asRecord(value);

  if (record === null) {
    return {};
  }

  const summary: Record<string, number> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'number') {
      summary[key] = entry;
    }
  }

  return summary;
};

const basePage = (value: unknown): MappingPage<never> => {
  const record = asRecord(value);

  return {
    rows: [],
    nextCursor: readNullableString(record?.nextCursor),
    hasNextPage: record?.hasNextPage === true,
    totalKnown:
      typeof record?.totalKnown === 'number' ? record.totalKnown : null,
    search: readString(record?.search),
    pageSize: readNumber(record?.pageSize),
    snapshot: parseSnapshot(record?.snapshot),
    summary: parseSummary(record?.summary),
    timings: parseSummary(record?.timings),
  };
};

const readRawRows = (value: unknown): Record<string, unknown>[] => {
  const rows = asRecord(value)?.rows;

  return Array.isArray(rows)
    ? rows.flatMap((row) => {
        const record = asRecord(row);

        return record === null ? [] : [record];
      })
    : [];
};

export const parseItemMappingPage = (value: unknown): MappingPage<ItemMappingRow> => {
  const base = basePage(value);

  return {
    ...base,
    rows: readRawRows(value).flatMap((row) => {
      const externalItemId = readString(row.externalItemId);

      if (externalItemId === '') {
        return [];
      }

      return [
        {
          externalItemId,
          code: readString(row.code),
          name: readString(row.name),
          secondaryName: readNullableString(row.secondaryName),
          decision: readString(row.decision) || 'CREATE',
          existingLinkId: readNullableString(row.existingLinkId),
          suggestedInternalItemId: readNullableString(
            row.suggestedInternalItemId,
          ),
          suggestedInternalItemName: readNullableString(
            row.suggestedInternalItemName,
          ),
          priceMicros: readNullableString(row.priceMicros),
          planPrice: readString(row.planPrice),
          crmPriceMicros: readNullableString(row.crmPriceMicros),
          priceDifferenceMicros: readNullableString(row.priceDifferenceMicros),
          warnings: readStringArray(row.warnings),
        },
      ];
    }),
  };
};

export const parsePartyMappingPage = (value: unknown): MappingPage<PartyMappingRow> => {
  const base = basePage(value);

  return {
    ...base,
    rows: readRawRows(value).flatMap((row) => {
      const externalPartyId = readString(row.externalPartyId);

      if (externalPartyId === '') {
        return [];
      }

      return [
        {
          externalPartyId,
          code: readString(row.code),
          fullName: readString(row.fullName),
          mobile: readNullableString(row.mobile),
          nationalCode: readNullableString(row.nationalCode),
          decision: readString(row.decision) || 'NEEDS_CRM_RECORD',
          existingLinkId: readNullableString(row.existingLinkId),
          suggestedInternalPartyId: readNullableString(
            row.suggestedInternalPartyId,
          ),
          warnings: readStringArray(row.warnings),
        },
      ];
    }),
  };
};

export const parsePartyCandidatePage = (value: unknown): PartyCandidatePage => {
  const record = asRecord(value);
  const rows = record?.rows;

  return {
    rows: Array.isArray(rows)
      ? rows.flatMap((row) => {
          const entry = asRecord(row);
          const id = readString(entry?.id);

          return id === ''
            ? []
            : [
                {
                  id,
                  label: readString(entry?.label) || id,
                  detail: readNullableString(entry?.detail),
                },
              ];
        })
      : [],
    hasNextPage: record?.hasNextPage === true,
    endCursor: readNullableString(record?.endCursor),
    totalKnown:
      typeof record?.totalKnown === 'number' ? record.totalKnown : null,
  };
};

// One label per business situation. A person decides what to do from this column, so it has
// to read as an instruction, not as a status code.
export const ITEM_STATUS_LABELS: Record<string, string> = {
  CREATE: 'فقط در CRM ثبت می‌شود',
  LINK_SUGGESTED: 'پیشنهاد اتصال به کالای موجود',
  LINK_AMBIGUOUS: 'چند کالای هم‌کد؛ انتخاب لازم است',
  IN_SYNC: 'وصل شده و هم‌خوان است',
  REMOTE_CHANGED: 'در حسابداری تغییر کرده',
  DUPLICATE_REMOTE_CODE: 'کد تکراری در حسابداری',
};

export const PARTY_STATUS_LABELS: Record<string, string> = {
  IN_SYNC: 'وصل شده و هم‌خوان است',
  REMOTE_CHANGED: 'در حسابداری تغییر کرده',
  LINK_SUGGESTED: 'آماده به‌روزرسانی',
  NEEDS_CRM_RECORD: 'ثبت‌نشده در CRM',
  AMBIGUOUS_CRM_MATCH: 'چند مشتری متناظر؛ انتخاب لازم است',
  DUPLICATE_REMOTE_CODE: 'شناسهٔ تکراری در حسابداری',
};

export const itemStatusTone = (
  decision: string,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (decision === 'IN_SYNC') {
    return 'success';
  }

  if (decision === 'DUPLICATE_REMOTE_CODE') {
    return 'danger';
  }

  if (decision === 'REMOTE_CHANGED' || decision === 'LINK_AMBIGUOUS') {
    return 'warning';
  }

  if (decision === 'LINK_SUGGESTED') {
    return 'info';
  }

  return 'neutral';
};

export const partyStatusTone = itemStatusTone;

export const formatMicrosForDisplay = (micros: string | null): string => {
  if (micros === null) {
    return '—';
  }

  // Display is whole rials with Persian digits; storage stays exact micros.
  const parsed = parseMicrosExact(micros);
  if (!parsed.ok) {
    return '—';
  }
  const wholeRials = parsed.value / MICROS_PER_UNIT;
  return formatExactDecimalForPeople(`${wholeRials}.000000`);
};
