import { Temporal } from 'temporal-polyfill';
import { isNonEmptyString } from 'twenty-shared/utils';

export type DashboardSharedDateBounds = {
  rangeStartInstant: string;
  rangeEndExclusiveInstant: string;
};

export type ResolveDashboardSharedDateBoundsResult =
  | { status: 'none' }
  | { status: 'invalid'; reason: 'reversed' | 'unparseable' }
  | { status: 'ok'; bounds: DashboardSharedDateBounds };

// Inclusive calendar days in target timezone; exclusive upper bound as Instant string
// suitable for ViewFilterOperand.IS_AFTER (gte) / IS_BEFORE (lt).
export const resolveDashboardSharedDateBounds = ({
  dateFrom,
  dateTo,
  timeZone,
}: {
  dateFrom: string | null;
  dateTo: string | null;
  timeZone: string;
}): ResolveDashboardSharedDateBoundsResult => {
  const hasFrom = isNonEmptyString(dateFrom);
  const hasTo = isNonEmptyString(dateTo);

  if (!hasFrom && !hasTo) {
    return { status: 'none' };
  }

  let fromPlain: Temporal.PlainDate | null = null;
  let toPlain: Temporal.PlainDate | null = null;

  try {
    if (hasFrom) {
      fromPlain = Temporal.PlainDate.from(dateFrom);
    }
    if (hasTo) {
      toPlain = Temporal.PlainDate.from(dateTo);
    }
  } catch {
    return { status: 'invalid', reason: 'unparseable' };
  }

  if (
    isDefinedPlain(fromPlain) &&
    isDefinedPlain(toPlain) &&
    Temporal.PlainDate.compare(fromPlain, toPlain) > 0
  ) {
    return { status: 'invalid', reason: 'reversed' };
  }

  const rangeStart = (
    fromPlain ?? Temporal.PlainDate.from('0001-01-01')
  ).toZonedDateTime({ timeZone });

  const rangeEndExclusive = (
    toPlain ?? Temporal.PlainDate.from('9999-12-31')
  )
    .add({ days: 1 })
    .toZonedDateTime({ timeZone });

  return {
    status: 'ok',
    bounds: {
      rangeStartInstant: rangeStart.toString({ timeZoneName: 'never' }),
      rangeEndExclusiveInstant: rangeEndExclusive.toString({
        timeZoneName: 'never',
      }),
    },
  };
};

const isDefinedPlain = (
  value: Temporal.PlainDate | null,
): value is Temporal.PlainDate => value !== null;
