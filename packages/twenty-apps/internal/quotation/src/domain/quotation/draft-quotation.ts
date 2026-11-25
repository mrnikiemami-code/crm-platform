import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  formatMoneyForDisplay,
  parseMoneyInput,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  assertPhase1DocumentCurrency,
  emptyTotalsByCurrency,
  type TotalsByCurrency,
} from 'src/domain/money/document-currency';
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
  buildTaxPolicyDefinition,
  parsePercentToBasisPoints,
  resolveTaxPolicy,
  type TaxPolicyDefinition,
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
  // WS3: omit or null → inherit document default tax policy.
  taxPolicy?: string | null;
  taxPolicyDefinition?: TaxPolicyDefinition | null;
};

export type DraftQuotationInput = {
  quotationId: string | null;
  // The version the form was opened at. A mismatch means someone else saved in
  // between, so the write is refused instead of silently overwriting their edit.
  expectedVersion?: number | null;
  status: QuotationStatus;
  customerType: 'PERSON' | 'COMPANY';
  personId: string | null;
  companyId: string | null;
  name: string;
  paymentTerms: string | null;
  taxPolicy: string | null;
  // The policy row the operator picked, already read from the workspace. When it
  // is absent the legacy registry decides, which keeps older callers and every
  // sealed document readable without a second source of truth.
  taxPolicyDefinition?: TaxPolicyDefinition | null;
  documentDiscount: DraftDiscountInput;
  // ISO document currency (catalog). Distinct from displayMoneyUnit (IRR/TOMAN scale).
  currencyCode?: string | null;
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
  // The operator's instruction, not just its result: reopening a draft must show
  // "10%" again instead of a frozen amount that means something else next time.
  discountKind: 'NONE' | 'RATE' | 'AMOUNT';
  discountInputExact: string;
  documentDiscountExact: string;
  taxExact: string;
  totalExact: string;
  // WS3: frozen per-line policy identity and rates (authority for this line's tax).
  taxPolicy: string;
  taxRateBasisPoints: string;
  dutyRateBasisPoints: string;
  // WS4: always equals document currency while MULTI_CURRENCY_DOCUMENTS is off.
  currencyCode: string;
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
  // The duty component of the same policy, frozen with the document exactly like the
  // tax rate. `dutyExact` is the duty part of `taxExact` (tax = taxExact - dutyExact).
  dutyRateBasisPoints: string;
  currencyCode: string;
  version: number;
  documentDiscountKind: 'NONE' | 'RATE' | 'AMOUNT';
  documentDiscountInputExact: string;
  totalExact: string;
  dutyExact: string;
  totalsExact: QuotationTotalsExactText;
  // Phase-2 stub: empty while MULTI_CURRENCY_DOCUMENTS is false (no FX bucketing).
  totalsByCurrency: TotalsByCurrency;
  displayTotal: string;
  displayGross: string;
  displayLineDiscount: string;
  displayDocumentDiscount: string;
  displayNet: string;
  displayTaxOnly: string;
  displayDuty: string;
  displayTax: string;
  displayRounding: string;
  lines: DraftLineRecord[];
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

const buildDiscountInputMeta = (
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
  discountKind: 'NONE' | 'RATE' | 'AMOUNT';
  discountInputExact: string;
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

  const discountMeta = buildDiscountInputMeta(line.discount, line.moneyUnit);

  if (!discountMeta.ok) {
    return discountMeta;
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
    discountKind: discountMeta.value.kind,
    discountInputExact: discountMeta.value.inputExact,
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

// A rate is never taken from the form: the selected policy is re-validated here,
// and a definition that disagrees with the requested code is refused instead of
// silently pricing the document with a different rate.
const resolveTaxPolicyFromCodeAndDefinition = ({
  taxPolicy,
  taxPolicyDefinition,
}: {
  taxPolicy: string | null | undefined;
  taxPolicyDefinition?: TaxPolicyDefinition | null;
}): Result<TaxPolicyDefinition> => {
  if (taxPolicyDefinition === undefined || taxPolicyDefinition === null) {
    return resolveTaxPolicy(taxPolicy ?? DEFAULT_TAX_POLICY_ID);
  }

  const requested =
    (taxPolicy ?? '').trim() || taxPolicyDefinition.id;

  if (requested !== taxPolicyDefinition.id) {
    return refused(
      'TAX_POLICY_MISMATCH',
      'سیاست مالیات انتخاب‌شده با نرخ ارسالی هم‌خوان نیست',
    );
  }

  return buildTaxPolicyDefinition({
    code: taxPolicyDefinition.id,
    label: taxPolicyDefinition.label,
    rateBasisPoints: taxPolicyDefinition.rateBasisPoints,
    dutyRateBasisPoints: taxPolicyDefinition.dutyRateBasisPoints,
    isExempt: taxPolicyDefinition.isExempt,
  });
};

const resolveSelectedTaxPolicy = (
  input: DraftQuotationInput,
): Result<TaxPolicyDefinition> =>
  resolveTaxPolicyFromCodeAndDefinition({
    taxPolicy: input.taxPolicy,
    taxPolicyDefinition: input.taxPolicyDefinition,
  });

// Line inherits the document default when it omits a policy or points at the same one.
const resolveLineTaxPolicy = (
  line: DraftLineInput,
  documentPolicy: TaxPolicyDefinition,
): Result<TaxPolicyDefinition> => {
  const lineCode = (line.taxPolicy ?? '').trim();

  if (
    lineCode === '' &&
    (line.taxPolicyDefinition === undefined || line.taxPolicyDefinition === null)
  ) {
    return accepted(documentPolicy);
  }

  if (
    lineCode === documentPolicy.id &&
    (line.taxPolicyDefinition === undefined || line.taxPolicyDefinition === null)
  ) {
    return accepted(documentPolicy);
  }

  return resolveTaxPolicyFromCodeAndDefinition({
    taxPolicy: lineCode || null,
    taxPolicyDefinition: line.taxPolicyDefinition,
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

  const taxPolicy = resolveSelectedTaxPolicy(input);

  if (!taxPolicy.ok) {
    return taxPolicy;
  }

  const documentCurrency = assertPhase1DocumentCurrency(input.currencyCode);

  if (!documentCurrency.ok) {
    return documentCurrency;
  }

  const documentDiscount = buildDiscount(
    input.documentDiscount,
    input.displayMoneyUnit,
  );

  if (!documentDiscount.ok) {
    return documentDiscount;
  }

  const documentDiscountMeta = buildDiscountInputMeta(
    input.documentDiscount,
    input.displayMoneyUnit,
  );

  if (!documentDiscountMeta.ok) {
    return documentDiscountMeta;
  }

  const builtPreTax: BuiltPreTaxLine[] = [];
  const linePolicies: TaxPolicyDefinition[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const built = computeOnePreTaxLine(input.lines[index], index);

    if (!built.ok) {
      return built;
    }

    const linePolicy = resolveLineTaxPolicy(
      input.lines[index],
      taxPolicy.value,
    );

    if (!linePolicy.ok) {
      return linePolicy;
    }

    builtPreTax.push(built.value);
    linePolicies.push(linePolicy.value);
  }

  const finalized = finalizeLinesWithDocumentDiscount({
    preTaxLines: builtPreTax.map((line) => line.preTax),
    documentDiscount: documentDiscount.value,
    taxRateBasisPoints: taxPolicy.value.rateBasisPoints,
    dutyRateBasisPoints: taxPolicy.value.dutyRateBasisPoints,
    lineTaxRates: linePolicies.map((policy) => ({
      taxRateBasisPoints: policy.rateBasisPoints,
      dutyRateBasisPoints: policy.dutyRateBasisPoints,
    })),
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
  const displayNet = displayAmount(
    finalized.value.totals.netMicros,
    input.displayMoneyUnit,
  );
  const displayTaxOnly = displayAmount(
    finalized.value.totals.taxOnlyMicros,
    input.displayMoneyUnit,
  );
  const displayDuty = displayAmount(
    finalized.value.totals.dutyMicros,
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
    !displayNet.ok ||
    !displayTaxOnly.ok ||
    !displayDuty.ok ||
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
      discountKind: preTaxLine.discountKind,
      discountInputExact: preTaxLine.discountInputExact,
      documentDiscountExact: formatMicrosExact(amounts.documentDiscountMicros),
      taxExact: formatMicrosExact(amounts.taxMicros),
      totalExact: formatMicrosExact(amounts.totalMicros),
      taxPolicy: linePolicies[index].id,
      taxRateBasisPoints: linePolicies[index].rateBasisPoints.toString(),
      dutyRateBasisPoints: linePolicies[index].dutyRateBasisPoints.toString(),
      currencyCode: documentCurrency.value,
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
    dutyRateBasisPoints: taxPolicy.value.dutyRateBasisPoints.toString(),
    currencyCode: documentCurrency.value,
    version: 1,
    documentDiscountKind: documentDiscountMeta.value.kind,
    documentDiscountInputExact: documentDiscountMeta.value.inputExact,
    totalExact: totalsExact.totalExact,
    dutyExact: totalsExact.dutyExact,
    totalsExact,
    totalsByCurrency: emptyTotalsByCurrency(),
    displayTotal: displayTotal.value,
    displayGross: displayGross.value,
    displayLineDiscount: displayLineDiscount.value,
    displayDocumentDiscount: displayDocumentDiscount.value,
    displayNet: displayNet.value,
    displayTaxOnly: displayTaxOnly.value,
    displayDuty: displayDuty.value,
    displayTax: displayTax.value,
    displayRounding: displayRounding.value,
    lines,
  });
};
