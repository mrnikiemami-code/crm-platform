import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';

import { getIntlLocaleForAppLocale } from '@/localization/utils/getIntlLocaleForAppLocale';
import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';

const formatOptionNumber = (optionNumber: number) =>
  new Intl.NumberFormat(getIntlLocaleForAppLocale(i18n.locale), {
    useGrouping: false,
  }).format(optionNumber);

export const generateNewSelectOptionLabel = (
  values: Pick<FieldMetadataItemOption, 'label'>[],
  iteration = 1,
): string => {
  const optionNumber = formatOptionNumber(values.length + iteration);
  const newOptionLabel = t`Option ${optionNumber}`;
  const labelExists = values.some((value) => value.label === newOptionLabel);

  return labelExists
    ? generateNewSelectOptionLabel(values, iteration + 1)
    : newOptionLabel;
};
