import { CUSTOM_OBJECT_DEFAULT_FIELD_PROPERTIES } from 'src/engine/metadata-modules/object-metadata/constants/custom-object-default-field-properties.constant';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { computeStandardDefaultPropertyI18nContext } from 'src/engine/metadata-modules/overrides/utils/compute-standard-default-property-i18n-context.util';

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
// createdBy...) whose labels and descriptions are the standard ones.
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
}): EffectiveEntityI18nContext =>
  computeStandardDefaultPropertyI18nContext({
    metadataName: 'fieldMetadata',
    property,
    baseValue,
    defaultValue: getCustomObjectDefaultFieldValue(fieldName, property),
    i18nContext,
  });
