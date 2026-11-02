import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import {
  IconClockPlay,
  type IconComponent,
  IconHours24,
  IconTimeDuration60,
  IconBrandDaysCounter,
} from 'twenty-ui/icon';

export type CronTriggerInterval = 'DAYS' | 'HOURS' | 'MINUTES' | 'CUSTOM';

export const CRON_TRIGGER_INTERVAL_OPTIONS: Array<{
  labelMessage: MessageDescriptor;
  value: CronTriggerInterval;
  Icon: IconComponent;
}> = [
  {
    labelMessage: msg`Days`,
    value: 'DAYS',
    Icon: IconBrandDaysCounter,
  },
  {
    labelMessage: msg`Hours`,
    value: 'HOURS',
    Icon: IconHours24,
  },
  {
    labelMessage: msg`Minutes`,
    value: 'MINUTES',
    Icon: IconTimeDuration60,
  },
  {
    labelMessage: msg`Cron (custom)`,
    value: 'CUSTOM',
    Icon: IconClockPlay,
  },
];
