import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, screen } from '@testing-library/react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { CommandMenuItem } from '@/command-menu/components/CommandMenuItem';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

jest.mock('@/command-menu/hooks/useCommandMenuOnItemClick', () => ({
  useCommandMenuOnItemClick: () => ({ onItemClick: jest.fn() }),
}));

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomComponentFamilyStateValue',
  () => ({
    useAtomComponentFamilyStateValue: () => false,
  }),
);

const renderGoToCommand = () =>
  render(
    <I18nProvider i18n={i18n}>
      <CommandMenuItem
        id="go-to-academy-events"
        label="رفتن به همایش‌ها"
        hotKeys={['G', 'S']}
      />
    </I18nProvider>,
  );

describe('CommandMenuItem', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  afterAll(() => {
    act(() => {
      i18n.activate(SOURCE_LOCALE);
    });
  });

  it('joins keyboard shortcut keys with a Persian separator in fa-IR', () => {
    act(() => {
      i18n.activate('fa-IR');
    });

    renderGoToCommand();

    expect(screen.getByText('رفتن به همایش‌ها')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('سپس')).toBeInTheDocument();
    expect(screen.queryByText('then')).not.toBeInTheDocument();
  });

  it('keeps the English separator in en', () => {
    act(() => {
      i18n.activate('en');
    });

    renderGoToCommand();

    expect(screen.getByText('then')).toBeInTheDocument();
  });
});
