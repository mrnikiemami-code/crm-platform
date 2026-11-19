import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  formatMoneyForDisplay,
  parseMoneyInput,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  finalizeLinesWithDocumentDiscount,
  formatTotalsExact,
  type QuotationTotalsExactText,
} from 'src/domain/money/document-totals';
import {
  computeLinePreTaxAmounts,
  type LineDiscount,
  type QuotationLineAmounts,
} from 'src/domain/money/line';
import { formatExactDecimalForPeople } from 'src/domain/money/display-format';
import { formatMicrosExact } from 'src/domain/money/micros';
import {
  formatQuantityExact,
  parseQuantity,
} from 'src/domain/money/quantity';
import {
  DEFAULT_TAX_POLICY_ID,
  resolveTaxPolicy,
} from 'src/domain/money/tax-policy';
import {
  canEditQuotationLines,
  type QuotationStatus,
} from 'src/domain/quotation/status';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Builds what a DRAFT quotation looks like after the operator typed quantities and
// amounts. Pure: no GraphQL, no install. The front component and the save route both
// call this so the totals on screen and the totals on disk cannot disagree.
//
// FINANCIAL ORDER (S2-R8/R10, extends provisional S1):
//   line: gross → line discount → net
//   document: discount on sum(nets), capacity-safe Hamilton allocation
//   tax: on (net − document share), rate from resolved tax policy (not free-typed %)
//   payable: floor(sum(line totals)) to whole IRR; roundingExact = payable − (net + tax)

export type DraftDiscountInput =
  | { kind: 'NONE' }
  | { kind: 'AMOUNT'; text: string }
  | { kind: 'RATE'; percentText: string };

export type DraftLineInput = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  unit: string;
  quantityText: string;
  unitPriceText: string;
  moneyUnit: MoneyUnit;
  discount: DraftDiscountInput;
};

export type DraftQuotationInput = {
  quotationId: string | null;
  status: QuotationStatus;
  customerType: 'PERSON' | 'COMPANY';
  personId: string | null;
  companyId: string | null;
  name: string;
  paymentTerms: string | null;
  taxPolicy: string | null;
  documentDiscount: DraftDiscountInput;
  displayMoneyUnit: MoneyUnit;
  lines: DraftLineInput[];
};

export type DraftLineRecord = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  unit: string;
  quantityExact: string;
  unitPriceExact: string;
  grossExact: string;
  discountExact: string;
  documentDiscountExact: string;
  taxExact: string;
  totalExact: string;
  sortOrder: number;
  amounts: QuotationLineAmounts;
};

export type DraftQuotationPlan = {
  quotationId: string | null;
  status: 'DRAFT';
  customerType: 'PERSON' | 'COMPANY';
  personId: string | null;
  companyId: string | null;
  name: string;
  paymentTerms: string | null;
  taxPolicy: string;
  taxRateBasisPoints: string;
  currencyCode: 'IRR';
  version: number;
  documentDiscountKind: 'NONE' | 'RATE' | 'AMOUNT';
  documentDiscountInputExact: string;
  totalExact: string;
  totalsExact: QuotationTotalsExactText;
  displayTotal: string;
  displayGross: string;
  displayLineDiscount: string;
  displayDocumentDiscount: string;
  displayTax: string;
  displayRounding: string;
  lines: DraftLineRecord[];
};

const parsePercentToBasisPoints = (text: string): Result<bigint> => {
  const money = parseMoneyInput(text === '' ? '0' : text, 'IRR');

  if (!money.ok) {
    return refused('TAX_RATE_INVALID', 'نرخ باید عدد معتبر باشد');
  }

  const percentMicros = money.value.irrMicros;
  const basisPoints = percentMicros / 10_000n;

  if (percentMicros % 10_000n !== 0n) {
    return refused(
      'TAX_RATE_TOO_FINE',
      'درصد حداکثر دو رقم اعشار دارد (مثلاً ۹ یا ۹٫۵)',
    );
  }

  return accepted(basisPoints);
};

const buildDiscount = (
  discount: DraftDiscountInput,
  moneyUnit: MoneyUnit,
): Result<LineDiscount> => {
  switch (discount.kind) {
    case 'NONE':
      return accepted({ kind: 'NONE' });
    case 'RATE': {
      const rate = parsePercentToBasisPoints(discount.percentText);

      if (!rate.ok) {
        return refused('DISCOUNT_RATE_INVALID', 'درصد تخفیف معتبر نیست');
      }

      return accepted({ kind: 'RATE', basisPoints: rate.value });
    }
    case 'AMOUNT': {
      const amount = parseMoneyInput(discount.text, moneyUnit);

      if (!amount.ok) {
        return refused('DISCOUNT_AMOUNT_INVALID', 'مبلغ تخفیف معتبر نیست');
      }

      return accepted({ kind: 'AMOUNT', micros: amount.value.irrMicros });
    }
  }
};

