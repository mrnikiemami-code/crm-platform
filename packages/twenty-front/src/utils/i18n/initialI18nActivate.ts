import { fromStorage, fromUrl } from '@lingui/detect-locale';
import { APP_LOCALES, DEFAULT_APP_LOCALE } from 'twenty-shared/translations';
import { isDefined, isValidLocale, normalizeLocale } from 'twenty-shared/utils';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

// `normalizeLocale` answers SOURCE_LOCALE for anything it does not recognise, so
// asking it first would turn a stale or hand-edited value ("not-a-locale") into
// an explicit English choice. Only a value that really names a locale — or a
// language that maps onto one — counts as a choice.
const resolveExplicitLocale = (
  value: string | null,
): keyof typeof APP_LOCALES | null => {
  if (!isDefined(value)) {
    return null;
  }

  const normalized = normalizeLocale(value);

  if (!isValidLocale(normalized)) {
    return null;
  }

  const rawValueMatchesLocale = Object.keys(APP_LOCALES).some(
    (locale) => locale.toLowerCase() === value.trim().toLowerCase(),
  );
  const rawValueMatchesLanguage =
    normalized.split('-')[0].toLowerCase() ===
    value.trim().split('-')[0].toLowerCase();

  return rawValueMatchesLocale || rawValueMatchesLanguage ? normalized : null;
};

// The locale a visitor sees before they sign in.
//
// Only an EXPLICIT choice counts: `?locale=` on the URL, or the locale this
// browser picked earlier. The browser's own Accept-Language is deliberately NOT
// consulted — a visitor on an English machine must still get the product's
// default language, and treating the browser as a choice would also make the
// first screen differ from the workspace they are about to join.
export const initialI18nActivate = () => {
  const urlLocale = resolveExplicitLocale(fromUrl('locale'));
  const storageLocale = resolveExplicitLocale(fromStorage('locale'));

  let locale: keyof typeof APP_LOCALES = DEFAULT_APP_LOCALE;

  if (isDefined(urlLocale)) {
    locale = urlLocale;
    try {
      localStorage.setItem('locale', urlLocale);
    } catch (error) {
      // oxlint-disable-next-line no-console
      console.log('Failed to save locale to localStorage:', error);
    }
  } else if (isDefined(storageLocale)) {
    locale = storageLocale;
  }

  dynamicActivate(locale);
};
