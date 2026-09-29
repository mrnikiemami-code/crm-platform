import camelCase from 'lodash.camelcase';
import { RESERVED_METADATA_NAME_KEYWORDS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';

type ComputeFieldTechnicalNameSuggestionArgs = {
  fieldType: FieldMetadataType;
  existingFieldNames: string[];
};

// Transliterating non-Latin labels yields meaningless names, so the
// suggestion is derived from the field type instead (e.g. "textField").
export const computeFieldTechnicalNameSuggestion = ({
  fieldType,
  existingFieldNames,
}: ComputeFieldTechnicalNameSuggestionArgs) => {
  const baseName = `${camelCase(
    fieldType === FieldMetadataType.MORPH_RELATION
      ? FieldMetadataType.RELATION
      : fieldType,
  )}Field`;

  const isNameTaken = (name: string) =>
    existingFieldNames.includes(name) ||
    RESERVED_METADATA_NAME_KEYWORDS.includes(name);

  let suggestion = baseName;
  let suffix = 2;

  while (isNameTaken(suggestion)) {
    suggestion = `${baseName}${suffix}`;
    suffix++;
  }

  return suggestion;
};
