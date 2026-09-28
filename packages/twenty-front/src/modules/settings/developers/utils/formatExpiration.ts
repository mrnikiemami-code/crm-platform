import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { differenceInDays, differenceInYears, parseISO } from 'date-fns';

import { localizeDigitsForAppLocale } from '@/localization/utils/localizeDigitsForAppLocale';
import { NEVER_EXPIRE_DELTA_IN_YEARS } from '@/settings/developers/constants/NeverExpireDeltaInYears';
import { beautifyDateDiff } from '~/utils/date-utils';

export const doesNeverExpire = (expiresAt: string) => {
  const expirationDate = parseISO(expiresAt);
  const now = new Date();
  const yearsDiff = differenceInYears(expirationDate, now);
  return yearsDiff > NEVER_EXPIRE_DELTA_IN_YEARS / 10;
};

// A key counts as expired once at least one full day has passed, matching
// the negative day count beautifyDateDiff produces.
const hasExpirationPassed = (expiresAt: string) =>
  differenceInDays(parseISO(expiresAt), new Date()) < 0;

export const isExpired = (expiresAt: string | null) => {
  if (!isNonEmptyString(expiresAt) || doesNeverExpire(expiresAt)) {
    return false;
  }
  return hasExpirationPassed(expiresAt);
};

export const formatExpiration = (
  expiresAt: string | null,
  withExpiresMention = false,
  short = true,
  locale?: string | null,
) => {
  if (!isNonEmptyString(expiresAt) || doesNeverExpire(expiresAt)) {
    return withExpiresMention ? t`Never expires` : t`Never`;
  }
  if (hasExpirationPassed(expiresAt)) {
    return t`Expired`;
  }
  const dateDiff = localizeDigitsForAppLocale(
    beautifyDateDiff(expiresAt, undefined, short),
    locale,
  );
  return withExpiresMention ? t`Expires in ${dateDiff}` : t`In ${dateDiff}`;
};
