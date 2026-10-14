import { describe, expect, it } from 'vitest';

import { insertTokenIntoBody } from 'src/components/template-variable-guide.front-component';
import {
  buildEligibleTemplateSources,
  resolveEligibleSource,
} from 'src/templates/data/find-eligible-template-sources';

// The eligible-source model decides which objects a template may be written for,
// and which relation resolves the recipient. Both rules are security-relevant —
// a collection offered here would make one source record map to several
// recipients — so they are locked against the real production functions.

const PERSON_ID = 'person-object-id';
const OPPORTUNITY_ID = 'opportunity-object-id';
const COMPANY_ID = 'company-object-id';

const person = {
  id: PERSON_ID,
  nameSingular: 'person',
  labelSingular: 'Person',
  labelPlural: 'People',
  isActive: true,
  isSystem: false,
  fieldsList: [],
};

const opportunity = {
  id: OPPORTUNITY_ID,
  nameSingular: 'opportunity',
  labelSingular: 'Opportunity',
  labelPlural: 'Opportunities',
  isActive: true,
  isSystem: false,
  fieldsList: [
    {
      id: 'f1',
      name: 'pointOfContact',
      label: 'Point of contact',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'MANY_TO_ONE',
        targetObjectMetadata: { id: PERSON_ID, nameSingular: 'person' },
      },
    },
    {
      id: 'f2',
      name: 'people',
      label: 'People',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'ONE_TO_MANY',
        targetObjectMetadata: { id: PERSON_ID, nameSingular: 'person' },
      },
    },
  ],
};

const company = {
  id: COMPANY_ID,
  nameSingular: 'company',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  isActive: true,
  isSystem: false,
  fieldsList: [
    {
      id: 'f3',
      name: 'people',
      label: 'People',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'ONE_TO_MANY',
        targetObjectMetadata: { id: PERSON_ID, nameSingular: 'person' },
      },
    },
  ],
};

const systemJoinTable = {
  id: 'join-id',
  nameSingular: 'calendarEventParticipant',
  labelSingular: 'Participant',
  labelPlural: 'Participants',
  isActive: true,
  isSystem: true,
  fieldsList: [
    {
      id: 'f4',
      name: 'person',
      label: 'Person',
      type: 'RELATION',
      isActive: true,
      isSystem: false,
      relation: {
        type: 'MANY_TO_ONE',
        targetObjectMetadata: { id: PERSON_ID, nameSingular: 'person' },
      },
    },
  ],
};

describe('eligible template sources', () => {
  it('offers Person first, with no relation of its own', () => {
    const sources = buildEligibleTemplateSources([person, opportunity]);

    expect(sources[0]).toMatchObject({
      objectName: 'person',
      relations: [],
    });
  });

  it('offers an object whose singular relation points at Person', () => {
    const sources = buildEligibleTemplateSources([person, opportunity]);
    const entry = sources.find((s) => s.objectName === 'opportunity');

    expect(entry?.relations).toEqual([
      { relationName: 'pointOfContact', relationLabel: 'Point of contact' },
    ]);
  });

  it('never offers a COLLECTION of Persons', () => {
    const sources = buildEligibleTemplateSources([
      person,
      opportunity,
      company,
    ]);

    // Company only has `people` (ONE_TO_MANY), so it is not a source at all.
    expect(sources.map((s) => s.objectName)).not.toContain('company');
    // And the collection side on opportunity is not offered as its relation.
    expect(
      sources.find((s) => s.objectName === 'opportunity')?.relations,
    ).toHaveLength(1);
  });

  it('omits system join tables', () => {
    const sources = buildEligibleTemplateSources([person, systemJoinTable]);

    expect(sources.map((s) => s.objectName)).toEqual(['person']);
  });

  it('returns NOTHING when Person itself is missing or inactive', () => {
    expect(buildEligibleTemplateSources([opportunity])).toEqual([]);
    expect(
      buildEligibleTemplateSources([{ ...person, isActive: false }]),
    ).toEqual([]);
  });
});

describe('resolveEligibleSource', () => {
  const sources = buildEligibleTemplateSources([person, opportunity]);

  it('accepts Person with an empty relation', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectName: 'person',
        relationName: '',
      }),
    ).toEqual({ objectName: 'person', relationName: '' });
  });

  it('accepts a declared relation on an eligible object', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectName: 'opportunity',
        relationName: 'pointOfContact',
      }),
    ).toEqual({ objectName: 'opportunity', relationName: 'pointOfContact' });
  });

  it('REJECTS a relation the object does not declare', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectName: 'opportunity',
        relationName: 'people',
      }),
    ).toBeNull();
  });

  it('REJECTS an object that is not eligible', () => {
    expect(
      resolveEligibleSource({
        sources,
        objectName: 'company',
        relationName: 'people',
      }),
    ).toBeNull();
  });

  it('REJECTS a non-Person source with no relation chosen', () => {
    // "Several eligible relations need an explicit choice" — an empty relation
    // on a related object is not a valid state to store.
    expect(
      resolveEligibleSource({
        sources,
        objectName: 'opportunity',
        relationName: '',
      }),
    ).toBeNull();
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
    expect((result.body.match(/@person\.firstName/g) ?? [])).toHaveLength(1);
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
    expect((result.body.match(/@company\.name/g) ?? [])).toHaveLength(1);
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
