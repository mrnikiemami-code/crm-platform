import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsPath } from 'twenty-shared/types';

import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';
import { SettingsObjectFieldEdit } from '~/pages/settings/data-model/SettingsObjectFieldEdit';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const RECORD_INDEX_URL = '/objects/companies?viewId=view-id';

const objectMetadataItem = getMockObjectMetadataItemOrThrow('company');
const fieldMetadataItem = objectMetadataItem.fields.find(
  (field) => field.name === 'employees',
);

const mockNavigateSettings = jest.fn();
const mockUpdateOneFieldMetadataItem = jest.fn();
const mockDeleteMetadataField = jest.fn();

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: Record<string, unknown>) => ({
    values,
    errors: {},
  }),
}));

jest.mock('@/object-metadata/hooks/useFilteredObjectMetadataItems', () => ({
  useFilteredObjectMetadataItems: () => ({
    findObjectMetadataItemByNamePlural: () => objectMetadataItem,
    objectMetadataItems: [objectMetadataItem],
  }),
}));

jest.mock('@/object-metadata/hooks/useUpdateOneFieldMetadataItem', () => ({
  useUpdateOneFieldMetadataItem: () => ({
    updateOneFieldMetadataItem: mockUpdateOneFieldMetadataItem,
  }),
}));

jest.mock('@/object-metadata/hooks/useFieldMetadataItem', () => ({
  useFieldMetadataItem: () => ({
    deactivateMetadataField: jest.fn(),
    activateMetadataField: jest.fn(),
    deleteMetadataField: mockDeleteMetadataField,
  }),
}));

jest.mock('@/object-metadata/hooks/useGetRelationMetadata', () => ({
  useGetRelationMetadata: () => () => undefined,
}));

jest.mock('@/object-metadata/hooks/useGetIsMetadataItemCustom', () => ({
  useGetIsMetadataItemCustom: () => () => true,
}));

jest.mock('@/object-record/read-only/utils/isObjectMetadataReadOnly', () => ({
  isObjectMetadataReadOnly: () => false,
}));

jest.mock('@/ui/layout/hooks/useWorkspaceSurface', () => ({
  useWorkspaceSurface: () => ({ type: 'main' }),
}));

jest.mock('~/hooks/useNavigateSettings', () => ({
  useNavigateSettings: () => mockNavigateSettings,
}));

jest.mock('~/hooks/useNavigateApp', () => ({
  useNavigateApp: () => jest.fn(),
}));

jest.mock('twenty-ui/primitives/feedback', () => ({
  ...jest.requireActual('twenty-ui/primitives/feedback'),
  useToast: () => ({ enqueueToast: jest.fn() }),
}));

jest.mock('@/settings/components/layout/SettingsPageLayout', () => ({
  SettingsPageLayout: ({
    actionButton,
    children,
  }: {
    actionButton: ReactNode;
    children: ReactNode;
  }) => (
    <>
      {actionButton}
      {children}
    </>
  ),
}));

jest.mock(
  '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons',
  () => ({
    SaveAndCancelButtons: ({
      onSave,
      onCancel,
    }: {
      onSave: () => void;
      onCancel: () => void;
    }) => (
      <>
        <button onClick={onSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </>
    ),
  }),
);

jest.mock(
  '@/settings/data-model/fields/forms/components/SettingsDataModelFieldDescriptionForm',
  () => ({
    ...jest.requireActual(
      '@/settings/data-model/fields/forms/components/SettingsDataModelFieldDescriptionForm',
    ),
    SettingsDataModelFieldDescriptionForm: () => {
      const { register } = useFormContext();

      // oxlint-disable-next-line react/jsx-props-no-spreading
      return <input aria-label="Description" {...register('description')} />;
    },
  }),
);

jest.mock(
  '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIconLabelForm',
  () => ({
    ...jest.requireActual(
      '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIconLabelForm',
    ),
    SettingsDataModelFieldIconLabelForm: ({
      fieldMetadataItem: field,
    }: {
      fieldMetadataItem: { name: string };
    }) => {
      const { register } = useFormContext();

      return (
        <input
          type="hidden"
          defaultValue={field.name}
          // oxlint-disable-next-line react/jsx-props-no-spreading
          {...register('name')}
        />
      );
    },
  }),
);

jest.mock(
  '@/settings/data-model/fields/forms/components/SettingsDataModelFieldSettingsFormCard',
  () => ({
    ...jest.requireActual(
      '@/settings/data-model/fields/forms/components/SettingsDataModelFieldSettingsFormCard',
    ),
    SettingsDataModelFieldSettingsFormCard: () => null,
  }),
);

jest.mock(
  '@/settings/translations/components/SettingsTranslationsButton',
  () => ({ SettingsTranslationsButton: () => null }),
);

const CurrentLocation = () => {
  const location = useLocation();

  return (
    <div data-testid="current-location">
      {location.pathname + location.search}
    </div>
  );
};

const renderFieldEdit = (state?: { returnTo: string }) => {
  const fieldEditPath = `/settings/objects/companies/${fieldMetadataItem?.name}`;

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[{ pathname: fieldEditPath, state }]}>
          <Routes>
            <Route
              path="/settings/objects/:objectNamePlural/:fieldName"
              element={<SettingsObjectFieldEdit />}
            />
            <Route path="*" element={<CurrentLocation />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </JotaiProvider>,
  );
};

