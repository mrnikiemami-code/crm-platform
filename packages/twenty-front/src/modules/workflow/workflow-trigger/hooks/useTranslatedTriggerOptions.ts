import { CRON_TRIGGER_INTERVAL_OPTIONS } from '@/workflow/workflow-trigger/constants/CronTriggerIntervalOptions';
import { MANUAL_TRIGGER_AVAILABILITY_TYPE_OPTIONS } from '@/workflow/workflow-trigger/constants/ManualTriggerAvailabilityTypeOptions';
import { MANUAL_TRIGGER_IS_PINNED_OPTIONS } from '@/workflow/workflow-trigger/constants/ManualTriggerIsPinnedOptions';
import { WEBHOOK_TRIGGER_AUTHENTICATION_OPTIONS } from '@/workflow/workflow-trigger/constants/WebhookTriggerAuthenticationOptions';
import { WEBHOOK_TRIGGER_HTTP_METHOD_OPTIONS } from '@/workflow/workflow-trigger/constants/WebhookTriggerHttpMethodOptions';
import { type MessageDescriptor } from '@lingui/core';
import { useLingui } from '@lingui/react';

// Trigger option constants carry message descriptors; the label is resolved at
// render time so the persisted setting values stay locale-independent.
const translateOptions = <TOption extends { labelMessage: MessageDescriptor }>(
  options: TOption[],
  translate: (descriptor: MessageDescriptor) => string,
): (Omit<TOption, 'labelMessage'> & { label: string })[] =>
  options.map(({ labelMessage, ...option }) => ({
    ...option,
    label: translate(labelMessage),
  }));

export const useTranslatedTriggerOptions = () => {
  const { i18n } = useLingui();
  const translate = (descriptor: MessageDescriptor) => i18n._(descriptor);

  return {
    availabilityTypeOptions: translateOptions(
      MANUAL_TRIGGER_AVAILABILITY_TYPE_OPTIONS,
      translate,
    ),
    isPinnedOptions: translateOptions(MANUAL_TRIGGER_IS_PINNED_OPTIONS, translate),
    cronIntervalOptions: translateOptions(CRON_TRIGGER_INTERVAL_OPTIONS, translate),
    webhookHttpMethodOptions: translateOptions(
      WEBHOOK_TRIGGER_HTTP_METHOD_OPTIONS,
      translate,
    ),
    webhookAuthenticationOptions: translateOptions(
      WEBHOOK_TRIGGER_AUTHENTICATION_OPTIONS,
      translate,
    ),
  };
};
