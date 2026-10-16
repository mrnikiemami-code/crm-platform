import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_DELIVERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_SOURCE_RECORD_ID_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_FAILURE_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_PROVIDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_PROVIDER_MESSAGE_ID_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_RECIPIENT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_QUEUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Channel is an open SELECT, not a fixed enum, so a new channel is added by
// appending one option — never by a schema redesign. Only channels that are
// actually implemented are listed: unsupported channels must not appear as
// selectable dead controls. SMS is the first planned channel; WhatsApp,
// Telegram, Instagram and Bale become options when their channel ships.
//
// Option `value` is the stable machine identifier and must never change; the
// `label` is the workspace-facing copy. This app is Persian-first, so labels
// are Persian here (the platform has no per-locale option-label mechanism for
// app-defined options).
enum CommunicationChannel {
  SMS = 'SMS',
}

// Workspace-facing Persian labels for the channel option. The `value` is the
// stable machine identifier and never changes; only the label is localized.
const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  [CommunicationChannel.SMS]: 'پیامک',
};

enum CommunicationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

enum CommunicationDirection {
  OUTBOUND = 'OUTBOUND',
}

// Workspace-facing Persian labels. The `value` is the stable machine
// identifier and never changes; only the label is localized. The platform has
// no per-locale option-label mechanism for app-defined options, so this
// Persian-first app authors the labels in Persian.
const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  [CommunicationStatus.QUEUED]: 'در صف',
  [CommunicationStatus.SENT]: 'ارسال شد',
  [CommunicationStatus.DELIVERED]: 'تحویل شد',
  [CommunicationStatus.FAILED]: 'ناموفق',
};

const COMMUNICATION_DIRECTION_LABELS: Record<CommunicationDirection, string> = {
  [CommunicationDirection.OUTBOUND]: 'خروجی',
};

