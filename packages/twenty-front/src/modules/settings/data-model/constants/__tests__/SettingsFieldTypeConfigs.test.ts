import { i18n } from '@lingui/core';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { FieldMetadataType } from 'twenty-shared/types';

import { SETTINGS_FIELD_TYPE_CATEGORY_DESCRIPTIONS } from '@/settings/data-model/constants/SettingsFieldTypeCategoryDescriptions';
import { SETTINGS_FIELD_TYPE_CATEGORY_LABELS } from '@/settings/data-model/constants/SettingsFieldTypeCategoryLabels';
import { SETTINGS_FIELD_TYPE_CONFIGS } from '@/settings/data-model/constants/SettingsFieldTypeConfigs';
import { messages as faMessages } from '~/locales/generated/fa-IR';

describe('SETTINGS_FIELD_TYPE_CONFIGS labels', () => {
  afterEach(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it('should keep the English labels in the source locale', () => {
    expect(
      i18n._(SETTINGS_FIELD_TYPE_CONFIGS[FieldMetadataType.TEXT].label),
    ).toBe('Text');
    expect(
      i18n._(SETTINGS_FIELD_TYPE_CONFIGS[FieldMetadataType.SELECT].label),
    ).toBe('Select');
    expect(i18n._(SETTINGS_FIELD_TYPE_CATEGORY_LABELS.Relation)).toBe(
      'Relation',
    );
  });

  it('should translate every field type and category in fa-IR', () => {
    i18n.load({ 'fa-IR': faMessages });
    i18n.activate('fa-IR');

    const untranslatedLabels = [
      ...Object.values(SETTINGS_FIELD_TYPE_CONFIGS).map(({ label }) => label),
      ...Object.values(SETTINGS_FIELD_TYPE_CATEGORY_LABELS),
      ...Object.values(SETTINGS_FIELD_TYPE_CATEGORY_DESCRIPTIONS),
    ]
      .map((descriptor) => i18n._(descriptor))
      .filter((label) => /[A-Za-z]/.test(label) && label !== 'JSON');

    expect(untranslatedLabels).toEqual([]);
    expect(
      i18n._(SETTINGS_FIELD_TYPE_CONFIGS[FieldMetadataType.SELECT].label),
    ).toBe('انتخاب تکی');
  });
});
