import { isNonEmptyString } from '@sniptt/guards';

// WS2: server-owned CRM ledger snapshots on a quotation. Clients never author these.
export type QuotationAccountingSnapshot = {
  taxAccountingCode: string;
  taxPolicyRecordId: string | null;
  currencyAccountingCode: string;
  quotationCurrencyRecordId: string | null;
};

export const EMPTY_QUOTATION_ACCOUNTING_SNAPSHOT: QuotationAccountingSnapshot = {
  taxAccountingCode: '',
  taxPolicyRecordId: null,
  currencyAccountingCode: '',
  quotationCurrencyRecordId: null,
};

// Keys a client must never supply on draft save or GraphQL patch (C3).
export const QUOTATION_ACCOUNTING_SNAPSHOT_FIELD_NAMES = [
  'taxAccountingCode',
  'currencyAccountingCode',
  'taxPolicyRecordId',
  'quotationCurrencyRecordId',
  'unitCode',
  'unitAccountingCode',
] as const;

export type QuotationAccountingSnapshotFieldName =
  (typeof QUOTATION_ACCOUNTING_SNAPSHOT_FIELD_NAMES)[number];

const readTrimmed = (value: string | null | undefined): string =>
  (value ?? '').trim();

export const normalizeAccountingCodeSnapshot = (
  value: string | null | undefined,
): string => readTrimmed(value);

export const buildQuotationAccountingSnapshot = ({
  taxPolicyRecordId,
  taxAccountingCode,
  quotationCurrencyRecordId,
  currencyAccountingCode,
}: {
  taxPolicyRecordId: string | null | undefined;
  taxAccountingCode: string | null | undefined;
  quotationCurrencyRecordId: string | null | undefined;
  currencyAccountingCode: string | null | undefined;
}): QuotationAccountingSnapshot => ({
  taxPolicyRecordId: isNonEmptyString(taxPolicyRecordId)
    ? taxPolicyRecordId.trim()
    : null,
  taxAccountingCode: normalizeAccountingCodeSnapshot(taxAccountingCode),
  quotationCurrencyRecordId: isNonEmptyString(quotationCurrencyRecordId)
    ? quotationCurrencyRecordId.trim()
    : null,
  currencyAccountingCode: normalizeAccountingCodeSnapshot(currencyAccountingCode),
});

// C4 Option A: a reference id is locked only after a non-empty code was snapshotted.
export const isNonEmptyAccountingCodeSnapshot = (
  value: string | null | undefined,
): boolean => normalizeAccountingCodeSnapshot(value) !== '';

export const findClientAccountingSnapshotOverrides = (
  body: Record<string, unknown>,
): QuotationAccountingSnapshotFieldName[] =>
  QUOTATION_ACCOUNTING_SNAPSHOT_FIELD_NAMES.filter(
    (fieldName) => body[fieldName] !== undefined,
  );

export const stripAccountingSnapshotFields = <T extends Record<string, unknown>>(
  patch: T,
): T => {
  const next = { ...patch };

  for (const fieldName of QUOTATION_ACCOUNTING_SNAPSHOT_FIELD_NAMES) {
    delete next[fieldName];
  }

  return next;
};
