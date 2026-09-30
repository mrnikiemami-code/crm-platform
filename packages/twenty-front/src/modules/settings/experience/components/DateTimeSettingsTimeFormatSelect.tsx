import { DATE_TIME_SETTINGS_PREVIEW_DATE } from '@/localization/constants/DateTimeSettingsPreviewDate';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { detectTimeFormat } from '@/localization/utils/detection/detectTimeFormat';
import { detectTimeZone } from '@/localization/utils/detection/detectTimeZone';
import { formatTimePreview } from '@/localization/utils/formatTimePreview';
import { Select } from '@/ui/input/components/Select';
import { useLingui } from '@lingui/react/macro';

type DateTimeSettingsTimeFormatSelectProps = {
  value: TimeFormat;
  onChange: (nextValue: TimeFormat) => void;
  timeZone: string;
};

export const DateTimeSettingsTimeFormatSelect = ({
  onChange,
  timeZone,
  value,
}: DateTimeSettingsTimeFormatSelectProps) => {
  const { t } = useLingui();
  const { calendar } = useDateTimeFormat();
  const systemTimeZone = detectTimeZone();

  const usedTimeZone = timeZone === 'system' ? systemTimeZone : timeZone;

  const systemTimeFormat = TimeFormat[detectTimeFormat()];

  const formatPreview = (timeFormat: TimeFormat) =>
    formatTimePreview({
      date: DATE_TIME_SETTINGS_PREVIEW_DATE,
      timeZone: usedTimeZone,
      timeFormat,
      calendar,
    });

  const systemTimeFormatLabel = formatPreview(systemTimeFormat);

  const hour24Label = formatPreview(TimeFormat.HOUR_24);

  const hour12Label = formatPreview(TimeFormat.HOUR_12);

  return (
    <Select
      dropdownId="datetime-settings-time-format"
      dropdownWidth={218}
      label={t`Time format`}
      dropdownWidthAuto
      fullWidth
      value={value}
      pinnedOption={{
        label: t`System settings`,
        value: TimeFormat.SYSTEM,
        contextualText: systemTimeFormatLabel,
      }}
      options={[
        {
          label: t`24h`,
          value: TimeFormat.HOUR_24,
          contextualText: hour24Label,
        },
        {
          label: t`12h`,
          value: TimeFormat.HOUR_12,
          contextualText: hour12Label,
        },
      ]}
      onChange={onChange}
    />
  );
};
