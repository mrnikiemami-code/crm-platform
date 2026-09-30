import { setupI18n } from '@lingui/core';

import { messages as enMessages } from 'src/engine/core-modules/i18n/locales/generated/en';
import { messages as faMessages } from 'src/engine/core-modules/i18n/locales/generated/fa-IR';
import {
  localizeStandardFieldOptions,
  restoreCanonicalStandardFieldOptionLabels,
} from 'src/engine/metadata-modules/field-metadata/utils/localize-standard-field-options.util';

const faI18n = {
  locale: 'fa-IR' as const,
  i18nInstance: setupI18n({
    locale: 'fa-IR',
    messages: { 'fa-IR': faMessages },
  }),
};
const enI18n = {
  locale: 'en' as const,
  i18nInstance: setupI18n({ locale: 'en', messages: { en: enMessages } }),
};

const TODO_ID = '20202020-3d31-4860-ad07-5c4603d44887';
const IN_PROGRESS_ID = '20202020-c559-4f8e-8b8e-21136da8684d';
const DONE_ID = '20202020-c7a7-43ff-8226-f6a97a32759e';

const taskStatusOptions = [
  { id: TODO_ID, value: 'TODO', label: 'To do', position: 0, color: 'sky' },
  {
    id: IN_PROGRESS_ID,
    value: 'IN_PROGRESS',
    label: 'In progress',
    position: 1,
    color: 'purple',
  },
  { id: DONE_ID, value: 'DONE', label: 'Done', position: 2, color: 'green' },
];

describe('localizeStandardFieldOptions', () => {
  it('localizes untouched standard task status options in fa-IR', () => {
    const localized = localizeStandardFieldOptions(taskStatusOptions, faI18n);

    expect(localized.map(({ label }) => label)).toEqual([
      'برای انجام',
      'در حال انجام',
      'انجام‌شده',
    ]);
    expect(localized.map(({ value }) => value)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'DONE',
    ]);
  });

  it('keeps the canonical labels in en', () => {
    expect(
      localizeStandardFieldOptions(taskStatusOptions, enI18n).map(
        ({ label }) => label,
      ),
    ).toEqual(['To do', 'In progress', 'Done']);
  });

  it('does not mutate the stored options', () => {
    const stored = structuredClone(taskStatusOptions);

    localizeStandardFieldOptions(stored, faI18n);

    expect(stored).toEqual(taskStatusOptions);
  });

  it.each(['تحویل‌شده به مشتری', 'Completed'])(
    'preserves a user-renamed standard option (%s)',
    (renamedLabel) => {
      const [localized] = localizeStandardFieldOptions(
        [{ id: DONE_ID, value: 'DONE', label: renamedLabel }],
        faI18n,
      );

      expect(localized.label).toBe(renamedLabel);
    },
  );

  it('preserves a user-created option that reuses a standard English label', () => {
    const [localized] = localizeStandardFieldOptions(
      [
        {
          id: 'a1b2c3d4-0000-4000-8000-000000000000',
          value: 'DONE',
          label: 'Done',
        },
      ],
      faI18n,
    );

    expect(localized.label).toBe('Done');
  });

  it('ignores non-array options', () => {
    expect(localizeStandardFieldOptions(null, faI18n)).toBeNull();
  });
});

describe('restoreCanonicalStandardFieldOptionLabels', () => {
  it('restores canonical labels submitted back in their localized form', () => {
    const submitted = localizeStandardFieldOptions(taskStatusOptions, faI18n);

    expect(
      restoreCanonicalStandardFieldOptionLabels(submitted, faI18n),
    ).toEqual(taskStatusOptions);
  });

  it('keeps user-authored labels and custom options unchanged', () => {
    const submitted = [
      { id: DONE_ID, value: 'DONE', label: 'تحویل‌شده به مشتری' },
      {
        id: 'a1b2c3d4-0000-4000-8000-000000000000',
        value: 'CUSTOM',
        label: 'برای انجام',
      },
    ];

    expect(
      restoreCanonicalStandardFieldOptionLabels(submitted, faI18n),
    ).toEqual(submitted);
  });
});
