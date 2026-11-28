import { accepted, refused, type Result } from 'src/domain/shared/result';

// Read-only stock / serial observation. Position index is not a warehouse name;
// verified store identity must come from an explicit store list (architect seam).

export type VendorStockObservation = {
  stock?: number | null;
  stockByPosition?: ReadonlyArray<number | null | undefined> | null;
  serial?: string | null;
  serials?: ReadonlyArray<string | null | undefined> | null;
};

export type VerifiedStoreBinding = {
  // 1-based position matching stockByPosition.
  position: number;
  externalStorageId: string;
  storeName: string;
};

export type StockByStoreObservation = {
  externalStorageId: string;
  storeName: string;
  quantity: number | null;
  // True when quantity is an explicit numeric zero.
  isExplicitZero: boolean;
};

export type SerialObservation = {
  serials: string[];
};

export const observeStockByVerifiedStores = ({
  observation,
  stores,
}: {
  observation: VendorStockObservation | null | undefined;
  stores: VerifiedStoreBinding[];
}): Result<StockByStoreObservation[]> => {
  if (!Array.isArray(stores) || stores.length === 0) {
    return refused(
      'STORE_BINDING_REQUIRED',
      'فهرست انبار تأییدشده لازم است؛ شناسه انبار حدس زده نمی‌شود',
    );
  }

  const stockByPosition = observation?.stockByPosition;
  const rows: StockByStoreObservation[] = [];
  const seenPositions = new Set<number>();
  const seenStores = new Set<string>();

  for (const store of stores) {
    const position = store.position;
    const externalStorageId = store.externalStorageId.trim();
    const storeName = store.storeName.trim();

    if (!Number.isInteger(position) || position < 1) {
      return refused('STORE_POSITION_INVALID', 'شماره موقعیت انبار نامعتبر است');
    }

    if (externalStorageId === '' || storeName === '') {
      return refused(
        'STORE_IDENTITY_REQUIRED',
        'هویت انبار بدون شناسه و نام تأییدشده قابل نمایش نیست',
      );
    }

    if (seenPositions.has(position) || seenStores.has(externalStorageId)) {
      return refused('STORE_BINDING_DUPLICATE', 'نگاشت انبار تکراری است');
    }

    seenPositions.add(position);
    seenStores.add(externalStorageId);

    let quantity: number | null = null;

    if (
      Array.isArray(stockByPosition) &&
      position - 1 < stockByPosition.length
    ) {
      const raw = stockByPosition[position - 1];

      if (typeof raw === 'number' && Number.isFinite(raw)) {
        quantity = raw;
      }
    }

    rows.push({
      externalStorageId,
      storeName,
      quantity,
      isExplicitZero: quantity === 0,
    });
  }

  return accepted(rows);
};

export const observeVendorSerials = (
  observation: VendorStockObservation | null | undefined,
): SerialObservation => {
  const serials: string[] = [];
  const push = (value: string | null | undefined) => {
    const text = (value ?? '').trim();

    if (text !== '' && !serials.includes(text)) {
      serials.push(text);
    }
  };

  push(observation?.serial);

  if (Array.isArray(observation?.serials)) {
    for (const entry of observation.serials) {
      push(entry);
    }
  }

  return { serials };
};

// Aggregate TotalCount when present; null means unobserved (distinct from zero).
export const observeTotalStock = (
  observation: VendorStockObservation | null | undefined,
): number | null => {
  const stock = observation?.stock;

  if (typeof stock !== 'number' || !Number.isFinite(stock)) {
    return null;
  }

  return stock;
};
