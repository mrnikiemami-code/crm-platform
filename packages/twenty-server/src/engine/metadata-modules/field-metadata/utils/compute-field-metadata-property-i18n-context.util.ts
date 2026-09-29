import { isDefined } from 'twenty-shared/utils';

import { CUSTOM_OBJECT_DEFAULT_FIELD_PROPERTIES } from 'src/engine/metadata-modules/object-metadata/constants/custom-object-default-field-properties.constant';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { resolveEffectiveEntityPropertyByName } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';

const getCustomObjectDefaultFieldValue = (
  fieldName: unknown,
  property: string,
): string | undefined => {
  if (typeof fieldName !== 'string') {
    return undefined;
  }

  const defaultFieldProperties =
    CUSTOM_OBJECT_DEFAULT_FIELD_PROPERTIES.get(fieldName);

  if (property === 'label' || property === 'description') {
    return defaultFieldProperties?.[property];
  }

  return undefined;
};

// Custom objects are created with a "name" field and system fields (createdAt,
// createdBy...) whose labels and descriptions are stored in the source locale.
// As long as they have not been edited, they are the standard ones and are
// translated from the standard catalog at read time, unless the owning
// application's catalog translates them itself.
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
  const defaultValue = getCustomObjectDefaultFieldValue(fieldName, property);

  if (
    !isDefined(defaultValue) ||
    baseValue !== defaultValue ||
    i18nContext.isStandardApp
  ) {
    return i18nContext;
  }

  const isTranslatedByOwningApplication =
    resolveEffectiveEntityPropertyByName({
      metadataName: 'fieldMetadata',
      baseValue: defaultValue,
      overrides: undefined,
      property,
      i18nContext,
    }) !== defaultValue;

  return isTranslatedByOwningApplication
    ? i18nContext
    : { ...i18nContext, isStandardApp: true, applicationCatalog: undefined };
};
