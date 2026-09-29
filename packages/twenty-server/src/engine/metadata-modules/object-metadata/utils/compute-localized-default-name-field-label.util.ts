import { DEFAULT_NAME_FIELD_LABEL } from 'src/engine/metadata-modules/object-metadata/constants/default-name-field-label.constant';
import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { resolveEffectiveEntityProperty } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';

// Custom objects have no translation catalog, so the default name field label
// is stored already translated into the creator's locale. The i18n context must
// be the standard application's one, which owns the "Name" label.
export const computeLocalizedDefaultNameFieldLabel = ({
  standardApplicationI18nContext,
}: {
  standardApplicationI18nContext: EffectiveEntityI18nContext;
}): string =>
  resolveEffectiveEntityProperty({
    metadataName: 'fieldMetadata',
    baseValue: DEFAULT_NAME_FIELD_LABEL,
    overrides: undefined,
    property: 'label',
    i18nContext: standardApplicationI18nContext,
  });
