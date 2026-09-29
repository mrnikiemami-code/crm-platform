import { t } from '@lingui/core/macro';
import { FieldMetadataType } from 'twenty-shared/types';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

type GetLabelIdentifierPreviewPlaceholderArgs = {
  fieldType: FieldMetadataType;
  objectLabelSingular: string;
  locale: string;
};

// The source locale keeps the generic example value of the field type
export const getLabelIdentifierPreviewPlaceholder = ({
  fieldType,
  objectLabelSingular,
  locale,
}: GetLabelIdentifierPreviewPlaceholderArgs): string | undefined => {
  if (fieldType !== FieldMetadataType.TEXT || locale === SOURCE_LOCALE) {
    return undefined;
  }

  return t`Sample ${objectLabelSingular} name`;
};
