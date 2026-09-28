import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { CalendarStartDay } from 'twenty-shared/constants';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { useGetRecordFilterDisplayValue } from '@/object-record/record-filter/hooks/useGetRecordFilterDisplayValue';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { RecordFilterOperand } from '@/object-record/record-filter/types/RecordFilterOperand';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import {
  WorkspaceMemberDateFormatEnum,
  WorkspaceMemberTimeFormatEnum,
} from '~/generated-metadata/graphql';

jest.mock('@/object-metadata/hooks/useGetFieldMetadataItemById', () => ({
  useGetFieldMetadataItemByIdOrThrow: () => ({
    getFieldMetadataItemByIdOrThrow: jest.fn(),
  }),
}));

const USER_TIME_ZONE = 'Asia/Tehran';

const setWorkspaceMember = ({
  locale,
  dateFormat,
}: {
  locale: string;
  dateFormat: WorkspaceMemberDateFormatEnum;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
    timeZone: USER_TIME_ZONE,
    dateFormat,
    timeFormat: WorkspaceMemberTimeFormatEnum.HOUR_24,
  } as CurrentWorkspaceMember);

  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    timeZone: USER_TIME_ZONE,
    dateFormat:
      dateFormat === WorkspaceMemberDateFormatEnum.DAY_FIRST
        ? DateFormat.DAY_FIRST
        : DateFormat.MONTH_FIRST,
    timeFormat: TimeFormat.HOUR_24,
    numberFormat: '1,000.00' as any,
    calendarStartDay: CalendarStartDay.MONDAY,
  });
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

const closeDateIsFilter = {
  id: 'close-date-is',
  fieldMetadataId: 'close-date',
  type: 'DATE',
  operand: RecordFilterOperand.IS,
  value: '2026-10-02',
  displayValue: '',
  label: 'Close date',
} as RecordFilter;

// 20:45 UTC is already 00:15 on the next day in Tehran.
const createdAtIsAfterFilter = {
  id: 'created-at-after',
  fieldMetadataId: 'created-at',
  type: 'DATE_TIME',
  operand: RecordFilterOperand.IS_AFTER,
  value: '2026-10-02T20:45:00Z',
  displayValue: '',
  label: 'Created at',
} as RecordFilter;

// displayValue persisted by an older, gregorian formatting of the value.
const closeDateIsBeforeFilterWithStaleDisplayValue = {
  id: 'close-date-before',
  fieldMetadataId: 'close-date',
  type: 'DATE',
  operand: RecordFilterOperand.IS_BEFORE,
  value: '2026-10-02',
  displayValue: 'Oct 2, 2026',
  label: 'Close date',
} as RecordFilter;

const renderGetRecordFilterDisplayValue = () =>
  renderHook(() => useGetRecordFilterDisplayValue(), { wrapper: Wrapper })
    .result.current.getRecordFilterDisplayValue;

describe('useGetRecordFilterDisplayValue date chips', () => {
  it('shows a jalali close date chip for fa-IR without touching the filter value', () => {
    setWorkspaceMember({
      locale: 'fa-IR',
      dateFormat: WorkspaceMemberDateFormatEnum.DAY_FIRST,
    });

    const filter = { ...closeDateIsFilter };

    expect(renderGetRecordFilterDisplayValue()(filter)).toBe('۱۰ مهر ۱۴۰۵');
    expect(filter.value).toBe('2026-10-02');
  });

  it('shows a jalali date-time chip in the user timezone across midnight for fa-IR', () => {
    setWorkspaceMember({
      locale: 'fa-IR',
      dateFormat: WorkspaceMemberDateFormatEnum.DAY_FIRST,
    });

    expect(renderGetRecordFilterDisplayValue()(createdAtIsAfterFilter)).toBe(
      '۱۱ مهر ۱۴۰۵، ۰۰:۱۵ (GMT+3:30)',
    );
  });

  it('regenerates a stale persisted date displayValue from the value for fa-IR', () => {
    setWorkspaceMember({
      locale: 'fa-IR',
      dateFormat: WorkspaceMemberDateFormatEnum.DAY_FIRST,
    });

    const filter = { ...closeDateIsBeforeFilterWithStaleDisplayValue };

    expect(renderGetRecordFilterDisplayValue()(filter)).toBe('۱۰ مهر ۱۴۰۵');
    expect(filter.value).toBe('2026-10-02');
    expect(filter.displayValue).toBe('Oct 2, 2026');
  });

  it('keeps the persisted date displayValue for en', () => {
    setWorkspaceMember({
      locale: 'en',
      dateFormat: WorkspaceMemberDateFormatEnum.MONTH_FIRST,
    });

    expect(
      renderGetRecordFilterDisplayValue()(
        closeDateIsBeforeFilterWithStaleDisplayValue,
      ),
    ).toBe(' Oct 2, 2026');
  });

  it('keeps the gregorian chips for en', () => {
    setWorkspaceMember({
      locale: 'en',
      dateFormat: WorkspaceMemberDateFormatEnum.MONTH_FIRST,
    });

    const getRecordFilterDisplayValue = renderGetRecordFilterDisplayValue();

    expect(getRecordFilterDisplayValue(closeDateIsFilter)).toBe('Oct 2, 2026');
    expect(getRecordFilterDisplayValue(createdAtIsAfterFilter)).toBe(
      'Oct 3, 2026 00:15 (GMT+3:30)',
    );
  });

  it('keeps the existing chips for another non-fa locale', () => {
    setWorkspaceMember({
      locale: 'fr-FR',
      dateFormat: WorkspaceMemberDateFormatEnum.DAY_FIRST,
    });

    expect(renderGetRecordFilterDisplayValue()(closeDateIsFilter)).toBe(
      '2 Oct, 2026',
    );
  });
});
