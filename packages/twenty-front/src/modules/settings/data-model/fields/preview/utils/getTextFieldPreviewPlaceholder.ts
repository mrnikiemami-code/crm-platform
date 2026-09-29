import { t } from '@lingui/core/macro';
import { FieldMetadataType } from 'twenty-shared/types';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

type GetTextFieldPreviewPlaceholderArgs = {
  fieldType: FieldMetadataType;
  locale: string;
};

// The source locale keeps the generic example value of the field type
export const getTextFieldPreviewPlaceholder = ({
  fieldType,
  locale,
}: GetTextFieldPreviewPlaceholderArgs): string | undefined => {
  if (fieldType !== FieldMetadataType.TEXT || locale === SOURCE_LOCALE) {
    return undefined;
  }

  return t`Sample text`;
};
