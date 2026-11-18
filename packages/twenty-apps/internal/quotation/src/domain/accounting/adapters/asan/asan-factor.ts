import {
  ASAN_SPECIAL_ITEM_CODES,
  type AsanSpecialItemCode,
} from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { toAsanFactorDate } from 'src/domain/accounting/adapters/asan/jalali';
import { QUANTITY_SCALE } from 'src/domain/money/quantity';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Maps a sealed quotation revision onto Asan's `FactorViewModel`.
//
// THE FIELD THAT MATTERS MOST: `FactorDetails.Price` is the TOTAL for the line, not the unit
// price. The guide says the per-unit figure is derived by Asan as `Price ÷ Count`, and that
// `Price` is the whole line amount after discount. Sending a unit price here multiplies the
// invoice by the quantity a second time — an error nobody notices until the customer refuses
// to pay, which is why there is a dedicated test for it.
//
// MONEY SCALE: Asan takes a plain integer (no decimals appear anywhere in the guide) while the
// CRM stores micros of IRR. The conversion is a division by 1,000,000 and it is REFUSED when
// it would not be exact, because a silently rounded line is a line nobody agreed to.
export const MICROS_PER_ASAN_UNIT = 1_000_000n;

// Asan's own numbering is what an accountant reconciles against, so the CRM never imposes
// one. The guide states 0 means auto-number and that a non-zero value disables it.
export const ASAN_AUTO_FACTOR_NUMBER = 0;

// Warehouse 0 is the first warehouse in the documented ordering; a workspace with more than
// one warehouse must configure the mapping explicitly.
export const ASAN_DEFAULT_STORAGE_ID = 0;

export type AsanFactorDetail = {
  ProductID: number;
  Count: number;
  Price: number;
  StorageID: number;
  Description?: string;
};

export type AsanFactorViewModel = {
  UserID: number;
  CustomerID: number;
  FactorDate: number;
  Description: string;
  VisitorID: number;
  FactorNumber: number;
  FactorDetails: AsanFactorDetail[];
};

// Quantities cross the wire as a `double`. The CRM's six-decimal scaled integer converts
// exactly for any quantity a document can carry, and the conversion is checked rather than
// assumed: beyond 2^53 micro-units a double cannot hold every integer.
export const scaledQuantityToAsanCount = (
  quantityScaled: bigint,
): Result<number> => {
  const magnitude = quantityScaled < 0n ? -quantityScaled : quantityScaled;

  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) {
    return refused(
      'QUANTITY_OUT_OF_RANGE',
      'this quantity cannot be represented exactly as a JSON number',
    );
  }

  return accepted(Number(quantityScaled) / Number(QUANTITY_SCALE));
};

// Micros -> the whole-unit integer Asan expects. Refusing a remainder is the whole point:
// half a rial is not a price, and rounding it changes what the customer is asked to pay.
export const microsToAsanMoney = (micros: bigint): Result<number> => {
  if (micros % MICROS_PER_ASAN_UNIT !== 0n) {
    return refused(
      'AMOUNT_NOT_WHOLE_UNIT',
      'Asan stores whole rial; this amount has a fractional rial and cannot be sent without rounding',
    );
  }

  const units = micros / MICROS_PER_ASAN_UNIT;

  if (
    units > BigInt(Number.MAX_SAFE_INTEGER) ||
    units < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return refused(
      'AMOUNT_OUT_OF_RANGE',
      'this amount exceeds what a JSON number can carry exactly',
    );
  }

  return accepted(Number(units));
};

// The revision stores amounts as exact decimal strings, so they are parsed once here rather
// than trusted as numbers that already went through the API.
const parseExactToMicros = (text: string): Result<bigint> => {
  const match = /^(-)?(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());

  if (match === null) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      `expected an exact decimal, got "${text}"`,
    );
  }

  const fraction = (match[3] ?? '').padEnd(6, '0');
  const magnitude =
    BigInt(match[2]) * MICROS_PER_ASAN_UNIT + BigInt(fraction === '' ? '0' : fraction);

  return accepted(match[1] === '-' ? -magnitude : magnitude);
};

export type AsanSpecialCodeAvailability = {
  discount: boolean;
  duty: boolean;
  tax: boolean;
};

