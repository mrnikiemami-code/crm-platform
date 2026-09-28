import { i18n } from '@lingui/core';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { type StepFilter, ViewFilterOperand } from 'twenty-shared/types';

import { getCoreWorkflowFilterChipLabel } from '@/object-core/workflows/utils/getCoreWorkflowFilterChipLabel';
import { CoreWorkflowFilterFieldKey } from '~/generated/graphql';
import { messages as enMessages } from '~/locales/generated/en';

i18n.load(SOURCE_LOCALE, enMessages);
i18n.activate(SOURCE_LOCALE);

// 20:45 UTC is 00:15 on the next day in Tehran.
const updatedAtFilter: StepFilter = {
  id: 'updated-at-after',
  type: 'DATE_TIME',
  stepOutputKey: CoreWorkflowFilterFieldKey.UPDATED_AT,
  operand: ViewFilterOperand.IS_AFTER,
  value: '2026-10-02T20:45:00Z',
  stepFilterGroupId: 'group',
};

describe('getCoreWorkflowFilterChipLabel', () => {
  it('formats the date value as jalali text in the user timezone for fa-IR', () => {
    expect(
      getCoreWorkflowFilterChipLabel({
        stepFilter: updatedAtFilter,
        timezone: 'Asia/Tehran',
        locale: 'fa-IR',
      }),
    ).toMatch(/۱۱ مهر ۱۴۰۵، ۰:۱۵$/);
  });

  it('formats the date value in the en app locale', () => {
    expect(
      getCoreWorkflowFilterChipLabel({
        stepFilter: updatedAtFilter,
        timezone: 'Asia/Tehran',
        locale: 'en',
      }),
    ).toMatch(/Oct 3, 2026, 12:15\sAM$/);
  });

  it('formats the date value in another non-fa app locale', () => {
    expect(
      getCoreWorkflowFilterChipLabel({
        stepFilter: updatedAtFilter,
        timezone: 'Asia/Tehran',
        locale: 'fr-FR',
      }),
    ).toMatch(/3 oct\. 2026, 00:15$/);
  });

  it('does not depend on the host locale when no app locale is given', () => {
    expect(
      getCoreWorkflowFilterChipLabel({
        stepFilter: updatedAtFilter,
        timezone: 'UTC',
      }),
    ).toMatch(/Oct 2, 2026, 8:45\sPM$/);
  });
});
