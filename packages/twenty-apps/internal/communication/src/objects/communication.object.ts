import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_DELIVERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
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
enum CommunicationChannel {
  SMS = 'SMS',
}

enum CommunicationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

enum CommunicationDirection {
  OUTBOUND = 'OUTBOUND',
}

export default defineObject({
  universalIdentifier: COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'communication',
  namePlural: 'communications',
  labelSingular: 'Communication',
  labelPlural: 'Communications',
  description:
    'One outbound communication, independent of the channel or provider it travels through.',
  icon: 'IconSend',
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
          label: 'SMS',
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
          id: '65f60718-293a-44b5-d6c7-e8f901122334',
          value: CommunicationStatus.QUEUED,
          label: 'Queued',
          position: 0,
          color: 'gray',
        },
        {
          id: '76071829-3a4b-45c6-e7d8-f90112233445',
          value: CommunicationStatus.SENT,
          label: 'Sent',
          position: 1,
          color: 'blue',
        },
        {
          id: '8718293a-4b5c-46d7-f8e9-011223344556',
          value: CommunicationStatus.DELIVERED,
          label: 'Delivered',
          position: 2,
          color: 'green',
        },
        {
          id: '98293a4b-5c6d-47e8-09fa-122334455667',
          value: CommunicationStatus.FAILED,
          label: 'Failed',
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
          id: 'a93a4b5c-6d7e-4809-1a0b-233445566778',
          value: CommunicationDirection.OUTBOUND,
          label: 'Outbound',
          position: 0,
          color: 'blue',
        },
      ],
    },
    {
      // Send-time snapshot: the provider actually used. Stored so history stays
      // truthful even if the configured default provider changes later.
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
  ],
});
