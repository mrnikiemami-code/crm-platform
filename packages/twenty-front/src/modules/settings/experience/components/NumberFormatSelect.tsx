import { NumberFormat } from '@/localization/constants/NumberFormat';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatNumberPreview } from '@/localization/utils/formatNumberPreview';
import { Select } from '@/ui/input/components/Select';
import { useLingui } from '@lingui/react/macro';

type NumberFormatSelectProps = {
  value: NumberFormat;
  onChange: (nextValue: NumberFormat) => void;
};

export const NumberFormatSelect = ({
  onChange,
  value,
}: NumberFormatSelectProps) => {
  const { t } = useLingui();

  const { calendar } = useDateTimeFormat();

  const formatPreview = (numberFormat: NumberFormat) =>
    formatNumberPreview({
      value: 1234.56,
      numberFormat,
      decimals: 2,
      calendar,
    });

  const systemNumberFormatLabel = formatPreview(NumberFormat.SYSTEM);
  const commasAndDotExample = formatPreview(NumberFormat.COMMAS_AND_DOT);
  const spacesAndCommaExample = formatPreview(NumberFormat.SPACES_AND_COMMA);
  const dotsAndCommaExample = formatPreview(NumberFormat.DOTS_AND_COMMA);
  const apostropheAndDotExample = formatPreview(
    NumberFormat.APOSTROPHE_AND_DOT,
  );

  return (
    <Select
      dropdownId="number-format-select"
      dropdownWidth={218}
      label={t`Number format`}
      dropdownWidthAuto
      fullWidth
      value={value}
      pinnedOption={{
        label: t`System settings`,
        value: NumberFormat.SYSTEM,
        contextualText: systemNumberFormatLabel,
      }}
      options={[
        {
          label: t`Commas and dot`,
          value: NumberFormat.COMMAS_AND_DOT,
          contextualText: commasAndDotExample,
        },
        {
          label: t`Spaces and comma`,
          value: NumberFormat.SPACES_AND_COMMA,
          contextualText: spacesAndCommaExample,
        },
        {
          label: t`Dots and comma`,
          value: NumberFormat.DOTS_AND_COMMA,
          contextualText: dotsAndCommaExample,
        },
        {
          label: t`Apostrophe and dot`,
          value: NumberFormat.APOSTROPHE_AND_DOT,
          contextualText: apostropheAndDotExample,
        },
      ]}
      onChange={onChange}
    />
  );
};
