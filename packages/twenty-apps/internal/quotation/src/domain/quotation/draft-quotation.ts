import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  formatMoneyForDisplay,
  parseMoneyInput,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  computeDocumentTotals,
  formatTotalsExact,
  type QuotationTotalsExactText,
} from 'src/domain/money/document-totals';
import {
  computeLineAmounts,
  type LineDiscount,
  type QuotationLineAmounts,
} from 'src/domain/money/line';
import { formatMicrosExact } from 'src/domain/money/micros';
import {
  formatQuantityExact,
  parseQuantity,
} from 'src/domain/money/quantity';
import {
  canEditQuotationLines,
  type QuotationStatus,
} from 'src/domain/quotation/status';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Builds what a DRAFT quotation looks like after the operator typed quantities and
// amounts. Pure: no GraphQL, no install. The front component and the save route both
// call this so the totals on screen and the totals on disk cannot disagree.

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
  discount:
    | { kind: 'NONE' }
    | { kind: 'AMOUNT'; text: string }
    | { kind: 'RATE'; percentText: string };
  taxRatePercentText: string;
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
  discountExact: string;
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
  taxPolicy: string | null;
  currencyCode: 'IRR';
  version: number;
  totalExact: string;
  totalsExact: QuotationTotalsExactText;
  displayTotal: string;
  lines: DraftLineRecord[];
};

const parsePercentToBasisPoints = (text: string): Result<bigint> => {
  const money = parseMoneyInput(text === '' ? '0' : text, 'IRR');

  if (!money.ok) {
    return refused('TAX_RATE_INVALID', 'نرخ مالیات باید عدد معتبر باشد');
  }

  // parseMoneyInput scales by 1e6 micros; 9% → 9.000000 units → 9_000_000 micros.
  // Basis points are hundredths of a percent: 9% = 900 bp. micros/10000 = bp when
  // the typed number is a percent (9 → 900).
  const percentMicros = money.value.irrMicros;
  const basisPoints = percentMicros / 10_000n;

  if (percentMicros % 10_000n !== 0n) {
    return refused(
      'TAX_RATE_TOO_FINE',
      'نرخ مالیات حداکثر دو رقم اعشار دارد (مثلاً ۹ یا ۹٫۵)',
    );
  }

  return accepted(basisPoints);
};

const buildDiscount = (
  discount: DraftLineInput['discount'],
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

const computeOneLine = (
  line: DraftLineInput,
  sortOrder: number,
): Result<DraftLineRecord> => {
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

  const taxRate = parsePercentToBasisPoints(line.taxRatePercentText);

  if (!taxRate.ok) {
    return taxRate;
  }

  const amounts = computeLineAmounts({
    quantityScaled: quantity.value,
    unitPriceMicros: unitPrice.value.irrMicros,
    discount: discount.value,
    taxRateBasisPoints: taxRate.value,
  });

  if (!amounts.ok) {
    return refused(amounts.refusal.code, amounts.refusal.detail);
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
    discountExact: formatMicrosExact(amounts.value.discountMicros),
    taxExact: formatMicrosExact(amounts.value.taxMicros),
    totalExact: formatMicrosExact(amounts.value.totalMicros),
    sortOrder,
    amounts: amounts.value,
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

  const builtLines: DraftLineRecord[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const built = computeOneLine(input.lines[index], index);

    if (!built.ok) {
      return built;
    }

    builtLines.push(built.value);
  }

  const totals = computeDocumentTotals(builtLines.map((line) => line.amounts));

  if (!totals.ok) {
    return totals;
  }

  const totalsExact = formatTotalsExact(totals.value);
  const display = formatMoneyForDisplay({
    irrMicros: totals.value.totalMicros,
    unit: input.displayMoneyUnit,
    formatExact: formatMicrosExact,
  });

  if (!display.ok) {
    // Fall back to rial when toman cannot express the micro remainder.
    const rialDisplay = formatMoneyForDisplay({
      irrMicros: totals.value.totalMicros,
      unit: 'IRR',
      formatExact: formatMicrosExact,
    });

    if (!rialDisplay.ok) {
      return rialDisplay;
    }

    return accepted({
      quotationId: input.quotationId,
      status: 'DRAFT',
      customerType: input.customerType,
      personId: input.customerType === 'PERSON' ? input.personId : null,
      companyId: input.customerType === 'COMPANY' ? input.companyId : null,
      name: title,
      paymentTerms: input.paymentTerms?.trim() ? input.paymentTerms.trim() : null,
      taxPolicy: input.taxPolicy?.trim() ? input.taxPolicy.trim() : null,
      currencyCode: 'IRR',
      version: 1,
      totalExact: totalsExact.totalExact,
      totalsExact,
      displayTotal: rialDisplay.value,
      lines: builtLines,
    });
  }

  return accepted({
    quotationId: input.quotationId,
    status: 'DRAFT',
    customerType: input.customerType,
    personId: input.customerType === 'PERSON' ? input.personId : null,
    companyId: input.customerType === 'COMPANY' ? input.companyId : null,
    name: title,
    paymentTerms: input.paymentTerms?.trim() ? input.paymentTerms.trim() : null,
    taxPolicy: input.taxPolicy?.trim() ? input.taxPolicy.trim() : null,
    currencyCode: 'IRR',
    version: 1,
    totalExact: totalsExact.totalExact,
    totalsExact,
    displayTotal: display.value,
    lines: builtLines,
  });
};
