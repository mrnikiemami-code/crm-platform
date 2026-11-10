import {
  readInteractionHead,
  readLeadFromLeadResponse,
} from 'src/data/source-snapshot';
import { buildInteractionHeadQuery, buildLeadQuery } from 'src/data/registration-queries';
import {
  LEAD_RELATION_BY_SOURCE_OBJECT,
  isSupportedSourceObject,
} from 'src/data/object-names';
import { type LeadSnapshot } from 'src/domain/registration-target';

export type LeadLookup =
  | { kind: 'FOUND'; snapshot: LeadSnapshot }
  /** The record the user selected does not exist (or is an unsupported type). */
  | { kind: 'SOURCE_MISSING' }
  /** The interaction exists but points at no lead: a real data state. */
  | { kind: 'NO_LEAD' }
  | { kind: 'UNREADABLE' };

export type LeadLookupDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
};

/**
 * Resolves the lead a registration belongs to, from the SELECTED record.
 *
 * A lead is read directly. An interaction is read in two steps — its lead id and
 * performer first, then that lead — because a one-shot nested read of
 * `eventLead { person { … } }` returns null on this server even for rows that
 * have values, which would make every interaction look unusable.
 */
export const lookupLead = async (
  sourceObjectNameSingular: string,
  sourceRecordId: string,
  dependencies: LeadLookupDependencies,
): Promise<LeadLookup> => {
  if (!isSupportedSourceObject(sourceObjectNameSingular)) {
    return { kind: 'SOURCE_MISSING' };
  }

  const leadRelation =
    LEAD_RELATION_BY_SOURCE_OBJECT[sourceObjectNameSingular];

  if (leadRelation === null) {
    let data: Record<string, unknown>;

    try {
      data = await dependencies.execute(buildLeadQuery(sourceRecordId));
    } catch {
      return { kind: 'UNREADABLE' };
    }

    const snapshot = readLeadFromLeadResponse(data);

    return snapshot === null
      ? { kind: 'SOURCE_MISSING' }
      : { kind: 'FOUND', snapshot };
  }

  let headData: Record<string, unknown>;

  try {
    headData = await dependencies.execute(
      buildInteractionHeadQuery(sourceRecordId),
    );
  } catch {
    return { kind: 'UNREADABLE' };
  }

  const head = readInteractionHead(headData);

  if (head === null) {
    return { kind: 'SOURCE_MISSING' };
  }

  if (head.leadId === null) {
    return { kind: 'NO_LEAD' };
  }

  let leadData: Record<string, unknown>;

  try {
    leadData = await dependencies.execute(buildLeadQuery(head.leadId));
  } catch {
    return { kind: 'UNREADABLE' };
  }

  const snapshot = readLeadFromLeadResponse(leadData);

  if (snapshot === null) {
    return { kind: 'SOURCE_MISSING' };
  }

  // The performer read from the interaction is the authoritative seller; the
  // lead read cannot know it.
  return {
    kind: 'FOUND',
    snapshot: {
      ...snapshot,
      name: snapshot.name ?? head.leadName,
      performedByName: head.performedByName,
    },
  };
};
