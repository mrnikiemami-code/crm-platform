import { type APP_LOCALES } from 'twenty-shared/translations';

import { getStandardFieldOptionCanonicalLabelById } from 'src/engine/metadata-modules/field-metadata/utils/get-standard-field-option-canonical-label-by-id.util';
import { type MessageIdTranslator } from 'src/engine/metadata-modules/overrides/types/message-id-translator.type';
import { resolveEffectiveEntityProperty } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';

type FieldOptionLike = { id?: unknown; label?: unknown };

type StandardFieldOptionI18n = {
  locale: keyof typeof APP_LOCALES | undefined;
  i18nInstance: MessageIdTranslator;
};

// Standard option labels are authored with the fieldMetadata.label context
// and live only in the standard catalog; options carry no overrides.
const translateCanonicalLabel = (
  canonicalLabel: string,
  { locale, i18nInstance }: StandardFieldOptionI18n,
) =>
  resolveEffectiveEntityProperty({
    metadataName: 'fieldMetadata',
    baseValue: canonicalLabel,
    overrides: undefined,
    property: 'label',
    i18nContext: {
      locale,
      i18nInstance,
      isStandardApp: true,
      applicationCatalog: undefined,
      workspaceCustomApplicationUniversalIdentifier: '',
      ownerApplicationUniversalIdentifier: undefined,
    },
  });

const getCanonicalLabel = (option: FieldOptionLike) =>
  typeof option.id === 'string'
    ? getStandardFieldOptionCanonicalLabelById().get(option.id)
    : undefined;

export const localizeStandardFieldOptions = <T>(
  options: T,
  i18n: StandardFieldOptionI18n,
): T => {
  if (!Array.isArray(options)) {
    return options;
  }

  return options.map((option: FieldOptionLike) => {
    const canonicalLabel = getCanonicalLabel(option);

    if (canonicalLabel === undefined || option.label !== canonicalLabel) {
      return option;
    }

    return {
      ...option,
      label: translateCanonicalLabel(canonicalLabel, i18n),
    };
  }) as T;
};

// The settings form submits every option it displayed, so an untouched
// standard option comes back with its localized label; storing that would
// replace the canonical source label for every locale.
export const restoreCanonicalStandardFieldOptionLabels = <T>(
  options: T,
  i18n: StandardFieldOptionI18n,
): T => {
  if (!Array.isArray(options)) {
    return options;
  }

  return options.map((option: FieldOptionLike) => {
    const canonicalLabel = getCanonicalLabel(option);

    if (
      canonicalLabel === undefined ||
      option.label === canonicalLabel ||
      option.label !== translateCanonicalLabel(canonicalLabel, i18n)
    ) {
      return option;
    }

    return { ...option, label: canonicalLabel };
  }) as T;
};
