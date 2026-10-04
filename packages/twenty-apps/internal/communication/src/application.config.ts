import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Communication',
  description:
    'Generic outbound communication for People. Records one outbound message independently of the channel it travels through, so new channels and providers can be added without changing the data model.',
  // Provider credentials and configuration are declared as server variables.
  // Twenty stores their values encrypted at rest and never exposes them in API
  // responses, so no credential is ever written to a workspace record.
  //
  // Configuration is namespaced per provider: each driver reads only its own
  // variables, so adding a provider never touches another provider's config.
  serverVariables: {
    // Which provider is used when a caller does not choose one explicitly.
    COMMUNICATION_PROVIDER: {
      description:
        'Provider id used by default for outbound communication. One of: kavenegar, razpayamak.',
      isSecret: false,
      isRequired: false,
    },
    KAVENEGAR_ENDPOINT: {
      description:
        'Kavenegar API base endpoint, for example https://api.kavenegar.com/v1.',
      isSecret: false,
      isRequired: false,
    },
    KAVENEGAR_API_KEY: {
      description:
        'Kavenegar API key. Sent in the request path; stored encrypted and never exposed in API responses.',
      isSecret: true,
      isRequired: false,
    },
    KAVENEGAR_SENDER: {
      description: 'Kavenegar sender line the message is sent from.',
      isSecret: false,
      isRequired: false,
    },
    RAZPAYAMAK_USERNAME: {
      description:
        'RazPayamak panel username used by the SmartSMS service.',
      isSecret: false,
      isRequired: false,
    },
    RAZPAYAMAK_API_KEY: {
      description:
        'RazPayamak ApiKey issued under the developer menu. Sent as the SmartSMS `password` field; stored encrypted and never exposed in API responses.',
      isSecret: true,
      isRequired: false,
    },
    RAZPAYAMAK_SENDER: {
      description:
        'RazPayamak primary sender number used as the SmartSMS `from` field.',
      isSecret: false,
      isRequired: false,
    },
    RAZPAYAMAK_BACKUP_SENDER_ONE: {
      description:
        'Optional RazPayamak backup sender line used when the primary line fails.',
      isSecret: false,
      isRequired: false,
    },
    RAZPAYAMAK_BACKUP_SENDER_TWO: {
      description:
        'Optional second RazPayamak backup sender line used when the primary and first backup fail.',
      isSecret: false,
      isRequired: false,
    },
  },
});
