import { zodResolver } from '@hookform/resolvers/zod';
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
  settingsDataModelFieldMultiSelectFormSchema,
  settingsDataModelFieldSelectFormSchema,
  type SettingsDataModelFieldSelectFormValues,
} from '@/settings/data-model/fields/forms/select/components/SettingsDataModelFieldSelectForm';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';
import { computeOptionValueFromLabel } from '~/pages/settings/data-model/utils/computeOptionValueFromLabel';

const mockUseFieldMetadataItemById = jest.fn();

jest.mock('@/object-metadata/hooks/useFieldMetadataItemById', () => ({
  useFieldMetadataItemById: (fieldMetadataId: string) =>
    mockUseFieldMetadataItemById(fieldMetadataId),
}));

const ADD_OPTION_LABELS = { en: 'Add option', 'fa-IR': 'افزودن گزینه' };
const FA_MORE_OPTIONS_LABEL = 'گزینه‌های بیشتر';
const FA_REMOVE_OPTION_LABEL = 'حذف گزینه';
const FA_DUPLICATE_ERROR = 'این گزینه تکراری است.';
const PRE_REGISTRATION_LABEL = 'پیش‌ثبت‌نام';
const FINAL_REGISTRATION_LABEL = 'ثبت‌نام قطعی';

type Locale = keyof typeof ADD_OPTION_LABELS;

type SelectFieldType =
  | FieldMetadataType.SELECT
  | FieldMetadataType.MULTI_SELECT;

const buildOption = (
  id: string,
  label: string,
  position: number,
): FieldMetadataItemOption => ({
  id,
  label,
  value: computeOptionValueFromLabel(label),
  color: 'green',
  position,
});

const renderSelectForm = ({
  locale,
  fieldType,
  existingOptions,
  existingDefaultValue = null,
  isNullable = true,
}: {
  locale: Locale;
  fieldType: SelectFieldType;
  existingOptions?: FieldMetadataItemOption[];
  existingDefaultValue?: SettingsDataModelFieldSelectFormValues['defaultValue'];
  isNullable?: boolean;
}) => {
  mockUseFieldMetadataItemById.mockReturnValue({
    fieldMetadataItem: existingOptions
      ? {
          options: existingOptions,
          defaultValue: existingDefaultValue,
          isNullable,
        }
      : undefined,
  });
  act(() => {
    i18n.activate(locale);
  });

  const SelectForm = () => {
    const formConfig = useForm<SettingsDataModelFieldSelectFormValues>({
      mode: 'onChange',
      resolver: zodResolver(
        fieldType === FieldMetadataType.SELECT
          ? settingsDataModelFieldSelectFormSchema
          : settingsDataModelFieldMultiSelectFormSchema,
      ),
    });

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelFieldSelectForm
          fieldType={fieldType}
          existingFieldMetadataId={existingOptions ? 'field-id' : ''}
        />
        <output data-testid="form-validity">
          {String(formConfig.formState.isValid)}
        </output>
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

const getOptionLabelInputs = () =>
  screen
    .getAllByRole('textbox')
    .filter(
      (input) => !/^[A-Z0-9_]+$/.test((input as HTMLInputElement).value),
    ) as HTMLInputElement[];

const getOptionLabels = () =>
  getOptionLabelInputs().map((input) => input.value);

const getFormValidity = () => screen.getByTestId('form-validity').textContent;

const renameOption = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
  label: string,
) => {
  const input = getOptionLabelInputs()[rowIndex];

  await user.clear(input);
  await user.type(input, label);
};

const removeOption = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
) => {
  const [, ...rowMenuButtons] = screen.getAllByRole('button', {
    name: FA_MORE_OPTIONS_LABEL,
  });

  await user.click(rowMenuButtons[rowIndex]);
  await user.click(await screen.findByText(FA_REMOVE_OPTION_LABEL));
};

