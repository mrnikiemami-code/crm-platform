import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';
import { type IconComponent, IconHttpGet, IconHttpPost } from 'twenty-ui/icon';

export type WebhookHttpMethods = 'GET' | 'POST';

// HTTP verbs are protocol tokens; only the option chrome is translatable.
export const WEBHOOK_TRIGGER_HTTP_METHOD_OPTIONS: Array<{
  labelMessage: MessageDescriptor;
  value: WebhookHttpMethods;
  Icon: IconComponent;
}> = [
  {
    labelMessage: msg`GET`,
    value: 'GET',
    Icon: IconHttpGet,
  },
  {
    labelMessage: msg`POST`,
    value: 'POST',
    Icon: IconHttpPost,
  },
];
