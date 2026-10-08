import {
  buildPersonPhoneOptions,
  type PersonPhoneOption,
  type PersonPhones,
} from 'src/logic-functions/types/person-phone.type';

// Minimal shape of a Person as returned by the workspace API for bulk
// resolution. It mirrors only the fields the app is authorized to read and
// never imports a platform type, so the logic-function bundle stays small.
export type BulkPersonRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  company?: { name?: string | null } | null;
  phones?: PersonPhones;
};

/**
 * Why a recipient cannot be sent to. `NOT_ACCESSIBLE` covers both "does not
 * exist" and "not permitted": the server only returns records the caller may
 * read, so a requested id missing from the response is honestly "not
 * accessible" and never silently dropped.
 */
export type BulkRecipientStatus = 'SENDABLE' | 'NO_PHONE' | 'NOT_ACCESSIBLE';

export type BulkRecipient = {
  personId: string;
  /** Best-effort display name; falls back to the id when the name is empty. */
  displayName: string;
  status: BulkRecipientStatus;
  /** Selectable numbers, primary first. Empty when none or inaccessible. */
  phones: PersonPhoneOption[];
  /** Default selection: the primary number, or `null` when not sendable. */
  selectedPhone: string | null;
};

export type SharedPhoneWarning = {
  phone: string;
  /** The distinct recipients that resolve to the same number. */
  personIds: string[];
};

export type BulkRecipientResolution = {
  recipients: BulkRecipient[];
  /** Requested ids that appeared more than once and were collapsed. */
  duplicatePersonIds: string[];
  /** Numbers shared by two or more distinct recipients. */
  sharedPhoneWarnings: SharedPhoneWarning[];
  /** Recipients that can be sent to (a real number is selectable). */
  sendableCount: number;
  /** Recipients that cannot be sent to (no phone or not accessible). */
  unsendableCount: number;
};

const buildFullName = (record: BulkPersonRecord): string | null => {
  const parts = [
    record.name?.firstName?.trim() ?? '',
    record.name?.lastName?.trim() ?? '',
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(' ') : null;
};

const buildDisplayName = (record: BulkPersonRecord): string =>
  buildFullName(record) ?? record.id;

/**
 * Resolves a raw multi-record selection into per-recipient rows.
 *
 *  - Duplicate ids are collapsed and reported.
 *  - A requested id absent from `persons` (the server returns only accessible
 *    records) becomes a `NOT_ACCESSIBLE` recipient — it is shown, never
 *    dropped, so the count a user sees matches what they selected.
 *  - A recipient with no usable number becomes `NO_PHONE`.
 *  - A number shared by two or more distinct recipients is reported as a
 *    warning (it is not an error, but it must be visible before sending).
 *
 * This is pure: all authorization already happened in the API read that
 * produced `persons`.
 */
export const resolveBulkRecipients = ({
  requestedPersonIds,
  persons,
}: {
  requestedPersonIds: string[];
  persons: BulkPersonRecord[];
}): BulkRecipientResolution => {
  const personsById = new Map(persons.map((person) => [person.id, person]));
  const duplicatePersonIds: string[] = [];
  const reportedDuplicates = new Set<string>();
  const seenPersonIds = new Set<string>();
  const recipients: BulkRecipient[] = [];

  for (const rawId of requestedPersonIds) {
    const personId = rawId.trim();

    if (personId.length === 0) {
      continue;
    }

    if (seenPersonIds.has(personId)) {
      // Report each duplicated id once, no matter how many times it repeated.
      if (!reportedDuplicates.has(personId)) {
        reportedDuplicates.add(personId);
        duplicatePersonIds.push(personId);
      }
      continue;
    }

    seenPersonIds.add(personId);

    const person = personsById.get(personId);

    if (person === undefined) {
      recipients.push({
        personId,
        displayName: personId,
        status: 'NOT_ACCESSIBLE',
        phones: [],
        selectedPhone: null,
      });
      continue;
    }

    const phones = buildPersonPhoneOptions(person.phones ?? null);
    const primary = phones.find((phone) => phone.isPrimary) ?? phones[0];

    recipients.push({
      personId,
      displayName: buildDisplayName(person),
      status: phones.length === 0 ? 'NO_PHONE' : 'SENDABLE',
      phones,
      selectedPhone: phones.length === 0 ? null : (primary?.value ?? null),
    });
  }

  // A number is "shared" when two or more DISTINCT recipients resolve to it.
  const personIdsByPhone = new Map<string, string[]>();

  for (const recipient of recipients) {
    if (recipient.status !== 'SENDABLE' || recipient.selectedPhone === null) {
      continue;
    }

    const existing = personIdsByPhone.get(recipient.selectedPhone) ?? [];

    existing.push(recipient.personId);
    personIdsByPhone.set(recipient.selectedPhone, existing);
  }

  const sharedPhoneWarnings: SharedPhoneWarning[] = [];

  for (const [phone, personIds] of personIdsByPhone) {
    if (personIds.length > 1) {
      sharedPhoneWarnings.push({ phone, personIds });
    }
  }

  const sendableCount = recipients.filter(
    (recipient) => recipient.status === 'SENDABLE',
  ).length;

  return {
    recipients,
    duplicatePersonIds,
    sharedPhoneWarnings,
    sendableCount,
    unsendableCount: recipients.length - sendableCount,
  };
};
