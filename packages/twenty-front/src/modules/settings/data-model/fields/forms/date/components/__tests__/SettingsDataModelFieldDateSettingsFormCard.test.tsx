import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enUS, faIR } from 'date-fns/locale';
import { Provider as JotaiProvider } from 'jotai';
import { FormProvider, useForm } from 'react-hook-form';
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

const LOCALE_CATALOGS = { en: enUS, 'fa-IR': faIR };

const CUSTOM_FORMAT_NOTICES = {
  en: 'Custom formats only apply to the Gregorian calendar. Persian calendar dates are shown in the default format.',
  'fa-IR':
    'قالب سفارشی فقط برای تقویم میلادی اعمال می\u200cشود. تاریخ\u200cهای شمسی با قالب پیش\u200cفرض نمایش داده می\u200cشوند.',
};

const DISPLAY_FORMAT_LABELS = {
  en: { default: 'Default', relative: 'Relative', custom: 'Custom' },
  'fa-IR': {
    default: 'پیش\u200cفرض',
    relative: 'نسبت به امروز',
    custom: 'سفارشی',
  },
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

const renderDateSettingsFormCard = (locale: Locale) => {
  jotaiStore.set(dateLocaleState.atom, {
    locale,
    localeCatalog: LOCALE_CATALOGS[locale],
  });
  act(() => {
    i18n.activate(locale);
  });

  const DateSettingsForm = () => {
    const formConfig = useForm({
      defaultValues: { label: 'Start date', icon: 'IconCalendarEvent' },
    });

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
};

const getPreviewText = () =>
  screen.getByTestId('date-field-preview').textContent;

const selectDisplayFormat = async (
  user: ReturnType<typeof userEvent.setup>,
  currentLabel: string,
  nextLabel: string,
) => {
  await user.click(screen.getByText(currentLabel));
  await user.click(await screen.findByRole('option', { name: nextLabel }));
};

const getCustomFormatInput = () => screen.getByPlaceholderText(/d-MMM-y/);

const typeCustomFormat = (format: string) => {
  fireEvent.change(getCustomFormatInput(), { target: { value: format } });
};

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

  it('labels the relative display format as "نسبت به امروز" in fa-IR', async () => {
    const user = userEvent.setup();
    renderDateSettingsFormCard('fa-IR');

    await user.click(screen.getByText(DISPLAY_FORMAT_LABELS['fa-IR'].default));

    expect(
      await screen.findByRole('option', { name: 'نسبت به امروز' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'نسبی' })).toBeNull();
  });

  it('keeps the en-US display format labels unchanged', async () => {
    const user = userEvent.setup();
    renderDateSettingsFormCard('en');

    await user.click(screen.getByText('Default'));

    for (const label of ['Default', 'Relative', 'Custom']) {
      expect(
        await screen.findByRole('option', { name: label }),
      ).toBeInTheDocument();
    }
  });

  describe('en-US (gregorian calendar)', () => {
    it('updates the preview for every display format without going stale', async () => {
      const user = userEvent.setup();
      const labels = DISPLAY_FORMAT_LABELS.en;
      renderDateSettingsFormCard('en');

      const defaultPreview = formatPreview('en', {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      });
      const relativePreview = formatPreview('en', {
        displayFormat: FieldDateDisplayFormat.RELATIVE,
      });

      expect(getPreviewText()).toBe(defaultPreview);

      await selectDisplayFormat(user, labels.default, labels.relative);
      expect(getPreviewText()).toBe(relativePreview);
      expect(relativePreview).not.toBe(defaultPreview);

      await selectDisplayFormat(user, labels.relative, labels.custom);
      typeCustomFormat('yyyy/MM/dd');
      expect(getPreviewText()).toBe('2028/09/29');

      typeCustomFormat('dd.MM.yyyy');
      expect(getPreviewText()).toBe('29.09.2028');

      await selectDisplayFormat(user, labels.custom, labels.default);
      expect(getPreviewText()).toBe(defaultPreview);
    });

    it('keeps the custom format input LTR and hides the persian calendar notice', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('en');

      await selectDisplayFormat(user, 'Default', 'Custom');

      expect(getCustomFormatInput()).toHaveAttribute('dir', 'ltr');
      expect(screen.queryByText(CUSTOM_FORMAT_NOTICES.en)).toBeNull();
    });

    it('does not crash on an invalid custom format', async () => {
      const user = userEvent.setup();
      renderDateSettingsFormCard('en');

      await selectDisplayFormat(user, 'Default', 'Custom');
      typeCustomFormat('yyyy jjj');

      expect(getPreviewText()).toBe('Invalid format string');

      typeCustomFormat('yyyy');
      expect(getPreviewText()).toBe('2028');
    });
  });

  describe('fa-IR (persian calendar)', () => {
    it('explains that custom formats do not apply and keeps a jalali preview', async () => {
      const user = userEvent.setup();
      const labels = DISPLAY_FORMAT_LABELS['fa-IR'];
      renderDateSettingsFormCard('fa-IR');

      const defaultPreview = formatPreview('fa-IR', {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      });
      const relativePreview = formatPreview('fa-IR', {
        displayFormat: FieldDateDisplayFormat.RELATIVE,
      });

      expect(getPreviewText()).toBe(defaultPreview);
      expect(screen.queryByText(CUSTOM_FORMAT_NOTICES['fa-IR'])).toBeNull();

      await selectDisplayFormat(user, labels.default, labels.relative);
      expect(getPreviewText()).toBe(relativePreview);
      expect(relativePreview).not.toBe(defaultPreview);

      await selectDisplayFormat(user, labels.relative, labels.custom);
      expect(screen.getByText(CUSTOM_FORMAT_NOTICES['fa-IR'])).toBeVisible();
      expect(getCustomFormatInput()).toHaveAttribute('dir', 'ltr');

      for (const format of ['yyyy/MM/dd', 'dd MMMM yyyy']) {
        typeCustomFormat(format);
        expect(getPreviewText()).toBe(defaultPreview);
        expect(getPreviewText()).not.toMatch(/[0-9]/);
        expect(getPreviewText()).not.toContain('۲۰۲۸');
      }

      await selectDisplayFormat(user, labels.custom, labels.relative);
      expect(getPreviewText()).toBe(relativePreview);
      expect(screen.queryByText(CUSTOM_FORMAT_NOTICES['fa-IR'])).toBeNull();
    });
  });
});
