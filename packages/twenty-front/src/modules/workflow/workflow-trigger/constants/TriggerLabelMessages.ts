import { msg } from '@lingui/core/macro';
import { type MessageDescriptor } from '@lingui/core';

// `defaultLabel` is the persisted identity used to resolve the database event
// name, so it must stay stable and untranslated. Only the displayed text is
// localized, through the message descriptor below.
export const TRIGGER_LABEL_MESSAGE_BY_DEFAULT_LABEL: Record<
  string,
  MessageDescriptor
> = {
  'Record is created': msg`Record is created`,
  'Record is updated': msg`Record is updated`,
  'Record is deleted': msg`Record is deleted`,
  'Record is created or updated': msg`Record is created or updated`,
  'Launch manually': msg`Launch manually`,
  'On a schedule': msg`On a schedule`,
  Webhook: msg`Webhook`,
};
