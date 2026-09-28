import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { resolveDateFormat } from '@/localization/utils/resolveDateFormat';
import { resolveTimeFormat } from '@/localization/utils/resolveTimeFormat';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useDateTimeFormat = () => {
  const workspaceMemberFormatPreferences = useAtomStateValue(
    workspaceMemberFormatPreferencesState,
  );
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  return {
    timeZone: workspaceMemberFormatPreferences.timeZone,
    dateFormat: resolveDateFormat(workspaceMemberFormatPreferences.dateFormat),
    timeFormat: resolveTimeFormat(workspaceMemberFormatPreferences.timeFormat),
    calendarStartDay: workspaceMemberFormatPreferences.calendarStartDay,
    calendar: getCalendarSystemForLocale(currentWorkspaceMember?.locale),
  };
};
