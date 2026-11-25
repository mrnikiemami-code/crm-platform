import { accepted, refused, type Result } from 'src/domain/shared/result';

// Shared CRM ledger-code rules (Goal 023 WS1). Empty is a real value meaning "unset".
// Never a float; never used as a vendor destination id.

export const ACCOUNTING_CODE_MAX_LENGTH = 64;

export const normalizeAccountingCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

// Rejects control characters and overlong values. Charset is otherwise open so
// Persian/Latin ledger codes both fit; tighten later only with product evidence.
export const parseAccountingCodeInput = (
  value: unknown,
): Result<string> => {
  const normalized = normalizeAccountingCode(value);

  if (normalized === '') {
    return accepted('');
  }

  if (normalized.length > ACCOUNTING_CODE_MAX_LENGTH) {
    return refused(
      'ACCOUNTING_CODE_TOO_LONG',
      `کد حسابداری حداکثر ${ACCOUNTING_CODE_MAX_LENGTH} نویسه است`,
    );
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const codePoint = normalized.charCodeAt(index);

    if (codePoint < 0x20 || codePoint === 0x7f) {
      return refused(
        'ACCOUNTING_CODE_INVALID',
        'کد حسابداری نویسه‌های کنترلی نمی‌پذیرد',
      );
    }
  }

  return accepted(normalized);
};
