// CRM ledger-code parse shared by tax-policy and currency authorities (Goal 023 WS1).

export const ACCOUNTING_CODE_MAX_LENGTH = 64;

export type ParsedAccountingCode =
  | { ok: true; accountingCode: string }
  | { ok: false; code: string; message: string };

export const parseAccountingCodeInput = (
  value: unknown,
): ParsedAccountingCode => {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (normalized === '') {
    return { ok: true, accountingCode: '' };
  }

  if (normalized.length > ACCOUNTING_CODE_MAX_LENGTH) {
    return {
      ok: false,
      code: 'ACCOUNTING_CODE_TOO_LONG',
      message: `کد حسابداری حداکثر ${ACCOUNTING_CODE_MAX_LENGTH} نویسه است`,
    };
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const codePoint = normalized.charCodeAt(index);

    if (codePoint < 0x20 || codePoint === 0x7f) {
      return {
        ok: false,
        code: 'ACCOUNTING_CODE_INVALID',
        message: 'کد حسابداری نویسه‌های کنترلی نمی‌پذیرد',
      };
    }
  }

  return { ok: true, accountingCode: normalized };
};
