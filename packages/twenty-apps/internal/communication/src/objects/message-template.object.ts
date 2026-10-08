import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Channel is an open SELECT so a new channel is appended, never a redesign.
// Only implemented channels are listed: an unsupported channel must not appear
// as a selectable dead control. Mirrors the Communication object's channel.
enum MessageTemplateChannel {
  SMS = 'SMS',
}

// A workspace-owned message template. It is a NATIVE app object, so it is
// created, edited, listed and permissioned through the platform's own object
// machinery — there is no parallel storage, no local file and no out-of-band
// table. A workspace owns its templates like any other record: two workspaces
// can never see each other's templates.
//
// The template stores ONLY the title and the body text with `@variable`
// placeholders. It never stores recipient data: interpolation is performed
// server-side at preview time against the authorized Person fields, so the
// template itself carries no personal data and cannot leak another workspace's
// records.
export default defineObject({
  universalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'messageTemplate',
  namePlural: 'messageTemplates',
  labelSingular: 'Message template',
  labelPlural: 'Message templates',
  description:
    'A reusable message body with @variable placeholders, owned by this workspace.',
  icon: 'IconTemplate',
  // Workspace-owned and hand-authored: the generic UI create/edit affordance is
  // the supported CRUD path (unlike the Communication object, which is written
  // only by the send flow). Permissions are the platform's own object
  // permissions.
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'title',
      label: 'Title',
      description: 'Short name a user recognises this template by',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'body',
      label: 'Body',
      description:
        'Message text with @variable placeholders, resolved server-side per recipient',
      icon: 'IconMessage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'channel',
      label: 'Channel',
      description: 'Channel this template is intended for',
      icon: 'IconBroadcast',
      defaultValue: `'${MessageTemplateChannel.SMS}'`,
      options: [
        {
          id: '7b1c2d3e-4f50-4162-8374-95a6b7c8d9e0',
          value: MessageTemplateChannel.SMS,
          label: 'SMS',
          position: 0,
          color: 'blue',
        },
      ],
    },
  ],
});
