import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, renderHook } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { useDeleteConfirmation } from '@/ui/layout/dialog/hooks/useDeleteConfirmation';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

const SRC_DIRECTORY = resolve(__dirname, '../../../../../..');

const DELETE_CONFIRMATION_DIALOG_FILES = [
  'pages/settings/data-model/SettingsObjectFieldEdit.tsx',
  'modules/settings/data-model/object-details/components/tabs/ObjectSettings.tsx',
  'modules/settings/developers/components/SettingsDevelopersWebhookForm.tsx',
  'pages/settings/developers/api-keys/SettingsDevelopersApiKeyDetail.tsx',
  'pages/settings/admin-panel/SettingsAdminApplicationRegistrationDangerZone.tsx',
  'modules/settings/applications/components/SettingsApplicationUninstallButton.tsx',
];

const renderDeleteConfirmation = (locale: 'en' | 'fa-IR') => {
  act(() => {
    i18n.activate(locale);
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  );

  return renderHook(() => useDeleteConfirmation(), { wrapper }).result.current;
};

describe('useDeleteConfirmation', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  afterAll(() => {
    act(() => {
      i18n.activate(SOURCE_LOCALE);
    });
  });

  it('uses the Persian delete word in fa-IR', () => {
    expect(renderDeleteConfirmation('fa-IR')).toEqual({
      confirmationValue: 'حذف',
      confirmationInstruction: 'برای تأیید حذف، عبارت «حذف» را وارد کنید.',
    });
  });

  it('keeps "yes" in en', () => {
    expect(renderDeleteConfirmation('en')).toEqual({
      confirmationValue: 'yes',
      confirmationInstruction: 'Type "yes" to confirm.',
    });
  });

  it.each(DELETE_CONFIRMATION_DIALOG_FILES)(
    '%s takes its delete confirmation word from the shared hook',
    (relativePath) => {
      const source = readFileSync(resolve(SRC_DIRECTORY, relativePath), 'utf8');

      expect(source).toContain('useDeleteConfirmation()');
      expect(source).not.toMatch(/["']yes["']/);
      expect(source).not.toMatch(/Type "yes"|type "yes"/);
    },
  );
});
