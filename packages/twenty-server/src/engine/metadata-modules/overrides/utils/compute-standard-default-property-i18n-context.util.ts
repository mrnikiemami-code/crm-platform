import { type TranslatableMetadataName } from 'twenty-shared/i18n';
import { isDefined } from 'twenty-shared/utils';

import { type EffectiveEntityI18nContext } from 'src/engine/metadata-modules/overrides/types/effective-entity-i18n-context.type';
import { resolveEffectiveEntityPropertyByName } from 'src/engine/metadata-modules/overrides/utils/resolve-effective-entity-property.util';

// Entities the server creates on behalf of a custom application (default
// fields, record page tabs...) store standard values in the source locale.
// As long as they have not been edited, they are translated from the standard
// catalog at read time, unless the owning application's catalog translates
// them itself.
export const computeStandardDefaultPropertyI18nContext = ({
  metadataName,
  property,
  baseValue,
  defaultValue,
  i18nContext,
}: {
  metadataName: TranslatableMetadataName;
  property: string;
  baseValue: unknown;
  defaultValue: string | undefined;
  i18nContext: EffectiveEntityI18nContext;
}): EffectiveEntityI18nContext => {
  if (
    !isDefined(defaultValue) ||
    baseValue !== defaultValue ||
    i18nContext.isStandardApp
  ) {
    return i18nContext;
  }

  const isTranslatedByOwningApplication =
    resolveEffectiveEntityPropertyByName({
      metadataName,
      baseValue: defaultValue,
      overrides: undefined,
      property,
      i18nContext,
    }) !== defaultValue;

  return isTranslatedByOwningApplication
    ? i18nContext
    : { ...i18nContext, isStandardApp: true, applicationCatalog: undefined };
};
