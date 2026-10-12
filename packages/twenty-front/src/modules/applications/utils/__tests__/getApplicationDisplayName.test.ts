import { i18n } from '@lingui/core';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { messages as faMessages } from '~/locales/generated/fa-IR';
import { messages as enMessages } from '~/locales/generated/en';
import { getApplicationDisplayName } from '@/applications/utils/getApplicationDisplayName';

// The command-menu suffix (`ارسال پیامک · <app>`) is the application display
// name, resolved through this single helper. Locking it here proves the real
// presentation resolves to «ارتباطات» in fa-IR without hardcoding a string in
// the command menu.
describe('getApplicationDisplayName (command-menu suffix source)', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  afterEach(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it('J: resolves the Communication app name to ارتباطات in fa-IR', () => {
    i18n.activate('fa-IR');

    expect(
      getApplicationDisplayName({
        application: { id: 'app-1', name: 'Communication' },
        currentWorkspace: null,
      }),
    ).toBe('ارتباطات');
  });

  it('keeps the source name in English', () => {
    i18n.activate('en');

    expect(
      getApplicationDisplayName({
        application: { id: 'app-1', name: 'Communication' },
        currentWorkspace: null,
      }),
    ).toBe('Communication');
  });

  it('falls back to the manifest name for an app with no catalog entry', () => {
    i18n.activate('fa-IR');

    expect(
      getApplicationDisplayName({
        application: { id: 'app-2', name: 'Some Other App' },
        currentWorkspace: null,
      }),
    ).toBe('Some Other App');
  });
});
