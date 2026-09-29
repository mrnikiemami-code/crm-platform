import { type APP_LOCALES } from 'twenty-shared/translations';

import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { computeFieldMetadataPropertyI18nContext } from 'src/engine/metadata-modules/field-metadata/utils/compute-field-metadata-property-i18n-context.util';
import { PARTIAL_SYSTEM_FLAT_FIELD_METADATAS } from 'src/engine/metadata-modules/object-metadata/constants/partial-system-flat-field-metadatas.constant';
import { buildNameFlatFieldMetadataForCustomObject } from 'src/engine/metadata-modules/object-metadata/utils/build-name-flat-field-metadata-for-custom-object.util';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { resolveEffectiveEntityProperty } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';
import { resolveMetadataEventRecord } from 'src/engine/subscriptions/metadata-event/utils/resolve-metadata-event-record.util';

const flatObjectMetadata = {
  universalIdentifier: '20202020-1111-4111-8111-111111111111',
  applicationUniversalIdentifier: '20202020-2222-4222-8222-222222222222',
};

describe('computeFieldMetadataPropertyI18nContext', () => {
  const i18nService = new I18nService();

  const buildCustomApplicationI18nContext = (
    locale: keyof typeof APP_LOCALES,
  ): EffectiveEntityI18nContext => ({
    locale,
    i18nInstance: i18nService.getI18nInstance(locale),
    isStandardApp: false,
    applicationCatalog: undefined,
    workspaceCustomApplicationUniversalIdentifier:
      '20202020-3333-4333-8333-333333333333',
    ownerApplicationUniversalIdentifier: '20202020-3333-4333-8333-333333333333',
  });

  const resolveFieldLabel = (
    field: { name: string; label: string },
    locale: keyof typeof APP_LOCALES,
  ) =>
    resolveEffectiveEntityProperty({
      metadataName: 'fieldMetadata',
      baseValue: field.label,
      overrides: null,
      property: 'label',
      i18nContext: computeFieldMetadataPropertyI18nContext({
        fieldName: field.name,
        property: 'label',
        baseValue: field.label,
        i18nContext: buildCustomApplicationI18nContext(locale),
      }),
    });

  beforeAll(async () => {
    await i18nService.loadTranslations();
  });

  it('stores the default name field with a locale-neutral label and the canonical name', () => {
    const nameField = buildNameFlatFieldMetadataForCustomObject({
      flatObjectMetadata,
    });

    expect(nameField.name).toBe('name');
    expect(nameField.label).toBe('Name');
    expect(nameField.description).toBe('Name');
  });

  it('displays the same default name field in the viewer locale', () => {
    const nameField = buildNameFlatFieldMetadataForCustomObject({
      flatObjectMetadata,
    });

    expect(resolveFieldLabel(nameField, 'fa-IR')).toBe('نام');
    expect(resolveFieldLabel(nameField, 'en')).toBe('Name');
  });

  it('keeps a renamed name field label as authored in every locale', () => {
    for (const label of ['Title', 'عنوان']) {
      expect(resolveFieldLabel({ name: 'name', label }, 'fa-IR')).toBe(label);
      expect(resolveFieldLabel({ name: 'name', label }, 'en')).toBe(label);
    }
  });

  it('does not translate a custom field labelled Name that is not the canonical name field', () => {
    expect(
      resolveFieldLabel({ name: 'contactName', label: 'Name' }, 'fa-IR'),
    ).toBe('Name');
  });

  it('translates the default label when the application catalog does not', () => {
    expect(
      resolveEffectiveEntityProperty({
        metadataName: 'fieldMetadata',
        baseValue: 'Name',
        overrides: null,
        property: 'label',
        i18nContext: computeFieldMetadataPropertyI18nContext({
          fieldName: 'name',
          property: 'label',
          baseValue: 'Name',
          i18nContext: {
            ...buildCustomApplicationI18nContext('fa-IR'),
            applicationCatalog: {},
          },
        }),
      }),
    ).toBe('نام');
  });

  it('keeps the context when the application catalog translates the label', () => {
    const i18nContext = {
      ...buildCustomApplicationI18nContext('fa-IR'),
      // A catalog that translates every message it is asked for
      applicationCatalog: new Proxy<Record<string, string>>(
        {},
        { get: () => 'اسم' },
      ),
    };

    expect(
      computeFieldMetadataPropertyI18nContext({
        fieldName: 'name',
        property: 'label',
        baseValue: 'Name',
        i18nContext,
      }),
    ).toBe(i18nContext);
  });

  it('keeps the context of the standard application', () => {
    const i18nContext = {
      ...buildCustomApplicationI18nContext('fa-IR'),
      isStandardApp: true,
    };

    expect(
      computeFieldMetadataPropertyI18nContext({
        fieldName: 'name',
        property: 'label',
        baseValue: 'Name',
        i18nContext,
      }),
    ).toBe(i18nContext);
  });

  it('translates the default name field label in metadata events', () => {
    const record = {
      name: 'name',
      label: 'Name',
      description: 'Name',
      overrides: null,
    };

    expect(
      resolveMetadataEventRecord({
        metadataName: 'fieldMetadata',
        record,
        i18nContext: buildCustomApplicationI18nContext('fa-IR'),
      }).label,
    ).toBe('نام');
    expect(
      resolveMetadataEventRecord({
        metadataName: 'fieldMetadata',
        record: { ...record, label: 'عنوان' },
        i18nContext: buildCustomApplicationI18nContext('en'),
      }).label,
    ).toBe('عنوان');
  });

  describe('custom object system fields', () => {
    const SYSTEM_FIELDS = Object.values(PARTIAL_SYSTEM_FLAT_FIELD_METADATAS);

    const resolveStandardObjectFieldProperty = (
      property: 'label' | 'description',
      baseValue: string,
    ) =>
      resolveEffectiveEntityProperty({
        metadataName: 'fieldMetadata',
        baseValue,
        overrides: null,
        property,
        i18nContext: {
          ...buildCustomApplicationI18nContext('fa-IR'),
          isStandardApp: true,
        },
      });

    it.each([
      ['createdAt', 'تاریخ ایجاد'],
      ['updatedAt', 'آخرین به‌روزرسانی'],
      ['deletedAt', 'حذف‌شده در'],
      ['createdBy', 'ایجادشده توسط'],
      ['updatedBy', 'به‌روزرسانی توسط'],
      ['id', 'شناسه'],
    ])(
      'displays the default %s label in the viewer locale',
      (fieldName, persianLabel) => {
        const { label } =
          PARTIAL_SYSTEM_FLAT_FIELD_METADATAS[
            fieldName as keyof typeof PARTIAL_SYSTEM_FLAT_FIELD_METADATAS
          ];

        expect(resolveFieldLabel({ name: fieldName, label }, 'fa-IR')).toBe(
          persianLabel,
        );
        expect(resolveFieldLabel({ name: fieldName, label }, 'en')).toBe(label);
      },
    );

    it('uses the same translations as the standard objects fields', () => {
      for (const { name, label, description } of SYSTEM_FIELDS) {
        expect(resolveFieldLabel({ name, label }, 'fa-IR')).toBe(
          resolveStandardObjectFieldProperty('label', label),
        );
        expect(
          resolveEffectiveEntityProperty({
            metadataName: 'fieldMetadata',
            baseValue: description,
            overrides: null,
            property: 'description',
            i18nContext: computeFieldMetadataPropertyI18nContext({
              fieldName: name,
              property: 'description',
              baseValue: description,
              i18nContext: buildCustomApplicationI18nContext('fa-IR'),
            }),
          }),
        ).toBe(resolveStandardObjectFieldProperty('description', description));
      }
    });

    it('keeps a relabelled system field as authored in every locale', () => {
      for (const label of ['Created on', 'زمان ثبت']) {
        expect(resolveFieldLabel({ name: 'createdAt', label }, 'fa-IR')).toBe(
          label,
        );
        expect(resolveFieldLabel({ name: 'createdAt', label }, 'en')).toBe(
          label,
        );
      }
    });

    it('does not translate a custom field that only shares a system label', () => {
      expect(
        resolveFieldLabel({ name: 'reviewedBy', label: 'Created by' }, 'fa-IR'),
      ).toBe('Created by');
    });

    it('lets a workspace translation take precedence', () => {
      const i18nContext = buildCustomApplicationI18nContext('fa-IR');
      const overrides = {
        [i18nContext.workspaceCustomApplicationUniversalIdentifier as string]: {
          translations: { 'fa-IR': { label: 'زمان ساخت' } },
        },
      };

      expect(
        resolveEffectiveEntityProperty({
          metadataName: 'fieldMetadata',
          baseValue: 'Creation date',
          overrides,
          property: 'label',
          i18nContext: computeFieldMetadataPropertyI18nContext({
            fieldName: 'createdAt',
            property: 'label',
            baseValue: 'Creation date',
            i18nContext,
          }),
        }),
      ).toBe('زمان ساخت');
    });

    it('translates system field labels in metadata events', () => {
      const record = {
        name: 'createdBy',
        label: 'Created by',
        description: 'The creator of the record',
        overrides: null,
      };

      const resolvedRecord = resolveMetadataEventRecord({
        metadataName: 'fieldMetadata',
        record,
        i18nContext: buildCustomApplicationI18nContext('fa-IR'),
      });

      expect(resolvedRecord.label).toBe('ایجادشده توسط');
      expect(resolvedRecord.description).toBe('ایجادکننده رکورد');
      expect(resolvedRecord.name).toBe('createdBy');
    });
  });
});
