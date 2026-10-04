import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Communication',
  description:
    'Generic outbound communication for People. Records one outbound message independently of the channel it travels through, so new channels can be added without changing the data model.',
  // Provider credentials are declared as server variables. Twenty stores their
  // values encrypted at rest (`isSecret: true`) and never exposes them in API
  // responses, so no credential is ever written to a workspace record.
  serverVariables: {
    COMMUNICATION_PROVIDER_ENDPOINT: {
      description:
        'Base endpoint of the outbound communication provider. No provider is selected yet; this is the configuration seam only.',
      isSecret: false,
      isRequired: false,
    },
    COMMUNICATION_PROVIDER_API_KEY: {
      description:
        'API key used to authenticate outbound communication requests. Stored encrypted; never exposed in API responses.',
      isSecret: true,
      isRequired: false,
    },
    COMMUNICATION_PROVIDER_SENDER: {
      description:
        'Default sender identity (for example a phone number) outbound communications are sent from.',
      isSecret: false,
      isRequired: false,
    },
  },
});
