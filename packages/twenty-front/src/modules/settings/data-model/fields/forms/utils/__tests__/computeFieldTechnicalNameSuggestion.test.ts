import { computeFieldTechnicalNameSuggestion } from '@/settings/data-model/fields/forms/utils/computeFieldTechnicalNameSuggestion';
import { FieldMetadataType } from 'twenty-shared/types';

describe('computeFieldTechnicalNameSuggestion', () => {
  it('should derive a lowerCamelCase name from the field type', () => {
    expect(
      computeFieldTechnicalNameSuggestion({
        fieldType: FieldMetadataType.TEXT,
        existingFieldNames: [],
      }),
    ).toBe('textField');

    expect(
      computeFieldTechnicalNameSuggestion({
        fieldType: FieldMetadataType.DATE_TIME,
        existingFieldNames: [],
      }),
    ).toBe('dateTimeField');
  });

  it('should use the relation base name for morph relations', () => {
    expect(
      computeFieldTechnicalNameSuggestion({
        fieldType: FieldMetadataType.MORPH_RELATION,
        existingFieldNames: [],
      }),
    ).toBe('relationField');
  });

  it('should append the first free numeric suffix when the name is taken', () => {
    expect(
      computeFieldTechnicalNameSuggestion({
        fieldType: FieldMetadataType.NUMBER,
        existingFieldNames: ['numberField', 'numberField2'],
      }),
    ).toBe('numberField3');
  });

  it('should always return a valid technical name', () => {
    Object.values(FieldMetadataType).forEach((fieldType) => {
      expect(
        computeFieldTechnicalNameSuggestion({
          fieldType,
          existingFieldNames: [],
        }),
      ).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    });
  });
});
