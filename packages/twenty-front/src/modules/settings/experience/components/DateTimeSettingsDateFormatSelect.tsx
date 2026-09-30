import { DateFormat } from '@/localization/constants/DateFormat';
import { DATE_TIME_SETTINGS_PREVIEW_DATE } from '@/localization/constants/DateTimeSettingsPreviewDate';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { detectDateFormat } from '@/localization/utils/detection/detectDateFormat';
import { detectTimeZone } from '@/localization/utils/detection/detectTimeZone';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { Select } from '@/ui/input/components/Select';
import { useLingui } from '@lingui/react/macro';

type DateTimeSettingsDateFormatSelectProps = {
  value: DateFormat;
  onChange: (nextValue: DateFormat) => void;
  timeZone: string;
};

export const DateTimeSettingsDateFormatSelect = ({
  onChange,
  timeZone,
  value,
}: DateTimeSettingsDateFormatSelectProps) => {
  const { t } = useLingui();
  const { calendar } = useDateTimeFormat();

  const systemTimeZone = detectTimeZone();

  const usedTimeZone = timeZone === 'system' ? systemTimeZone : timeZone;

  const systemDateFormat = DateFormat[detectDateFormat()];

  const formatPreview = (dateFormat: DateFormat) =>
    formatDateISOStringToDate({
      date: DATE_TIME_SETTINGS_PREVIEW_DATE.toISOString(),
      timeZone: usedTimeZone,
      dateFormat,
      calendar,
    });

  const systemDateFormatLabel = formatPreview(systemDateFormat);

  return (
    <Select
      dropdownId="datetime-settings-date-format"
      dropdownWidth={320}
      label={t`Date format`}
      fullWidth
      value={value}
      pinnedOption={{
        label: t`System settings`,
        value: DateFormat.SYSTEM,
        contextualText: systemDateFormatLabel,
      }}
      options={[
        {
          label: formatPreview(DateFormat.MONTH_FIRST),
          value: DateFormat.MONTH_FIRST,
        },
        {
          label: formatPreview(DateFormat.DAY_FIRST),
          value: DateFormat.DAY_FIRST,
        },
        {
          label: formatPreview(DateFormat.YEAR_FIRST),
          value: DateFormat.YEAR_FIRST,
        },
      ]}
      onChange={onChange}
    />
  );
};
