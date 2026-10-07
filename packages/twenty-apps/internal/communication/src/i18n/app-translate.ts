import { useCallback } from 'react';

import persianCatalog from '../../locales/fa-IR.json';

// App-owned Persian translation. The app cannot rely on the Twenty build tool
// supporting `fa-IR` (the published CLI skips it: `fa-IR` is not in the bundled
// `twenty-shared` locale list), so the catalog ships with the app and is applied
// by this small module instead of the SDK's baked-catalog mechanism. The file is
// the same authored catalog under `locales/`; esbuild inlines it at build time.
const PERSIAN_CATALOG = persianCatalog as Record<string, string>;

// Persian is written right-to-left; the composer mirrors its layout for it.
export const isPersianLocale = (locale: string): boolean => {
  const normalized = locale.toLowerCase();

  return normalized === 'fa' || normalized.startsWith('fa-');
};

/**
 * Pure translation core. Persian resolves against the app-owned catalog (a
 * missing key falls back to the source string); every other locale defers to the
 * SDK's own `t`. Kept separate from the hook so the shipped behavior is directly
 * testable.
 */
export const translateAppMessage = (options: {
  locale: string;
  message: string;
  sdkTranslate: (message: string) => string;
}): string => {
  const { locale, message, sdkTranslate } = options;

  return isPersianLocale(locale)
    ? (PERSIAN_CATALOG[message] ?? message)
    : sdkTranslate(message);
};

export type AppTranslate = {
  /** The locale the host reported. */
  locale: string;
  t: (message: string) => string;
};

export const useAppTranslate = (options: {
  locale: string;
  sdkTranslate: (message: string) => string;
}): AppTranslate => {
  const { locale, sdkTranslate } = options;

  const t = useCallback(
    (message: string) => translateAppMessage({ locale, message, sdkTranslate }),
    [locale, sdkTranslate],
  );

  return { locale, t };
};
