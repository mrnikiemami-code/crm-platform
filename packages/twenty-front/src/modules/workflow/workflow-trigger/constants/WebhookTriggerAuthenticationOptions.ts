import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { type IconComponent, IconKey, IconLockOpen } from 'twenty-ui/icon';

export type AuthenticationMethods = 'API_KEY' | null;

export const WEBHOOK_TRIGGER_AUTHENTICATION_OPTIONS: Array<{
  labelMessage: MessageDescriptor;
  value: AuthenticationMethods;
  Icon: IconComponent;
}> = [
  {
    labelMessage: msg`None`,
    value: null,
    Icon: IconLockOpen,
  },
  {
    labelMessage: msg`API key`,
    value: 'API_KEY',
    Icon: IconKey,
  },
];
