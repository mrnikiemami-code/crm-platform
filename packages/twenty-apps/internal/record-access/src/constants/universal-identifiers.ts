import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

// Identifiers this app needs, split by what makes them portable.
//
// PORTABLE: everything the platform ships has the same universal identifier in
// every workspace. Those are read from STANDARD_OBJECTS instead of being copied
// as literals, so the app cannot drift from the platform's own definition.
export const PERSON_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.person.universalIdentifier;
export const WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.workspaceMember.universalIdentifier;
/** `workspaceMember.id`: the "Me (User ID)" value the record-level rule uses. */
export const WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.workspaceMember.fields.id.universalIdentifier;

// Objects that carry customer data but have no row-level rule. A system object
// defaults to readable when a role has no override for it, so these are named
// explicitly and denied; leaving them out would be the same as granting them.
export const ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.attachment.universalIdentifier;
export const NOTE_TARGET_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.noteTarget.universalIdentifier;
export const TASK_TARGET_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.taskTarget.universalIdentifier;
export const TIMELINE_ACTIVITY_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.timelineActivity.universalIdentifier;
export const CALENDAR_EVENT_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.calendarEventParticipant.universalIdentifier;
export const MESSAGE_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.messageParticipant.universalIdentifier;

// WORKSPACE-SPECIFIC: the academy objects live in the workspace's custom
// application and the `assignee` fields are created per workspace, so their ids
// differ between instances. The block below is written by
// scripts/generate-workspace-identifiers.ts — never edit it by hand. On a new
// workspace: run create-assignee-fields.ts, then the generator, then build.
//
// BEGIN GENERATED WORKSPACE IDENTIFIERS
export const EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER =
  '8b0406f5-f10d-499d-8f81-0994bd10c05f';
export const EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER =
  '2fb53fae-1866-4c38-a37a-0aa8d4797c57';
export const REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '020a3694-c0fc-4dfb-b108-efad91ced90d';
export const SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER =
  '51187b43-d919-4c5e-aebf-b95c89d02f06';
export const ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '4e96de24-aef1-4ca9-9da3-5ac0e673ccc8';

export const PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '0e6b1519-ccbf-457f-813e-c9f7ab099e4d';
export const EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '764a5e26-2d5d-4c0a-ae05-ea024d5ff9d8';
export const REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '7bb15378-ff15-4148-921e-d9c7581a6c2a';
export const SALES_INTERACTION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER =
  '503a0aaa-7607-492e-98e6-91aba22c451a';

export const EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER =
  '97aba3ff-dcda-42f3-8154-f8d6b9e1feee';
// END GENERATED WORKSPACE IDENTIFIERS

// --- this app's own entities (minted once, part of the published app) -------
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '9b0f4d6e-2c85-4a7b-9e31-6d5f8a2c4b17';

export const ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER =
  '7a2b4c6d-9e13-4f57-a011-6c8e2b4d9f60';

// The platform requires every application to name the role its own operations
// run as. This app has no logic functions, so the role grants nothing and is
// only the app's identity.
export const RECORD_ACCESS_APP_ROLE_UNIVERSAL_IDENTIFIER =
  '7a2b4c6d-9e13-4f57-a011-6c8e2b4d9f61';

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
