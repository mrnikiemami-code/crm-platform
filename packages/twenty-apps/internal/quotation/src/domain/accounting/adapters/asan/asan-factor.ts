import {
  ASAN_SPECIAL_ITEM_CODES,
} from 'src/domain/accounting/adapters/asan/asan-capabilities';
import {
  dutyTravelsInsideTax,
  type DutyHandlingMode,
} from 'src/domain/accounting/capabilities';
import { type AccountingMoneyUnit } from 'src/domain/accounting/adapter-contract';
import { crmMicrosToAsanUnits } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { toAsanFactorDate } from 'src/domain/accounting/adapters/asan/jalali';
import { QUANTITY_SCALE } from 'src/domain/money/quantity';
import { decodeRevisionLine, parseRevisionMicros, validateRevisionFinancialFacts, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
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

  const count = Number(quantityScaled) / Number(QUANTITY_SCALE);
  // Safe integer conversion before division is not sufficient. At large magnitudes
  // a double can collapse adjacent six-decimal quantities into the same value.
  // Verify the decimal quantity that will cross the wire without re-rounding it.
  const wire = JSON.stringify(count);
  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(wire);
  // JSON uses exponent notation for the smallest supported positive quantity.
  const decimal = match ? wire : count.toFixed(6);
  const exact = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(decimal);
  if (!exact || BigInt(exact[1] + exact[2] + (exact[3] ?? '').padEnd(6, '0')) !== quantityScaled) {
    return refused('QUANTITY_OUT_OF_RANGE', 'this quantity loses its six-decimal identity on the vendor wire');
  }
  return accepted(count);
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

export type AsanSpecialCodeAvailability = {
  discount: boolean;
  duty: boolean;
  tax: boolean;
};

export type AsanSpecialItemCodeOverrides = {
  discount?: string;
  duty?: string;
  tax?: string;
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
  // The installation's actual special-row item codes, when they differ from the documented
  // defaults. These identify a ROW, not a tax policy: the connection's policy mapping is a
  // different table and is never posted as a product id.
  specialItemCodes?: AsanSpecialItemCodeOverrides;
  // How the destination carries duty, so the mapper can decide whether duty gets its own
  // row or travels inside the single tax figure. A destination that has no duty field must
  // not be handed a duty row it would post as a product.
  dutyHandling?: DutyHandlingMode;
  // The Asan tax item code this CRM tax policy maps to, resolved from the
  // connection. Absent keeps the documented default for callers that predate
  // configurable policies; the export planner refuses an unmapped taxed document
  // before it can reach this mapper.
  taxVendorCode?: string;
  // Kept for callers that predate the single-policy-code rule. Duty is no longer mapped to
  // a policy code; this only supplies the installation's duty row code when one was stored
  // under the old key.
  dutyVendorCode?: string;
  description: string;
  storageId?: number;
  // The unit Asan stores amounts in. Absent keeps the legacy rial assumption for callers that
  // predate the connection setting; a connection ALWAYS passes the confirmed unit, and the
  // export planner refuses to reach here with UNCONFIRMED.
  moneyUnit?: AccountingMoneyUnit;
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

  // The unit is applied at ONE point so a line price and a special-code amount can never be
  // converted by different rules.
  const convertToVendorUnits = (
    micros: bigint,
  ): Result<number> =>
    input.moneyUnit === undefined
      ? microsToAsanMoney(micros)
      : crmMicrosToAsanUnits(micros, input.moneyUnit);

  for (const line of input.revision.lines) {
    const productCode = input.productCodeByLineId[line.lineId];

    if (productCode === undefined) {
      return refused(
        'LINE_HAS_NO_ASAN_PRODUCT',
        `line "${line.lineId}" has no linked Asan product code`,
      );
    }

    const decoded = decodeRevisionLine(line);
    if (!decoded.ok) return decoded;
    const quantity = scaledQuantityToAsanCount(decoded.value.quantity);
    if (!quantity.ok) return quantity;
    const lineDiscount = decoded.value.lineDiscount + decoded.value.documentDiscount;
    // Restore ALL allocated discounts when a separate row will subtract them.
    const price = convertToVendorUnits(input.specialCodesInUse.discount ? decoded.value.gross : decoded.value.net);

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

    discountTotalMicros += lineDiscount;
  }

  // The split is a document-level fact in the sealed snapshot, so it is read from the
  // totals rather than re-derived per line: `taxMicros` already includes duty, and
  // subtracting it is what makes the destination's tax row the tax component only.
  const documentTax = parseRevisionMicros(input.revision.totals.taxMicros);

  if (!documentTax.ok) {
    return documentTax;
  }

  const documentDuty = parseRevisionMicros(input.revision.totals.dutyMicros ?? '0');

  if (!documentDuty.ok) {
    return documentDuty;
  }

  const taxTotalMicros = documentTax.value - documentDuty.value;
  const dutyTotalMicros = documentDuty.value;

  // A destination with no duty field of its own receives ONE figure that already includes
  // both components; the destination's own definition of the policy code splits it. Sending
  // the tax-only part there would drop the duty, which is exactly what must not happen.
  const dutyTravelsSeparately =
    input.dutyHandling === undefined ||
    !dutyTravelsInsideTax(input.dutyHandling);
  const taxRowMicros = dutyTravelsSeparately
    ? taxTotalMicros
    : documentTax.value;
  const rowCode = (
    kind: keyof typeof ASAN_SPECIAL_ITEM_CODES,
  ): string =>
    (input.specialItemCodes?.[kind] ?? '').trim() ||
    // A caller that predates the single-policy-code rule stored the row code under the old
    // policy-mapping key; it is still a row code, so it may supply the default.
    (kind === 'tax' ? (input.taxVendorCode ?? '').trim() : '') ||
    (kind === 'duty' ? (input.dutyVendorCode ?? '').trim() : '') ||
    ASAN_SPECIAL_ITEM_CODES[kind];

  // Discount, duty and tax are separate lines with Count = 0 and the amount in Price. They
  // are appended only when the installation defines the code AND the amount is non-zero: a
  // zero-value line on a fiscal document is noise an accountant has to explain.
  const specialResult = appendSpecialLines({
    details,
    storageId: input.storageId ?? ASAN_DEFAULT_STORAGE_ID,
    convertToVendorUnits,
    amounts: [
      {
        enabled: input.specialCodesInUse.discount,
        code: rowCode('discount'),
        micros: discountTotalMicros,
        label: 'تخفیف',
      },
      {
        enabled: input.specialCodesInUse.duty && dutyTravelsSeparately,
        code: rowCode('duty'),
        micros: dutyTotalMicros,
        label: 'عوارض',
      },
      {
        enabled: input.specialCodesInUse.tax,
        code: rowCode('tax'),
        micros: taxRowMicros,
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
  convertToVendorUnits,
  amounts,
}: {
  details: AsanFactorDetail[];
  storageId: number;
  convertToVendorUnits: (micros: bigint) => Result<number>;
  amounts: {
    enabled: boolean;
    code: string;
    micros: bigint;
    label: string;
  }[];
}): Result<AsanFactorDetail[]> => {
  for (const amount of amounts) {
    if (!amount.enabled || amount.micros === 0n) {
      continue;
    }

    const value = convertToVendorUnits(amount.micros);

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


// Live Asan pre-dispatch gate. Independently reconstruct the payable from the
// wire rows; a rounding difference or omitted fiscal amount must not post.
export const validateAsanDocumentPayable = ({
  factor, revision, moneyUnit, specialItemCodes, productCodeByLineId,
}: {
  factor: AsanFactorViewModel;
  revision: QuotationRevisionSnapshot;
  moneyUnit: AccountingMoneyUnit;
  specialItemCodes?: AsanSpecialItemCodeOverrides;
  productCodeByLineId?: Record<string, number>;
}): Result<true> => {
  const financial = validateRevisionFinancialFacts(revision);
  if (!financial.ok) return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', financial.refusal.detail);
  const validInt = (value: number) => Number.isInteger(value) && value > 0 && value <= 2147483647;
  if (!validInt(factor.CustomerID) || !validInt(factor.UserID) || factor.FactorNumber !== 0 || factor.FactorDetails.length === 0) return refused('ASAN_DOCUMENT_ID_INVALID', 'customer/user id or document numbering is invalid');
  const codes = Object.fromEntries((['discount', 'duty', 'tax'] as const).map((kind) => [kind, (specialItemCodes?.[kind] ?? '').trim() || ASAN_SPECIAL_ITEM_CODES[kind]])) as Record<'discount' | 'duty' | 'tax', string>;
  if (Object.values(codes).some((code) => !/^\d+$/.test(code) || !validInt(Number(code))) || new Set(Object.values(codes).map(Number)).size !== 3) return refused('ASAN_SPECIAL_CODE_INVALID', 'special codes must be distinct positive int identifiers');
  const reserved = new Set(Object.values(codes).map(Number));
  const seen = new Set<number>();
  let payable = 0n;
  for (const detail of factor.FactorDetails) {
    if (!validInt(detail.ProductID) || !Number.isInteger(detail.StorageID) || detail.StorageID < 0 || detail.StorageID > 2147483647 ||
      !Number.isFinite(detail.Count) || detail.Count < 0 || !Number.isSafeInteger(detail.Price) || detail.Price < 0) return refused('ASAN_DOCUMENT_ROW_INVALID', 'invalid row amount, quantity or identifier');
    const special = reserved.has(detail.ProductID);
    if (detail.Count === 0) {
      if (!special || seen.has(detail.ProductID)) return refused('ASAN_SPECIAL_CODE_INVALID', 'unrecognized or repeated special row');
      seen.add(detail.ProductID);
    } else if (special) return refused('ASAN_SPECIAL_CODE_INVALID', 'ordinary product row uses a reserved special code');
    payable += BigInt(detail.Price) * (detail.Count === 0 && detail.ProductID === Number(codes.discount) ? -1n : 1n);
  }
  // An equal grand total is not sufficient: each fiscal component and product row
  // must match the seal independently. No undocumented rounding row is invented.
  const ordinary = factor.FactorDetails.filter(row => row.Count !== 0);
  if (ordinary.length !== revision.lines.length) return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', 'product row count differs from seal');
  for (let i = 0; i < revision.lines.length; i++) {
    const line = revision.lines[i];
    const decoded = decodeRevisionLine(line);
    if (!decoded.ok) return decoded;
    const quantity = scaledQuantityToAsanCount(decoded.value.quantity);
    const gross = crmMicrosToAsanUnits(decoded.value.gross, moneyUnit);
    if (!quantity.ok || !gross.ok || ordinary[i].Count !== quantity.value || ordinary[i].Price !== gross.value ||
        (productCodeByLineId !== undefined && ordinary[i].ProductID !== productCodeByLineId[line.lineId])) {
      return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', 'product row differs from sealed gross, quantity or mapped identity');
    }
  }
  const tax = parseRevisionMicros(revision.totals.taxMicros);
  const duty = parseRevisionMicros(revision.totals.dutyMicros ?? '0');
  const discount = parseRevisionMicros(revision.totals.discountMicros);
  if (!tax.ok || !duty.ok || !discount.ok) return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', 'invalid sealed fiscal components');
  for (const [kind, micros] of [['discount', discount.value], ['duty', duty.value], ['tax', tax.value - duty.value]] as const) {
    const expected = crmMicrosToAsanUnits(micros, moneyUnit);
    const row = factor.FactorDetails.find(detail => detail.Count === 0 && detail.ProductID === Number(codes[kind]));
    if (!expected.ok || (expected.value === 0 ? row !== undefined : row?.Price !== expected.value)) {
      return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', 'special fiscal row differs from sealed ' + kind);
    }
  }
  const total = parseRevisionMicros(revision.totals.totalMicros);
  if (!total.ok) return total;
  const expected = crmMicrosToAsanUnits(total.value, moneyUnit);
  if (!expected.ok) return expected;
  if (payable !== BigInt(expected.value)) return refused('ASAN_DOCUMENT_TOTAL_MISMATCH', 'wire payable differs from sealed CRM total; no undocumented rounding or missing amount may be posted');
  return accepted(true);
};
