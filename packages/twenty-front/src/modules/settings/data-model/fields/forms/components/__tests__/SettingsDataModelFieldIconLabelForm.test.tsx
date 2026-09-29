import { zodResolver } from '@hookform/resolvers/zod';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import {
  type CurrentWorkspace,
  currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { SettingsDataModelFieldIconLabelForm } from '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIconLabelForm';
import { settingsFieldFormSchema } from '@/settings/data-model/fields/forms/validation-schemas/settingsFieldFormSchema';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

jest.mock('@/ui/input/components/IconPicker', () => ({
  IconPicker: () => null,
}));

type FormValues = {
  type: FieldMetadataType;
  icon: string;
  label: string;
  name: string;
  isLabelSyncedWithName?: boolean;
  settings: { displayedMaxRows: number };
};

const EXISTING_FIELD_NAMES = ['name', 'eventCode'];

const renderNewFieldForm = () => {
  const formRef: { current?: UseFormReturn<FormValues> } = {};

  const FieldForm = () => {
    const formConfig = useForm<FormValues>({
      mode: 'onTouched',
      resolver: zodResolver(
        settingsFieldFormSchema({
          existingOtherLabels: EXISTING_FIELD_NAMES,
          isCreationMode: true,
        }),
      ),
      defaultValues: {
        type: FieldMetadataType.TEXT,
        icon: 'IconTypography',
        label: '',
        name: '',
        settings: { displayedMaxRows: 0 },
      },
    });
    formRef.current = formConfig;

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelFieldIconLabelForm
          isCreationMode
          fieldType={FieldMetadataType.TEXT}
          existingFieldNames={EXISTING_FIELD_NAMES}
        />
      </FormProvider>
    );
  };

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <FieldForm />
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

const WORKSPACE_CUSTOM_APPLICATION_ID = 'workspace-custom-application-id';

const OTHER_FIELD_NAMES = ['name', 'eventCode'];

type ExistingFieldArgs = {
  type?: FieldMetadataType;
  label?: string;
  name?: string;
  isCustom?: boolean;
  isSystem?: boolean;
  isLabelSyncedWithName?: boolean;
};

const renderExistingFieldForm = ({
  type = FieldMetadataType.TEXT,
  label = 'همایش',
  name = 'hmyshH',
  isCustom = true,
  isSystem = false,
  isLabelSyncedWithName = true,
}: ExistingFieldArgs = {}) => {
  jotaiStore.set(currentWorkspaceState.atom, {
    workspaceCustomApplication: { id: WORKSPACE_CUSTOM_APPLICATION_ID },
  } as CurrentWorkspace);

  const fieldMetadataItem = {
    id: 'existing-field-id',
    type,
    label,
    name,
    icon: 'IconTypography',
    isLabelSyncedWithName,
    isSystem,
    isUIEditable: !isSystem,
    applicationId: isCustom
      ? WORKSPACE_CUSTOM_APPLICATION_ID
      : 'standard-application-id',
  } as FieldMetadataItem;

  const formRef: { current?: UseFormReturn<FormValues> } = {};

  const FieldForm = () => {
    const formConfig = useForm<FormValues>({
      mode: 'onTouched',
      resolver: zodResolver(
        settingsFieldFormSchema({
          initialName: name,
          otherFieldNames: OTHER_FIELD_NAMES,
        }),
      ),
      defaultValues: {
        type,
        icon: 'IconTypography',
        label,
        isLabelSyncedWithName,
        settings: { displayedMaxRows: 0 },
      },
    });
    formRef.current = formConfig;

    return (
      // oxlint-disable-next-line react/jsx-props-no-spreading
      <FormProvider {...formConfig}>
        <SettingsDataModelFieldIconLabelForm
          fieldMetadataItem={fieldMetadataItem}
          isCreationMode={false}
        />
      </FormProvider>
    );
  };

  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <FieldForm />
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

const validateName = async (getForm: () => UseFormReturn<FormValues>) => {
  let isValid = false;
  await act(async () => {
    isValid = await getForm().trigger('name');
  });
  return isValid;
};

describe('SettingsDataModelFieldIconLabelForm on field creation', () => {
  beforeEach(() => {
    resetJotaiStore();
  });

  afterAll(() => {
    activateLocale(SOURCE_LOCALE);
  });

  describe('with fa-IR locale', () => {
    beforeEach(() => {
      activateLocale('fa-IR');
    });

    it('shows the technical name input before a label is typed', () => {
      renderNewFieldForm();

      expect(screen.getByPlaceholderText('کد همایش')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('eventCode')).toBeInTheDocument();
      expect(screen.getByLabelText('نام فنی (API)*')).toBe(
        screen.getByPlaceholderText('eventCode'),
      );
    });

    it('suggests an editable LTR technical name for a Persian label', async () => {
      const { getForm } = renderNewFieldForm();

      await typeInto(screen.getByPlaceholderText('کد همایش'), 'کد همایش');

      const technicalNameInput = screen.getByPlaceholderText('eventCode');

      expect(technicalNameInput).toHaveValue('textField');
      expect(technicalNameInput).toHaveAttribute('dir', 'ltr');
      expect(technicalNameInput).toBeEnabled();
      expect(technicalNameInput).toBeRequired();

      await typeInto(technicalNameInput, 'eventTitle');

      expect(await validateName(getForm)).toBe(true);
      expect(getForm().getValues()).toMatchObject({
        label: 'کد همایش',
        name: 'eventTitle',
        isLabelSyncedWithName: false,
      });
    });

    it.each([
      ['', 'نام فنی الزامی است'],
      ['1event', 'نام فنی باید با حرف انگلیسی آغاز شود'],
      ['Event code', 'فقط حروف انگلیسی، عدد و قالب lowerCamelCase مجاز است'],
      ['eventCode', 'این نام فنی قبلاً استفاده شده است'],
    ])(
      'shows a localized error for the technical name %p',
      async (technicalName, expectedMessage) => {
        const { getForm } = renderNewFieldForm();

        await typeInto(screen.getByPlaceholderText('کد همایش'), 'کد همایش');
        await typeInto(screen.getByPlaceholderText('eventCode'), technicalName);

        expect(await validateName(getForm)).toBe(false);

        const error = screen.getByText(expectedMessage);

        expect(
          screen
            .getByPlaceholderText('eventCode')
            .compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      },
    );

    it('keeps label sync and hides the input for a Latin label', async () => {
      const { getForm } = renderNewFieldForm();

      await typeInto(screen.getByPlaceholderText('کد همایش'), 'Event code');

      expect(
        screen.queryByPlaceholderText('eventCode'),
      ).not.toBeInTheDocument();
      expect(getForm().getValues()).toMatchObject({
        name: 'eventCode',
        isLabelSyncedWithName: true,
      });
    });
  });

  describe('with English locale', () => {
    beforeEach(() => {
      activateLocale(SOURCE_LOCALE);
    });

    it('keeps syncing the API name from a Latin label without extra input', async () => {
      const { getForm } = renderNewFieldForm();

      expect(
        screen.queryByPlaceholderText('eventCode'),
      ).not.toBeInTheDocument();

      await typeInto(screen.getByPlaceholderText('Employees'), 'Event title');

      expect(
        screen.queryByPlaceholderText('eventCode'),
      ).not.toBeInTheDocument();
      expect(getForm().getValues()).toMatchObject({
        label: 'Event title',
        name: 'eventTitle',
        isLabelSyncedWithName: true,
      });
    });
  });
});

describe('SettingsDataModelFieldIconLabelForm on field edition', () => {
  beforeEach(() => {
    resetJotaiStore();
  });

  afterAll(() => {
    activateLocale(SOURCE_LOCALE);
  });

  describe('with fa-IR locale', () => {
    beforeEach(() => {
      activateLocale('fa-IR');
    });

    it('shows the exact stored API name of a custom field as editable LTR input', () => {
      renderExistingFieldForm();

      const technicalNameInput = screen.getByLabelText('نام فنی (API)*');

      expect(technicalNameInput).toHaveValue('hmyshH');
      expect(technicalNameInput).toHaveAttribute('dir', 'ltr');
      expect(technicalNameInput).toBeEnabled();
    });

    it('keeps the stored name valid without changes', async () => {
      const { getForm } = renderExistingFieldForm();

      expect(await validateName(getForm)).toBe(true);
    });

    it('stops label sync when the API name is edited', async () => {
      const { getForm } = renderExistingFieldForm();

      await typeInto(screen.getByLabelText('نام فنی (API)*'), 'academyTitle');

      expect(await validateName(getForm)).toBe(true);
      expect(getForm().getValues()).toMatchObject({
        name: 'academyTitle',
        isLabelSyncedWithName: false,
      });
    });

    it.each([
      ['', 'نام فنی الزامی است'],
      ['1event', 'نام فنی باید با حرف انگلیسی آغاز شود'],
      ['Event code', 'فقط حروف انگلیسی، عدد و قالب lowerCamelCase مجاز است'],
      ['eventCode', 'این نام فنی قبلاً استفاده شده است'],
    ])(
      'shows a localized error for the edited API name %p',
      async (technicalName, expectedMessage) => {
        const { getForm } = renderExistingFieldForm();

        await typeInto(screen.getByLabelText('نام فنی (API)*'), technicalName);

        expect(await validateName(getForm)).toBe(false);
        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      },
    );

    it('does not transliterate a Persian label into the stored name', async () => {
      const { getForm } = renderExistingFieldForm();

      await typeInto(screen.getByDisplayValue('همایش'), 'همایش تازه');

      expect(screen.getByLabelText('نام فنی (API)*')).toHaveValue('hmyshH');
      expect(getForm().getFieldState('name').isDirty).toBe(false);
      expect(getForm().getValues('isLabelSyncedWithName')).toBe(false);
    });

    it('shows the API name of a custom relation field as selectable read-only text', () => {
      renderExistingFieldForm({
        type: FieldMetadataType.RELATION,
        name: 'academyEvent',
      });

      const technicalName = screen.getByLabelText('نام فنی (API)');

      expect(technicalName).toHaveValue('academyEvent');
      expect(technicalName).toHaveAttribute('readonly');
      expect(technicalName).not.toBeDisabled();
      expect(technicalName).toHaveAttribute('dir', 'ltr');
    });

    it('shows the API name of a default field of a custom object as read-only', async () => {
      const { getForm } = renderExistingFieldForm({
        type: FieldMetadataType.DATE_TIME,
        label: 'Creation date',
        name: 'createdAt',
        isSystem: true,
      });

      const technicalName = screen.getByLabelText('نام فنی (API)');

      expect(technicalName).toHaveValue('createdAt');
      expect(technicalName).toHaveAttribute('readonly');

      await typeInto(screen.getByDisplayValue('Creation date'), 'Created on');

      expect(getForm().getFieldState('name').isDirty).toBe(false);
      expect(getForm().getValues('name')).toBeUndefined();
    });

    it('keeps the API name of standard fields hidden', () => {
      renderExistingFieldForm({ isCustom: false, name: 'createdAt' });

      expect(screen.queryByDisplayValue('createdAt')).not.toBeInTheDocument();
    });
  });

  describe('with English locale', () => {
    beforeEach(() => {
      activateLocale(SOURCE_LOCALE);
    });

    it('keeps syncing the API name from a Latin label', async () => {
      const { getForm } = renderExistingFieldForm({
        label: 'Event',
        name: 'event',
      });

      await typeInto(screen.getByDisplayValue('Event'), 'Event title');

      expect(screen.getByLabelText('API Name*')).toHaveValue('eventTitle');
      expect(getForm().getValues()).toMatchObject({
        name: 'eventTitle',
        isLabelSyncedWithName: true,
      });
    });
  });
});
