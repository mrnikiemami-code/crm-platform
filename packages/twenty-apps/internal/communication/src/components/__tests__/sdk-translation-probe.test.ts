import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateMessageId } from 'twenty-shared/i18n';
import { t as sdkTranslate } from 'twenty-sdk/front-component';
import { describe, expect, it } from 'vitest';

// Drives the REAL produced SDK front-component runtime: `t` is imported from the
// built `twenty-sdk/front-component` entry that a shipped app resolves, and the
// two globals it reads are populated exactly as the build/runtime do — the
// execution context supplies the locale, the compiled catalog supplies the
// translations. No resolver logic is reimplemented here.
const CONTEXT_KEY = '__twentySdkExecutionContext__';
const TRANSLATIONS_KEY = '__twentySdkFrontComponentTranslations__';

const loadAppPersianCatalog = (): Record<string, string> => {
  const raw = readFileSync(join(process.cwd(), 'locales', 'fa-IR.json'), 'utf8');
  const authored = JSON.parse(raw) as Record<string, string>;

  return Object.fromEntries(
    Object.entries(authored).map(([message, translation]) => [
      generateMessageId(message),
      translation,
    ]),
  );
};

const setRuntimeGlobals = (
  locale: string,
  catalogs: Record<string, Record<string, string>>,
): void => {
  (globalThis as Record<string, unknown>)[CONTEXT_KEY] = { locale };
  (globalThis as Record<string, unknown>)[TRANSLATIONS_KEY] = catalogs;
};

describe('produced SDK runtime translation (witness)', () => {
  it('resolves real Persian keys through the shipped runtime', () => {
    setRuntimeGlobals('fa-IR', { 'fa-IR': loadAppPersianCatalog() });

    expect(sdkTranslate('Send')).toBe('ارسال');
    expect(sdkTranslate('Phone number')).toBe('شماره تلفن');
    expect(sdkTranslate('Channel')).toBe('کانال');
    expect(sdkTranslate('Unable to load phone numbers.')).toBe(
      'دریافت شماره‌ها ناموفق بود.',
    );
    expect(
      sdkTranslate('No phone number is recorded for this person.'),
    ).toBe('شماره‌ای برای این شخص ثبت نشده است.');
  });

  it('falls back to the English source string for an untranslated key', () => {
    setRuntimeGlobals('fa-IR', { 'fa-IR': loadAppPersianCatalog() });

    expect(sdkTranslate('Not translated anywhere')).toBe(
      'Not translated anywhere',
    );
  });

  it('returns the English source string for the source locale', () => {
    setRuntimeGlobals('en', { 'fa-IR': loadAppPersianCatalog() });

    expect(sdkTranslate('Send')).toBe('Send');
  });

  it('falls back when no catalog is present for the active locale', () => {
    setRuntimeGlobals('de-DE', { 'fa-IR': loadAppPersianCatalog() });

    expect(sdkTranslate('Send')).toBe('Send');
  });

  it('is the same message-id scheme the catalog compile uses', () => {
    // A drift between the id used to key the catalog and the id the runtime
    // computes would silently untranslate; this asserts they agree.
    setRuntimeGlobals('fa-IR', { 'fa-IR': loadAppPersianCatalog() });

    expect(sdkTranslate('Send')).not.toBe('Send');
    expect(Object.keys(loadAppPersianCatalog())).toContain(
      generateMessageId('Send'),
    );
  });
});

// The strongest witness available locally: the app's own build output, produced
// by the local SDK 2.42 CLI (`twenty dev:build`), which bakes the compiled
// catalog into a `globalThis["__twentySdkFrontComponentTranslations__"] = {...}`
// banner. This test reads that banner out of the shipped `.mjs` and feeds it to
// the real runtime `t`, proving the produced bundle translates end to end. It
// skips when the bundle has not been built.
describe('produced build output translation (bundle witness)', () => {
  const bundlePath = join(
    process.cwd(),
    '.twenty',
    'output',
    'src',
    'components',
    'send-message-composer.front-component.mjs',
  );

  const hasBundle = existsSync(bundlePath);
  const maybeIt = hasBundle ? it : it.skip;

  const loadBakedCatalogs = (): Record<string, Record<string, string>> => {
    const source = readFileSync(bundlePath, 'utf8');
    const match = source.match(
      /globalThis\["__twentySdkFrontComponentTranslations__"\]\s*=\s*(\{[\s\S]*?\});/,
    );

    expect(match).not.toBeNull();

    return JSON.parse(match![1]) as Record<string, Record<string, string>>;
  };

  maybeIt('bakes the Persian catalog and translates through the real runtime', () => {
    setRuntimeGlobals('fa-IR', loadBakedCatalogs());

    expect(sdkTranslate('Send')).toBe('ارسال');
    expect(sdkTranslate('Unable to load phone numbers.')).toBe(
      'دریافت شماره‌ها ناموفق بود.',
    );
  });

  maybeIt('keeps the English source fallback in the produced bundle', () => {
    setRuntimeGlobals('fa-IR', loadBakedCatalogs());

    expect(sdkTranslate('A key that was never translated')).toBe(
      'A key that was never translated',
    );
  });
});