describe('SettingsObjectFieldEdit navigation', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  beforeEach(() => {
    act(() => {
      i18n.activate('en');
    });
  });

  beforeEach(() => {
    resetJotaiStore();
    mockNavigateSettings.mockReset();
    mockUpdateOneFieldMetadataItem.mockReset();
    mockUpdateOneFieldMetadataItem.mockResolvedValue({ status: 'successful' });
    jotaiStore.set(navigationMemorizedUrlState.atom, RECORD_INDEX_URL);
  });

  it('returns to the object settings after saving, not to the last record page', async () => {
    const user = userEvent.setup();

    renderFieldEdit();

    await user.type(screen.getByLabelText('Description'), ' updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockNavigateSettings).toHaveBeenCalledWith(
        SettingsPath.ObjectDetail,
        { objectNamePlural: 'companies' },
      );
    });
    expect(mockUpdateOneFieldMetadataItem).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('current-location')).not.toBeInTheDocument();
  });

  it('returns to the object settings after cancelling', async () => {
    const user = userEvent.setup();

    renderFieldEdit();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockNavigateSettings).toHaveBeenCalledWith(
      SettingsPath.ObjectDetail,
      { objectNamePlural: 'companies' },
    );
    expect(screen.queryByTestId('current-location')).not.toBeInTheDocument();
  });

  it('still returns to an explicitly requested page', async () => {
    const user = userEvent.setup();

    renderFieldEdit({ returnTo: RECORD_INDEX_URL });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByTestId('current-location')).toHaveTextContent(
      RECORD_INDEX_URL,
    );
    expect(mockNavigateSettings).not.toHaveBeenCalled();
  });
});

describe('SettingsObjectFieldEdit delete confirmation', () => {
  const openDeleteDialog = async (locale: 'en' | 'fa-IR') => {
    act(() => {
      i18n.activate(locale);
    });

    renderFieldEdit();

    await userEvent
      .setup()
      .click(
        screen.getByRole('button', {
          name: locale === 'en' ? 'Delete' : 'حذف',
        }),
      );

    const input = await screen.findByTestId('confirmation-modal-input');

    return {
      input: (input.querySelector('input') ?? input) as HTMLInputElement,
      confirmButton: screen.getByTestId('confirmation-modal-confirm-button'),
    };
  };

  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  beforeEach(() => {
    resetJotaiStore();
    mockDeleteMetadataField.mockReset();
  });

  it('asks for the Persian delete word in fa-IR', async () => {
    const { input, confirmButton } = await openDeleteDialog('fa-IR');

    expect(
      screen.getByText(
        `این کار فیلد و همه داده‌هایش را از ${objectMetadataItem.labelPlural} برای همیشه حذف می‌کند. برای تأیید حذف، عبارت «حذف» را وارد کنید.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/yes/)).not.toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'حذف');
    expect(confirmButton).toHaveTextContent('حذف');
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'yes' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'حذف' } });
    expect(confirmButton).toBeEnabled();
    expect(mockDeleteMetadataField).not.toHaveBeenCalled();
  });

  it('keeps "yes" as the confirmation word in en', async () => {
    const { input, confirmButton } = await openDeleteDialog('en');

    expect(
      screen.getByText(
        `This will permanently delete the field and all its data from ${objectMetadataItem.labelPlural}. Type "yes" to confirm.`,
      ),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'yes');

    fireEvent.change(input, { target: { value: 'حذف' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'yes' } });
    expect(confirmButton).toBeEnabled();
  });
});
