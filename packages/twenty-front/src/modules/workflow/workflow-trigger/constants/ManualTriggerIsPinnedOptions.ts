import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { type IconComponent, IconPinned, IconPinnedOff } from 'twenty-ui/icon';

export const MANUAL_TRIGGER_IS_PINNED_OPTIONS: Array<{
  labelMessage: MessageDescriptor;
  value: boolean;
  Icon: IconComponent;
}> = [
  {
    labelMessage: msg`Not pinned`,
    value: false,
    Icon: IconPinnedOff,
  },
  {
    labelMessage: msg`Pinned`,
    value: true,
    Icon: IconPinned,
  },
];
