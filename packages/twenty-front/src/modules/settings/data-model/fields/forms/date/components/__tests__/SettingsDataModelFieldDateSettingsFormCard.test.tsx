import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enUS, faIR } from 'date-fns/locale';
import { Provider as JotaiProvider } from 'jotai';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import {
  FieldDateDisplayFormat,
  type FieldDateMetadataSettings,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { SettingsDataModelFieldDateSettingsFormCard } from '@/settings/data-model/fields/forms/date/components/SettingsDataModelFieldDateSettingsFormCard';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { UserContext } from '@/users/contexts/UserContext';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { dateLocaleState } from '~/localization/states/dateLocaleState';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';
import { formatDateString } from '~/utils/string/formatDateString';

const PREVIEW_DATE = '2028-09-29';

jest.mock(
  '@/settings/data-model/fields/preview/components/SettingsDataModelFieldPreviewWidget',
  () => {
    const { DateDisplay } = jest.requireActual(
      '@/ui/field/display/components/DateDisplay',
    );

    return {
      SettingsDataModelFieldPreviewWidget: ({
        fieldMetadataItem,
      }: {
        fieldMetadataItem: { settings: FieldDateMetadataSettings };
      }) => (
        <div data-testid="date-field-preview">
          <DateDisplay
            value="2028-09-29"
            dateFieldSettings={fieldMetadataItem.settings}
          />
        </div>
      ),
    };
  },
);

jest.mock(
  '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIsUniqueForm',
  () => ({ SettingsDataModelFieldIsUniqueForm: () => null }),
);

type Locale = 'en' | 'fa-IR';

type DateSettingsFormValues = {
  label: string;
  icon: string;
  settings?: FieldDateMetadataSettings;
};

const LOCALE_CATALOGS = { en: enUS, 'fa-IR': faIR };

const DISPLAY_FORMAT_LABELS = {
  en: { default: 'Default', relative: 'Relative', custom: 'Custom' },
  'fa-IR': {
    default: 'پیش\u200cفرض',
    relative: 'نسبت به امروز',
    custom: 'سفارشی',
  },
};

const STORED_CUSTOM_SETTINGS: FieldDateMetadataSettings = {
  displayFormat: FieldDateDisplayFormat.CUSTOM,
  customUnicodeDateFormat: 'yyyy/MM/dd',
};

const formatPreview = (
  locale: Locale,
  dateFieldSettings: FieldDateMetadataSettings,
) =>
  formatDateString({
    value: PREVIEW_DATE,
    timeZone: 'UTC',
    dateFormat: DateFormat.DAY_FIRST,
    dateFieldSettings,
    localeCatalog: LOCALE_CATALOGS[locale],
  });

const renderDateSettingsFormCard = (
  locale: Locale,
  storedSettings?: FieldDateMetadataSettings,
) => {
  jotaiStore.set(dateLocaleState.atom, {
    locale,
    localeCatalog: LOCALE_CATALOGS[locale],
  });
  act(() => {
    i18n.activate(locale);
  });

  const formRef: { current?: UseFormReturn<DateSettingsFormValues> } = {};

  const DateSettingsForm = () => {
    const formConfig = useForm<DateSettingsFormValues>({
      defaultValues: {
        label: 'Start date',
        icon: 'IconCalendarEvent',
        settings: storedSettings,
      },
    });
    formRef.current = formConfig;
    // Subscribes the proxy so dirty state is tracked for the assertions.
    void formConfig.formState.dirtyFields;

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelFieldDateSettingsFormCard
          fieldType={FieldMetadataType.DATE}
          existingFieldMetadataId=""
          objectNameSingular="academyEvent"
        />
      </FormProvider>
    );
  };

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <UserContext.Provider
          value={{
            dateFormat: DateFormat.DAY_FIRST,
            timeFormat: TimeFormat.HOUR_24,
            timeZone: 'UTC',
          }}
        >
          <DateSettingsForm />
        </UserContext.Provider>
      </I18nProvider>
    </JotaiProvider>,
  );

  const getForm = () => {
    if (!formRef.current) {
      throw new Error('Form is not rendered');
    }
    return formRef.current;
  };

  return { getForm };
};

const getPreviewText = () =>
  screen.getByTestId('date-field-preview').textContent;

const openDisplayFormatOptions = async (
  user: ReturnType<typeof userEvent.setup>,
  currentLabel: string,
) => {
  await user.click(screen.getByText(currentLabel));
  await screen.findAllByRole('option');

  return screen.getAllByRole('option').map((option) => option.textContent);
};

const selectDisplayFormat = async (
  user: ReturnType<typeof userEvent.setup>,
  currentLabel: string,
  nextLabel: string,
) => {
  await user.click(screen.getByText(currentLabel));
  await user.click(await screen.findByRole('option', { name: nextLabel }));
};

const queryCustomFormatInput = () => screen.queryByPlaceholderText(/d-MMM-y/);

const typeCustomFormat = (format: string) => {
  const input = queryCustomFormatInput();

  if (!input) {
    throw new Error('Custom format input is not rendered');
  }

  fireEvent.change(input, { target: { value: format } });
};

