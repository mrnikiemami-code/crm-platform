import { computeMetadataNameFromLabel } from 'twenty-shared/metadata';
import { RelationType } from 'twenty-shared/types';

import { computeRelationTargetFieldName } from 'src/engine/metadata-modules/flat-field-metadata/utils/compute-relation-target-field-name.util';

const LOWER_CAMEL_CASE_IDENTIFIER_REGEX = /^[a-z][a-zA-Z0-9]*$/;

const baseArgs = {
  sourceObjectNameSingular: 'academyEvent',
  sourceObjectNamePlural: 'academyEvents',
  existingTargetObjectFieldNames: [],
};

describe('computeRelationTargetFieldName', () => {
  it('should name the counterpart after the singular source object for a Persian label on a one-to-many relation', () => {
    const name = computeRelationTargetFieldName({
      ...baseArgs,
      targetFieldLabel: 'همایش',
      sourceRelationType: RelationType.ONE_TO_MANY,
    });

    expect(name).toBe('academyEvent');
    expect(name).toMatch(LOWER_CAMEL_CASE_IDENTIFIER_REGEX);
  });

  it('should name the counterpart after the plural source object for a Persian label on a many-to-one relation', () => {
    const name = computeRelationTargetFieldName({
      ...baseArgs,
      targetFieldLabel: 'همایش‌ها',
      sourceRelationType: RelationType.MANY_TO_ONE,
    });

    expect(name).toBe('academyEvents');
    expect(name).toMatch(LOWER_CAMEL_CASE_IDENTIFIER_REGEX);
  });

  it('should not transliterate the Persian label', () => {
    const persianLabel = 'همایش ها';

    const name = computeRelationTargetFieldName({
      ...baseArgs,
      targetFieldLabel: persianLabel,
      sourceRelationType: RelationType.ONE_TO_MANY,
    });

    expect(name).not.toBe(
      computeMetadataNameFromLabel({ label: persianLabel }),
    );
  });

  it('should append a deterministic numeric suffix on collision', () => {
    const name = computeRelationTargetFieldName({
      ...baseArgs,
      targetFieldLabel: 'همایش',
      sourceRelationType: RelationType.ONE_TO_MANY,
      existingTargetObjectFieldNames: ['academyEvent', 'academyEvent2'],
    });

    expect(name).toBe('academyEvent3');
    expect(name).toMatch(LOWER_CAMEL_CASE_IDENTIFIER_REGEX);
  });

  it('should add the custom suffix when the source object name is reserved', () => {
    expect(
      computeRelationTargetFieldName({
        ...baseArgs,
        targetFieldLabel: 'نشانه',
        sourceRelationType: RelationType.ONE_TO_MANY,
        sourceObjectNameSingular: 'appToken',
      }),
    ).toBe('appTokenCustom');
  });

  it.each([
    ['Company', RelationType.ONE_TO_MANY],
    ['Target Pets', RelationType.MANY_TO_ONE],
    ['Café owner', RelationType.ONE_TO_MANY],
  ])(
    'should keep the label based name for the Latin label "%s"',
    (targetFieldLabel, sourceRelationType) => {
      expect(
        computeRelationTargetFieldName({
          ...baseArgs,
          targetFieldLabel,
          sourceRelationType,
          existingTargetObjectFieldNames: [
            computeMetadataNameFromLabel({ label: targetFieldLabel }),
          ],
        }),
      ).toBe(computeMetadataNameFromLabel({ label: targetFieldLabel }));
    },
  );
});