describe('SettingsDataModelFieldSelectForm', () => {
  let consoleErrorSpy: jest.SpyInstance<void, unknown[]>;

  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
    // jsdom lacks the pointer and animation APIs dnd-kit relies on.
    window.PointerEvent ??= MouseEvent as typeof PointerEvent;
    document.getAnimations ??= () => [];
    Element.prototype.getAnimations ??= () => [];
  });

  beforeEach(() => {
    resetJotaiStore();
    consoleErrorSpy = jest.spyOn(console, 'error');
  });

  afterEach(() => {
    const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((args) =>
      args.some(
        (arg) => typeof arg === 'string' && arg.includes('the same key'),
      ),
    );

    consoleErrorSpy.mockRestore();
    expect(duplicateKeyWarnings).toEqual([]);
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

    describe('duplicate options', () => {
      it('flags both duplicate rows and clears once one is renamed', async () => {
        const user = userEvent.setup();

        renderSelectForm({ locale: 'fa-IR', fieldType });

        await renameOption(user, 0, PRE_REGISTRATION_LABEL);
        await user.click(
          screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
        );
        await renameOption(user, 1, PRE_REGISTRATION_LABEL);

        expect(getOptionLabels()).toEqual([
          PRE_REGISTRATION_LABEL,
          PRE_REGISTRATION_LABEL,
        ]);
        expect(screen.getAllByText(FA_DUPLICATE_ERROR)).toHaveLength(2);
        expect(getFormValidity()).toBe('false');
        getOptionLabelInputs().forEach((input) => expect(input).toBeEnabled());

        await renameOption(user, 1, FINAL_REGISTRATION_LABEL);

        expect(getOptionLabels()).toEqual([
          PRE_REGISTRATION_LABEL,
          FINAL_REGISTRATION_LABEL,
        ]);
        expect(screen.queryByText(FA_DUPLICATE_ERROR)).not.toBeInTheDocument();
        expect(getFormValidity()).toBe('true');
      });

      it('removes only the new duplicate of a persisted option', async () => {
        const user = userEvent.setup();

        renderSelectForm({
          locale: 'fa-IR',
          fieldType,
          existingOptions: [
            buildOption('persisted-pre', PRE_REGISTRATION_LABEL, 0),
            buildOption('persisted-final', FINAL_REGISTRATION_LABEL, 1),
          ],
        });

        await user.click(
          screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
        );
        await renameOption(user, 2, PRE_REGISTRATION_LABEL);

        expect(screen.getAllByText(FA_DUPLICATE_ERROR)).toHaveLength(2);
        expect(getFormValidity()).toBe('false');

        const [persistedPreInput, persistedFinalInput] = getOptionLabelInputs();

        await removeOption(user, 2);

        expect(getOptionLabels()).toEqual([
          PRE_REGISTRATION_LABEL,
          FINAL_REGISTRATION_LABEL,
        ]);
        expect(getOptionLabelInputs()).toEqual([
          persistedPreInput,
          persistedFinalInput,
        ]);
        expect(screen.queryByText(FA_DUPLICATE_ERROR)).not.toBeInTheDocument();
        expect(getFormValidity()).toBe('true');
      });

      it('removes the persisted duplicate and keeps its twin row', async () => {
        const user = userEvent.setup();

        renderSelectForm({
          locale: 'fa-IR',
          fieldType,
          existingOptions: [
            buildOption('persisted-pre', PRE_REGISTRATION_LABEL, 0),
            buildOption('persisted-final', FINAL_REGISTRATION_LABEL, 1),
          ],
        });

        await user.click(
          screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
        );
        await renameOption(user, 2, PRE_REGISTRATION_LABEL);

        const [, persistedFinalInput, newDuplicateInput] =
          getOptionLabelInputs();

        await removeOption(user, 0);

        expect(getOptionLabels()).toEqual([
          FINAL_REGISTRATION_LABEL,
          PRE_REGISTRATION_LABEL,
        ]);
        expect(getOptionLabelInputs()).toEqual([
          persistedFinalInput,
          newDuplicateInput,
        ]);
        expect(screen.queryByText(FA_DUPLICATE_ERROR)).not.toBeInTheDocument();
        expect(getFormValidity()).toBe('true');
      });

      it('keeps a duplicated default option removable on a required field', async () => {
        const user = userEvent.setup();
        const preRegistrationDefaultValue = `'${computeOptionValueFromLabel(
          PRE_REGISTRATION_LABEL,
        )}'`;

        renderSelectForm({
          locale: 'fa-IR',
          fieldType,
          isNullable: false,
          existingDefaultValue:
            fieldType === FieldMetadataType.SELECT
              ? preRegistrationDefaultValue
              : [preRegistrationDefaultValue],
          existingOptions: [
            buildOption('persisted-pre', PRE_REGISTRATION_LABEL, 0),
          ],
        });

        await user.click(
          screen.getByRole('button', { name: ADD_OPTION_LABELS['fa-IR'] }),
        );
        await renameOption(user, 1, PRE_REGISTRATION_LABEL);

        const [, ...rowMenuButtons] = screen.getAllByRole('button', {
          name: FA_MORE_OPTIONS_LABEL,
        });

        rowMenuButtons.forEach((button) => expect(button).toBeEnabled());
        expect(screen.getAllByText(FA_DUPLICATE_ERROR)).toHaveLength(2);

        const [, newDuplicateInput] = getOptionLabelInputs();

        await removeOption(user, 0);

        expect(getOptionLabelInputs()).toEqual([newDuplicateInput]);
        expect(screen.queryByText(FA_DUPLICATE_ERROR)).not.toBeInTheDocument();
        expect(getFormValidity()).toBe('true');
      });
    });
  });
});
