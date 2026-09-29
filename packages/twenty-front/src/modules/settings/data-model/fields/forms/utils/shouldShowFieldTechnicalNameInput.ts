import { isNonEmptyString } from '@sniptt/guards';

import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { isNonLatinScriptLocale } from '@/settings/data-model/utils/isNonLatinScriptLocale';

type ShouldShowFieldTechnicalNameInputArgs = {
  isCreationMode: boolean;
  label: string | undefined | null;
  locale: string | undefined | null;
};

// In non-Latin script locales the label will almost always be non-Latin, so
// the technical name input is shown before the label is typed.
export const shouldShowFieldTechnicalNameInput = ({
  isCreationMode,
  label,
  locale,
}: ShouldShowFieldTechnicalNameInputArgs) =>
  isCreationMode &&
  (hasNonLatinLetters(label) ||
    (!isNonEmptyString(label) && isNonLatinScriptLocale(locale)));
