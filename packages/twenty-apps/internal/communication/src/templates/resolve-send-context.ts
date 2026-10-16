import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  type EligibleTemplateSource,
  PERSON_SOURCE_OBJECT_NAME,
  resolveStoredTemplateSource,
} from 'src/templates/data/find-eligible-template-sources';
import { readSourceRecordRelation } from 'src/templates/data/read-source-record-relation';

// Resolves the SEND CONTEXT for one selected record.
//
// The rule the whole feature rests on: a record of a related source is not sent
// to a number attached to that record — the record is read, its stored relation
// is followed, and the PERSON at the other end is the recipient. So the recipient
// is derived from the record, never supplied by the client, and the same record
// yields the same recipient on every attempt.
//
// Every identifier is validated against the LIVE eligible set first, so a renamed,
// deactivated or removed object/relation is a hard failure rather than a silent
// reinterpretation.

export const SEND_CONTEXT_OUTCOME = {
  /** The record's source, relation and recipient all resolved. */
  RESOLVED: 'RESOLVED',
  /**
   * The record's object is not a template source at all (or its source is not
   * resolvable any more). The caller reports this; it NEVER becomes Person.
   */
  UNSUPPORTED_OBJECT: 'UNSUPPORTED_OBJECT',
  /** The source record itself could not be read. */
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  /** The source record's relation is null: there is no recipient to send to. */
  RELATION_EMPTY: 'RELATION_EMPTY',
} as const;

export type SendContextOutcome =
  (typeof SEND_CONTEXT_OUTCOME)[keyof typeof SEND_CONTEXT_OUTCOME];

export type ResolvedSendContext =
  | {
      outcome: typeof SEND_CONTEXT_OUTCOME.RESOLVED;
      /** The `nameSingular` of the object the record belongs to. */
      objectName: string;
      /** The object's stable identifier, as stored on the template. */
      objectUid: string;
      /** The relation used to reach the recipient, `''` for a Person source. */
      relationUid: string;
      relationName: string;
      /** The source record the `@source.*` tokens read from. */
      sourceRecordId: string;
      /** The PERSON the message is addressed to. */
      recipientPersonId: string;
      /**
       * `null` for a Person source, where the source record IS the recipient and
       * a second, identical read would be waste.
       */
      sourceRecord: { objectName: string; recordId: string } | null;
    }
  | {
      outcome: Exclude<SendContextOutcome, typeof SEND_CONTEXT_OUTCOME.RESOLVED>;
    };

/**
 * Resolves the send context for `recordId`, given the object it belongs to.
 *
 * `objectName` is the object's `nameSingular` — the value the HOST reports for
 * the selection, not a client-chosen string. It is matched against the eligible
 * set, so an object that is not a source (or is not eligible) is refused.
 *
 * `relationUid` is the template's stored relation, which selects WHICH relation
 * to follow when a source object has more than one path to a Person.
 */
export const resolveSendContext = async ({
  client,
  sources,
  objectName,
  recordId,
  relationUid,
}: {
  client: Pick<CoreApiClient, 'query'>;
  sources: readonly EligibleTemplateSource[];
  objectName: string;
  recordId: string;
  relationUid: string;
}): Promise<ResolvedSendContext> => {
  // The source is identified by its NAME here because that is what the host
  // reports for the selection. It is immediately converted to the stable
  // identifier, and the name is never used as identity after this point.
  const source = sources.find((entry) => entry.objectName === objectName);

  if (source === undefined) {
    return { outcome: SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT };
  }

  const resolved = resolveStoredTemplateSource({
    sources,
    storedObjectUid: source.objectUid,
    storedRelationUid: relationUid,
  });

  // `UNRESOLVABLE` means the requested relation is not one of the object's
  // Person-resolving relations. Refusing is the point: guessing one would be the
  // "pick a Person for the user" failure.
  //
  // `LEGACY_PERSON` is impossible at this point — it only arises from an EMPTY
  // stored identifier, and this function is reached only after the source was
  // found by NAME, so its identifier is present. It is checked EXPLICITLY rather
  // than assumed, so a future change that makes it reachable fails closed instead
  // of proceeding with a `null` identifier.
  if (resolved.kind !== 'RESOLVED') {
    return { outcome: SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT };
  }

  const resolvedObjectName = resolved.objectName;
  const resolvedObjectUid = resolved.objectUid;

  const isPersonSource = resolvedObjectName === PERSON_SOURCE_OBJECT_NAME;

  if (isPersonSource) {
    // The record IS the person, so no relation is followed and no second read is
    // made. Access is proven by the recipient lookup in the send path.
    return {
      outcome: SEND_CONTEXT_OUTCOME.RESOLVED,
      objectName: resolvedObjectName,
      objectUid: resolvedObjectUid,
      relationUid: '',
      relationName: '',
      sourceRecordId: recordId,
      recipientPersonId: recordId,
      sourceRecord: null,
    };
  }

  const resolvedRelationUid = resolved.relationUid;
  const resolvedRelationName = resolved.relationName;

  if (resolvedRelationName.length === 0) {
    return { outcome: SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT };
  }

  const related = await readSourceRecordRelation({
    client,
    objectName: resolvedObjectName,
    relationName: resolvedRelationName,
    recordId,
  });

  if (related.kind === 'NOT_FOUND') {
    return { outcome: SEND_CONTEXT_OUTCOME.RECORD_NOT_FOUND };
  }

  if (related.kind === 'RELATION_EMPTY') {
    return { outcome: SEND_CONTEXT_OUTCOME.RELATION_EMPTY };
  }

  return {
    outcome: SEND_CONTEXT_OUTCOME.RESOLVED,
    objectName: resolvedObjectName,
    objectUid: resolvedObjectUid,
    relationUid: resolvedRelationUid,
    relationName: resolvedRelationName,
    sourceRecordId: recordId,
    recipientPersonId: related.personId,
    // `@source.*` reads THIS record, and the recipient is reached through it.
    sourceRecord: { objectName: resolvedObjectName, recordId },
  };
};
