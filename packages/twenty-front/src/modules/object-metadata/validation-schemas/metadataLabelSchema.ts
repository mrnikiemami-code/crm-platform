import { errors } from '@/settings/data-model/fields/forms/utils/errorMessages';
import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { z } from 'zod';

import { METADATA_LABEL_VALID_PATTERN } from '~/pages/settings/data-model/constants/MetadataLabelValidPattern';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';
export const metadataLabelSchema = (existingLabels?: string[]) => {
  return z
    .string()
    .trim()
    .min(1, errors.LabelEmpty)
    .regex(METADATA_LABEL_VALID_PATTERN, errors.LabelNotFormattable)
    .refine(
      (label) => {
        const computedName = computeMetadataNameFromLabel(label);

        return computedName !== '';
      },
      {
        message: errors.LabelNotFormattable,
      },
    )
    .refine(
      (label) => {
        // Non-Latin labels get an explicit technical name, checked on its own
        if (!existingLabels || !label?.length || hasNonLatinLetters(label)) {
          return true;
        }
        const computedName = computeMetadataNameFromLabel(label);

        return computedName !== '' && !existingLabels.includes(computedName);
      },
      {
        message: errors.LabelNotUnique,
      },
    );
};
