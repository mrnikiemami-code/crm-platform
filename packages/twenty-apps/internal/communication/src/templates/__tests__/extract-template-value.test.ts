import { describe, expect, it } from 'vitest';

import { extractTemplateValue } from 'src/templates/extract-template-value';

describe('extractTemplateValue', () => {
  it('trims TEXT/SELECT/DATE and treats blank as empty', () => {
    expect(extractTemplateValue({ kind: 'TEXT', rawValue: '  مدیر  ' })).toBe(
      'مدیر',
    );
    expect(extractTemplateValue({ kind: 'TEXT', rawValue: '   ' })).toBeNull();
    expect(extractTemplateValue({ kind: 'TEXT', rawValue: null })).toBeNull();
    expect(extractTemplateValue({ kind: 'SELECT', rawValue: 'SMS' })).toBe('SMS');
  });

  it('renders NUMBER and RATING', () => {
    expect(extractTemplateValue({ kind: 'NUMBER', rawValue: 42 })).toBe('42');
    expect(extractTemplateValue({ kind: 'NUMBER', rawValue: 0 })).toBe('0');
    expect(extractTemplateValue({ kind: 'RATING', rawValue: 5 })).toBe('5');
    expect(
      extractTemplateValue({ kind: 'NUMBER', rawValue: Number.NaN }),
    ).toBeNull();
  });

  it('renders BOOLEAN only for a real boolean', () => {
    expect(extractTemplateValue({ kind: 'BOOLEAN', rawValue: true })).toBe(
      'true',
    );
    expect(extractTemplateValue({ kind: 'BOOLEAN', rawValue: 'yes' })).toBeNull();
  });

  it('joins MULTI_SELECT values', () => {
    expect(
      extractTemplateValue({ kind: 'MULTI_SELECT', rawValue: ['a', 'b'] }),
    ).toBe('a, b');
    expect(extractTemplateValue({ kind: 'MULTI_SELECT', rawValue: [] })).toBeNull();
  });

  it('renders CURRENCY in major units', () => {
    expect(
      extractTemplateValue({
        kind: 'CURRENCY',
        rawValue: { amountMicros: 1_500_000, currencyCode: 'IRR' },
      }),
    ).toBe('1.5');
    expect(
      extractTemplateValue({
        kind: 'CURRENCY',
        rawValue: { amountMicros: 0, currencyCode: 'IRR' },
      }),
    ).toBe('0');
  });

  it('reads the primary value of LINKS and EMAILS', () => {
    expect(
      extractTemplateValue({
        kind: 'LINKS',
        rawValue: { primaryLinkUrl: 'https://a.example' },
      }),
    ).toBe('https://a.example');
    expect(
      extractTemplateValue({
        kind: 'EMAILS',
        rawValue: { primaryEmail: 'a@example.com' },
      }),
    ).toBe('a@example.com');
  });

  it('splits FULL_NAME into its three subfields', () => {
    const rawValue = { firstName: 'سارا', lastName: 'احمدی' };

    expect(
      extractTemplateValue({ kind: 'FULL_NAME', subFieldName: 'firstName', rawValue }),
    ).toBe('سارا');
    expect(
      extractTemplateValue({ kind: 'FULL_NAME', subFieldName: 'lastName', rawValue }),
    ).toBe('احمدی');
    expect(
      extractTemplateValue({ kind: 'FULL_NAME', subFieldName: 'fullName', rawValue }),
    ).toBe('سارا احمدی');
    expect(
      extractTemplateValue({
        kind: 'FULL_NAME',
        subFieldName: 'fullName',
        rawValue: { firstName: 'سارا', lastName: null },
      }),
    ).toBe('سارا');
  });

  it('yields null for an unexpected shape rather than guessing', () => {
    expect(extractTemplateValue({ kind: 'FULL_NAME', subFieldName: 'x', rawValue: null })).toBeNull();
    expect(extractTemplateValue({ kind: 'LINKS', rawValue: 'https://x' })).toBeNull();
    expect(extractTemplateValue({ kind: 'CURRENCY', rawValue: { amountMicros: 'x' } })).toBeNull();
  });
});
