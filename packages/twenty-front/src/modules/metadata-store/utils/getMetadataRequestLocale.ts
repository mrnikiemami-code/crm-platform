import { i18n } from '@lingui/core';
import { type createStore } from 'jotai';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

// Must match the x-locale header sent by the Apollo client, since the server
// localizes metadata labels for that locale.
export const getMetadataRequestLocale = (
  store: Pick<ReturnType<typeof createStore>, 'get'>,
): string => store.get(currentWorkspaceMemberState.atom)?.locale ?? i18n.locale;
