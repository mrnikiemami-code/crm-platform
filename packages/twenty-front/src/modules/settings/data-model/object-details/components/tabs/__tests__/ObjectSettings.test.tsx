import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { ObjectSettings } from '@/settings/data-model/object-details/components/tabs/ObjectSettings';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const mockDeleteOneObjectMetadataItem = jest.fn();

jest.mock('@/object-metadata/hooks/useDeleteOneObjectMetadataItem', () => ({
  useDeleteOneObjectMetadataItem: () => ({
    deleteOneObjectMetadataItem: mockDeleteOneObjectMetadataItem,
  }),
}));

jest.mock('@/object-metadata/hooks/useUpdateOneObjectMetadataItem', () => ({
  useUpdateOneObjectMetadataItem: () => ({
    updateOneObjectMetadataItem: jest.fn(),
  }),
}));

jest.mock('@/object-metadata/hooks/useGetIsMetadataItemCustom', () => ({
  useGetIsMetadataItemCustom: () => () => true,
}));

jest.mock('@/object-record/read-only/utils/isObjectMetadataReadOnly', () => ({
  isObjectMetadataReadOnly: () => false,
}));

jest.mock('~/hooks/useNavigateSettings', () => ({
  useNavigateSettings: () => jest.fn(),
}));

jest.mock('twenty-ui/primitives/feedback', () => ({
  ...jest.requireActual('twenty-ui/primitives/feedback'),
  useToast: () => ({ enqueueToast: jest.fn() }),
}));

jest.mock(
  '@/settings/data-model/object-details/components/SettingsUpdateDataModelObjectAboutForm',
  () => ({ SettingsUpdateDataModelObjectAboutForm: () => null }),
);

jest.mock(
  '@/settings/data-model/objects/forms/components/SettingsDataModelObjectSettingsFormCard',
  () => ({ SettingsDataModelObjectSettingsFormCard: () => null }),
);

jest.mock(
  '@/settings/translations/components/SettingsTranslationsButton',
  () => ({ SettingsTranslationsButton: () => null }),
);

jest.mock(
  '@/settings/data-model/object-details/components/tabs/SettingsObjectSearchSection',
  () => ({ SettingsObjectSearchSection: () => null }),
);

jest.mock(
  '@/settings/data-model/object-details/components/tabs/SettingsObjectIndexesSection',
  () => ({ SettingsObjectIndexesSection: () => null }),
);

const DELETE_LABELS = { en: 'Delete', 'fa-IR': 'حذف' };

type Locale = keyof typeof DELETE_LABELS;

const objectMetadataItem: EnrichedObjectMetadataItem = {
  ...getMockObjectMetadataItemOrThrow('company'),
  id: 'object-id',
};

const renderAndOpenDeleteDialog = async (locale: Locale) => {
  act(() => {
    i18n.activate(locale);
  });

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <ObjectSettings
          objectMetadataItem={objectMetadataItem}
          isDeleting={false}
          setIsDeleting={jest.fn()}
        />
      </I18nProvider>
    </JotaiProvider>,
  );

  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: DELETE_LABELS[locale] }));

  const input = await screen.findByTestId('confirmation-modal-input');
  const confirmButton = screen.getByTestId('confirmation-modal-confirm-button');

  return {
    confirmButton,
    input: (input.querySelector('input') ?? input) as HTMLInputElement,
  };
};

const typeConfirmation = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
};

describe('ObjectSettings delete confirmation', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  beforeEach(() => {
    resetJotaiStore();
    mockDeleteOneObjectMetadataItem.mockReset();
  });

  afterAll(() => {
    act(() => {
      i18n.activate(SOURCE_LOCALE);
    });
  });

  describe('fa-IR', () => {
    it('asks to type the Persian confirmation word', async () => {
      const { input, confirmButton } = await renderAndOpenDeleteDialog('fa-IR');

      expect(
        screen.getByText(
          'این کار موجودیت و همه رکوردهایش را برای همیشه حذف می\u200cکند. برای تأیید حذف، عبارت «حذف» را وارد کنید.',
        ),
      ).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'حذف');
      expect(confirmButton).toHaveTextContent('حذف');
      expect(confirmButton).toBeDisabled();
    });

    it('does not accept the English confirmation word', async () => {
      const { input, confirmButton } = await renderAndOpenDeleteDialog('fa-IR');

      typeConfirmation(input, 'yes');

      expect(confirmButton).toBeDisabled();
    });

    it('enables deletion once the Persian confirmation word is typed', async () => {
      const { input, confirmButton } = await renderAndOpenDeleteDialog('fa-IR');

      typeConfirmation(input, 'حذف');

      expect(confirmButton).toBeEnabled();
      expect(mockDeleteOneObjectMetadataItem).not.toHaveBeenCalled();
    });
  });

  describe('en', () => {
    it('keeps asking to type "yes"', async () => {
      const { input, confirmButton } = await renderAndOpenDeleteDialog('en');

      expect(
        screen.getByText(
          'This will permanently delete the object and all its records. Type "yes" to confirm.',
        ),
      ).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'yes');

      typeConfirmation(input, 'حذف');
      expect(confirmButton).toBeDisabled();

      typeConfirmation(input, 'yes');
      expect(confirmButton).toBeEnabled();
    });

    it('deletes the object only through the existing metadata mutation', async () => {
      mockDeleteOneObjectMetadataItem.mockResolvedValue({
        status: 'successful',
      });
      const { input, confirmButton } = await renderAndOpenDeleteDialog('en');

      typeConfirmation(input, 'yes');
      await userEvent.setup().click(confirmButton);

      expect(mockDeleteOneObjectMetadataItem).toHaveBeenCalledTimes(1);
      expect(mockDeleteOneObjectMetadataItem).toHaveBeenCalledWith('object-id');
    });
  });
});
