import { i18n } from '@lingui/core';
import { FieldMetadataType } from 'twenty-shared/types';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { getFieldPreviewValue } from '@/settings/data-model/fields/preview/utils/getFieldPreviewValue';
import { getLabelIdentifierPreviewPlaceholder } from '@/settings/data-model/fields/preview/utils/getLabelIdentifierPreviewPlaceholder';
import { getSettingsFieldTypeConfig } from '@/settings/data-model/utils/getSettingsFieldTypeConfig';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

describe('getLabelIdentifierPreviewPlaceholder', () => {
  afterEach(() => {
    i18n.load(SOURCE_LOCALE, enMessages);
    i18n.activate(SOURCE_LOCALE);
  });

  it('returns a localized sample name derived from the object label in fa-IR', () => {
    i18n.load('fa-IR', faMessages);
    i18n.activate('fa-IR');

    const placeholder = getLabelIdentifierPreviewPlaceholder({
      fieldType: FieldMetadataType.TEXT,
      objectLabelSingular: 'همایش',
      locale: 'fa-IR',
    });

    expect(placeholder).toBe('نمونه نام همایش');
    expect(
      getFieldPreviewValue({
        fieldType: FieldMetadataType.TEXT,
        fieldSettings: null,
        defaultValue: null,
        placeholderValue: placeholder,
      }),
    ).toBe('نمونه نام همایش');
  });

  it('keeps the generic example value for the source locale', () => {
    i18n.load(SOURCE_LOCALE, enMessages);
    i18n.activate(SOURCE_LOCALE);

    const placeholder = getLabelIdentifierPreviewPlaceholder({
      fieldType: FieldMetadataType.TEXT,
      objectLabelSingular: 'Listing',
      locale: SOURCE_LOCALE,
    });

    expect(placeholder).toBeUndefined();
    expect(
      getFieldPreviewValue({
        fieldType: FieldMetadataType.TEXT,
        fieldSettings: null,
        defaultValue: null,
        placeholderValue: placeholder,
      }),
    ).toBe(
      getSettingsFieldTypeConfig(FieldMetadataType.TEXT).exampleValues?.[0],
    );
  });

  it('does not override non text label identifiers', () => {
    expect(
      getLabelIdentifierPreviewPlaceholder({
        fieldType: FieldMetadataType.FULL_NAME,
        objectLabelSingular: 'شخص',
        locale: 'fa-IR',
      }),
    ).toBeUndefined();
  });
});
