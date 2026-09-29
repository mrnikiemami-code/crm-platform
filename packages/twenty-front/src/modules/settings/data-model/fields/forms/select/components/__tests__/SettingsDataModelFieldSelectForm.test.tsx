import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';
import {
  SettingsDataModelFieldSelectForm,
  type SettingsDataModelFieldSelectFormValues,
} from '@/settings/data-model/fields/forms/select/components/SettingsDataModelFieldSelectForm';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

const mockUseFieldMetadataItemById = jest.fn();

jest.mock('@/object-metadata/hooks/useFieldMetadataItemById', () => ({
  useFieldMetadataItemById: (fieldMetadataId: string) =>
    mockUseFieldMetadataItemById(fieldMetadataId),
}));

const ADD_OPTION_LABELS = { en: 'Add option', 'fa-IR': 'افزودن گزینه' };

type Locale = keyof typeof ADD_OPTION_LABELS;

type SelectFieldType =
  | FieldMetadataType.SELECT
  | FieldMetadataType.MULTI_SELECT;

const renderSelectForm = ({
  locale,
  fieldType,
  existingOptions,
}: {
  locale: Locale;
  fieldType: SelectFieldType;
  existingOptions?: FieldMetadataItemOption[];
}) => {
  mockUseFieldMetadataItemById.mockReturnValue({
    fieldMetadataItem: existingOptions
      ? { options: existingOptions, defaultValue: null, isNullable: true }
      : undefined,
  });
  act(() => {
    i18n.activate(locale);
  });

  const SelectForm = () => {
    const formConfig = useForm<SettingsDataModelFieldSelectFormValues>();

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelFieldSelectForm
          fieldType={fieldType}
          existingFieldMetadataId={existingOptions ? 'field-id' : ''}
        />
      </FormProvider>
    );
  };

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <SelectForm />
        </MemoryRouter>
      </I18nProvider>
    </JotaiProvider>,
  );
};

const getOptionLabels = () =>
  screen
    .getAllByRole('textbox')
    .map((input) => (input as HTMLInputElement).value)
    .filter((value) => !/^[A-Z0-9_]+$/.test(value));

describe('SettingsDataModelFieldSelectForm', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  beforeEach(() => {
    resetJotaiStore();
  });

  afterAll(() => {
    act(() => {
      i18n.activate(SOURCE_LOCALE);
    });
  });

  describe.each<SelectFieldType>([
    FieldMetadataType.SELECT,
    FieldMetadataType.MULTI_SELECT,
  ])('%s', (fieldType) => {
    it('labels generated options in Persian with Persian digits', async () => {
      const user = userEvent.setup();

      renderSelectForm({ locale: 'fa-IR', fieldType });

      expect(getOptionLabels()).toEqual(['گزینه ۱']);

      await user.click(
        screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
      );

      expect(getOptionLabels()).toEqual(['گزینه ۱', 'گزینه ۲']);
      expect(screen.queryByDisplayValue(/Option \d/)).not.toBeInTheDocument();
    });

    it('keeps existing option labels as authored', async () => {
      const user = userEvent.setup();

      renderSelectForm({
        locale: 'fa-IR',
        fieldType,
        existingOptions: [
          {
            id: 'option-1',
            label: 'Option 1',
            value: 'OPTION_1',
            color: 'green',
            position: 0,
          },
        ],
      });

      await user.click(
        screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
      );

      expect(getOptionLabels()).toEqual(['Option 1', 'گزینه ۲']);
    });

    it('keeps English option labels in en', async () => {
      const user = userEvent.setup();

      renderSelectForm({ locale: 'en', fieldType });

      await user.click(
        screen.getByRole('button', { name: ADD_OPTION_LABELS.en }),
      );

      expect(getOptionLabels()).toEqual(['Option 1', 'Option 2']);
    });
  });
});
