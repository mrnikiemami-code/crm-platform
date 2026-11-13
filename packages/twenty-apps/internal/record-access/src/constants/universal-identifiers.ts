// Universal identifiers for this app's own entities, and the identifiers it
// points at.
//
// The assignee fields are created once per workspace through the platform's own
// data-model API (see scripts/create-assignee-fields.ts), because they belong to
// objects this application does not own: person is a standard object, while
// eventLead, eventRegistration and registrationPayment belong to the workspace's
// custom application. Their universal identifiers are therefore read back from
// the workspace and recorded here, so the role below can reference them.
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '9b0f4d6e-2c85-4a7b-9e31-6d5f8a2c4b17';

// --- workspace objects the policy covers ------------------------------------
export const PERSON_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-e674-48e5-a542-72570eee7213';
export const EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER =
  '8b0406f5-f10d-499d-8f81-0994bd10c05f';
export const EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER =
  '2fb53fae-1866-4c38-a37a-0aa8d4797c57';
export const REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '020a3694-c0fc-4dfb-b108-efad91ced90d';
// A sales interaction is the same customer conversation as its lead, so it
// carries the same owner. Without it the restricted role would have to choose
// between seeing every interaction in the workspace and seeing none.
export const SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER =
  '51187b43-d919-4c5e-aebf-b95c89d02f06';
export const WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-3319-4234-a34c-82d5c0e881a6';
export const ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '4e96de24-aef1-4ca9-9da3-5ac0e673ccc8';

// --- objects that carry customer data but have no row-level rule ------------
// A system object defaults to readable when a role has no override for it, so
// these are named explicitly and denied; leaving them out would be the same as
// granting them.
export const ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-bd3d-4c60-8dca-571c71d4447a';
export const NOTE_TARGET_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-fff0-4b44-be82-bda313884400';
export const TASK_TARGET_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-5a9a-44e8-95df-771cd06d0fb1';
export const TIMELINE_ACTIVITY_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-6736-4337-b5c4-8b39fae325a5';
export const CALENDAR_EVENT_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-a1c3-47a6-9732-27e5b1e8436d';
export const MESSAGE_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-a433-4456-aa2d-fd9cb26b774a';

// --- standard fields referenced by the policy -------------------------------
// `workspaceMember.id`: the "Me (User ID)" value the record-level settings use.
export const WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'd77dff76-dcfd-52a3-b352-832898b28b9d';
// `eventLead.assignedTo` already exists ("مسئول پیگیری") and is the lead's
// assignment; no new lead field is needed.
export const EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER =
  '97aba3ff-dcda-42f3-8154-f8d6b9e1feee';

// --- the assignee fields, as created in this workspace ----------------------
export const PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '0e6b1519-ccbf-457f-813e-c9f7ab099e4d';
export const EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '764a5e26-2d5d-4c0a-ae05-ea024d5ff9d8';
export const REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '7bb15378-ff15-4148-921e-d9c7581a6c2a';
// Created in the isolated proof run; a fresh workspace gets its own id from
// scripts/create-assignee-fields.ts.
export const SALES_INTERACTION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '971a5d85-0863-4cee-a2a0-350503dfa037';

// --- the role that carries the policy ---------------------------------------
export const ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER =
  '7a2b4c6d-9e13-4f57-a011-6c8e2b4d9f60';
// The platform requires every application to name the role its own operations
// run as. This app has no logic functions, so the role grants nothing and is
// only the app's identity.
export const RECORD_ACCESS_APP_ROLE_UNIVERSAL_IDENTIFIER =
  '7a2b4c6d-9e13-4f57-a011-6c8e2b4d9f61';

// --- one predicate per restricted object ------------------------------------
export const PERSON_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER =
  '8b3c5d7e-0f24-4a68-b122-7d9f3c5e0a71';
export const EVENT_LEAD_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER =
  '8b3c5d7e-0f24-4a68-b122-7d9f3c5e0a72';
export const EVENT_REGISTRATION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER =
  '8b3c5d7e-0f24-4a68-b122-7d9f3c5e0a73';
export const REGISTRATION_PAYMENT_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER =
  '8b3c5d7e-0f24-4a68-b122-7d9f3c5e0a74';
export const SALES_INTERACTION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER =
  '8b3c5d7e-0f24-4a68-b122-7d9f3c5e0a75';
