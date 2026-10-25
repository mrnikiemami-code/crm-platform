import { translateStandardLabel } from 'src/engine/core-modules/i18n/utils/translate-standard-label.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getChartI18n } from 'src/modules/dashboard/chart-data/utils/chart-i18n.storage';

// Flat field maps store source-locale labels; chart axes must surface the
// same localized metadata labels the GraphQL metadata layer already returns.
export const getLocalizedChartFieldLabel = (
  fieldMetadata: Pick<FlatFieldMetadata, 'label'>,
): string =>
  translateStandardLabel({
    sourceValue: fieldMetadata.label,
    context: 'fieldMetadata.label',
    isStandardApp: true,
    applicationCatalog: undefined,
    i18nInstance: getChartI18n(),
  });
