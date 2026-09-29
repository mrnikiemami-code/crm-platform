import { isDefined } from 'twenty-shared/utils';

import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';
import { generateNewSelectOption } from '@/settings/data-model/fields/forms/select/utils/generateNewSelectOption';

export const convertBulkTextToOptions = (
  text: string,
  currentOptions: FieldMetadataItemOption[],
): FieldMetadataItemOption[] => {
  const parsedBulkTextOptions = text
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const newBulkSelectOptions: FieldMetadataItemOption[] = [];
  const reusedOptionIds = new Set<string>();

  for (
    let optionIndex = 0;
    optionIndex < parsedBulkTextOptions.length;
    optionIndex++
  ) {
    const label = parsedBulkTextOptions[optionIndex];

    // try to find an existing option with the same label, so we can keep its id, color, value, and label
    // each option is reused once so repeated lines never share an id
    const existingOption = currentOptions.find(
      (opt) =>
        !reusedOptionIds.has(opt.id) &&
        opt.label.toLowerCase() === label.toLowerCase(),
    );

    if (isDefined(existingOption)) {
      reusedOptionIds.add(existingOption.id);
      // reuse existing option meta (including original label), just update position
      newBulkSelectOptions.push({
        ...existingOption,
        position: optionIndex,
      });
    } else {
      newBulkSelectOptions.push({
        ...generateNewSelectOption(newBulkSelectOptions, label),
        position: optionIndex,
      });
    }
  }

  return newBulkSelectOptions;
};
