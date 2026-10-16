import { describe, expect, it } from 'vitest';

import {
  type EligibleTemplateSource,
  PERSON_SOURCE_OBJECT_NAME,
} from 'src/templates/data/find-eligible-template-sources';
import {
  resolveSendContext,
  SEND_CONTEXT_OUTCOME,
} from 'src/templates/resolve-send-context';

// The recipient of a contextual send is DERIVED from the record, never supplied
// by the caller. These tests pin that: the same record always yields the same
// recipient, a record whose relation is null yields NO recipient (rather than a
// guess), and an object that is not a source is refused instead of being treated
// as a Person.

const PERSON_UID = 'person-uid';
const OPPORTUNITY_UID = 'opportunity-uid';
const CONTACT_RELATION_UID = 'contact-relation-uid';

const sources: EligibleTemplateSource[] = [
  {
    objectUid: PERSON_UID,
    objectName: PERSON_SOURCE_OBJECT_NAME,
    objectNamePlural: 'people',
    labelSingular: 'Person',
    labelPlural: 'People',
    labelFieldName: 'name',
    labelFieldType: 'FULL_NAME',
    relations: [],
  },
  {
    objectUid: OPPORTUNITY_UID,
    objectName: 'opportunity',
    objectNamePlural: 'opportunities',
    labelSingular: 'Opportunity',
    labelPlural: 'فرصت‌ها',
    labelFieldName: 'name',
    labelFieldType: 'TEXT',
    relations: [
      {
        relationUid: CONTACT_RELATION_UID,
        relationName: 'pointOfContact',
        relationLabel: 'Point of Contact',
      },
    ],
  },
];

/** A fake client whose source read returns `node`, keyed by the object name. */
const buildClient = (node: unknown) => {
  const queries: Record<string, unknown>[] = [];
  return {
    queries,
    client: {
      query: async (payload: Record<string, unknown>) => {
        queries.push(payload);
        const objectKey = Object.keys(payload).find((key) => key !== '__args');
        return { [objectKey ?? 'unknown']: node };
      },
    },
  };
};

describe('resolveSendContext', () => {
  it('derives the recipient from a related record through its relation', async () => {
    const { client } = buildClient({
      id: 'opp-1',
      pointOfContact: { id: 'person-42' },
    });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'opportunity',
      recordId: 'opp-1',
      relationUid: CONTACT_RELATION_UID,
    });

    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.RESOLVED);

    if (result.outcome !== SEND_CONTEXT_OUTCOME.RESOLVED) {
      throw new Error('expected RESOLVED');
    }

    // The recipient is the RELATED person, not the record id.
    expect(result.recipientPersonId).toBe('person-42');
    expect(result.objectName).toBe('opportunity');
    expect(result.objectUid).toBe(OPPORTUNITY_UID);
    // `@source.*` reads the record itself.
    expect(result.sourceRecord).toEqual({
      objectName: 'opportunity',
      recordId: 'opp-1',
    });
  });

  it('for a Person source the record IS the recipient, with no second read', async () => {
    const { client, queries } = buildClient({ id: 'person-7' });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: PERSON_SOURCE_OBJECT_NAME,
      recordId: 'person-7',
      relationUid: '',
    });

    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.RESOLVED);

    if (result.outcome !== SEND_CONTEXT_OUTCOME.RESOLVED) {
      throw new Error('expected RESOLVED');
    }

    expect(result.recipientPersonId).toBe('person-7');
    // No `@source.*` group exists for a Person source, so nothing extra is read.
    expect(result.sourceRecord).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it('reports RELATION_EMPTY when the record points at nobody', async () => {
    const { client } = buildClient({ id: 'opp-2', pointOfContact: null });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'opportunity',
      recordId: 'opp-2',
      relationUid: CONTACT_RELATION_UID,
    });

    // NOT resolved to the record id, and NOT resolved to some other person.
    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.RELATION_EMPTY);
  });

  it('reports RECORD_NOT_FOUND when the record cannot be read', async () => {
    const { client } = buildClient(null);

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'opportunity',
      recordId: 'gone',
      relationUid: CONTACT_RELATION_UID,
    });

    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.RECORD_NOT_FOUND);
  });

  it('refuses an object that is not an eligible source', async () => {
    const { client, queries } = buildClient({ id: 'x' });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'company',
      recordId: 'company-1',
      relationUid: '',
    });

    // Never reinterpreted as Person, and no read is even attempted.
    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT);
    expect(queries).toHaveLength(0);
  });

  it('refuses a relation that is not one of the source relations', async () => {
    const { client } = buildClient({ id: 'opp-3' });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'opportunity',
      recordId: 'opp-3',
      // A relation of a DIFFERENT object, or a forged one.
      relationUid: 'someone-elses-relation',
    });

    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT);
  });

  it('refuses a related source with NO relation rather than picking one', async () => {
    const { client } = buildClient({ id: 'opp-4' });

    const result = await resolveSendContext({
      client: client as never,
      sources,
      objectName: 'opportunity',
      recordId: 'opp-4',
      relationUid: '',
    });

    expect(result.outcome).toBe(SEND_CONTEXT_OUTCOME.UNSUPPORTED_OBJECT);
  });
});
