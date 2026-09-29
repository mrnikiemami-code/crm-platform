import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { TEXT_DATA_MODEL_SELECT_OPTIONS } from '@/settings/data-model/fields/forms/components/text/constants/TextDataModelSelectOptions';
import { messages as faMessages } from '~/locales/generated/fa-IR';

const FIELD_CONFIGURATION_MESSAGES = {
  stepTitle: msg`2. Configure field`,
  iconAndNameTitle: msg`Icon and Name`,
  iconAndNameDescription: msg`The name and icon of this field`,
  customizationTitle: msg({
    message: 'Customization',
    context: 'Field settings section',
  }),
  customizationDescription: msg`Customize field settings`,
  wrapTitle: msg`Wrap on record pages`,
  wrapDescription: msg`Display text on multiple lines`,
  uniqueTitle: msg({ message: 'Unique', context: 'Field setting' }),
  uniqueDescription: msg`Prevent from assigning the same value to different records`,
};

const translateAll = () =>
  Object.fromEntries(
    Object.entries(FIELD_CONFIGURATION_MESSAGES).map(([key, descriptor]) => [
      key,
      i18n._(descriptor),
    ]),
  );

const translateTextWrapOptions = () =>
  TEXT_DATA_MODEL_SELECT_OPTIONS.map(({ label }) => i18n._(label));

describe('field configuration copy', () => {
  afterEach(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it('should keep the English wording in the source locale', () => {
    expect(translateAll()).toEqual({
      stepTitle: '2. Configure field',
      iconAndNameTitle: 'Icon and Name',
      iconAndNameDescription: 'The name and icon of this field',
      customizationTitle: 'Customization',
      customizationDescription: 'Customize field settings',
      wrapTitle: 'Wrap on record pages',
      wrapDescription: 'Display text on multiple lines',
      uniqueTitle: 'Unique',
      uniqueDescription:
        'Prevent from assigning the same value to different records',
    });
    expect(translateTextWrapOptions()).toEqual([
      'Deactivated',
      'First 2 lines',
      'First 5 lines',
      'First 10 lines',
      'All lines',
    ]);
  });

  it('should use natural Persian wording in fa-IR', () => {
    i18n.load({ 'fa-IR': faMessages });
    i18n.activate('fa-IR');

    expect(translateAll()).toEqual({
      stepTitle: '2. تنظیمات فیلد',
      iconAndNameTitle: 'نام و آیکون',
      iconAndNameDescription: 'نام و آیکون فیلد',
      customizationTitle: 'تنظیمات بیشتر',
      customizationDescription: 'تنظیمات بیشتر برای این فیلد',
      wrapTitle: 'نمایش در صفحه رکورد',
      wrapDescription: 'نمایش متن به\u200cصورت چند\u200cخطی',
      uniqueTitle: 'مقدار یکتا',
      uniqueDescription: 'این مقدار نمی\u200cتواند در چند رکورد تکرار شود',
    });
    expect(translateTextWrapOptions()).toEqual([
      'تک\u200cخطی',
      '۲ خط اول',
      '۵ خط اول',
      '۱۰ خط اول',
      'همه خطوط',
    ]);
  });

  it('should not change the shared translations used by other screens', () => {
    i18n.load({ 'fa-IR': faMessages });
    i18n.activate('fa-IR');

    expect(i18n._(msg`Customization`)).toBe('سفارشی\u200cسازی');
    expect(i18n._(msg`Unique`)).toBe('یکتا');
    expect(i18n._(msg`Deactivated`)).toBe('غیرفعال');
  });
});
