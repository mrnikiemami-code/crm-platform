import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import {
  IconCheckbox,
  type IconComponent,
  IconId,
  IconListDetails,
} from 'twenty-ui/icon';

export const MANUAL_TRIGGER_AVAILABILITY_TYPE_OPTIONS: Array<{
  labelMessage: MessageDescriptor;
  value: 'GLOBAL' | 'SINGLE_RECORD' | 'BULK_RECORDS';
  Icon: IconComponent;
}> = [
  {
    labelMessage: msg`Global`,
    value: 'GLOBAL',
    Icon: IconCheckbox,
  },
  {
    labelMessage: msg`Single`,
    value: 'SINGLE_RECORD',
    Icon: IconId,
  },
  {
    labelMessage: msg`Bulk`,
    value: 'BULK_RECORDS',
    Icon: IconListDetails,
  },
];
