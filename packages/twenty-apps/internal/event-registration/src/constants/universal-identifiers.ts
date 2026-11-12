// Every identifier below is stable: the platform reconciles application
// entities by universal identifier, so changing one is treated as a different
// entity (a new command item, a new function) rather than an edit.
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '3c1f6a52-9d84-4e07-b5a3-7f21c8de9043';

export const REGISTRATION_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER =
  'b7d24e19-5a63-4c8f-9e21-6d40af8b3c77';

// One form, two entry points: the record page of a lead and of a sales
// interaction both open this single component.
export const REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'e2a95c14-7f38-4b6d-a0c9-3e57b1df8264';

export const REGISTER_FROM_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'a51c7b83-2e46-4d19-8f05-9b3c67e2a410';
export const REGISTER_FROM_INTERACTION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'd94b0e27-6c18-4a53-b7f2-1e85a309cc61';

export const PREPARE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '6f0b8d41-3a97-4e26-8c15-2b7d9e40fa52';
export const SAVE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '8d3e5a76-9c04-4f8b-ae71-5b2c40d9f13e';

// The app's function role is scoped per object, and those entries are matched by
// the objects' OWN universal identifiers. These six are the objects already in
// the workspace; declaring them here is what lets the role stay minimal — there
// is no wildcard to fall back on. Verified identical in the development and
// intranet workspaces (same metadata lineage), and stable because the platform
// reconciles by this value.
export const EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER =
  '8b0406f5-f10d-499d-8f81-0994bd10c05f';
export const SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER =
  '51187b43-d919-4c5e-aebf-b95c89d02f06';
export const PERSON_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-e674-48e5-a542-72570eee7213';
export const ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '4e96de24-aef1-4ca9-9da3-5ac0e673ccc8';
export const EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER =
  '2fb53fae-1866-4c38-a37a-0aa8d4797c57';
export const REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '020a3694-c0fc-4dfb-b108-efad91ced90d';

// Workspace variable overrides the platform-injected API base URL for this app's
// functions only (see application.config.ts).
export const RECORD_API_BASE_URL_VARIABLE_UNIVERSAL_IDENTIFIER =
  'c5a10f83-2d64-4b97-a8e1-6f30d9b47e2a';
