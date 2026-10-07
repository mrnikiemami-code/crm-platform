import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateMessageId } from 'twenty-shared/i18n';
import { describe, expect, it } from 'vitest';

// Verifies the SHIPPED Persian catalog against the same message-id scheme the
// SDK build and runtime share (`generateMessageId` is a single implementation
// in twenty-shared). The SDK's own resolver is unit-tested inside the SDK; here
// we assert the app's authored keys compile to ids whose values are the real
// Persian strings, and that a missing key would fall back to the source string.
const loadCompiledAppCatalog = (): Record<string, string> => {
  const raw = readFileSync(join(process.cwd(), 'locales', 'fa-IR.json'), 'utf8');
  const authored = JSON.parse(raw) as Record<string, string>;

  return Object.fromEntries(
    Object.entries(authored).map(([message, translation]) => [
      generateMessageId(message),
      translation,
    ]),
  );
};

// Mirrors the runtime resolver's contract: translated value, else source string.
const translate = (
  catalog: Record<string, string>,
  message: string,
): string => catalog[generateMessageId(message)] ?? message;

describe('app Persian catalog (shipped artifact)', () => {
  it('translates the composer keys to Persian', () => {
    const catalog = loadCompiledAppCatalog();

    expect(translate(catalog, 'Send')).toBe('ارسال');
    expect(translate(catalog, 'Phone number')).toBe('شماره تلفن');
    expect(translate(catalog, 'Channel')).toBe('کانال');
    expect(translate(catalog, 'Message')).toBe('متن پیام');
    expect(translate(catalog, 'Cancel')).toBe('انصراف');
    expect(translate(catalog, 'Send message')).toBe('ارسال پیام');
    expect(translate(catalog, 'Unable to load phone numbers.')).toBe(
      'دریافت شماره‌ها ناموفق بود.',
    );
    expect(
      translate(catalog, 'No phone number is recorded for this person.'),
    ).toBe('شماره‌ای برای این شخص ثبت نشده است.');
  });

  it('falls back to the English source string for an untranslated key', () => {
    const catalog = loadCompiledAppCatalog();

    expect(translate(catalog, 'Not translated anywhere')).toBe(
      'Not translated anywhere',
    );
  });

  it('keeps the English source string for the source locale', () => {
    // The source locale has no catalog: the runtime returns the message itself.
    const sourceCatalog: Record<string, string> = {};

    expect(translate(sourceCatalog, 'Send')).toBe('Send');
  });

  it('uses one message-id function for both compile and lookup', () => {
    const catalog = loadCompiledAppCatalog();

    expect(Object.keys(catalog)).toContain(generateMessageId('Send'));
    expect(translate(catalog, 'Send')).not.toBe('Send');
  });
});
