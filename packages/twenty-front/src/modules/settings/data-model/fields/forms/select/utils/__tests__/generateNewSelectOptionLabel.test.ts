import { i18n } from '@lingui/core';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { generateNewSelectOption } from '@/settings/data-model/fields/forms/select/utils/generateNewSelectOption';
import { generateNewSelectOptionLabel } from '@/settings/data-model/fields/forms/select/utils/generateNewSelectOptionLabel';
import { messages as enMessages } from '~/locales/generated/en';
import { messages as faMessages } from '~/locales/generated/fa-IR';

describe('generateNewSelectOptionLabel', () => {
  beforeAll(() => {
    i18n.load({ en: enMessages, 'fa-IR': faMessages });
  });

  afterAll(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  describe('en', () => {
    beforeEach(() => {
      i18n.activate('en');
    });

    it('generates a new select option label', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'Option 2' },
        { label: 'Lorem ipsum' },
      ];

      const newLabel = generateNewSelectOptionLabel(options);

      expect(newLabel).toBe('Option 4');
    });

    it('iterates until it finds an unique label', () => {
      const options = [
        { label: 'Option 1' },
        { label: 'Option 2' },
        { label: 'Option 4' },
        { label: 'Option 5' },
      ];

      const newLabel = generateNewSelectOptionLabel(options);

      expect(newLabel).toBe('Option 6');
    });

    it('labels the first default option', () => {
      expect(generateNewSelectOptionLabel([])).toBe('Option 1');
    });
  });

  describe('fa-IR', () => {
    beforeEach(() => {
      i18n.activate('fa-IR');
    });

    it('generates a Persian label with Persian digits', () => {
      const options = [
        { label: 'گزینه ۱' },
        { label: 'گزینه ۲' },
        { label: 'لورم' },
      ];

      expect(generateNewSelectOptionLabel(options)).toBe('گزینه ۴');
      expect(generateNewSelectOptionLabel([])).toBe('گزینه ۱');
    });

    it('iterates until it finds an unique Persian label', () => {
      const options = [
        { label: 'گزینه ۱' },
        { label: 'گزینه ۲' },
        { label: 'گزینه ۴' },
        { label: 'گزینه ۵' },
      ];

      expect(generateNewSelectOptionLabel(options)).toBe('گزینه ۶');
    });

    it('keeps existing option labels untouched', () => {
      const options = [
        { label: 'Option 1', value: 'OPTION_1' },
        { label: 'Option 2', value: 'OPTION_2' },
      ];
      const snapshot = structuredClone(options);

      expect(generateNewSelectOptionLabel(options)).toBe('گزینه ۳');
      expect(options).toEqual(snapshot);
    });

    it('builds the next option with a Persian label and an ASCII value', () => {
      const newOption = generateNewSelectOption([
        {
          id: '1',
          label: 'گزینه ۱',
          value: 'GZYNH_1',
          color: 'green',
          position: 0,
        },
      ]);

      expect(newOption.label).toBe('گزینه ۲');
      expect(newOption.value).toMatch(/^[A-Z0-9_]+$/);
      expect(newOption.position).toBe(1);
    });
  });
});
