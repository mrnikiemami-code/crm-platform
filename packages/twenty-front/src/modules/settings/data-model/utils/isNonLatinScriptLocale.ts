import { isDefined } from 'twenty-shared/utils';

export const isNonLatinScriptLocale = (locale: string | undefined | null) => {
  if (!isDefined(locale) || locale === '') {
    return false;
  }

  try {
    const script = new Intl.Locale(locale).maximize().script;

    return isDefined(script) && script !== 'Latn';
  } catch {
    return false;
  }
};
