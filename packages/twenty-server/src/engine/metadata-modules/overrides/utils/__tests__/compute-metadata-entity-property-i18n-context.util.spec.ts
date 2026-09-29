import { type TranslatableMetadataName } from 'twenty-shared/i18n';
import { type APP_LOCALES } from 'twenty-shared/translations';

import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { EngineComponentKey } from 'src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';
import { interpolateNavigationCommandMenuItemField } from 'src/engine/metadata-modules/command-menu-item/utils/interpolate-navigation-command-menu-item-field.util';
import { NAVIGATION_INTERPOLATED_LABEL } from 'src/engine/metadata-modules/flat-command-menu-item/utils/build-object-navigation-universal-flat-command-menu-item.util';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { computeMetadataEntityPropertyI18nContext } from 'src/engine/metadata-modules/overrides/utils/compute-metadata-entity-property-i18n-context.util';
import { resolveEffectiveEntityPropertyByName } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';
import { resolveMetadataEventRecord } from 'src/engine/subscriptions/metadata-event/utils/resolve-metadata-event-record.util';

describe('computeMetadataEntityPropertyI18nContext', () => {
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

  const resolveProperty = ({
    metadataName,
    entity,
    property,
    locale,
  }: {
    metadataName: TranslatableMetadataName;
    entity: Record<string, unknown>;
    property: string;
    locale: keyof typeof APP_LOCALES;
  }) =>
    resolveEffectiveEntityPropertyByName({
      metadataName,
      baseValue: entity[property] as string,
      overrides: undefined,
      property,
      i18nContext: computeMetadataEntityPropertyI18nContext({
        metadataName,
        entity,
        property,
        baseValue: entity[property],
        i18nContext: buildCustomApplicationI18nContext(locale),
      }),
    });

  beforeAll(async () => {
    await i18nService.loadTranslations();
  });

  describe('custom object record page layout', () => {
    it.each([
      ['Timeline', 'خط زمانی'],
      ['Tasks', 'وظایف'],
      ['Notes', 'یادداشت‌ها'],
      ['Files', 'فایل‌ها'],
      ['Fields', 'فیلدها'],
    ])('displays the %s tab title in the viewer locale', (title, persian) => {
      const tab = { title, isSystemSideEffect: true };

      expect(
        resolveProperty({
          metadataName: 'pageLayoutTab',
          entity: tab,
          property: 'title',
          locale: 'fa-IR',
        }),
      ).toBe(persian);
      expect(
        resolveProperty({
          metadataName: 'pageLayoutTab',
          entity: tab,
          property: 'title',
          locale: 'en',
        }),
      ).toBe(title);
    });

    it.each([
      ['Fields', 'فیلدها'],
      ['Timeline', 'خط زمانی'],
    ])(
      'displays the %s widget title in the viewer locale',
      (title, persian) => {
        expect(
          resolveProperty({
            metadataName: 'pageLayoutWidget',
            entity: { title, isSystemSideEffect: true },
            property: 'title',
            locale: 'fa-IR',
          }),
        ).toBe(persian);
      },
    );

    it('keeps a renamed tab title as authored', () => {
      for (const title of ['Agenda', 'برنامه']) {
        expect(
          resolveProperty({
            metadataName: 'pageLayoutTab',
            entity: { title, isSystemSideEffect: true },
            property: 'title',
            locale: 'fa-IR',
          }),
        ).toBe(title);
      }
    });

    it('does not translate a user-created tab that shares a system title', () => {
      expect(
        resolveProperty({
          metadataName: 'pageLayoutTab',
          entity: { title: 'Notes', isSystemSideEffect: false },
          property: 'title',
          locale: 'fa-IR',
        }),
      ).toBe('Notes');
    });

    it('keeps the context when the application catalog translates the title', () => {
      const i18nContext = {
        ...buildCustomApplicationI18nContext('fa-IR'),
        applicationCatalog: new Proxy<Record<string, string>>(
          {},
          { get: () => 'یادداشت' },
        ),
      };

      expect(
        computeMetadataEntityPropertyI18nContext({
          metadataName: 'pageLayoutTab',
          entity: { title: 'Notes', isSystemSideEffect: true },
          property: 'title',
          baseValue: 'Notes',
          i18nContext,
        }),
      ).toBe(i18nContext);
    });

    it('translates system tab titles in metadata events', () => {
      expect(
        resolveMetadataEventRecord({
          metadataName: 'pageLayoutTab',
          record: { title: 'Tasks', isSystemSideEffect: true, overrides: null },
          i18nContext: buildCustomApplicationI18nContext('fa-IR'),
        }).title,
      ).toBe('وظایف');
    });
  });

  describe('custom object navigation command', () => {
    const navigationCommand = {
      label: NAVIGATION_INTERPOLATED_LABEL,
      engineComponentKey: EngineComponentKey.NAVIGATION,
    };

    it('translates the navigation label template and keeps the placeholder', () => {
      expect(
        resolveProperty({
          metadataName: 'commandMenuItem',
          entity: navigationCommand,
          property: 'label',
          locale: 'fa-IR',
        }),
      ).toBe('رفتن به {objectLabelPlural}');
      expect(
        resolveProperty({
          metadataName: 'commandMenuItem',
          entity: navigationCommand,
          property: 'label',
          locale: 'en',
        }),
      ).toBe('Go to {objectLabelPlural}');
    });

    it.each([
      ['fa-IR', 'رفتن به همایش‌ها'],
      ['en', 'Go to همایش‌ها'],
    ] as const)(
      'interpolates the custom object label as authored in %s',
      (locale, expected) => {
        expect(
          interpolateNavigationCommandMenuItemField({
            commandMenuItem: {
              engineComponentKey: EngineComponentKey.NAVIGATION,
              navigationTargetObjectMetadataId: 'object-id',
            },
            resolvedValue: resolveProperty({
              metadataName: 'commandMenuItem',
              entity: navigationCommand,
              property: 'label',
              locale,
            }),
            objectMetadata: { labelPlural: 'همایش‌ها', overrides: null },
            objectMetadataI18nContext:
              buildCustomApplicationI18nContext(locale),
          }),
        ).toBe(expected);
      },
    );

    it('keeps a renamed navigation label as authored', () => {
      expect(
        resolveProperty({
          metadataName: 'commandMenuItem',
          entity: { ...navigationCommand, label: 'Open events' },
          property: 'label',
          locale: 'fa-IR',
        }),
      ).toBe('Open events');
    });

    it('does not translate other commands sharing the template', () => {
      expect(
        resolveProperty({
          metadataName: 'commandMenuItem',
          entity: { ...navigationCommand, engineComponentKey: 'OTHER' },
          property: 'label',
          locale: 'fa-IR',
        }),
      ).toBe(NAVIGATION_INTERPOLATED_LABEL);
    });
  });
});