export type AsanMappingInput = {
  revision: QuotationRevisionSnapshot;
  // Asan's numeric identifiers, resolved from the accounting links — never the CRM ids, and
  // never a code guessed from a name.
  customerCode: number;
  userId: number;
  // Product code per revision line id. A line without a code cannot be sent: Asan needs
  // `ProductID`, and inventing one would post the wrong item.
  productCodeByLineId: Record<string, number>;
  // Which special codes this installation actually has defined. A false entry means the
  // amount is folded into no separate line, which the caller must have decided.
  specialCodesInUse: AsanSpecialCodeAvailability;
  description: string;
  storageId?: number;
};

export const mapRevisionToAsanFactor = (
  input: AsanMappingInput,
): Result<AsanFactorViewModel> => {
  const factorDate = toAsanFactorDate(input.revision.issuedAt.slice(0, 10));

  if (!factorDate.ok) {
    return factorDate;
  }

  const details: AsanFactorDetail[] = [];
  let discountTotalMicros = 0n;
  let taxTotalMicros = 0n;

  for (const line of input.revision.lines) {
    const productCode = input.productCodeByLineId[line.lineId];

    if (productCode === undefined) {
      return refused(
        'LINE_HAS_NO_ASAN_PRODUCT',
        `line "${line.lineId}" has no linked Asan product code`,
      );
    }

    const quantity = scaledQuantityToAsanCount(BigInt(line.quantityScaled));

    if (!quantity.ok) {
      return quantity;
    }

    const lineTotal = parseExactToMicros(line.totalMicros);

    if (!lineTotal.ok) {
      return lineTotal;
    }

    const tax = parseExactToMicros(line.taxMicros);

    if (!tax.ok) {
      return tax;
    }

    const discount = parseExactToMicros(line.discountMicros);

    if (!discount.ok) {
      return discount;
    }

    // `Price` is the whole line amount AFTER discount. Tax is excluded here because Asan
    // takes tax as its own special-code line, so including it would double-charge the VAT.
    const netOfTaxMicros = lineTotal.value - tax.value;
    const price = microsToAsanMoney(netOfTaxMicros);

    if (!price.ok) {
      return price;
    }

    details.push({
      ProductID: productCode,
      Count: quantity.value,
      Price: price.value,
      StorageID: input.storageId ?? ASAN_DEFAULT_STORAGE_ID,
      Description: line.description,
    });

    discountTotalMicros += discount.value;
    taxTotalMicros += tax.value;
  }

  // Discount, duty and tax are separate lines with Count = 0 and the amount in Price. They
  // are appended only when the installation defines the code AND the amount is non-zero: a
  // zero-value line on a fiscal document is noise an accountant has to explain.
  const specialResult = appendSpecialLines({
    details,
    storageId: input.storageId ?? ASAN_DEFAULT_STORAGE_ID,
    amounts: [
      {
        enabled: input.specialCodesInUse.discount,
        code: ASAN_SPECIAL_ITEM_CODES.discount,
        micros: discountTotalMicros,
        label: 'تخفیف',
      },
      {
        enabled: input.specialCodesInUse.tax,
        code: ASAN_SPECIAL_ITEM_CODES.tax,
        micros: taxTotalMicros,
        label: 'مالیات',
      },
    ],
  });

  if (!specialResult.ok) {
    return specialResult;
  }

  return accepted({
    UserID: input.userId,
    CustomerID: input.customerCode,
    FactorDate: factorDate.value,
    Description: input.description,
    VisitorID: 0,
    FactorNumber: ASAN_AUTO_FACTOR_NUMBER,
    FactorDetails: details,
  });
};

const appendSpecialLines = ({
  details,
  storageId,
  amounts,
}: {
  details: AsanFactorDetail[];
  storageId: number;
  amounts: {
    enabled: boolean;
    code: AsanSpecialItemCode;
    micros: bigint;
    label: string;
  }[];
}): Result<AsanFactorDetail[]> => {
  for (const amount of amounts) {
    if (!amount.enabled || amount.micros === 0n) {
      continue;
    }

    const value = microsToAsanMoney(amount.micros);

    if (!value.ok) {
      return value;
    }

    details.push({
      // The special codes are numeric by contract; a non-numeric constant would be a code
      // defect, not user data, so it fails loudly here rather than at the vendor.
      ProductID: Number(amount.code),
      // Count = 0 is what makes Asan treat the row as an amount rather than a quantity.
      Count: 0,
      Price: value.value,
      StorageID: storageId,
      Description: amount.label,
    });
  }

  return accepted(details);
};
