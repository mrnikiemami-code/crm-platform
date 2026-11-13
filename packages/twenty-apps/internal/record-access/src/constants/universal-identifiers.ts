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
  '2b2f56f8-cc15-4ee8-804c-b80bc1b6f0a5';
export const EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '704ece13-777b-48aa-8010-98984342d3a4';
export const REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  'a015306d-1549-4c0a-b0d3-294eca09ca2a';

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
