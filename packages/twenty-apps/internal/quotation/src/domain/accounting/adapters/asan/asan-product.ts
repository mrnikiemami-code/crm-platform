import { accepted, refused, type Result } from 'src/domain/shared/result';

// Maps a CRM catalog item onto Asan's `ProductInput`.
//
// WHAT ASAN ACCEPTS ON CREATE: `ProductCode`, `ProductName`, `ProductName2`, `SellPrice`,
// `SalesPrice[2]`. WHAT IT ACCEPTS ON UPDATE: prices only. There is no documented endpoint
// that renames a product, so `mapItemForUpdate` deliberately cannot produce a name change —
// a caller wanting one gets a refusal rather than a promise the vendor will not keep.
export type AsanProductInput = {
  ProductCode: number;
  ProductName: string;
  ProductName2?: string;
  SellPrice: number;
  SalesPrice?: number[];
};

// Asan's `ProductCode` is a positive integer typed as `long`/`decimal` depending on the
// endpoint. The CRM's catalog item id is a UUID, so the code always comes from the accounting
// link; deriving one from a name or a SKU would collide the first time two products share a
// name.
export const isValidAsanProductCode = (code: number): boolean =>
  Number.isInteger(code) && code > 0 && Number.isSafeInteger(code);

export type AsanProductCreateInput = {
  productCode: number;
  name: string;
  secondaryName: string | null;
  // Whole rial, already converted and checked by the caller.
  sellPrice: number;
  salesPrices: number[];
};

export const mapItemToAsanProduct = (
  input: AsanProductCreateInput,
): Result<AsanProductInput> => {
  if (!isValidAsanProductCode(input.productCode)) {
    return refused(
      'ASAN_PRODUCT_CODE_INVALID',
      'Asan needs a positive integer product code; link the item to an existing code or allocate one first',
    );
  }

  const name = input.name.trim();

  if (name === '') {
    return refused('ASAN_PRODUCT_NAME_MISSING', 'Asan requires a product name');
  }

  // Asan's own documentation warns that leaving `SalesPrice` out zeroes price 2 and 3 on an
  // EDIT. On create an absent array is simply "no extra prices", so it is omitted rather than
  // sent as zeros — a zero price tier is a real price a salesperson could select.
  const salesPrices = input.salesPrices.filter((price) => price > 0);

  return accepted({
    ProductCode: input.productCode,
    ProductName: name,
    ...(input.secondaryName === null
      ? {}
      : { ProductName2: input.secondaryName }),
    SellPrice: input.sellPrice,
    ...(salesPrices.length === 0 ? {} : { SalesPrice: salesPrices }),
  });
};

// The ONLY supported update. Sending this with a changed name would be silently ignored by
// Asan, which is why the function takes prices and nothing else: the type makes the
// limitation impossible to forget.
export type AsanProductPriceUpdateInput = {
  productCode: number;
  // Name fields are echo-only. Asan documents that it re-reads and preserves the stored name,
  // and sends them because some builds expect the property to be present.
  currentName: string;
  currentSecondaryName: string | null;
  sellPrice: number;
  salesPrices: number[];
};

export const mapItemPricesToAsanUpdate = (
  input: AsanProductPriceUpdateInput,
): Result<AsanProductInput> => {
  if (!isValidAsanProductCode(input.productCode)) {
    return refused(
      'ASAN_PRODUCT_CODE_INVALID',
      'Asan needs a positive integer product code',
    );
  }

  if (input.sellPrice <= 0) {
    return refused(
      'ASAN_SELL_PRICE_INVALID',
      'a sell price must be a positive whole amount',
    );
  }

  // An empty array is omitted on purpose: Asan's guide states that omitting `SalesPrice` on
  // an edit SETS PRICE 2 AND 3 TO ZERO. Sending explicit zeros would therefore do exactly
  // what the caller wants, while an empty array would be ambiguous to a future reader — so
  // the caller must state the intent.
  const salesPrices = input.salesPrices;

  return accepted({
    ProductCode: input.productCode,
    ProductName: input.currentName,
    ...(input.currentSecondaryName === null
      ? {}
      : { ProductName2: input.currentSecondaryName }),
    SellPrice: input.sellPrice,
    ...(salesPrices.length === 0 ? {} : { SalesPrice: salesPrices }),
  });
};

// Which CRM item fields are publishable, derived from the capabilities rather than repeated
// at every call site. `false` here is not a failure at write time; it is the reason a rename
// becomes a manual-export task.
export const ASAN_PUBLISHABLE_ITEM_FIELDS: readonly string[] = [
  'sellPrice',
  'salesPrices',
];

export const isAsanPublishableItemField = (field: string): boolean =>
  ASAN_PUBLISHABLE_ITEM_FIELDS.includes(field);
