import { accepted, refused, type Result } from 'src/domain/shared/result';

// Snapshot price for a quotation line comes from the workspace's default IRR
// price list. Validity windows on Price are honored when present; no extra
// multi-list / promotional pricing rules are invented here.

export type PriceCandidate = {
  unitPriceExact: string;
  validFrom: string | null;
  validTo: string | null;
};

const toDayStamp = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  // GraphQL may return ISO datetime; compare on the calendar day only.
  return value.trim().slice(0, 10);
};

export const isPriceValidOnDay = (
  candidate: PriceCandidate,
  dayIso: string,
): boolean => {
  const from = toDayStamp(candidate.validFrom);
  const to = toDayStamp(candidate.validTo);

  if (from !== null && dayIso < from) {
    return false;
  }

  if (to !== null && dayIso > to) {
    return false;
  }

  return true;
};

export const selectCurrentPriceExact = (
  candidates: PriceCandidate[],
  dayIso: string = new Date().toISOString().slice(0, 10),
): Result<string> => {
  const valid = candidates.filter((candidate) =>
    isPriceValidOnDay(candidate, dayIso),
  );

  if (valid.length === 0) {
    return refused(
      'CATALOG_PRICE_MISSING',
      'قیمت معتبری در فهرست قیمت پیش‌فرض برای این کالا ثبت نشده است',
    );
  }

  // Prefer the most recently started valid window; open-ended ties keep insertion order.
  const ranked = [...valid].sort((left, right) => {
    const leftFrom = toDayStamp(left.validFrom) ?? '';
    const rightFrom = toDayStamp(right.validFrom) ?? '';

    if (leftFrom === rightFrom) {
      return 0;
    }

    return leftFrom < rightFrom ? 1 : -1;
  });

  const exact = ranked[0].unitPriceExact.trim();

  if (exact === '') {
    return refused(
      'CATALOG_PRICE_MISSING',
      'قیمت معتبری در فهرست قیمت پیش‌فرض برای این کالا ثبت نشده است',
    );
  }

  return accepted(exact);
};
