export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '768bca20-0b81-4d33-a624-0a894a193ffd';

export const DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER =
  'a7517c4b-7257-409f-9bfd-b15817bdc623';

// Communication object
export const COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER =
  '0f30ffdc-a032-4740-95a6-7d0059d49383';
export const COMMUNICATION_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'a40daf91-e20e-4385-a80f-0cff1176590f';
export const COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER =
  'd61fe7c4-ee50-4109-aeab-847db46c2655';
export const COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER =
  '532057f8-9d4c-4272-8409-d9fd7bdc08a4';
export const COMMUNICATION_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER =
  '9843a84f-233a-43c6-91cc-b876f65f20ba';
export const COMMUNICATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '4c09f95d-33cf-45a6-8e2e-8e041bea4970';
export const COMMUNICATION_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER =
  'da100a12-5d65-413d-a596-84ed50156b55';
export const COMMUNICATION_PROVIDER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '3f2a5b7c-4d61-4e8f-9a0b-1c2d3e4f5a6b';
export const COMMUNICATION_RECIPIENT_FIELD_UNIVERSAL_IDENTIFIER =
  '4a3b6c8d-5e72-4f90-ab1c-2d3e4f5a6b7c';
export const COMMUNICATION_PROVIDER_MESSAGE_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '2e1e1f29-ab30-494a-94f6-3134c4055a4b';
export const COMMUNICATION_FAILURE_REASON_FIELD_UNIVERSAL_IDENTIFIER =
  '30497b41-8ce9-4b3a-b5c0-fbc039ad004a';
export const COMMUNICATION_QUEUED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '17ee55b4-689b-4f3f-ae4d-0433fefc5dd5';
export const COMMUNICATION_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '082db93b-888b-49c0-b8e3-54dba0475716';
export const COMMUNICATION_DELIVERED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '5e7822ca-2627-4693-9a21-38479e871ed1';

// Relations
export const COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'b1bfd4a2-4e12-4846-b4c6-61caad242e84';
export const COMMUNICATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '2de2c209-e3a6-4f94-9122-f0f75625164f';
export const COMMUNICATION_SENDER_FIELD_UNIVERSAL_IDENTIFIER =
  '91cd4527-f4d3-427b-86ab-9b0c6b8a61f0';
export const COMMUNICATIONS_ON_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER =
  'a8d62781-7a33-40ae-a899-e56748579788';

// Send-message vertical slice (W5)
export const SEND_MESSAGE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'b7c1e3d5-2f48-4a69-8b0c-1d2e3f4a5b6c';
export const SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'c8d2f4e6-3a59-4b70-9c1d-2e3f4a5b6c7d';
export const SEND_PERSON_COMMUNICATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'd9e3a5f7-4b60-4c81-ad2e-3f4a5b6c7d8e';
export const LIST_PERSON_PHONE_OPTIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'ea4b6c81-5c71-4d92-be3f-4a5b6c7d8e9f';

// Timeline integration (W6)
export const COMMUNICATION_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER =
  'a093b325-527d-4282-a0c9-9921745de0e2';
export const COMMUNICATION_TIMELINE_RENDERER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '762996db-f9e9-4781-8a88-3820b2943689';
export const ON_COMMUNICATION_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'ca2d8874-c451-4d79-84a1-b0b807ea8f88';

// Workflow action (W7)
export const SEND_COMMUNICATION_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER =
  'e55f7b79-cf61-45b4-a1c4-259fa7089b28';

// Workspace application variables (W9-R2)
// Provider credentials, sender identities and default-provider selection are
// workspace-owned: they are declared as native `applicationVariables`, which the
// platform materialises per workspace, encrypts per workspace, and exposes to
// logic functions through the workspace-scoped execution context. Each variable
// needs a stable universal identifier; these are generated once and must never
// change, because a changed identifier is treated as a different variable.
export const COMMUNICATION_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER =
  '477dc6e2-ddfb-4e72-9e67-cc87d240f160';
export const KAVENEGAR_ENDPOINT_VARIABLE_UNIVERSAL_IDENTIFIER =
  '3d567260-3825-4faa-ae86-280e02b0e32d';
export const KAVENEGAR_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER =
  '076e58cb-5ab7-409c-8253-4afcc8ef0de2';
export const KAVENEGAR_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER =
  '4db6a8af-2612-4465-acae-f15b8e3da085';
export const RAZPAYAMAK_USERNAME_VARIABLE_UNIVERSAL_IDENTIFIER =
  'bb7d473c-e4ba-4440-92bc-24ce5709d374';
export const RAZPAYAMAK_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER =
  'ac7a5ffa-4a4f-4c7a-a092-5504319f0bdc';
export const RAZPAYAMAK_SENDER_VARIABLE_UNIVERSAL_IDENTIFIER =
  'da25b771-9e4e-4d2f-8fb3-0f5e6e40e79f';
export const RAZPAYAMAK_BACKUP_SENDER_ONE_VARIABLE_UNIVERSAL_IDENTIFIER =
  'e469abb7-fae1-48f9-a5e5-16eb45e49683';
export const RAZPAYAMAK_BACKUP_SENDER_TWO_VARIABLE_UNIVERSAL_IDENTIFIER =
  '8d0985d9-f096-4d58-8ae5-739ed3e5822b';

// NOTE (W9-R1): a custom settings front component was registered in W9 and has
// been RETIRED. Twenty's application settings page shows the Variables tab only
// when no custom settings tab exists
// (SettingsApplicationDetails.tsx: `!hasCustomSettingsTab`), so a custom tab
// would have HIDDEN the native variables screen that owns credentials and the
// default provider. The published SDK 2.35.0 exposes no app-side application
// variable editor, so the native Variables tab stays authoritative and no
// settings component is registered. No universal identifier is reserved here
// because nothing was ever installed with one.
