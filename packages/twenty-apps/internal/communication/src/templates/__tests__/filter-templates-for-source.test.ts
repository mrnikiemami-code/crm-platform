import { describe, expect, it } from 'vitest';

import { type MessageTemplateRecord } from 'src/templates/data/find-message-templates';
import { filterTemplatesForSource } from 'src/templates/filter-templates-for-source';
import {
  type EligibleTemplateSource,
  PERSON_SOURCE_OBJECT_NAME,
} from 'src/templates/data/find-eligible-template-sources';

// The picker must only offer templates that can actually resolve for the source
// being composed for. Before this filter the composer received every template in
// the workspace, so an Opportunity template could be chosen while composing for a
// Person — a choice that could only fail later, at send time.

const PERSON_UID = 'person-uid';
const OPPORTUNITY_UID = 'opportunity-uid';

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
        relationUid: 'contact-relation-uid',
        relationName: 'pointOfContact',
        relationLabel: 'Point of Contact',
      },
    ],
  },
];

const template = (
  id: string,
  sourceObjectUid: string,
): MessageTemplateRecord => ({
  id,
  title: id,
  body: 'x',
  channel: 'SMS',
  targetObject: 'PERSON',
  sourceObjectUid,
  updatedAt: '',
});

const allTemplates = [
  template('person-one', PERSON_UID),
  template('opportunity-one', OPPORTUNITY_UID),
  // A row that predates the source model: no stored source.
  template('legacy', ''),
];

describe('filterTemplatesForSource', () => {
  it('offers a Person template for a Person source, and NOT an Opportunity one', () => {
    const result = filterTemplatesForSource({
      templates: allTemplates,
      sources,
      sourceObjectUid: PERSON_UID,
    });

    expect(result.map((entry) => entry.id)).toEqual(['person-one', 'legacy']);
    expect(result.map((entry) => entry.id)).not.toContain('opportunity-one');
  });

  it('offers an Opportunity template for an Opportunity source, and NOT a Person one', () => {
    const result = filterTemplatesForSource({
      templates: allTemplates,
      sources,
      sourceObjectUid: OPPORTUNITY_UID,
    });

    expect(result.map((entry) => entry.id)).toEqual(['opportunity-one']);
    expect(result.map((entry) => entry.id)).not.toContain('person-one');
    // A legacy, source-less row means Person, so it must NOT appear for another
    // source: its `@source.*` tokens would have nothing to read.
    expect(result.map((entry) => entry.id)).not.toContain('legacy');
  });

  it('treats a source-less template as Person, per the existing contract', () => {
    const result = filterTemplatesForSource({
      templates: [template('legacy', '')],
      sources,
      sourceObjectUid: PERSON_UID,
    });

    expect(result.map((entry) => entry.id)).toEqual(['legacy']);
  });

  it('returns NOTHING for an unknown source instead of falling back to Person', () => {
    // The whole point: an unresolvable source must not silently receive the
    // Person templates, because those are exactly the mismatched ones.
    const result = filterTemplatesForSource({
      templates: allTemplates,
      sources,
      sourceObjectUid: 'not-a-real-source',
    });

    expect(result).toEqual([]);
  });

  it('returns NOTHING for an empty source identifier rather than everything', () => {
    const result = filterTemplatesForSource({
      templates: allTemplates,
      sources,
      sourceObjectUid: '',
    });

    expect(result).toEqual([]);
  });
});
