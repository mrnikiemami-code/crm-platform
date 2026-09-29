import { DEFAULT_NAME_FIELD_LABEL } from 'src/engine/metadata-modules/object-metadata/constants/default-name-field-label.constant';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { resolveEffectiveEntityProperty } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';

// Custom objects are created with a "name" field whose label is stored in the
// source locale. As long as it has not been renamed, that label is the
// standard one and is translated from the standard catalog at read time,
// unless the owning application's catalog translates it itself.
export const computeFieldMetadataPropertyI18nContext = ({
  fieldName,
  property,
  baseValue,
  i18nContext,
}: {
  fieldName: unknown;
  property: string;
  baseValue: unknown;
  i18nContext: EffectiveEntityI18nContext;
}): EffectiveEntityI18nContext => {
  if (
    fieldName !== 'name' ||
    property !== 'label' ||
    baseValue !== DEFAULT_NAME_FIELD_LABEL ||
    i18nContext.isStandardApp
  ) {
    return i18nContext;
  }

  const isTranslatedByOwningApplication =
    resolveEffectiveEntityProperty({
      metadataName: 'fieldMetadata',
      baseValue: DEFAULT_NAME_FIELD_LABEL,
      overrides: undefined,
      property: 'label',
      i18nContext,
    }) !== DEFAULT_NAME_FIELD_LABEL;

  return isTranslatedByOwningApplication
    ? i18nContext
    : { ...i18nContext, isStandardApp: true, applicationCatalog: undefined };
};
