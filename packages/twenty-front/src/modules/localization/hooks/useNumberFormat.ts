import { useMemo } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  formatNumber as utilFormatNumber,
  type FormatNumberOptions,
} from '~/utils/format/formatNumber';

// Locales that render with Persian digits. A single list so a new
// digit-localizing locale is one entry, not a scattered condition.
const PERSIAN_DIGIT_LOCALES = ['fa-IR'];

export const useNumberFormat = () => {
  const workspaceMemberFormatPreferences = useAtomStateValue(
    workspaceMemberFormatPreferencesState,
  );
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const locale = currentWorkspaceMember?.locale ?? SOURCE_LOCALE;
  const usesPersianDigits = PERSIAN_DIGIT_LOCALES.includes(locale);

  const formatNumber = useMemo(
    () =>
      (
        value: number,
        options?: Omit<FormatNumberOptions, 'format'>,
      ): string => {
        const formatted = utilFormatNumber(value, {
          format: workspaceMemberFormatPreferences.numberFormat,
          ...options,
        });

        // Persian digits for a Persian workspace, applied at the single
        // formatted-number seam so every consumer is covered at once.
        return usesPersianDigits ? formatDigitsAsPersian(formatted) : formatted;
      },
    [workspaceMemberFormatPreferences.numberFormat, usesPersianDigits],
  );

  return {
    formatNumber,
    numberFormat: workspaceMemberFormatPreferences.numberFormat,
  };
};
