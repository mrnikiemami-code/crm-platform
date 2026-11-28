import { accepted, refused, type Result } from 'src/domain/shared/result';

// Asan's guide describes Cardex date filters as .NET ticks, not Unix time.
// Use explicit Gregorian UTC calendar dates; the actual vendor timezone and
// inclusive bounds must be confirmed in G1 before operator reliance.
const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
const DAY_MS = 86400000;
const dateMs = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
};

export const buildCardexDateBounds = (from: string, to: string): Result<{ FromDate: string; ToDate: string }> => {
  const start = dateMs(from);
  const end = dateMs(to);
  if (start === null || end === null || start < 0 || end < start || (end - start) / DAY_MS >= 93) {
    return refused('INVALID_INPUT', 'Cardex requires an explicit date range of at most 93 UTC calendar days');
  }
  return accepted({
    FromDate: String(TICKS_AT_UNIX_EPOCH + BigInt(start) * 10000n),
    ToDate: String(TICKS_AT_UNIX_EPOCH + BigInt(end + DAY_MS) * 10000n - 1n),
  });
};

export const isExactAsanPositiveLong = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;

const exactId = (value: unknown): string | null => {
  const raw = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return isExactAsanPositiveLong(raw) ? raw : null;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const boundedText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length <= max ? value : null;

export type AsanReportedAmount = {
  reportedText: string;
  // A JSON double is an observation, not a certified exact CRM amount.
  representation: 'VENDOR_TEXT' | 'JSON_NUMBER';
};
const reportedAmount = (value: unknown): AsanReportedAmount | null => {
  if (typeof value === 'string' && /^-?\d{1,24}(?:\.\d{1,18})?$/.test(value)) {
    return { reportedText: value, representation: 'VENDOR_TEXT' };
  }
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    return { reportedText: String(value), representation: 'JSON_NUMBER' };
  }
  return null;
};

export type AsanCustomerFinanceSummary = {
  customerExternalId: string;
  remain: AsanReportedAmount | null;
  bookCredit: AsanReportedAmount | null;
  chequeCredit: AsanReportedAmount | null;
  settlementDays: number | null;
};

export const parseCustomerFinanceSummary = (records: Record<string, unknown>[], customerId: string): Result<AsanCustomerFinanceSummary> => {
  if (!isExactAsanPositiveLong(customerId) || records.length !== 1) {
    return refused('ASAN_INCOMPLETE_DATASET', 'exact customer finance identity is unavailable');
  }
  const row = records[0];
  const code = exactId(row.Code === undefined ? row.PersonCode : row.Code);
  if (code !== customerId || (row.PersonCode !== undefined && exactId(row.PersonCode) !== code)) {
    return refused('ASAN_INCOMPLETE_DATASET', 'customer finance identity differs');
  }
  const settlementDays = row.SettlementDays;
  return accepted({
    customerExternalId: customerId,
    remain: reportedAmount(row.Remain),
    bookCredit: reportedAmount(row.BookCredit),
    chequeCredit: reportedAmount(row.ChequeCredit),
    settlementDays: typeof settlementDays === 'number' && Number.isInteger(settlementDays) &&
      settlementDays >= 0 && settlementDays <= 255 ? settlementDays : null,
  });
};

export type AsanCustomerCardexRow = {
  rowNumber: number;
  shownDate: string;
  description: string;
  documentType: string;
  debitText: string;
  creditText: string;
  balanceText: string;
};

// Do not convert localized display strings into a balance or synthesize totals.
// Reject an incomplete/foreign/oversized report rather than silently filtering.
export const parseCustomerCardex = (records: unknown[], customerId: string): Result<AsanCustomerCardexRow[]> => {
  if (!isExactAsanPositiveLong(customerId) || records.length > 500) {
    return refused('ASAN_INCOMPLETE_DATASET', 'customer ledger exceeds the bounded report or has invalid identity');
  }
  const rows: AsanCustomerCardexRow[] = [];
  for (const raw of records) {
    const row = object(raw);
    const shownDate = boundedText(row?.ShowDate, 100);
    const description = boundedText(row?.Description, 2000);
    const documentType = boundedText(row?.FactorType, 100);
    const debitText = boundedText(row?.show_Bedehkar, 100);
    const creditText = boundedText(row?.show_Bestankar, 100);
    const balanceText = boundedText(row?.show_Mande, 100);
    if (row === null || exactId(row.PersonCode) !== customerId ||
        typeof row.Row !== 'number' || !Number.isSafeInteger(row.Row) ||
        shownDate === null || description === null || documentType === null ||
        debitText === null || creditText === null || balanceText === null) {
      return refused('ASAN_INCOMPLETE_DATASET', 'customer ledger contains foreign or incomplete rows');
    }
    rows.push({ rowNumber: row.Row, shownDate, description, documentType, debitText, creditText, balanceText });
  }
  return accepted(rows);
};
