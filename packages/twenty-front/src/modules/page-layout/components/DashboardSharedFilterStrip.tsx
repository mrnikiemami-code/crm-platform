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
import { getLocaleTextDirection, SOURCE_LOCALE } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledStrip = styled.div`
  align-items: flex-end;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: 100%;
  z-index: 2;
`;

const StyledControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 160px;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1 1 220px;
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  min-width: 200px;
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
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

export const DashboardSharedFilterStrip = () => {
  const { i18n } = useLingui();
  const { sharedFilter, updateSharedFilter, clearSharedFilter } =
    useDashboardSharedFilter();
  const { timeZone } = useDateTimeFormat();
  const direction = getLocaleTextDirection(i18n.locale);
  const isPersianUi = i18n.locale !== SOURCE_LOCALE;

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

  const hasActiveFilter =
    sharedFilter.source !== DASHBOARD_SHARED_SOURCE_FILTER.ALL ||
    isDefined(sharedFilter.dateFrom) ||
    isDefined(sharedFilter.dateTo);

  const showUndatedEmptyBanner = dateBounds.status === 'ok';

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
          placeholder={isPersianUi ? 'اختیاری' : t`Optional`}
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
          placeholder={isPersianUi ? 'اختیاری' : t`Optional`}
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

      <StyledHint>
        {isPersianUi
          ? 'پیش‌فرض: همه منابع و همه تاریخ‌ها (شامل بدون‌تاریخ). تاریخ فقط روی زمان‌های واقعی کسب‌وکار؛ createdAt واردات استفاده نمی‌شود. واریزی‌ها برای منبع بدون اتصال یک‌گامی هستند.'
          : t`Default: all sources and all-time (includes undated). Date range uses business timestamps only — never import createdAt. Payments are unscoped for source (no one-hop lead join).`}
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
      </StyledHint>

      {showUndatedEmptyBanner && (
        <StyledEmptyDateBanner data-testid="dashboard-shared-date-empty-banner">
          {isPersianUi
            ? 'در بازه انتخاب‌شده داده دارای تاریخ فعالیت ثبت نشده است. رکوردهای بدون تاریخ فعالیت از نتیجه فیلتر شده حذف می‌شوند؛ با پاک کردن تاریخ، همه رکوردها دوباره نمایش داده می‌شوند.'
            : t`No activity-dated records in the selected range. Undated rows are excluded while a date filter is active; clear dates to restore all-time totals.`}
        </StyledEmptyDateBanner>
      )}
    </StyledStrip>
  );
};
