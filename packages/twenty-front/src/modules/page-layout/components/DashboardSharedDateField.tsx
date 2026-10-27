import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatDashboardSharedDateDisplay } from '@/page-layout/utils/formatDashboardSharedDateDisplay';
import { isValidCanonicalIsoPlainDate } from '@/page-layout/utils/parseDashboardSharedDateInput';
import {
  DatePicker,
  MONTH_AND_YEAR_DROPDOWN_MONTH_SELECT_ID,
  MONTH_AND_YEAR_DROPDOWN_YEAR_SELECT_ID,
} from '@/ui/input/components/internal/date/components/DatePicker';
import { SelectControl } from '@/ui/input/components/SelectControl';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { styled } from '@linaria/react';
import { isDefined, isNonEmptyString } from 'twenty-shared/utils';
import { IconCalendarEvent } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  display: block;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledRoot = styled.div`
  min-width: 168px;
  width: 100%;
`;

const StyledActiveDot = styled.span`
  background: ${themeCssVariables.color.blue};
  border-radius: 50%;
  display: inline-block;
  height: 6px;
  margin-inline-start: ${themeCssVariables.spacing[1]};
  width: 6px;
`;

type DashboardSharedDateFieldProps = {
  label: string;
  dropdownId: string;
  value: string | null;
  placeholder: string;
  onCommit: (isoPlainDate: string | null) => void;
};

export const DashboardSharedDateField = ({
  label,
  dropdownId,
  value,
  placeholder,
  onCommit,
}: DashboardSharedDateFieldProps) => {
  const { calendar, dateFormat } = useDateTimeFormat();
  const { closeDropdown } = useCloseDropdown();

  const displayValue = formatDashboardSharedDateDisplay({
    isoPlainDate: value,
    calendar,
    dateFormat,
  });

  const hasValue = isNonEmptyString(value) && isValidCanonicalIsoPlainDate(value);

  const commitIsoDate = (nextValue: string | null) => {
    if (!isDefined(nextValue) || nextValue === '') {
      onCommit(null);

      return;
    }

    if (!isValidCanonicalIsoPlainDate(nextValue)) {
      return;
    }

    onCommit(nextValue);
  };

  return (
    <StyledRoot>
      <StyledLabel>
        {label}
        {hasValue && <StyledActiveDot aria-hidden />}
      </StyledLabel>
      <Dropdown
        dropdownId={dropdownId}
        dropdownPlacement="bottom-start"
        clickableComponentWidth="100%"
        excludedClickOutsideIds={[
          MONTH_AND_YEAR_DROPDOWN_MONTH_SELECT_ID,
          MONTH_AND_YEAR_DROPDOWN_YEAR_SELECT_ID,
        ]}
        clickableComponent={
          <SelectControl
            selectedOption={{
              value: value ?? '',
              label: hasValue ? displayValue : placeholder,
              Icon: IconCalendarEvent,
            }}
            textAccent={hasValue ? 'default' : 'placeholder'}
            selectSizeVariant="small"
          />
        }
        dropdownComponents={
          <DropdownContent widthInPixels={300}>
            <DatePicker
              instanceId={`${dropdownId}-picker`}
              plainDateString={hasValue ? value : null}
              clearable={hasValue}
              onChange={commitIsoDate}
              onClose={(nextValue) => {
                commitIsoDate(nextValue);
                closeDropdown(dropdownId);
              }}
              onClear={() => {
                onCommit(null);
                closeDropdown(dropdownId);
              }}
            />
          </DropdownContent>
        }
      />
    </StyledRoot>
  );
};
