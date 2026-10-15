import { describe, expect, it } from 'vitest';

import { insertTokenIntoBody } from 'src/components/template-variable-guide.front-component';
import {
  buildEligibleTemplateSources,
  resolveEligibleSource,
  resolveStoredTemplateSource,
} from 'src/templates/data/find-eligible-template-sources';

// The eligible-source model decides which objects a template may be written for,
// and which relation resolves the recipient. Both rules are security-relevant — a
// collection offered here would make one source record map to several recipients —
// so they are locked against the real production functions.
//
// IDENTITY: what is stored and compared is the metadata `universalIdentifier`,
// never a name. These tests use uids deliberately, and the fixtures keep a
// MISLEADING name on purpose to prove names do not participate in identity.

const PERSON_ID = 'person-object-id';
const PERSON_UID = 'uid-person';
const OPPORTUNITY_ID = 'opportunity-object-id';
const OPPORTUNITY_UID = 'uid-opportunity';
const COMPANY_ID = 'company-object-id';
const COMPANY_UID = 'uid-company';

const person = {
  id: PERSON_ID,
  universalIdentifier: PERSON_UID,
  nameSingular: 'person',
  namePlural: 'people',
  labelSingular: 'Person',
  labelPlural: 'People',
  isActive: true,
  isSystem: false,
  fieldsList: [],
};

const opportunity = {
  id: OPPORTUNITY_ID,
  universalIdentifier: OPPORTUNITY_UID,
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  isActive: true,
  isSystem: false,
  fieldsList: [
    {
      id: 'f1',
      universalIdentifier: 'uid-relation-poc',
      name: 'pointOfContact',
      label: 'Point of contact',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'MANY_TO_ONE',
        targetObjectMetadata: { id: PERSON_ID, universalIdentifier: PERSON_UID },
      },
    },
    {
      id: 'f2',
      universalIdentifier: 'uid-relation-people',
      name: 'people',
      label: 'People',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'ONE_TO_MANY',
        targetObjectMetadata: { id: PERSON_ID, universalIdentifier: PERSON_UID },
      },
    },
  ],
};

const company = {
  id: COMPANY_ID,
  universalIdentifier: COMPANY_UID,
  nameSingular: 'company',
  namePlural: 'companies',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  isActive: true,
  isSystem: false,
  fieldsList: [
    {
      id: 'f3',
      universalIdentifier: 'uid-relation-company-people',
      name: 'people',
      label: 'People',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'ONE_TO_MANY',
        targetObjectMetadata: { id: PERSON_ID, universalIdentifier: PERSON_UID },
      },
    },
  ],
};

const systemJoinTable = {
  id: 'join-id',
  universalIdentifier: 'uid-join',
  nameSingular: 'calendarEventParticipant',
  namePlural: 'calendarEventParticipants',
  labelSingular: 'Participant',
  labelPlural: 'Participants',
  isActive: true,
  isSystem: true,
  fieldsList: [
    {
      id: 'f4',
      universalIdentifier: 'uid-relation-join-person',
      name: 'person',
      label: 'Person',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'MANY_TO_ONE',
        targetObjectMetadata: { id: PERSON_ID, universalIdentifier: PERSON_UID },
      },
    },
  ],
};

describe('eligible template sources', () => {
  it('offers Person first, with no relation of its own', () => {
    const sources = buildEligibleTemplateSources([person, opportunity]);

    expect(sources[0]).toMatchObject({
      objectUid: PERSON_UID,
      objectName: 'person',
      relations: [],
    });
  });

  it('carries the connection name from metadata instead of guessing the plural', () => {
    const sources = buildEligibleTemplateSources([person, opportunity]);

    // `namePlural` is the real connection field: Person's is `people`, NOT
    // `persons`, so deriving it would silently query a field that does not exist.
    expect(sources[0].objectNamePlural).toBe('people');
    expect(
      sources.find((s) => s.objectUid === OPPORTUNITY_UID)?.objectNamePlural,
    ).toBe('opportunities');
  });

  it('offers an object whose singular relation points at Person, keyed by uid', () => {
    const sources = buildEligibleTemplateSources([person, opportunity]);
    const entry = sources.find((s) => s.objectUid === OPPORTUNITY_UID);

    expect(entry?.relations).toEqual([
      {
        relationUid: 'uid-relation-poc',
        relationName: 'pointOfContact',
        relationLabel: 'Point of contact',
      },
    ]);
  });

  it('never offers a COLLECTION of Persons', () => {
    const sources = buildEligibleTemplateSources([person, opportunity, company]);

    expect(sources.map((s) => s.objectUid)).not.toContain(COMPANY_UID);
    expect(
      sources.find((s) => s.objectUid === OPPORTUNITY_UID)?.relations,
    ).toHaveLength(1);
  });

  it('omits system join tables', () => {
    const sources = buildEligibleTemplateSources([person, systemJoinTable]);

    expect(sources.map((s) => s.objectUid)).toEqual([PERSON_UID]);
  });

  it('returns NOTHING when Person itself is missing, inactive or has no uid', () => {
    expect(buildEligibleTemplateSources([opportunity])).toEqual([]);
    expect(
      buildEligibleTemplateSources([{ ...person, isActive: false }]),
    ).toEqual([]);
    expect(
      buildEligibleTemplateSources([{ ...person, universalIdentifier: '' }]),
    ).toEqual([]);
  });
});

