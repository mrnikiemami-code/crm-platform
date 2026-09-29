import { getTextFieldPreviewPlaceholder } from '@/settings/data-model/fields/preview/utils/getTextFieldPreviewPlaceholder';
import { FieldMetadataType } from 'twenty-shared/types';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

describe('getTextFieldPreviewPlaceholder', () => {
  it('should keep the default example value in the source locale', () => {
    expect(
      getTextFieldPreviewPlaceholder({
        fieldType: FieldMetadataType.TEXT,
        locale: SOURCE_LOCALE,
      }),
    ).toBeUndefined();
  });

  it('should return a translatable sample for text fields in other locales', () => {
    expect(
      getTextFieldPreviewPlaceholder({
        fieldType: FieldMetadataType.TEXT,
        locale: 'fa-IR',
      }),
    ).toBe('Sample text');
  });

  it('should not affect other field types', () => {
    expect(
      getTextFieldPreviewPlaceholder({
        fieldType: FieldMetadataType.NUMBER,
        locale: 'fa-IR',
      }),
    ).toBeUndefined();
  });
});
