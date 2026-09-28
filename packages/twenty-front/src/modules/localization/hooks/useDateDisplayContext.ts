import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

export const useDateDisplayContext = () => {
  const { calendar, timeZone, dateFormat, timeFormat } = useDateTimeFormat();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { localeCatalog } = useAtomStateValue(dateLocaleState);

  return {
    calendar,
    timeZone,
    dateFormat,
    timeFormat,
    locale: currentWorkspaceMember?.locale ?? SOURCE_LOCALE,
    localeCatalog,
  };
};