describe('resolveEligibleSource (writes)', () => {
  const sources = buildEligibleTemplateSources([person, opportunity]);

  it('accepts Person with an empty relation', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectUid: PERSON_UID,
        relationUid: '',
      }),
    ).toEqual({ objectUid: PERSON_UID, relationUid: '' });
  });

  it('accepts a declared relation on an eligible object', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectUid: OPPORTUNITY_UID,
        relationUid: 'uid-relation-poc',
      }),
    ).toEqual({ objectUid: OPPORTUNITY_UID, relationUid: 'uid-relation-poc' });
  });

  it('REJECTS a relation the object does not declare', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectUid: OPPORTUNITY_UID,
        relationUid: 'uid-relation-people',
      }),
    ).toBeNull();
  });

  it('REJECTS an object that is not eligible', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectUid: COMPANY_UID,
        relationUid: 'uid-relation-company-people',
      }),
    ).toBeNull();
  });

  it('REJECTS a non-Person source with no relation chosen', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectUid: OPPORTUNITY_UID,
        relationUid: '',
      }),
    ).toBeNull();
  });

  it('REJECTS a forged pair that mixes two real values', () => {
    // A real object uid with a real relation uid that belongs to ANOTHER object.
    expect(
      resolveEligibleSource({
        sources,
        objectUid: PERSON_UID,
        relationUid: 'uid-relation-poc',
      }),
    ).toEqual({ objectUid: PERSON_UID, relationUid: '' });
  });
});

describe('resolveStoredTemplateSource (reads)', () => {
  const sources = buildEligibleTemplateSources([person, opportunity]);

  it('reads an EMPTY stored source as legacy Person', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: '',
        storedRelationUid: '',
      }),
    ).toEqual({
      kind: 'LEGACY_PERSON',
      objectName: 'person',
      objectUid: null,
    });
  });

  it('resolves a stored Person source', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: PERSON_UID,
        storedRelationUid: '',
      }),
    ).toMatchObject({ kind: 'RESOLVED', objectName: 'person', relationName: '' });
  });

  it('resolves a stored related source and its relation NAME from metadata', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: OPPORTUNITY_UID,
        storedRelationUid: 'uid-relation-poc',
      }),
    ).toMatchObject({
      kind: 'RESOLVED',
      objectName: 'opportunity',
      relationName: 'pointOfContact',
    });
  });

  it('reports UNRESOLVABLE — NEVER Person — when the object uid is gone', () => {
    // The critical case: a stored identifier that no longer exists must not be
    // silently downgraded to a Person template.
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: 'uid-deleted-object',
        storedRelationUid: '',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });
  });

  it('reports UNRESOLVABLE when the relation uid is gone or became a collection', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: OPPORTUNITY_UID,
        storedRelationUid: 'uid-removed-relation',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });

    // `uid-relation-people` is a ONE_TO_MANY collection, so it is not in the
    // eligible set and must not resolve.
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: OPPORTUNITY_UID,
        storedRelationUid: 'uid-relation-people',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });
  });

  it('reports UNRESOLVABLE when a related source stores no relation', () => {
    // Guessing a relation here would be exactly the "pick a Person for the user"
    // failure the model exists to prevent.
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: OPPORTUNITY_UID,
        storedRelationUid: '',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });
  });

  it('reports UNRESOLVABLE for a Person source that carries a relation', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: PERSON_UID,
        storedRelationUid: 'uid-relation-poc',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });
  });

  it('reports UNRESOLVABLE for a relation without an object', () => {
    expect(
      resolveStoredTemplateSource({
        sources,
        storedObjectUid: '',
        storedRelationUid: 'uid-relation-poc',
      }),
    ).toEqual({ kind: 'UNRESOLVABLE' });
  });
});

describe('variable insertion', () => {
  it('inserts EXACTLY ONCE at the caret when the renderer exposes one', () => {
    const result = insertTokenIntoBody({
      body: 'سلام ',
      token: '@person.firstName',
      selectionStart: 5,
      selectionEnd: 5,
    });

    expect(result.body).toBe('سلام @person.firstName');
    expect(result.usedCaret).toBe(true);
    expect(result.body.match(/@person\.firstName/g) ?? []).toHaveLength(1);
  });

  it('replaces a selected range rather than appending', () => {
    const result = insertTokenIntoBody({
      body: 'سلام XX',
      token: '@person.lastName',
      selectionStart: 5,
      selectionEnd: 7,
    });

    expect(result.body).toBe('سلام @person.lastName');
  });

  it('appends at the END when no selection API is available', () => {
    // This is the real path on this platform build: the remote-element polyfill
    // implements no selection API, so `selectionStart` is undefined.
    const result = insertTokenIntoBody({
      body: 'سلام ',
      token: '@company.name',
      selectionStart: null,
      selectionEnd: null,
    });

    expect(result.body).toBe('سلام @company.name');
    expect(result.usedCaret).toBe(false);
    expect(result.body.match(/@company\.name/g) ?? []).toHaveLength(1);
  });

  it('ignores an out-of-range selection instead of corrupting the text', () => {
    const result = insertTokenIntoBody({
      body: 'abc',
      token: '@x',
      selectionStart: 99,
      selectionEnd: 120,
    });

    expect(result.body).toBe('abc@x');
    expect(result.usedCaret).toBe(false);
  });
});
