import { zodResolver } from '@hookform/resolvers/zod';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { SETTINGS_OBJECT_MODEL_IS_LABEL_SYNCED_WITH_NAME_LABEL_DEFAULT_VALUE } from '@/settings/constants/SettingsObjectModel';
import { SettingsDataModelObjectAboutForm } from '@/settings/data-model/objects/forms/components/SettingsDataModelObjectAboutForm';
import {
  type SettingsDataModelObjectAboutFormValues,
  settingsDataModelObjectAboutFormSchema,
} from '@/settings/data-model/validation-schemas/settingsDataModelObjectAboutFormSchema';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

jest.mock('@/ui/input/components/IconPicker', () => ({
  IconPicker: () => null,
}));

type FormValues = SettingsDataModelObjectAboutFormValues;

const renderNewObjectForm = ({
  conflictingObjectMetadataItem,
}: {
  conflictingObjectMetadataItem?: EnrichedObjectMetadataItem;
} = {}) => {
  const formRef: { current?: UseFormReturn<FormValues> } = {};

  const NewObjectForm = () => {
    const formConfig = useForm<FormValues>({
      mode: 'onChange',
      resolver: zodResolver(settingsDataModelObjectAboutFormSchema),
      defaultValues: {
        color: 'gray',
        isLabelSyncedWithName:
          SETTINGS_OBJECT_MODEL_IS_LABEL_SYNCED_WITH_NAME_LABEL_DEFAULT_VALUE,
      },
    });
    formRef.current = formConfig;

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelObjectAboutForm
          onNewDirtyField={() => formConfig.trigger()}
          conflictingObjectMetadataItem={conflictingObjectMetadataItem}
        />
      </FormProvider>
    );
  };

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <NewObjectForm />
        </MemoryRouter>
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

const typeInto = async (input: HTMLElement, value: string) => {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
};

const activateLocale = (locale: 'fa-IR' | typeof SOURCE_LOCALE) => {
  act(() => {
    i18n.load(locale, locale === 'fa-IR' ? faMessages : enMessages);
    i18n.activate(locale);
  });
};

describe('SettingsDataModelObjectAboutForm on object creation', () => {
  beforeEach(() => {
    resetJotaiStore();
  });

  afterAll(() => {
    activateLocale(SOURCE_LOCALE);
  });

  describe('with fa-IR locale and Persian labels', () => {
    beforeEach(() => {
      activateLocale('fa-IR');
    });

    it('requires an explicit technical name instead of transliterating labels', async () => {
      const { getForm } = renderNewObjectForm();

      await typeInto(screen.getByLabelText('مفرد'), 'همایش');
      await typeInto(screen.getByLabelText('جمع'), 'همایش‌ها');

      expect(getForm().getValues('isLabelSyncedWithName')).toBe(false);
      expect(getForm().getValues('nameSingular') ?? '').toBe('');
      expect(getForm().getValues('namePlural') ?? '').toBe('');
      expect(
        screen.getByText(
          'برچسب‌ها شامل نویسه‌های غیرلاتین هستند. نام فنی را با حروف لاتین وارد کنید (مثلاً academyEvent).',
        ),
      ).toBeInTheDocument();

      let isValid = true;
      await act(async () => {
        isValid = await getForm().trigger();
      });

      expect(isValid).toBe(false);
      expect(screen.getAllByText('نام فنی الزامی است')).toHaveLength(2);
    });

    it('creates metadata names from an explicit technical name and keeps Persian labels', async () => {
      const { getForm } = renderNewObjectForm();

      await typeInto(screen.getByLabelText('مفرد'), 'همایش');
      await typeInto(screen.getByLabelText('جمع'), 'همایش‌ها');

      const technicalNameSingularInput = screen.getByPlaceholderText('listing');
      const technicalNamePluralInput = screen.getByPlaceholderText('listings');

      expect(technicalNameSingularInput).toHaveAttribute('dir', 'ltr');
      expect(technicalNamePluralInput).toHaveAttribute('dir', 'ltr');
      expect(technicalNameSingularInput).toBeEnabled();
      expect(screen.getByLabelText('مفرد')).not.toHaveAttribute('dir');

      await typeInto(technicalNameSingularInput, 'academyEvent');

      let isValid = false;
      await act(async () => {
        isValid = await getForm().trigger();
      });

      expect(getForm().formState.errors).toEqual({});
      expect(isValid).toBe(true);
      expect(getForm().getValues()).toMatchObject({
        labelSingular: 'همایش',
        labelPlural: 'همایش‌ها',
        nameSingular: 'academyEvent',
        namePlural: 'academyEvents',
        isLabelSyncedWithName: false,
      });
    });

    it('shows a localized error for invalid technical names', async () => {
      const { getForm } = renderNewObjectForm();

      await typeInto(screen.getByLabelText('مفرد'), 'همایش');
      await typeInto(screen.getByPlaceholderText('listing'), '1همایش');

      expect(getForm().getFieldState('nameSingular').invalid).toBe(true);
      expect(
        screen.getAllByText(
          'فقط از حروف لاتین و اعداد به‌صورت camelCase استفاده کنید و با حرف کوچک شروع کنید (مثلاً academyEvent)',
        ).length,
      ).toBeGreaterThan(0);
    });

    it('shows a localized error when the technical name is already used', async () => {
      renderNewObjectForm({
        conflictingObjectMetadataItem: {
          nameSingular: 'academyEvent',
          namePlural: 'academyEventList',
        } as EnrichedObjectMetadataItem,
      });

      await typeInto(screen.getByLabelText('مفرد'), 'همایش');
      await typeInto(screen.getByPlaceholderText('listing'), 'academyEvent');

      expect(
        screen.getByText('این نام فنی قبلاً برای موجودیت دیگری استفاده شده است'),
      ).toBeInTheDocument();
    });
  });

  describe('with English locale and Latin labels', () => {
    beforeEach(() => {
      activateLocale(SOURCE_LOCALE);
    });

    it('keeps suggesting synchronized API names from the labels', async () => {
      const { getForm } = renderNewObjectForm();

      await typeInto(screen.getByLabelText('Singular'), 'Academy event');

      expect(getForm().getValues()).toMatchObject({
        labelSingular: 'Academy event',
        labelPlural: 'Academy events',
        nameSingular: 'academyEvent',
        namePlural: 'academyEvents',
        isLabelSyncedWithName: true,
      });
      expect(screen.queryByPlaceholderText('listing')).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          'The labels contain non-Latin characters. Enter the technical name in Latin letters (e.g. academyEvent).',
        ),
      ).not.toBeInTheDocument();
    });
  });
});
