// Stable identities for this app. A universal identifier is how the platform
// recognises an app and its logic functions across installs and upgrades, so
// these must never change once installed — a changed value is treated as a new
// entity.
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'fb0af0ce-826b-4218-af6f-180e527064d8';

// The field this app owns on `salesInteraction`. It records WHO wrote the title:
// `true` when this app generated it and may therefore replace it, `false` when a
// person typed it and the app must never touch it.
export const TITLE_OWNERSHIP_FIELD_NAME = 'titleIsAuto';
export const TITLE_OWNERSHIP_FIELD_UNIVERSAL_IDENTIFIER =
  '3ffc43e2-38b0-4d69-863f-419dc64b896b';

// Title synchronisation entry points. Two of them because one database-event
// trigger fires on one event name: creation fills an empty title, and updates
// follow a change to the attempt or to the title itself.
export const TITLE_ON_CREATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'dac3c08f-07cb-4d65-8662-a17bec5592ef';
export const TITLE_ON_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '5c3cff63-7a28-43d0-bfd4-d83817a170ad';
export const PERSON_TITLE_SYNC_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a41c8e52-9d47-4b16-8f03-2e5d7b9c6a18';

// The least-privilege role this app's logic functions run as.
export const SALES_FOLLOWUP_APP_ROLE_UNIVERSAL_IDENTIFIER =
  'c72b4d18-5a63-4f29-9b47-8e1c3d6a0f52';

// The object this app owns titles for, and the two it reads to find a customer.
// These belong to THIS workspace's custom application; the scripts verify that
// they resolve before writing anything, and refuse rather than guess.
export const SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER =
  '51187b43-d919-4c5e-aebf-b95c89d02f06';
export const EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER =
  '8b0406f5-f10d-499d-8f81-0994bd10c05f';
export const PERSON_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-e674-48e5-a542-72570eee7213';
