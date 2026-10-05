import { defineApplication } from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER,
  KAVENEGAR_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  KAVENEGAR_ENDPOINT_VARIABLE_UNIVERSAL_IDENTIFIER,
  KAVENEGAR_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_BACKUP_SENDER_ONE_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_BACKUP_SENDER_TWO_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER,
  RAZPAYAMAK_USERNAME_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Communication',
  description:
    'Generic outbound communication for People. Records one outbound message independently of the channel it travels through, so new channels and providers can be added without changing the data model.',
  // Explicit empty `serverVariables` is a **removal tombstone**, not a
  // declaration. The platform only reconciles registration variables when the
  // key is present (`application-registration.service.ts`:
  // `if (isDefined(manifest.application.serverVariables))`), and
  // `syncVariableSchemas` deletes every registration variable for the app when
  // the declared set is empty. Omitting the key entirely would therefore leave
  // the previous shared rows behind. Declaring it empty removes them through
  // supported sync, so no workspace can inherit a shared credential.
  serverVariables: {},
  // Provider credentials, sender identities and the default-provider selection
  // are declared as native **workspace** application variables.
  //
  // Why workspace-owned and not registration-scoped `serverVariables`:
  // `serverVariables` are stored on the application *registration* and are
  // shared by every workspace that installs the app, so two workspaces could
  // never use different provider accounts. These values are per-workspace
  // credentials, so they must be materialised per workspace, encrypted with the
  // workspace key, and injected only into that workspace's function execution
  // context. The platform does exactly that for `applicationVariables`
  // (`compute-application-manifest-all-universal-flat-entity-maps.service.ts`
  // encrypts with `{ workspaceId }`, and the logic-function executor merges the
  // workspace map after the registration map, so workspace values win).
  //
  // Every variable must carry a stable `universalIdentifier`; the platform keys
  // the sync on it, so changing one is treated as a different variable.
  //
  // Configuration is namespaced per provider: each driver reads only its own
  // variables, so adding a provider never touches another provider's config.
  // Nothing here is `isRequired` (the 2.35.0 application-variable contract has
  // no such field): an unused provider must not block installation, and the app
  // reports a precise "not configured" failure at send time instead.
  applicationVariables: {
    // Which provider is used when a caller does not choose one explicitly.
    COMMUNICATION_PROVIDER: {
      universalIdentifier:
        COMMUNICATION_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Provider id used by default for outbound communication. One of: kavenegar, razpayamak.',
      isSecret: false,
    },
    KAVENEGAR_ENDPOINT: {
      universalIdentifier: KAVENEGAR_ENDPOINT_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Kavenegar API base endpoint, for example https://api.kavenegar.com/v1.',
      isSecret: false,
    },
    KAVENEGAR_API_KEY: {
      universalIdentifier: KAVENEGAR_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Kavenegar API key. Sent in the request path; stored encrypted per workspace and never exposed in API responses.',
      isSecret: true,
    },
    KAVENEGAR_SENDER: {
      universalIdentifier: KAVENEGAR_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER,
      description: 'Kavenegar sender line the message is sent from.',
      isSecret: false,
    },
    RAZPAYAMAK_USERNAME: {
      universalIdentifier: RAZPAYAMAK_USERNAME_VARIABLE_UNIVERSAL_IDENTIFIER,
      description: 'RazPayamak panel username used by the SmartSMS service.',
      isSecret: false,
    },
    RAZPAYAMAK_API_KEY: {
      universalIdentifier: RAZPAYAMAK_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'RazPayamak ApiKey issued under the developer menu. Sent as the SmartSMS `password` field; stored encrypted per workspace and never exposed in API responses.',
      isSecret: true,
    },
    RAZPAYAMAK_SENDER: {
      universalIdentifier: RAZPAYAMAK_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'RazPayamak primary sender number used as the SmartSMS `from` field.',
      isSecret: false,
    },
    RAZPAYAMAK_BACKUP_SENDER_ONE: {
      universalIdentifier:
        RAZPAYAMAK_BACKUP_SENDER_ONE_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Optional RazPayamak backup sender line used when the primary line fails.',
      isSecret: false,
    },
    RAZPAYAMAK_BACKUP_SENDER_TWO: {
      universalIdentifier:
        RAZPAYAMAK_BACKUP_SENDER_TWO_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Optional second RazPayamak backup sender line used when the primary and first backup fail.',
      isSecret: false,
    },
  },
});
