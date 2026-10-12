import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import { isTwentyStandardApplication } from '@/applications/utils/isTwentyStandardApplication';
import { isWorkspaceCustomApplication } from '@/applications/utils/isWorkspaceCustomApplication';
import { isDefined } from 'twenty-shared/utils';

type ApplicationLike = {
  id?: string | null;
  name: string;
  universalIdentifier?: string | null;
};

type WorkspaceLike = {
  workspaceCustomApplication?: { id?: string | null } | null;
};

// Applications whose display name has a localized host catalog entry.
//
// An application manifest cannot localize its own `displayName`: that property
// is not in the platform's translatable-properties registry
// (`TRANSLATABLE_PROPERTIES_BY_METADATA_NAME`), so the value reaches the UI
// verbatim. This is therefore the single localization source every
// application-name surface reads through (chips, the command menu, workflow
// nodes), and the correct place to correct it — never the individual surface.
const LOCALIZED_APPLICATION_NAMES = {
  Communication: msg`Communication`,
} as const;

const isLocalizedApplicationName = (
  name: string,
): name is keyof typeof LOCALIZED_APPLICATION_NAMES =>
  Object.prototype.hasOwnProperty.call(LOCALIZED_APPLICATION_NAMES, name);

export const getApplicationDisplayName = ({
  application,
  currentWorkspace,
}: {
  application: ApplicationLike;
  currentWorkspace: WorkspaceLike | null | undefined;
}): string => {
  if (isTwentyStandardApplication(application)) {
    return i18n._(msg`Standard`);
  }

  if (isWorkspaceCustomApplication(application, currentWorkspace)) {
    return i18n._(msg`Custom`);
  }

  // A workspace-installed application: resolve a localized name when one is
  // declared, otherwise fall back to the name the manifest supplied.
  return isDefined(application.name) &&
    isLocalizedApplicationName(application.name)
    ? i18n._(LOCALIZED_APPLICATION_NAMES[application.name])
    : application.name;
};
