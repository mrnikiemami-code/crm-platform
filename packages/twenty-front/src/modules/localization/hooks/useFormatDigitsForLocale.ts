import { useCallback } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

// Locales that render with Eastern-Arabic/Persian digits. A single place so a
// new digit-localizing locale is one entry, not a scattered condition.
const PERSIAN_DIGIT_LOCALES = ['fa-IR'];

/**
 * Formats a string's ASCII digits with the current member locale's numerals.
 *
 * Only DIGITS change: identifiers, phone numbers and formatted numbers keep
 * their exact characters otherwise. Used for values that are technical strings
 * rather than numbers (e.g. a phone number), where `formatNumber` does not
 * apply.
 */
export const useFormatDigitsForLocale = () => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const locale = currentWorkspaceMember?.locale ?? SOURCE_LOCALE;

  return useCallback(
    (value: string): string =>
      PERSIAN_DIGIT_LOCALES.includes(locale)
        ? formatDigitsAsPersian(value)
        : value,
    [locale],
  );
};
