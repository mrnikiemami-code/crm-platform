import { type APP_LOCALES } from 'twenty-shared/translations';

import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { buildNameFlatFieldMetadataForCustomObject } from 'src/engine/metadata-modules/object-metadata/utils/build-name-flat-field-metadata-for-custom-object.util';
import { computeLocalizedDefaultNameFieldLabel } from 'src/engine/metadata-modules/object-metadata/utils/compute-localized-default-name-field-label.util';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';

const flatObjectMetadata = {
  universalIdentifier: '20202020-1111-4111-8111-111111111111',
  applicationUniversalIdentifier: '20202020-2222-4222-8222-222222222222',
};

describe('computeLocalizedDefaultNameFieldLabel', () => {
  const i18nService = new I18nService();

  const buildStandardApplicationI18nContext = (
    locale: keyof typeof APP_LOCALES,
  ): EffectiveEntityI18nContext => ({
    locale,
    i18nInstance: i18nService.getI18nInstance(locale),
    isStandardApp: true,
    applicationCatalog: undefined,
    workspaceCustomApplicationUniversalIdentifier:
      '20202020-3333-4333-8333-333333333333',
    ownerApplicationUniversalIdentifier: undefined,
  });

  beforeAll(async () => {
    await i18nService.loadTranslations();
  });

  it('keeps the English label for the source locale', () => {
    expect(
      computeLocalizedDefaultNameFieldLabel({
        standardApplicationI18nContext:
          buildStandardApplicationI18nContext('en'),
      }),
    ).toBe('Name');
  });

  it('translates the label from the standard catalog for fa-IR', () => {
    expect(
      computeLocalizedDefaultNameFieldLabel({
        standardApplicationI18nContext:
          buildStandardApplicationI18nContext('fa-IR'),
      }),
    ).toBe('نام');
  });

  it('builds a localized name field while keeping the canonical name', () => {
    const nameField = buildNameFlatFieldMetadataForCustomObject({
      flatObjectMetadata,
      label: computeLocalizedDefaultNameFieldLabel({
        standardApplicationI18nContext:
          buildStandardApplicationI18nContext('fa-IR'),
      }),
    });

    expect(nameField.name).toBe('name');
    expect(nameField.label).toBe('نام');
    expect(nameField.description).toBe('نام');
  });

  it('defaults the name field label to Name when no label is given', () => {
    const nameField = buildNameFlatFieldMetadataForCustomObject({
      flatObjectMetadata,
    });

    expect(nameField.name).toBe('name');
    expect(nameField.label).toBe('Name');
    expect(nameField.description).toBe('Name');
  });
});
