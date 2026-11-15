import { fromStorage, fromUrl } from '@lingui/detect-locale';
import { APP_LOCALES, DEFAULT_APP_LOCALE } from 'twenty-shared/translations';
import { isDefined, isValidLocale, normalizeLocale } from 'twenty-shared/utils';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

// The locale a visitor sees before they sign in.
//
// Only an EXPLICIT choice counts: `?locale=` on the URL, or the locale this
// browser picked earlier. The browser's own Accept-Language is deliberately NOT
// consulted — a visitor on an English machine must still get the product's
// default language, and treating the browser as a choice would also make the
// first screen differ from the workspace they are about to join.
export const initialI18nActivate = () => {
  const urlLocale = fromUrl('locale');
  const storageLocale = fromStorage('locale');

  let locale: keyof typeof APP_LOCALES = DEFAULT_APP_LOCALE;

  const normalizedUrlLocale = isDefined(urlLocale)
    ? normalizeLocale(urlLocale)
    : null;
  const normalizedStorageLocale = isDefined(storageLocale)
    ? normalizeLocale(storageLocale)
    : null;

  if (isDefined(normalizedUrlLocale) && isValidLocale(normalizedUrlLocale)) {
    locale = normalizedUrlLocale;
    try {
      localStorage.setItem('locale', normalizedUrlLocale);
    } catch (error) {
      // oxlint-disable-next-line no-console
      console.log('Failed to save locale to localStorage:', error);
    }
  } else if (
    isDefined(normalizedStorageLocale) &&
    isValidLocale(normalizedStorageLocale)
  ) {
    locale = normalizedStorageLocale;
  }

  dynamicActivate(locale);
};
