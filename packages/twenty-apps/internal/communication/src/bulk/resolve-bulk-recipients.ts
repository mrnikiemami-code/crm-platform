import {
  computeSharedPhoneWarnings,
  type SharedPhoneWarning,
} from 'src/bulk/shared-phone-warnings';
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
  /**
   * The number that would be used, or `null` when the recipient cannot be sent
   * to. `null` covers both "no number at all" and "the caller selected a number
   * that does not belong to this Person" — in neither case is a number invented.
   */
  selectedPhone: string | null;
};

/** Why a phone override was rejected. */
export type InvalidOverrideReason =
  | 'EMPTY_SELECTION'
  | 'INVALID_TYPE'
  | 'NOT_OWNED_BY_PERSON';

export type InvalidPhoneOverride = {
  personId: string;
  reason: InvalidOverrideReason;
};

/** A key the caller did not supply at all, as opposed to an explicit choice. */
export type PhoneOverrides = {
  /** Only keys the caller actually supplied; an absent key is not listed. */
  present: Record<string, unknown>;
};

export type { SharedPhoneWarning };

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
 * Recomputes shared-number warnings from a set of recipients and the number
 * each currently resolves to. Callers pass the CURRENT selections so the
 * warning always reflects what would actually be sent.
 */
export const recomputeSharedPhoneWarnings = (
  recipients: readonly BulkRecipient[],
): SharedPhoneWarning[] =>
  computeSharedPhoneWarnings(
    recipients.map((recipient) => ({
      personId: recipient.personId,
      phone: recipient.selectedPhone,
    })),
  );

export type PhoneOverrideApplication = {
  recipients: BulkRecipient[];
  /**
   * Every override the caller supplied that was NOT a valid number of that
   * Person, with the specific reason. The recipient is set to `selectedPhone:
   * null` (never the primary, never the bogus value) and is therefore not ready
   * to send and excluded from `readyCount`.
   */
  invalidOverrides: InvalidPhoneOverride[];
};

/**
 * Applies per-recipient phone overrides.
 *
 * Distinguishes an ABSENT key (the caller expressed no choice → keep the
 * recipient's own default) from an EXPLICIT choice that is empty, of an invalid
 * type, or not a number of that Person. An explicit invalid choice is reported
 * and the recipient is left with NO destination (`selectedPhone: null`) — the
 * primary number is never substituted for it. A valid override changes only its
 * own recipient.
 */
export const applyPhoneOverrides = ({
  recipients,
  overrides,
}: {
  recipients: readonly BulkRecipient[];
  overrides: Record<string, unknown>;
}): PhoneOverrideApplication => {
  const invalidOverrides: InvalidPhoneOverride[] = [];

  const nextRecipients = recipients.map((recipient) => {
    if (!Object.prototype.hasOwnProperty.call(overrides, recipient.personId)) {
      return recipient;
    }

    const override = overrides[recipient.personId];

    if (typeof override !== 'string') {
      invalidOverrides.push({
        personId: recipient.personId,
        reason: 'INVALID_TYPE',
      });

      return { ...recipient, selectedPhone: null };
    }

    if (override.trim().length === 0) {
      invalidOverrides.push({
        personId: recipient.personId,
        reason: 'EMPTY_SELECTION',
      });

      return { ...recipient, selectedPhone: null };
    }

    const trimmed = override.trim();

    if (!recipient.phones.some((phone) => phone.value === trimmed)) {
      invalidOverrides.push({
        personId: recipient.personId,
        reason: 'NOT_OWNED_BY_PERSON',
      });

      return { ...recipient, selectedPhone: null };
    }

    return { ...recipient, selectedPhone: trimmed };
  });

  return { recipients: nextRecipients, invalidOverrides };
};

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

  const sendableCount = recipients.filter(
    (recipient) => recipient.status === 'SENDABLE',
  ).length;

  return {
    recipients,
    duplicatePersonIds,
    sharedPhoneWarnings: recomputeSharedPhoneWarnings(recipients),
    sendableCount,
    unsendableCount: recipients.length - sendableCount,
  };
};
