import { accepted, refused, type Result } from 'src/domain/shared/result';

// Positional SalesPrice10 / priceUnitsByPosition values. Index is NOT a warehouse
// or CRM price-list id. Zero is a real observed amount; missing slots stay absent.

export type VendorPriceTierObservation = {
  priceUnitsByPosition?: ReadonlyArray<string | null | undefined> | null;
  salesPriceUnits?: ReadonlyArray<number | null | undefined> | null;
};

export type ExplicitPriceListBinding = {
  // 1-based vendor position as documented by the destination guide.
  position: number;
  priceListId: string;
};

export type MappedVendorTierPrice = {
  position: number;
  priceListId: string;
  // Exact vendor unit text when present; null means the position was absent.
  amountUnitsText: string | null;
  // True when the vendor sent an explicit zero (distinct from missing).
  isExplicitZero: boolean;
};

const readPositionText = (
  observation: VendorPriceTierObservation,
  zeroBasedIndex: number,
): string | null => {
  const byPosition = observation.priceUnitsByPosition;

  if (Array.isArray(byPosition) && zeroBasedIndex < byPosition.length) {
    const raw = byPosition[zeroBasedIndex];

    if (raw === null || raw === undefined) {
      return null;
    }

    const text = String(raw).trim();

    return text === '' ? null : text;
  }

  const sales = observation.salesPriceUnits;

  if (Array.isArray(sales) && zeroBasedIndex < sales.length) {
    const raw = sales[zeroBasedIndex];

    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return null;
    }

    return String(raw);
  }

  return null;
};

export const mapVendorPriceTiersToPriceLists = ({
  observation,
  bindings,
}: {
  observation: VendorPriceTierObservation | null | undefined;
  bindings: ExplicitPriceListBinding[];
}): Result<MappedVendorTierPrice[]> => {
  if (!observation) {
    return refused(
      'VENDOR_PRICE_TIERS_UNOBSERVED',
      'سطوح قیمت مقصد مشاهده نشده است',
    );
  }

  if (!Array.isArray(bindings) || bindings.length === 0) {
    return refused(
      'PRICE_LIST_BINDING_REQUIRED',
      'نگاشت صریح فهرست قیمت برای سطوح مقصد لازم است؛ شناسه حدس زده نمی‌شود',
    );
  }

  const seenPositions = new Set<number>();
  const seenLists = new Set<string>();
  const mapped: MappedVendorTierPrice[] = [];

  for (const binding of bindings) {
    const position = binding.position;
    const priceListId = binding.priceListId.trim();

    if (!Number.isInteger(position) || position < 1) {
      return refused(
        'PRICE_TIER_POSITION_INVALID',
        'شماره سطح قیمت نامعتبر است',
      );
    }

    if (priceListId === '') {
      return refused(
        'PRICE_LIST_ID_REQUIRED',
        'شناسه فهرست قیمت برای سطح مقصد الزامی است',
      );
    }

    if (seenPositions.has(position) || seenLists.has(priceListId)) {
      return refused(
        'PRICE_TIER_BINDING_DUPLICATE',
        'نگاشت سطح قیمت تکراری است',
      );
    }

    seenPositions.add(position);
    seenLists.add(priceListId);

    const amountUnitsText = readPositionText(observation, position - 1);
    const isExplicitZero = amountUnitsText === '0';

    mapped.push({
      position,
      priceListId,
      amountUnitsText,
      isExplicitZero,
    });
  }

  return accepted(mapped);
};
