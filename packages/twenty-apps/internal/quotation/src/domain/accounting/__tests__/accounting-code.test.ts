import { describe, expect, it } from 'vitest';

import {
  ACCOUNTING_CODE_MAX_LENGTH,
  parseAccountingCodeInput,
} from 'src/domain/accounting/accounting-code';

describe('parseAccountingCodeInput', () => {
  it('accepts empty as unset', () => {
    expect(parseAccountingCodeInput('')).toEqual({
      ok: true,
      value: '',
    });
    expect(parseAccountingCodeInput('   ')).toEqual({
      ok: true,
      value: '',
    });
  });

  it('trims a usable code', () => {
    expect(parseAccountingCodeInput('  GL-4100  ')).toEqual({
      ok: true,
      value: 'GL-4100',
    });
  });

  it('refuses overlong and control characters', () => {
    expect(
      parseAccountingCodeInput('x'.repeat(ACCOUNTING_CODE_MAX_LENGTH + 1)).ok,
    ).toBe(false);
    expect(parseAccountingCodeInput('a\nb').ok).toBe(false);
  });
});