const queryPersianCalendarNotice = () =>
  screen.queryByText(/Gregorian calendar|تقویم میلادی/);

describe('SettingsDataModelFieldDateSettingsFormCard', () => {
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

  describe('fa-IR (persian calendar)', () => {
    const labels = DISPLAY_FORMAT_LABELS['fa-IR'];

    it('only offers the relative and default display formats', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('fa-IR');

      const options = await openDisplayFormatOptions(user, labels.default);

      expect(options).toEqual([labels.relative, labels.default]);
      expect(options).not.toContain(labels.custom);
    });

    it('shows neither the custom format input nor a calendar notice', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('fa-IR');

      const defaultPreview = formatPreview('fa-IR', {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      });
      const relativePreview = formatPreview('fa-IR', {
        displayFormat: FieldDateDisplayFormat.RELATIVE,
      });

      expect(getPreviewText()).toBe(defaultPreview);

      await selectDisplayFormat(user, labels.default, labels.relative);
      expect(getPreviewText()).toBe(relativePreview);

      await selectDisplayFormat(user, labels.relative, labels.default);
      expect(getPreviewText()).toBe(defaultPreview);

      expect(queryCustomFormatInput()).toBeNull();
      expect(queryPersianCalendarNotice()).toBeNull();
    });

    it('preserves a stored custom format without dirtying the form', async () => {
      const { getForm } = renderDateSettingsFormCard(
        'fa-IR',
        STORED_CUSTOM_SETTINGS,
      );

      expect(screen.getByText(labels.default)).toBeInTheDocument();
      expect(screen.queryByText(labels.custom)).toBeNull();
      expect(queryCustomFormatInput()).toBeNull();
      expect(queryPersianCalendarNotice()).toBeNull();
      expect(getPreviewText()).toBe(
        formatPreview('fa-IR', {
          displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
        }),
      );
      expect(getPreviewText()).not.toMatch(/[0-9]/);

      expect(getForm().getValues('settings')).toEqual(STORED_CUSTOM_SETTINGS);
      expect(getForm().formState.isDirty).toBe(false);
      expect(getForm().formState.dirtyFields.settings).toBeUndefined();
    });

    it('only changes a stored custom format when the user picks another one', async () => {
      const user = userEvent.setup();
      const { getForm } = renderDateSettingsFormCard(
        'fa-IR',
        STORED_CUSTOM_SETTINGS,
      );

      await selectDisplayFormat(user, labels.default, labels.relative);

      expect(getForm().getValues('settings')).toEqual({
        displayFormat: FieldDateDisplayFormat.RELATIVE,
        customUnicodeDateFormat: 'yyyy/MM/dd',
      });
      expect(getPreviewText()).toBe(
        formatPreview('fa-IR', {
          displayFormat: FieldDateDisplayFormat.RELATIVE,
        }),
      );
    });
  });

  describe('en-US (gregorian calendar)', () => {
    const labels = DISPLAY_FORMAT_LABELS.en;

    it('keeps the relative, default and custom display formats', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('en');

      const options = await openDisplayFormatOptions(user, labels.default);

      expect(options).toEqual([labels.relative, labels.default, labels.custom]);
    });

    it('updates the preview live for every display format', async () => {
      const user = userEvent.setup();
      const { getForm } = renderDateSettingsFormCard('en');

      const defaultPreview = formatPreview('en', {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      });

      expect(getPreviewText()).toBe(defaultPreview);

      await selectDisplayFormat(user, labels.default, labels.relative);
      expect(getPreviewText()).toBe(
        formatPreview('en', { displayFormat: FieldDateDisplayFormat.RELATIVE }),
      );

      await selectDisplayFormat(user, labels.relative, labels.custom);
      expect(queryCustomFormatInput()).toHaveAttribute('dir', 'ltr');
      expect(queryPersianCalendarNotice()).toBeNull();

      typeCustomFormat('yyyy/MM/dd');
      expect(getPreviewText()).toBe('2028/09/29');

      typeCustomFormat('dd.MM.yyyy');
      expect(getPreviewText()).toBe('29.09.2028');
      expect(getForm().getValues('settings')).toEqual({
        displayFormat: FieldDateDisplayFormat.CUSTOM,
        customUnicodeDateFormat: 'dd.MM.yyyy',
      });

      await selectDisplayFormat(user, labels.custom, labels.default);
      expect(getPreviewText()).toBe(defaultPreview);
    });

    it('shows a stored custom format with its pattern', () => {
      const { getForm } = renderDateSettingsFormCard(
        'en',
        STORED_CUSTOM_SETTINGS,
      );

      expect(screen.getByText(labels.custom)).toBeInTheDocument();
      expect(queryCustomFormatInput()).toHaveValue('yyyy/MM/dd');
      expect(getPreviewText()).toBe('2028/09/29');
      expect(getForm().formState.isDirty).toBe(false);
    });

    it('does not crash on an invalid custom format', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('en');

      await selectDisplayFormat(user, labels.default, labels.custom);
      typeCustomFormat('yyyy jjj');

      expect(getPreviewText()).toBe('Invalid format string');

      typeCustomFormat('yyyy');
      expect(getPreviewText()).toBe('2028');
    });
  });
});
