import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { dateLocaleState } from '~/localization/states/dateLocaleState';
import { beautifyPastDateRelativeToNow } from '~/utils/date-utils';

type EventLogTimestampCellProps = {
  timestamp: string;
};

export const EventLogTimestampCell = ({
  timestamp,
}: EventLogTimestampCellProps) => {
  const { localeCatalog } = useAtomStateValue(dateLocaleState);

  return <>{beautifyPastDateRelativeToNow(timestamp, localeCatalog)}</>;
};
