import { accepted, refused, type Result } from 'src/domain/shared/result';

export type SecondaryUnitRatioObservation = {
  secondaryUnitName?: string | null;
  unitCount?: number | null;
};

export type SecondaryUnitConversion = {
  secondaryUnitName: string;
  primaryPerSecondary: number;
};

// Secondary UoM may convert only when ProductUnitCount is a verified positive
// finite integer. Missing or fractional counts refuse — never invent a ratio.
export const resolveSecondaryUnitRatio = (
  observation: SecondaryUnitRatioObservation | null | undefined,
): Result<SecondaryUnitConversion | null> => {
  const secondaryName = (observation?.secondaryUnitName ?? '').trim();
  const count = observation?.unitCount;

  if (secondaryName === '' && (count === null || count === undefined)) {
    return accepted(null);
  }

  if (secondaryName === '') {
    return refused(
      'SECONDARY_UNIT_NAME_REQUIRED',
      'نام واحد فرعی بدون نسبت معتبر قابل استفاده نیست',
    );
  }

  if (
    typeof count !== 'number' ||
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count <= 0
  ) {
    return refused(
      'SECONDARY_UNIT_RATIO_UNVERIFIED',
      'نسبت واحد فرعی تأیید نشده است؛ تبدیل انجام نمی‌شود',
    );
  }

  return accepted({
    secondaryUnitName: secondaryName,
    primaryPerSecondary: count,
  });
};

export const convertSecondaryQuantityToPrimary = ({
  secondaryQuantity,
  observation,
}: {
  secondaryQuantity: number;
  observation: SecondaryUnitRatioObservation | null | undefined;
}): Result<number> => {
  if (
    typeof secondaryQuantity !== 'number' ||
    !Number.isFinite(secondaryQuantity) ||
    secondaryQuantity < 0
  ) {
    return refused(
      'SECONDARY_QUANTITY_INVALID',
      'مقدار واحد فرعی نامعتبر است',
    );
  }

  const ratio = resolveSecondaryUnitRatio(observation);

  if (!ratio.ok) {
    return ratio;
  }

  if (ratio.value === null) {
    return refused(
      'SECONDARY_UNIT_ABSENT',
      'واحد فرعی مشاهده نشده است',
    );
  }

  return accepted(secondaryQuantity * ratio.value.primaryPerSecondary);
};