const documentDiscountInputExact = (
  discount: DraftDiscountInput,
  moneyUnit: MoneyUnit,
): Result<{ kind: 'NONE' | 'RATE' | 'AMOUNT'; inputExact: string }> => {
  switch (discount.kind) {
    case 'NONE':
      return accepted({ kind: 'NONE', inputExact: '0.000000' });
    case 'RATE': {
      const rate = parsePercentToBasisPoints(discount.percentText);

      if (!rate.ok) {
        return refused('DISCOUNT_RATE_INVALID', 'درصد تخفیف کل معتبر نیست');
      }

      // Store percent with 6 fraction digits of the percent value (9 → 9.000000).
      return accepted({
        kind: 'RATE',
        inputExact: formatMicrosExact(rate.value * 10_000n),
      });
    }
    case 'AMOUNT': {
      const amount = parseMoneyInput(discount.text, moneyUnit);

      if (!amount.ok) {
        return refused('DISCOUNT_AMOUNT_INVALID', 'مبلغ تخفیف کل معتبر نیست');
      }

      return accepted({
        kind: 'AMOUNT',
        inputExact: formatMicrosExact(amount.value.irrMicros),
      });
    }
  }
};

type BuiltPreTaxLine = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  unit: string;
  quantityExact: string;
  unitPriceExact: string;
  sortOrder: number;
  preTax: {
    grossMicros: bigint;
    discountMicros: bigint;
    netAfterLineDiscountMicros: bigint;
  };
};

const computeOnePreTaxLine = (
  line: DraftLineInput,
  sortOrder: number,
): Result<BuiltPreTaxLine> => {
  const name = line.name.trim();

  if (name === '') {
    return refused('LINE_NAME_MISSING', 'هر ردیف باید نام داشته باشد');
  }

  if (line.unit.trim() === '') {
    return refused('LINE_UNIT_MISSING', 'واحد اندازه‌گیری الزامی است');
  }

  const quantity = parseQuantity(line.quantityText);

  if (!quantity.ok) {
    return refused('QUANTITY_INVALID', `مقدار «${line.name}» معتبر نیست`);
  }

  const unitPrice = parseMoneyInput(line.unitPriceText, line.moneyUnit);

  if (!unitPrice.ok) {
    return refused('UNIT_PRICE_INVALID', `قیمت «${line.name}» معتبر نیست`);
  }

  const discount = buildDiscount(line.discount, line.moneyUnit);

  if (!discount.ok) {
    return discount;
  }

  const preTax = computeLinePreTaxAmounts({
    quantityScaled: quantity.value,
    unitPriceMicros: unitPrice.value.irrMicros,
    discount: discount.value,
  });

  if (!preTax.ok) {
    return refused(preTax.refusal.code, preTax.refusal.detail);
  }

  return accepted({
    clientLineId: line.clientLineId,
    catalogItemId: line.catalogItemId,
    kind: line.kind,
    name,
    description: line.description?.trim() ? line.description.trim() : null,
    unit: line.unit.trim(),
    quantityExact: formatQuantityExact(quantity.value),
    unitPriceExact: formatMicrosExact(unitPrice.value.irrMicros),
    sortOrder,
    preTax: preTax.value,
  });
};

const displayAmount = (
  micros: bigint,
  unit: MoneyUnit,
): Result<string> => {
  const display = formatMoneyForDisplay({
    irrMicros: micros,
    unit,
    formatExact: formatMicrosExact,
    formatPeople: formatExactDecimalForPeople,
  });

  if (display.ok) {
    return display;
  }

  return formatMoneyForDisplay({
    irrMicros: micros,
    unit: 'IRR',
    formatExact: formatMicrosExact,
    formatPeople: formatExactDecimalForPeople,
  });
};

