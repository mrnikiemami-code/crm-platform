import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

const COMMAND_MENU_MESSAGES = [
  [msg`Selection`, 'Selection', 'انتخاب‌شده‌ها'],
  [msg`This object`, 'This object', 'این موجودیت'],
  [msg`Ask & find`, 'Ask & find', 'پرسش و جستجو'],
  [msg`Go to`, 'Go to', 'رفتن به'],
  [msg`Edit navigation`, 'Edit navigation', 'ویرایش ناوبری'],
  [msg`then`, 'then', 'سپس'],
] as const;

describe('command menu section headings', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  afterAll(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it.each(COMMAND_MENU_MESSAGES)(
    'translates %#',
    (descriptor, english, persian) => {
      i18n.activate('fa-IR');
      expect(i18n._(descriptor)).toBe(persian);

      i18n.activate('en');
      expect(i18n._(descriptor)).toBe(english);
    },
  );
});
