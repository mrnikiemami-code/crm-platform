import {
  addCustomSuffixIfIsReserved,
  computeMetadataNameFromLabel,
  IDENTIFIER_MAX_CHAR_LENGTH,
} from 'twenty-shared/metadata';
import { RelationType } from 'twenty-shared/types';

type ComputeRelationTargetFieldNameArgs = {
  targetFieldLabel: string;
  sourceRelationType: RelationType;
  sourceObjectNameSingular: string;
  sourceObjectNamePlural: string;
  existingTargetObjectFieldNames: string[];
};

const hasNonLatinLetters = (value: string) =>
  /(?!\p{Script=Latin})\p{Letter}/u.test(value);

// Transliterating non-Latin labels yields meaningless identifiers, so the
// counterpart field is named after the source object instead
export const computeRelationTargetFieldName = ({
  targetFieldLabel,
  sourceRelationType,
  sourceObjectNameSingular,
  sourceObjectNamePlural,
  existingTargetObjectFieldNames,
}: ComputeRelationTargetFieldNameArgs): string => {
  if (!hasNonLatinLetters(targetFieldLabel)) {
    return computeMetadataNameFromLabel({ label: targetFieldLabel });
  }

  const baseName = addCustomSuffixIfIsReserved(
    sourceRelationType === RelationType.ONE_TO_MANY
      ? sourceObjectNameSingular
      : sourceObjectNamePlural,
  );

  let candidateName = baseName;
  let suffix = 2;

  while (existingTargetObjectFieldNames.includes(candidateName)) {
    const suffixString = `${suffix}`;

    candidateName = `${baseName.slice(
      0,
      IDENTIFIER_MAX_CHAR_LENGTH - suffixString.length,
    )}${suffixString}`;
    suffix++;
  }

  return candidateName;
};