export const buildDraftQuotationPlan = (
  input: DraftQuotationInput,
): Result<DraftQuotationPlan> => {
  if (!canEditQuotationLines(input.status) && input.quotationId !== null) {
    return refused(
      'QUOTATION_NOT_EDITABLE',
      'این پیش‌فاکتور قفل است و فقط با صدور نسخهٔ جدید قابل تغییر است',
    );
  }

  if (input.customerType === 'PERSON' && !input.personId) {
    return refused('CUSTOMER_PERSON_REQUIRED', 'شخص مشتری را انتخاب کنید');
  }

  if (input.customerType === 'COMPANY' && !input.companyId) {
    return refused('CUSTOMER_COMPANY_REQUIRED', 'شرکت مشتری را انتخاب کنید');
  }

  if (input.customerType === 'PERSON' && input.companyId) {
    return refused(
      'CUSTOMER_MIXED',
      'پیش‌فاکتور شخص نباید به شرکت هم وصل باشد',
    );
  }

  if (input.customerType === 'COMPANY' && input.personId) {
    return refused(
      'CUSTOMER_MIXED',
      'پیش‌فاکتور شرکت نباید به شخص هم وصل باشد',
    );
  }

  const title = input.name.trim();

  if (title === '') {
    return refused('QUOTATION_NAME_MISSING', 'عنوان پیش‌فاکتور الزامی است');
  }

  if (input.lines.length === 0) {
    return refused('DOCUMENT_HAS_NO_LINES', 'حداقل یک ردیف کالا یا خدمت لازم است');
  }

  const taxPolicy = resolveTaxPolicy(
    input.taxPolicy ?? DEFAULT_TAX_POLICY_ID,
  );

  if (!taxPolicy.ok) {
    return taxPolicy;
  }

  const documentDiscount = buildDiscount(
    input.documentDiscount,
    input.displayMoneyUnit,
  );

  if (!documentDiscount.ok) {
    return documentDiscount;
  }

  const documentDiscountMeta = documentDiscountInputExact(
    input.documentDiscount,
    input.displayMoneyUnit,
  );

  if (!documentDiscountMeta.ok) {
    return documentDiscountMeta;
  }

  const builtPreTax: BuiltPreTaxLine[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const built = computeOnePreTaxLine(input.lines[index], index);

    if (!built.ok) {
      return built;
    }

    builtPreTax.push(built.value);
  }

  const finalized = finalizeLinesWithDocumentDiscount({
    preTaxLines: builtPreTax.map((line) => line.preTax),
    documentDiscount: documentDiscount.value,
    taxRateBasisPoints: taxPolicy.value.rateBasisPoints,
  });

  if (!finalized.ok) {
    return finalized;
  }

  const totalsExact = formatTotalsExact(finalized.value.totals);
  const displayTotal = displayAmount(
    finalized.value.totals.totalMicros,
    input.displayMoneyUnit,
  );
  const displayGross = displayAmount(
    finalized.value.totals.grossMicros,
    input.displayMoneyUnit,
  );
  const displayLineDiscount = displayAmount(
    finalized.value.totals.lineDiscountMicros,
    input.displayMoneyUnit,
  );
  const displayDocumentDiscount = displayAmount(
    finalized.value.totals.documentDiscountMicros,
    input.displayMoneyUnit,
  );
  const displayTax = displayAmount(
    finalized.value.totals.taxMicros,
    input.displayMoneyUnit,
  );
  const displayRounding = displayAmount(
    finalized.value.totals.roundingMicros,
    input.displayMoneyUnit,
  );

  if (
    !displayTotal.ok ||
    !displayGross.ok ||
    !displayLineDiscount.ok ||
    !displayDocumentDiscount.ok ||
    !displayTax.ok ||
    !displayRounding.ok
  ) {
    return refused('DISPLAY_AMOUNT_INVALID', 'نمایش مبلغ ممکن نیست');
  }

  const lines: DraftLineRecord[] = builtPreTax.map((preTaxLine, index) => {
    const amounts = finalized.value.lines[index];

    return {
      clientLineId: preTaxLine.clientLineId,
      catalogItemId: preTaxLine.catalogItemId,
      kind: preTaxLine.kind,
      name: preTaxLine.name,
      description: preTaxLine.description,
      unit: preTaxLine.unit,
      quantityExact: preTaxLine.quantityExact,
      unitPriceExact: preTaxLine.unitPriceExact,
      grossExact: formatMicrosExact(amounts.grossMicros),
      discountExact: formatMicrosExact(amounts.discountMicros),
      documentDiscountExact: formatMicrosExact(amounts.documentDiscountMicros),
      taxExact: formatMicrosExact(amounts.taxMicros),
      totalExact: formatMicrosExact(amounts.totalMicros),
      sortOrder: preTaxLine.sortOrder,
      amounts,
    };
  });

  return accepted({
    quotationId: input.quotationId,
    status: 'DRAFT',
    customerType: input.customerType,
    personId: input.customerType === 'PERSON' ? input.personId : null,
    companyId: input.customerType === 'COMPANY' ? input.companyId : null,
    name: title,
    paymentTerms: input.paymentTerms?.trim() ? input.paymentTerms.trim() : null,
    taxPolicy: taxPolicy.value.id,
    taxRateBasisPoints: taxPolicy.value.rateBasisPoints.toString(),
    currencyCode: 'IRR',
    version: 1,
    documentDiscountKind: documentDiscountMeta.value.kind,
    documentDiscountInputExact: documentDiscountMeta.value.inputExact,
    totalExact: totalsExact.totalExact,
    totalsExact,
    displayTotal: displayTotal.value,
    displayGross: displayGross.value,
    displayLineDiscount: displayLineDiscount.value,
    displayDocumentDiscount: displayDocumentDiscount.value,
    displayTax: displayTax.value,
    displayRounding: displayRounding.value,
    lines,
  });
};
