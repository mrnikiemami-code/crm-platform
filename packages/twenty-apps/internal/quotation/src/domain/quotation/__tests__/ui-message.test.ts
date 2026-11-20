import { describe, expect, it } from 'vitest';

import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

describe('toPersianUiMessage', () => {
  it('keeps Persian copy as-is', () => {
    expect(toPersianUiMessage('پیش‌فاکتور قفل است.', 'عملیات انجام نشد.')).toBe(
      'پیش‌فاکتور قفل است.',
    );
  });

  it('drops the machine code before the operator reads it', () => {
    expect(
      toPersianUiMessage(
        'QUOTATION_IMMUTABLE: محتوای این پیش‌فاکتور قفل است.',
        'عملیات انجام نشد.',
      ),
    ).toBe('محتوای این پیش‌فاکتور قفل است.');
  });

  it('hides an English transport or provider message behind the fallback', () => {
    expect(
      toPersianUiMessage('TypeError: Cannot read properties of undefined', 'ارتباط با سرور برقرار نشد.'),
    ).toBe('ارتباط با سرور برقرار نشد.');
  });

  it('falls back when there is nothing to show', () => {
    expect(toPersianUiMessage(undefined, 'عملیات انجام نشد.')).toBe(
      'عملیات انجام نشد.',
    );
    expect(toPersianUiMessage('   ', 'عملیات انجام نشد.')).toBe(
      'عملیات انجام نشد.',
    );
  });

  it('falls back when the message is only a code', () => {
    expect(toPersianUiMessage('QUOTATION_NOT_FOUND:', 'عملیات انجام نشد.')).toBe(
      'عملیات انجام نشد.',
    );
  });
});
