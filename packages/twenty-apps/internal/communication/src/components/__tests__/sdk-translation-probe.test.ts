import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { t as sdkTranslate } from 'twenty-sdk/front-component';
import { describe, expect, it } from 'vitest';

// Build-boundary witness. It consumes the app's OWN build output — the
// front-component bundle produced by the app's build in the 2.42 toolchain —
// and drives it through the REAL `t` from the installed
// `twenty-sdk/front-component` runtime. Nothing about the id scheme, the
// catalog format or the resolver is reimplemented here: the runtime computes the
// ids internally, so a resolution can only succeed if the runtime's scheme and
// the baked banner agree.
//
// The two globals are exactly what the host pushes at runtime: the execution
// context supplies the locale, the banner supplies the catalogs.
const CONTEXT_KEY = '__twentySdkExecutionContext__';
const TRANSLATIONS_KEY = '__twentySdkFrontComponentTranslations__';

// Resolved from this file, not the cwd, so the witness is position-independent.
const bundlePath = fileURLToPath(
  new URL(
    '../../../.twenty/output/src/components/send-message-composer.front-component.mjs',
    import.meta.url,
  ),
);

const readBakedCatalogs = (): Record<string, Record<string, string>> => {
  // The banner is esbuild's `banner.js`, so line 1 is exactly
  // `globalThis["__twentySdkFrontComponentTranslations__"]=<json>;`.
  const firstLine = readFileSync(bundlePath, 'utf8').split('\n', 1)[0];
  const prefix = `globalThis[${JSON.stringify(TRANSLATIONS_KEY)}]=`;

  expect(firstLine.startsWith(prefix)).toBe(true);

  return JSON.parse(firstLine.slice(prefix.length).replace(/;\s*$/, '')) as Record<
    string,
    Record<string, string>
  >;
};

const setRuntime = (
  locale: string,
  catalogs: Record<string, Record<string, string>>,
): void => {
  (globalThis as Record<string, unknown>)[CONTEXT_KEY] = { locale };
  (globalThis as Record<string, unknown>)[TRANSLATIONS_KEY] = catalogs;
};

describe('produced bundle translation (build-boundary witness)', () => {
  it('has a built bundle to witness — never skipped silently', () => {
    expect(
      existsSync(bundlePath),
      `Missing ${bundlePath}. Build the app in the 2.42 toolchain before the suite; the translation witness must not pass by skipping.`,
    ).toBe(true);
  });

  it('translates real Persian keys through the produced bundle and real runtime', () => {
    setRuntime('fa-IR', readBakedCatalogs());

    expect(sdkTranslate('Send')).toBe('ارسال');
    expect(sdkTranslate('Phone number')).toBe('شماره تلفن');
    expect(sdkTranslate('Channel')).toBe('کانال');
    expect(sdkTranslate('Unable to load phone numbers.')).toBe(
      'دریافت شماره‌ها ناموفق بود.',
    );
    expect(sdkTranslate('No phone number is recorded for this person.')).toBe(
      'شماره‌ای برای این شخص ثبت نشده است.',
    );
  });

  it('keeps the English source fallback for an untranslated key', () => {
    setRuntime('fa-IR', readBakedCatalogs());

    expect(sdkTranslate('A key that was never translated')).toBe(
      'A key that was never translated',
    );
  });

  it('falls back to the source string when no catalog is baked for the locale', () => {
    setRuntime('de-DE', readBakedCatalogs());

    expect(sdkTranslate('Send')).toBe('Send');
  });

  it('returns the source string for the source locale', () => {
    setRuntime('en', readBakedCatalogs());

    expect(sdkTranslate('Send')).toBe('Send');
  });
});
