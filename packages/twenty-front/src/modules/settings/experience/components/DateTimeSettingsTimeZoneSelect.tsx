import { useMemo } from 'react';

import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { detectTimeZone } from '@/localization/utils/detection/detectTimeZone';
import { findAvailableTimeZoneOption } from '@/localization/utils/findAvailableTimeZoneOption';
import { formatLocalizedTimeZoneLabel } from '@/localization/utils/formatLocalizedTimeZoneLabel';
import { AVAILABLE_TIMEZONE_OPTIONS } from '@/settings/experience/constants/AvailableTimezoneOptions';
import { Select } from '@/ui/input/components/Select';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { type SelectOption } from 'twenty-ui/primitives/input';

type DateTimeSettingsTimeZoneSelectProps = {
  value?: string;
  onChange: (nextValue: string) => void;
};

export const DateTimeSettingsTimeZoneSelect = ({
  value = detectTimeZone(),
  onChange,
}: DateTimeSettingsTimeZoneSelectProps) => {
  const { calendar } = useDateTimeFormat();
  const systemTimeZone = detectTimeZone();

  const systemTimeZoneOption = findAvailableTimeZoneOption(systemTimeZone);

  const options = useMemo<SelectOption<string>[]>(
    () =>
      calendar === 'persian'
        ? AVAILABLE_TIMEZONE_OPTIONS.map((option) => ({
            ...option,
            label: formatLocalizedTimeZoneLabel(option.value, calendar),
          }))
        : (AVAILABLE_TIMEZONE_OPTIONS as SelectOption<string>[]),
    [calendar],
  );

  return (
    <Select
      dropdownId="datetime-settings-time-zone"
      label={t`Time zone`}
      dropdownWidth={480}
      fullWidth
      value={value}
      pinnedOption={{
        label: t`System settings`,
        value: 'system',
        contextualText: isDefined(systemTimeZoneOption)
          ? formatLocalizedTimeZoneLabel(systemTimeZoneOption.value, calendar)
          : undefined,
      }}
      options={options}
      onChange={onChange}
      withSearchInput
    />
  );
};
