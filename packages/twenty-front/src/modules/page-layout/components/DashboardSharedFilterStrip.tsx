import { FormDateFieldInput } from '@/object-record/record-field/ui/form-types/components/FormDateFieldInput';
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

  const [dateInputEpoch, setDateInputEpoch] = useState(0);

  const hasActiveFilter =
    sharedFilter.source !== DASHBOARD_SHARED_SOURCE_FILTER.ALL ||
    isDefined(sharedFilter.dateFrom) ||
    isDefined(sharedFilter.dateTo);

  const handleClear = () => {
    clearSharedFilter();
    setDateInputEpoch((epoch) => epoch + 1);
  };

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
        <FormDateFieldInput
          key={`from-${dateInputEpoch}`}
          label={isPersianUi ? 'از تاریخ' : t`From`}
          defaultValue={sharedFilter.dateFrom ?? undefined}
          onChange={(value) =>
            updateSharedFilter({ ...sharedFilter, dateFrom: value })
          }
        />
      </StyledControl>

      <StyledControl>
        <FormDateFieldInput
          key={`to-${dateInputEpoch}`}
          label={isPersianUi ? 'تا تاریخ' : t`To`}
          defaultValue={sharedFilter.dateTo ?? undefined}
          onChange={(value) =>
            updateSharedFilter({ ...sharedFilter, dateTo: value })
          }
        />
      </StyledControl>

      <Button
        onClick={handleClear}
        variant="secondary"
        size="small"
        disabled={!hasActiveFilter}
      >
        {isPersianUi ? 'پاک کردن فیلتر' : t`Clear filters`}
      </Button>

      <StyledHint>
        {isPersianUi
          ? 'پیش‌فرض: همه منابع و همه تاریخ‌ها (شامل بدون‌تاریخ). تاریخ فقط روی زمان‌های واقعی کسب‌وکار اعمال می‌شود؛ createdAt واردات استفاده نمی‌شود. واریزی‌ها برای منبع بدون اتصال یک‌گامی هستند.'
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
    </StyledStrip>
  );
};
