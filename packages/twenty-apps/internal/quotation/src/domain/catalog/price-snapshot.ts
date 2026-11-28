import { accepted, refused, type Result } from 'src/domain/shared/result';

// Snapshot price for a quotation line comes from an explicit or default IRR price list.
// Validity windows on Price are honored when present; no extra multi-list rules are invented.

export type PriceCandidate = {
  id?: string | null;
  unitPriceExact: string;
  validFrom: string | null;
  validTo: string | null;
};

export type SelectedCatalogPrice = {
  unitPriceExact: string;
  priceId: string | null;
  validFrom: string | null;
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

export const selectCurrentCatalogPrice = (
  candidates: PriceCandidate[],
  dayIso: string = new Date().toISOString().slice(0, 10),
): Result<SelectedCatalogPrice> => {
  const valid = candidates.filter((candidate) =>
    isPriceValidOnDay(candidate, dayIso),
  );

  if (valid.length === 0) {
    return refused(
      'CATALOG_PRICE_MISSING',
      'قیمت معتبری در فهرست قیمت پیش‌فرض برای این کالا ثبت نشده است',
    );
  }

  const ranked = [...valid].sort((left, right) => {
    const leftFrom = toDayStamp(left.validFrom) ?? '';
    const rightFrom = toDayStamp(right.validFrom) ?? '';

    if (leftFrom === rightFrom) {
      return 0;
    }

    return leftFrom < rightFrom ? 1 : -1;
  });

  const chosen = ranked[0];
  const exact = chosen.unitPriceExact.trim();

  if (exact === '') {
    return refused(
      'CATALOG_PRICE_MISSING',
      'قیمت معتبری در فهرست قیمت پیش‌فرض برای این کالا ثبت نشده است',
    );
  }

  return accepted({
    unitPriceExact: exact,
    priceId:
      typeof chosen.id === 'string' && chosen.id.trim() !== ''
        ? chosen.id.trim()
        : null,
    validFrom: toDayStamp(chosen.validFrom),
  });
};

export const selectCurrentPriceExact = (
  candidates: PriceCandidate[],
  dayIso: string = new Date().toISOString().slice(0, 10),
): Result<string> => {
  const selected = selectCurrentCatalogPrice(candidates, dayIso);

  if (!selected.ok) {
    return selected;
  }

  return accepted(selected.value.unitPriceExact);
};