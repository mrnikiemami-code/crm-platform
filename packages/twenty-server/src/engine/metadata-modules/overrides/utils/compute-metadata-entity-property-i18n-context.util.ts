import { computeCommandMenuItemPropertyI18nContext } from 'src/engine/metadata-modules/command-menu-item/utils/compute-command-menu-item-property-i18n-context.util';
import { computeFieldMetadataPropertyI18nContext } from 'src/engine/metadata-modules/field-metadata/utils/compute-field-metadata-property-i18n-context.util';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { computePageLayoutPropertyI18nContext } from 'src/engine/metadata-modules/page-layout/utils/compute-page-layout-property-i18n-context.util';

export const computeMetadataEntityPropertyI18nContext = ({
  metadataName,
  entity,
  property,
  baseValue,
  i18nContext,
}: {
  metadataName: string;
  entity: Record<string, unknown>;
  property: string;
  baseValue: unknown;
  i18nContext: EffectiveEntityI18nContext;
}): EffectiveEntityI18nContext => {
  switch (metadataName) {
    case 'commandMenuItem':
      return computeCommandMenuItemPropertyI18nContext({
        engineComponentKey: entity.engineComponentKey,
        property,
        baseValue,
        i18nContext,
      });
    case 'fieldMetadata':
      return computeFieldMetadataPropertyI18nContext({
        fieldName: entity.name,
        property,
        baseValue,
        i18nContext,
      });
    case 'pageLayoutTab':
    case 'pageLayoutWidget':
      return computePageLayoutPropertyI18nContext({
        metadataName,
        isSystemSideEffect: entity.isSystemSideEffect,
        property,
        baseValue,
        i18nContext,
      });
    default:
      return i18nContext;
  }
};
