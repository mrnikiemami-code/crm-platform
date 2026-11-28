import {
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';
import {
  type AdapterCapabilities,
  currencyModeNeedsRate,
  taxModeNeedsVendorCode,
} from 'src/domain/accounting/capabilities';
import { taxPolicyProfileFromSnapshot } from 'src/domain/accounting/tax-code-contract';
import {
  checkFinancialRequirements,
  CURRENCY_CODE_PATTERN,
  financialSettingsFromRecord,
  isConversionRateUsable,
} from 'src/domain/accounting/financial-contract';
import {
  type AsanFactorViewModel,
  mapRevisionToAsanFactor,
  scaledQuantityToAsanCount,
  validateAsanDocumentPayable,
} from 'src/domain/accounting/adapters/asan/asan-factor';
import { QUOTATION_EXPORTABLE_STATUSES } from 'src/domain/accounting/outbound-plan';
import { formatMicrosExact } from 'src/domain/money/micros';
import { parseRevisionMicros, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

// Everything a person needs to judge "would this document travel, and what would the
// destination receive" BEFORE anything is written. It is built from the sealed revision and
// the same mapper the real dispatch uses, so the preview cannot describe a document the
// dispatch would not build. Nothing here calls a vendor.
export type DocumentPreviewLine = {
  lineId: string;
  description: string;
  externalItemId: string | null;
  quantity: number | null;
  totalMicros: string | null;
  taxMicros: string | null;
  // A stable code, not a sentence: the sentence belongs to the screen that shows it.
  problem: string | null;
};

export type QuotationDocumentPreview = {
  checks: { code: string; ok: boolean }[];
  // Things a person should know before sending that do not, on their own, block a document.
  // Kept apart from `checks` so a warning never reads as a missing requirement.
  warnings: { code: string; detail: string }[];
  document: AsanFactorViewModel | null;
  documentError: { code: string; detail: string } | null;
  moneyUnit: string;
  customerExternalId: string | null;
  lines: DocumentPreviewLine[];
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
};

export type DocumentPreviewInput = {
  revision: QuotationRevisionSnapshot | null;
  quotationStatus: string;
  quotationName: string;
  descriptionOverride?: string;
  asanWire?: boolean;
  settings: ConnectionSettings;
  capabilities: AdapterCapabilities;
  flags: { outboundEnabled: boolean; documentExportEnabled: boolean };
  customerExternalId: string | null;
  lineLinks: { lineId: string; externalItemId: string | null }[];
};

const toVendorId = (value: string | null): number | null => {
  const text = (value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const parsed = Number(text);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

// Preserve the existing preview/UI decimal-IRR presentation contract, not the raw seal encoding.
const displayRevisionAmount = (text: string): string | null => {
  const parsed = parseRevisionMicros(text);
  return parsed.ok ? formatMicrosExact(parsed.value) : null;
};

const amountIsPositive = (text: string | undefined): boolean => {
  const parsed = parseRevisionMicros(text ?? '');

  return parsed.ok && parsed.value > 0n;
};

export const buildQuotationDocumentPreview = (
  input: DocumentPreviewInput,
): QuotationDocumentPreview => {
  const { revision, settings, capabilities, flags } = input;
  const linkByLineId = new Map(
    input.lineLinks.map((link) => [link.lineId, link.externalItemId]),
  );
  const snapshotLines = revision?.lines ?? [];

  const lineRows: DocumentPreviewLine[] = snapshotLines.map((line) => {
    const externalItemId = linkByLineId.get(line.lineId) ?? null;
    const scaled = parseRevisionMicros(line.quantityScaled);
    const quantity = scaled.ok ? scaledQuantityToAsanCount(scaled.value) : scaled;
    const linkIsUsable = toVendorId(externalItemId) !== null;

    return {
      lineId: line.lineId,
      description: line.description,
      externalItemId,
      quantity: quantity.ok ? quantity.value : null,
      totalMicros: displayRevisionAmount(line.totalMicros),
      taxMicros: displayRevisionAmount(line.taxMicros),
      problem: linkIsUsable ? null : 'LINE_HAS_NO_PRODUCT_LINK',
    };
  });

  const customerCode = toVendorId(input.customerExternalId);
  const userId = toVendorId(settings.remoteUserId);
  const storageId =
    settings.defaultStorageId.trim() === ''
      ? null
      : /^(0|[1-9]\d*)$/.test(settings.defaultStorageId.trim()) && Number(settings.defaultStorageId) <= 2147483647
        ? Number(settings.defaultStorageId) : null;
  const taxTotal = revision?.totals.taxMicros ?? '0';
  const dutyTotal = revision?.totals.dutyMicros ?? '0';
  const discountTotal = revision?.totals.discountMicros ?? '0';
  const hasTax = amountIsPositive(taxTotal);
  // `taxMicros` already includes duty, so a duty-only policy still has tax to carry; the
  // duty flag exists to judge the DUTY contract, not to imply tax is absent.
  const hasDuty = amountIsPositive(dutyTotal);
  const hasDiscount = amountIsPositive(discountTotal);
  const taxPolicyCode = (revision?.taxPolicy ?? '').trim();
  const taxVendorCode = settings.taxPolicyMappings[taxPolicyCode] ?? '';
  const financial = financialSettingsFromRecord(settings.financial);
  const documentCurrencyCode = (revision?.currencyCode ?? '').trim();
  const distinctLineTaxPolicies = new Set(
    (revision?.lines ?? [])
      .map((line) => {
        const linePolicy =
          typeof line.taxPolicy === 'string' ? line.taxPolicy.trim() : '';

        return linePolicy !== '' ? linePolicy : taxPolicyCode;
      })
      .filter((code) => code !== ''),
  );
  const multiTaxReady = distinctLineTaxPolicies.size <= 1;

  // What the destination declared decides what has to be true. A rate/amount destination
  // needs no fiscal code, and a single-currency destination needs no currency code, so the
  // preview must not mark either of those as missing.
  const currencyVendorValue = (
    financial.currencyMappings[documentCurrencyCode] ?? ''
  ).trim();
  const currencyReady =
    capabilities.currencyHandling === 'SINGLE_CURRENCY'
      ? CURRENCY_CODE_PATTERN.test(financial.baseCurrency)
      : capabilities.currencyHandling === 'UNSUPPORTED'
        ? false
        : currencyVendorValue !== '' &&
          (!currencyModeNeedsRate(capabilities.currencyHandling) ||
            documentCurrencyCode === financial.baseCurrency ||
            isConversionRateUsable(financial.conversionRate));

  const taxReady =
    !hasTax ||
    (capabilities.taxHandling !== 'UNSUPPORTED' &&
      (!taxModeNeedsVendorCode(capabilities.taxHandling) ||
        (taxPolicyCode !== '' && taxVendorCode.trim() !== '')));

  const dutyReady =
    !hasDuty || capabilities.dutyHandling !== 'UNSUPPORTED';

  // A code the destination publishes a rate for is compared with the policy actually
  // sealed in the revision, and the FINANCIAL GATE below refuses a disagreement. This
  // preview calls that same gate, so what it shows cannot differ from what dispatch does.
  // An unpublished catalog leaves the code unverifiable: that is not a match, and the
  // preview says so as a warning instead of letting the mapping read as confirmed.
  const financialGate = checkFinancialRequirements({
    capabilities,
    financial,
    taxPolicyMappings: settings.taxPolicyMappings,
    document: {
      taxPolicyCode,
      hasTax,
      hasDuty,
      currencyCode: documentCurrencyCode,
      taxPolicyRates: taxPolicyProfileFromSnapshot({
        taxRateBasisPoints: revision?.taxRateBasisPoints ?? null,
        dutyRateBasisPoints: revision?.dutyRateBasisPoints ?? null,
      }),
    },
  });
  const taxCodeMatch = financialGate.ok ? financialGate.value.taxCodeMatch : null;
  const warnings: { code: string; detail: string }[] = [];

  if (taxCodeMatch?.kind === 'UNVERIFIABLE') {
    warnings.push({ code: 'TAX_CODE_UNVERIFIED', detail: taxCodeMatch.reason });
  }

  const checks = [
    { code: 'OUTBOUND_ENABLED', ok: flags.outboundEnabled },
    { code: 'DOCUMENT_EXPORT_ENABLED', ok: flags.documentExportEnabled },
    { code: 'TRANSPORT_APPROVED', ok: settings.transportApproved },
    {
      code: 'QUOTATION_STATUS_EXPORTABLE',
      ok: QUOTATION_EXPORTABLE_STATUSES.has(input.quotationStatus),
    },
    { code: 'REVISION_PRESENT', ok: revision !== null },
    { code: 'CURRENCY_IRR', ok: revision?.currencyCode === 'IRR' },
    { code: 'MONEY_UNIT_CONFIRMED', ok: settings.moneyUnit !== 'UNCONFIRMED' },
    { code: 'MULTI_TAX_SUPPORTED', ok: multiTaxReady },
    { code: 'VENDOR_USER_ID', ok: userId !== null },
    {
      code: 'STORAGE_ID',
      ok: settings.defaultStorageId.trim() === '' || storageId !== null,
    },
    { code: 'CUSTOMER_LINKED', ok: customerCode !== null },
    {
      code: 'PROFORMA_CAPABILITY',
      ok: capabilities.documents.createProforma,
    },
    { code: 'DISCOUNT_CODE_PRESENT', ok: !hasDiscount || settings.specialCodes.discount },
    {
      code: 'TAX_CODE_PRESENT',
      ok:
        !hasTax ||
        !capabilities.requiresSpecialItemCodes ||
        settings.specialCodes.tax,
    },
    {
      code: 'DUTY_CODE_PRESENT',
      ok:
        !hasDuty ||
        !capabilities.requiresSpecialItemCodes ||
        settings.specialCodes.duty,
    },
    { code: 'TAX_POLICY_MAPPED', ok: taxReady },
    // Shown only when a destination code is actually in use: a rate/amount destination has
    // nothing to compare, and a row claiming "verified" there would be a claim no data backs.
    ...(taxCodeMatch === null
      ? []
      : [{ code: 'TAX_CODE_VERIFIED', ok: taxCodeMatch.kind === 'MATCH' }]),
    { code: 'DUTY_POLICY_SUPPORTED', ok: dutyReady },
    { code: 'CURRENCY_MAPPING', ok: currencyReady },
    {
      code: 'ALL_LINES_LINKED',
      ok:
        snapshotLines.length > 0 &&
        snapshotLines.every((line) => toVendorId(linkByLineId.get(line.lineId) ?? null) !== null),
    },
  ];

  const base = {
    checks,
    warnings,
    moneyUnit: settings.moneyUnit,
    customerExternalId: input.customerExternalId,
    lines: lineRows,
    outboundEnabled: flags.outboundEnabled,
    documentExportEnabled: flags.documentExportEnabled,
  };

  if (revision === null) {
    return {
      ...base,
      document: null,
      documentError: { code: 'REVISION_NOT_FOUND', detail: '' },
    };
  }

  if (!multiTaxReady) {
    return { ...base, document: null, documentError: { code: 'MULTI_TAX_UNSUPPORTED', detail: '' } };
  }

  if (customerCode === null) {
    return {
      ...base,
      document: null,
      documentError: { code: 'CUSTOMER_NOT_LINKED', detail: '' },
    };
  }

  if (userId === null) {
    return {
      ...base,
      document: null,
      documentError: { code: 'ADAPTER_NOT_CONFIGURED', detail: '' },
    };
  }

  if (settings.defaultStorageId.trim() !== '' && storageId === null) {
    return {
      ...base,
      document: null,
      documentError: { code: 'ADAPTER_NOT_CONFIGURED', detail: '' },
    };
  }

  if (settings.moneyUnit === 'UNCONFIRMED') {
    return {
      ...base,
      document: null,
      documentError: { code: 'MONEY_UNIT_UNCONFIRMED', detail: '' },
    };
  }

  // The gate itself ran before the checks, so a refusal and the "not verified" warning come
  // from one comparison rather than two that could drift apart.
  if (!financialGate.ok) {
    return {
      ...base,
      document: null,
      documentError: {
        code: financialGate.refusal.code,
        detail: financialGate.refusal.detail,
      },
    };
  }

  const productCodeByLineId: Record<string, number> = {};
  let linkMissing = false;

  for (const line of revision.lines) {
    const productCode = toVendorId(linkByLineId.get(line.lineId) ?? null);

    if (productCode === null) {
      linkMissing = true;
      break;
    }

    productCodeByLineId[line.lineId] = productCode;
  }

  if (linkMissing) {
    return {
      ...base,
      document: null,
      documentError: { code: 'LINE_HAS_NO_PRODUCT_LINK', detail: '' },
    };
  }

  const factor = mapRevisionToAsanFactor({
    revision,
    customerCode,
    userId,
    productCodeByLineId,
    specialCodesInUse: settings.specialCodes,
    ...(settings.specialItemCodes === undefined
      ? {}
      : { specialItemCodes: settings.specialItemCodes }),
    dutyHandling: capabilities.dutyHandling,
    ...(input.asanWire || taxVendorCode.trim() === '' ? {} : { taxVendorCode }),
    description: input.descriptionOverride ?? (input.quotationName === '' ? revision.quotationNumber : input.quotationName),
    ...(storageId === null ? {} : { storageId }),
    moneyUnit: settings.moneyUnit,
  });

  if (factor.ok && input.asanWire) {
    const integrity = validateAsanDocumentPayable({ factor: factor.value, revision,
      moneyUnit: settings.moneyUnit, productCodeByLineId,
      ...(settings.specialItemCodes === undefined ? {} : { specialItemCodes: settings.specialItemCodes }) });
    if (!integrity.ok) return { ...base, document: null, documentError: integrity.refusal };
  }
  return factor.ok
    ? { ...base, document: factor.value, documentError: null }
    : {
        ...base,
        document: null,
        documentError: {
          code: factor.refusal.code,
          detail: factor.refusal.detail,
        },
      };
};