// Provider is intentionally NOT modeled as a SELECT here. The platform's app
// sync does not apply a field TYPE change (`UpdateFieldInput` has no `type`),
// so a TEXT→SELECT rewrite leaves an inconsistent column. The provider is
// stored as its stable machine id (`razpayamak` / `kavenegar`) in the TEXT
// `providerId` field, and the Persian name is presented by the app's own
// surfaces through `resolveProviderLabel` (timeline card).
export default defineObject({
  universalIdentifier: COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'communication',
  namePlural: 'communications',
  labelSingular: 'Communication',
  labelPlural: 'Communications',
  description:
    'One outbound communication, independent of the channel or provider it travels through.',
  icon: 'IconSend',
  // Records are written by the send flow, never hand-authored. Disabling the
  // generic create affordance removes the "create a Communication" form that
  // could be mistaken for sending a message; the native send path and the
  // logic functions are unaffected. The sidebar view is read-only history.
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    COMMUNICATION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: COMMUNICATION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Short label identifying this communication',
      icon: 'IconAbc',
      isNullable: true,
    },
    {
      universalIdentifier: COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'channel',
      label: 'Channel',
      description: 'Channel the communication travels through',
      icon: 'IconBroadcast',
      defaultValue: `'${CommunicationChannel.SMS}'`,
      options: [
        {
          id: '10a1b2c3-d4e5-4f60-8172-93a4b5c6d7e8',
          value: CommunicationChannel.SMS,
          label: COMMUNICATION_CHANNEL_LABELS[CommunicationChannel.SMS],
          position: 0,
          color: 'blue',
        },
      ],
    },
    {
      universalIdentifier: COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'body',
      label: 'Body',
      description: 'Message text that was sent',
      icon: 'IconMessage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: COMMUNICATION_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'subject',
      label: 'Subject',
      description: 'Optional subject, for channels that support one',
      icon: 'IconHeading',
      isNullable: true,
    },
    {
      universalIdentifier: COMMUNICATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      description: 'Delivery state of this communication',
      icon: 'IconProgress',
      defaultValue: `'${CommunicationStatus.QUEUED}'`,
      options: [
        {
          id: 'd2f48b26-2d20-4945-ae97-f671bcb34b91',
          value: CommunicationStatus.QUEUED,
          label: COMMUNICATION_STATUS_LABELS[CommunicationStatus.QUEUED],
          position: 0,
          color: 'gray',
        },
        {
          id: '43aadda8-9626-425c-b82d-ab0282e089a3',
          value: CommunicationStatus.SENT,
          label: COMMUNICATION_STATUS_LABELS[CommunicationStatus.SENT],
          position: 1,
          color: 'blue',
        },
        {
          id: 'a0d493c1-31b3-4390-98c9-93781752d311',
          value: CommunicationStatus.DELIVERED,
          label: COMMUNICATION_STATUS_LABELS[CommunicationStatus.DELIVERED],
          position: 2,
          color: 'green',
        },
        {
          id: '2ee303bf-9ea2-4113-bb9f-62e52cd5e71e',
          value: CommunicationStatus.FAILED,
          label: COMMUNICATION_STATUS_LABELS[CommunicationStatus.FAILED],
          position: 3,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier: COMMUNICATION_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'direction',
      label: 'Direction',
      description: 'Direction of the communication relative to this workspace',
      icon: 'IconArrowRight',
      defaultValue: `'${CommunicationDirection.OUTBOUND}'`,
      options: [
        {
          id: 'e7224a85-9a18-4762-8c81-0327c681dbd5',
          value: CommunicationDirection.OUTBOUND,
          label: COMMUNICATION_DIRECTION_LABELS[CommunicationDirection.OUTBOUND],
          position: 0,
          color: 'blue',
        },
      ],
    },
    {
      // Send-time snapshot: the provider actually used. Stored so history stays
      // truthful even if the configured default provider changes later.
      //
      // This is the stable MACHINE id (`razpayamak` / `kavenegar`), kept as
      // TEXT on purpose: the platform's app sync does not apply a field
      // TYPE change (a TEXT→SELECT rewrite left the column as TEXT while
      // writing options — an inconsistent state), so the type is left alone.
      // The Persian provider label is shown by the app's own surfaces
      // (composer, timeline card) instead of the generic cell.
      universalIdentifier:
        COMMUNICATION_PROVIDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'providerId',
      label: 'Provider',
      description: 'Provider that was selected for this send',
      icon: 'IconPlugConnected',
      isNullable: true,
    },
    {
      // Send-time snapshot: the exact destination used. Stored so history stays
      // meaningful even if the linked Person's phone number changes later.
      universalIdentifier: COMMUNICATION_RECIPIENT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'recipient',
      label: 'Recipient',
      description: 'Destination address this communication was sent to',
      icon: 'IconPhone',
      isNullable: true,
    },
    {
      universalIdentifier:
        COMMUNICATION_PROVIDER_MESSAGE_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'providerMessageId',
      label: 'Provider message ID',
      description: 'Identifier returned by the provider for this message',
      icon: 'IconHash',
      isNullable: true,
    },
    {
      universalIdentifier:
        COMMUNICATION_FAILURE_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'failureReason',
      label: 'Failure reason',
      description: 'Reason the provider reported when sending failed',
      icon: 'IconAlertTriangle',
      isNullable: true,
    },
    {
      universalIdentifier: COMMUNICATION_QUEUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'queuedAt',
      label: 'Queued at',
      description: 'When the communication was queued for sending',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: COMMUNICATION_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'sentAt',
      label: 'Sent at',
      description: 'When the provider accepted the communication',
      icon: 'IconSend',
      isNullable: true,
    },
    {
      universalIdentifier:
        COMMUNICATION_DELIVERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'deliveredAt',
      label: 'Delivered at',
      description: 'When the provider confirmed delivery',
      icon: 'IconCircleCheck',
      isNullable: true,
    },
    {
      // WHICH record the message was composed from, when that record is not the
      // recipient Person. It is what makes two sends with DIFFERENT source values
      // distinguishable in history: the body alone would not say which Opportunity
      // produced it.
      //
      // A plain metadata id, never a credential, written only from the
      // server-resolved context. Nullable because every existing row predates it
      // and every Person-source send leaves it empty.
      universalIdentifier:
        COMMUNICATION_SOURCE_RECORD_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceRecordId',
      label: 'Source record id',
      description: 'The record this message was composed from, when not the recipient',
      icon: 'IconFileText',
      isNullable: true,
      isUIEditable: false,
    },
  ],
});
