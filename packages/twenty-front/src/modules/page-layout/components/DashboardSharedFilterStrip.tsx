import { DashboardSharedDateField } from '@/page-layout/components/DashboardSharedDateField';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { useDashboardSharedFilter } from '@/page-layout/hooks/useDashboardSharedFilter';
import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  type DashboardSharedSourceFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import { resolveDashboardSharedDateBounds } from '@/page-layout/utils/resolveDashboardSharedDateBounds';
import { Select } from '@/ui/input/components/Select';
import { useLingui } from '@lingui/react';
import { msg, t } from '@lingui/core/macro';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { getLocaleTextDirection, SOURCE_LOCALE } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';
import { IconChevronDown, IconChevronUp } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledStrip = styled.div`
  align-items: flex-end;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: 100%;
  z-index: 2;
`;

const StyledControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 148px;
`;

const StyledStatus = styled.div<{ $active: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.color.blue10
      : themeCssVariables.background.transparent.light};
  border: 1px solid
    ${({ $active }) =>
      $active
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ $active }) =>
    $active
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
  flex: 1 1 100%;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledEmptyDateBanner = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  flex: 1 1 100%;
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledNoteToggle = styled.button`
  align-items: center;
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledNoteBody = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1 1 100%;
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  max-width: 100%;
  padding-block-end: ${themeCssVariables.spacing[1]};

  a {
    color: ${themeCssVariables.font.color.secondary};
  }
`;

export const DashboardSharedFilterStrip = () => {
  const { i18n } = useLingui();
  const { sharedFilter, updateSharedFilter, clearSharedFilter } =
    useDashboardSharedFilter();
  const { timeZone } = useDateTimeFormat();
  const direction = getLocaleTextDirection(i18n.locale);
  const isPersianUi = i18n.locale !== SOURCE_LOCALE;
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const dateBounds = resolveDashboardSharedDateBounds({
    dateFrom: sharedFilter.dateFrom,
    dateTo: sharedFilter.dateTo,
    timeZone,
  });

  const sourceOptions = [
    {
      value: DASHBOARD_SHARED_SOURCE_FILTER.ALL,
      label: isPersianUi ? 'همه منابع' : t(msg`All sources`),
    },
    {
      value: DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM,
      label: isPersianUi ? 'اینستاگرام' : t(msg`Instagram`),
    },
    {
      value: DASHBOARD_SHARED_SOURCE_FILTER.VOICE,
      label: isPersianUi ? 'پیام صوتی' : t(msg`Voice message`),
    },
  ];

  const hasDateFilter =
    isDefined(sharedFilter.dateFrom) || isDefined(sharedFilter.dateTo);
  const hasActiveFilter =
    sharedFilter.source !== DASHBOARD_SHARED_SOURCE_FILTER.ALL || hasDateFilter;

  const dateStatusLabel = !hasDateFilter
    ? isPersianUi
      ? 'تاریخ: همه (شامل بدون‌تاریخ)'
      : t`Date: all-time (includes undated)`
    : dateBounds.status === 'invalid'
      ? isPersianUi
        ? 'تاریخ: نامعتبر — اعمال نشده'
        : t`Date: invalid — not applied`
      : isPersianUi
        ? 'تاریخ: فیلتر فعال'
        : t`Date: filter active`;

  return (
    <StyledStrip dir={direction} data-testid="dashboard-shared-filter-strip">
      <StyledControl>
        <Select
          dropdownId="dashboard-shared-source-filter"
          label={isPersianUi ? 'منبع' : t`Source`}
          value={sharedFilter.source}
          options={sourceOptions}
          onChange={(value: DashboardSharedSourceFilter) =>
            updateSharedFilter({ ...sharedFilter, source: value })
          }
          fullWidth
          selectSizeVariant="small"
        />
      </StyledControl>

      <StyledControl>
        <DashboardSharedDateField
          dropdownId="dashboard-shared-date-from"
          label={isPersianUi ? 'از تاریخ' : t`From`}
          placeholder={isPersianUi ? 'خالی' : t`Empty`}
          value={sharedFilter.dateFrom}
          onCommit={(dateFrom) =>
            updateSharedFilter({ ...sharedFilter, dateFrom })
          }
        />
      </StyledControl>

      <StyledControl>
        <DashboardSharedDateField
          dropdownId="dashboard-shared-date-to"
          label={isPersianUi ? 'تا تاریخ' : t`To`}
          placeholder={isPersianUi ? 'خالی' : t`Empty`}
          value={sharedFilter.dateTo}
          onCommit={(dateTo) =>
            updateSharedFilter({ ...sharedFilter, dateTo })
          }
        />
      </StyledControl>

      <Button
        onClick={clearSharedFilter}
        variant="secondary"
        size="small"
        disabled={!hasActiveFilter}
      >
        {isPersianUi ? 'پاک کردن فیلتر' : t`Clear filters`}
      </Button>

      <StyledStatus
        $active={hasDateFilter && dateBounds.status === 'ok'}
        data-testid="dashboard-shared-date-status"
      >
        {dateStatusLabel}
      </StyledStatus>

      <StyledNoteToggle
        type="button"
        aria-expanded={isNoteOpen}
        onClick={() => setIsNoteOpen((open) => !open)}
      >
        {isNoteOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        {isPersianUi ? 'راهنما' : t`Guide`}
      </StyledNoteToggle>

      {isNoteOpen && (
        <StyledNoteBody data-testid="dashboard-shared-filter-guide">
          {isPersianUi ? (
            <>
              بدون فیلتر تاریخ = همه رکوردها (شامل بدون‌تاریخ). با بازه، فقط
              رکوردهای دارای تاریخ فعالیت واقعی. منبع: همه / اینستاگرام / پیام
              صوتی؛ سرنخ دوتایی در هر دو. واریزی‌ها برای منبع بدون اتصال
              یک‌گامی. رتبه تماس ≠ برنده فروش. مرحله فعلی ≠ قیف تاریخی.{' '}
              <a href="/objects/eventLeads?viewId=143e2990-1b0e-4562-a7e7-558db58af293">
                سرنخ‌های بدون اقدام
              </a>
            </>
          ) : (
            t`No date filter = all records (including undated). With a range, only rows with real activity timestamps. Source: all / Instagram / voice; dual-tagged leads count in each. Payments are unscoped for source. Call ranking ≠ sales winner. Current stage ≠ historical funnel.`
          )}
        </StyledNoteBody>
      )}

      {dateBounds.status === 'invalid' && (
        <StyledError>
          {dateBounds.reason === 'reversed'
            ? isPersianUi
              ? 'تاریخ شروع باید قبل یا برابر تاریخ پایان باشد.'
              : t`From must be on or before To.`
            : isPersianUi
              ? 'تاریخ نامعتبر است.'
              : t`Could not parse the selected dates.`}
        </StyledError>
      )}

      {dateBounds.status === 'ok' && (
        <StyledEmptyDateBanner data-testid="dashboard-shared-date-empty-banner">
          {isPersianUi
            ? 'در بازه انتخاب‌شده داده دارای تاریخ فعالیت ثبت نشده است. بدون‌تاریخ‌ها از نتیجه حذف می‌شوند؛ با پاک کردن تاریخ، همه رکوردها برمی‌گردند.'
            : t`No activity-dated records in the selected range. Undated rows are excluded while a date filter is active; clear dates to restore all-time totals.`}
        </StyledEmptyDateBanner>
      )}
    </StyledStrip>
  );
};
