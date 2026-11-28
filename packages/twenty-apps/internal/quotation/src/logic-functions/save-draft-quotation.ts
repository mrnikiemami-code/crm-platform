import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql } from 'src/data/record-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import {
  DEFAULT_TAX_POLICY_ID,
  resolveTaxPolicyFromCatalog,
  selectDefaultTaxPolicy,
} from 'src/domain/money/tax-policy';
import {
  type DraftDiscountInput,
  type DraftQuotationInput,
} from 'src/domain/quotation/draft-quotation';
import { persistDraftQuotation } from 'src/services/quotation-persist.service';
import { loadTaxPolicies } from 'src/services/tax-policy.service';
import {
  buildDraftQuotationWritePayload,
  validateDraftQuotation,
} from 'src/services/quotation-save.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readVersion = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  return typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : null;
};

const readDiscount = (
  row: Record<string, unknown>,
): DraftDiscountInput => {
  const kind = readString(row.discountKind).toUpperCase();
  const percent = readString(row.discountPercentText);
  const amount = readString(row.discountAmountText);

  if (kind === 'AMOUNT' || (amount !== '' && percent === '')) {
    return amount === ''
      ? { kind: 'NONE' }
      : { kind: 'AMOUNT', text: amount };
  }

  if (kind === 'RATE' || percent !== '') {
    return percent === ''
      ? { kind: 'NONE' }
      : { kind: 'RATE', percentText: percent };
  }

  return { kind: 'NONE' };
};

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const linesRaw = Array.isArray(body.lines) ? body.lines : [];

  const input: DraftQuotationInput = {
    quotationId: readString(body.quotationId) || null,
    expectedVersion: readVersion(body.expectedVersion),
    status: (readString(body.status) || 'DRAFT') as 'DRAFT',
    customerType:
      readString(body.customerType) === 'PERSON'
        ? ('PERSON' as const)
        : ('COMPANY' as const),
    personId: readString(body.personId) || null,
    companyId: readString(body.companyId) || null,
    name: readString(body.name),
    paymentTerms: readString(body.paymentTerms) || null,
    taxPolicy: readString(body.taxPolicy) || DEFAULT_TAX_POLICY_ID,
    currencyCode: readString(body.currencyCode) || 'IRR',
    documentDiscount: readDiscount({
      discountKind: body.documentDiscountKind,
      discountPercentText: body.documentDiscountPercentText,
      discountAmountText: body.documentDiscountAmountText,
    }),
    displayMoneyUnit:
      readString(body.displayMoneyUnit) === 'IRR'
        ? ('IRR' as const)
        : ('TOMAN' as const),
    lines: linesRaw.map((line, index) => {
      const row = asRecord(line);
      const moneyUnit = (readString(row.moneyUnit) || 'TOMAN') as MoneyUnit;

      return {
        clientLineId: readString(row.clientLineId) || `line-${index}`,
        catalogItemId: readString(row.catalogItemId) || null,
        kind: (readString(row.kind) === 'SERVICE'
          ? 'SERVICE'
          : 'PRODUCT') as CatalogItemKind,
        name: readString(row.name),
        description: readString(row.description) || null,
        unit: readString(row.unit),
        unitRecordId: readString(row.unitRecordId) || null,
        quantityText: readString(row.quantityText),
        unitPriceText: readString(row.unitPriceText),
        moneyUnit,
        discount: readDiscount(row),
        taxPolicy: readString(row.taxPolicy) || null,
      };
    }),
  };

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    const outcome = validateDraftQuotation(input);

    if (outcome.kind === 'REJECTED') {
      return {
        success: false,
        code: outcome.code,
        message: outcome.message,
      };
    }

    const payload = buildDraftQuotationWritePayload(outcome.plan);

    return {
      success: true,
      persisted: false,
      reason: 'APP_NOT_INSTALLED',
      message:
        'محاسبات معتبر است؛ برای نوشتن در پایگاه، اپ باید روی فضای کاری نصب شود.',
      plan: {
        totalExact: outcome.plan.totalExact,
        totalsExact: outcome.plan.totalsExact,
        displayTotal: outcome.plan.displayTotal,
        lineCount: outcome.plan.lines.length,
      },
      writePayload: payload.ok ? payload.value : null,
    };
  }

  // The rate is read from the workspace, never from the request. The form sends the
  // policy code it selected; an unknown or deactivated code is refused here, and a
  // counterfeit rate is refused again at the server boundary.
  let definedInput: DraftQuotationInput;

  try {
    // A read, not a seed: an empty catalog means the settings have not been set up
    // yet, and inventing a policy here would be a silent financial decision.
    const catalog = await loadTaxPolicies();

    if (catalog.length === 0) {
      return {
        success: false,
        code: 'TAX_POLICY_UNAVAILABLE',
        message:
          'هیچ سیاست مالیاتی تعریف نشده است؛ ابتدا در تنظیمات مالیات یک سیاست بسازید.',
      };
    }

    const requestedCode =
      input.taxPolicy ??
      selectDefaultTaxPolicy(catalog)?.id ??
      DEFAULT_TAX_POLICY_ID;
    const policy = resolveTaxPolicyFromCatalog(requestedCode, catalog);

    if (!policy.ok) {
      return {
        success: false,
        code: policy.refusal.code,
        message: policy.refusal.detail,
      };
    }

    const headerDefinition = {
      id: policy.value.id,
      label: policy.value.label,
      rateBasisPoints: policy.value.rateBasisPoints,
      dutyRateBasisPoints: policy.value.dutyRateBasisPoints,
      isExempt: policy.value.isExempt,
    };

    const resolvedLines: typeof input.lines = [];

    for (const line of input.lines) {
      const lineCode = (line.taxPolicy ?? '').trim() || policy.value.id;
      const linePolicy = resolveTaxPolicyFromCatalog(lineCode, catalog);

      if (!linePolicy.ok) {
        return {
          success: false,
          code: linePolicy.refusal.code,
          message: linePolicy.refusal.detail,
        };
      }

      resolvedLines.push({
        ...line,
        taxPolicy: linePolicy.value.id,
        taxPolicyDefinition: {
          id: linePolicy.value.id,
          label: linePolicy.value.label,
          rateBasisPoints: linePolicy.value.rateBasisPoints,
          dutyRateBasisPoints: linePolicy.value.dutyRateBasisPoints,
          isExempt: linePolicy.value.isExempt,
        },
      });
    }

    definedInput = {
      ...input,
      taxPolicy: policy.value.id,
      taxPolicyDefinition: headerDefinition,
      lines: resolvedLines,
    };
  } catch (error) {
    console.error('save-draft-quotation: tax policy lookup failed', error);

    return {
      success: false,
      code: 'PERSISTENCE_FAILED',
      message: 'خواندن سیاست مالیات انجام نشد؛ دوباره تلاش کنید',
    };
  }

  const saved = await persistDraftQuotation(definedInput, {
    execute: executeRecordGraphql,
  });

  if (saved.kind !== 'SAVED') {
    return {
      success: false,
      code: saved.kind === 'REJECTED' ? saved.code : 'PERSISTENCE_FAILED',
      message:
        saved.kind === 'REJECTED'
          ? saved.message
          : 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  return {
    success: true,
    persisted: true,
    quotationId: saved.quotationId,
    version: saved.version,
    plan: {
      totalExact: saved.plan.totalExact,
      totalsExact: saved.plan.totalsExact,
      displayTotal: saved.plan.displayTotal,
      lineCount: saved.plan.lines.length,
    },
    message: 'پیش‌نویس پیش‌فاکتور ذخیره شد',
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-draft-quotation',
  description: 'اعتبارسنجی و ذخیره پیش‌نویس پیش‌فاکتور',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/save-draft',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
