import {
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';
import { type AdapterCapabilities } from 'src/domain/accounting/capabilities';
import {
  type AsanFactorViewModel,
  mapRevisionToAsanFactor,
  scaledQuantityToAsanCount,
} from 'src/domain/accounting/adapters/asan/asan-factor';
import { QUOTATION_EXPORTABLE_STATUSES } from 'src/domain/accounting/outbound-plan';
import { parseMicrosExact } from 'src/domain/money/micros';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

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

const amountIsPositive = (text: string | undefined): boolean => {
  const parsed = parseMicrosExact(text ?? '');

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
    const quantity = scaledQuantityToAsanCount(BigInt(line.quantityScaled));
    const linkIsUsable = toVendorId(externalItemId) !== null;

    return {
      lineId: line.lineId,
      description: line.description,
      externalItemId,
      quantity: quantity.ok ? quantity.value : null,
      totalMicros: line.totalMicros,
      taxMicros: line.taxMicros,
      problem: linkIsUsable ? null : 'LINE_HAS_NO_PRODUCT_LINK',
    };
  });

  const customerCode = toVendorId(input.customerExternalId);
  const userId = toVendorId(settings.remoteUserId);
  const storageId =
    settings.defaultStorageId.trim() === ''
      ? null
      : toVendorId(settings.defaultStorageId);
  const taxTotal = revision?.totals.taxMicros ?? '0';
  const discountTotal = revision?.totals.discountMicros ?? '0';
  const hasTax = amountIsPositive(taxTotal);
  const hasDiscount = amountIsPositive(discountTotal);
  const taxPolicyCode = (revision?.taxPolicy ?? '').trim();
  const taxVendorCode = settings.taxPolicyMappings[taxPolicyCode] ?? '';
  const taxPolicyMapped =
    !hasTax || (taxPolicyCode !== '' && taxVendorCode.trim() !== '');

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
    { code: 'TAX_CODE_PRESENT', ok: !hasTax || settings.specialCodes.tax },
    { code: 'TAX_POLICY_MAPPED', ok: taxPolicyMapped },
    {
      code: 'ALL_LINES_LINKED',
      ok:
        snapshotLines.length > 0 &&
        snapshotLines.every((line) => toVendorId(linkByLineId.get(line.lineId) ?? null) !== null),
    },
  ];

  const base = {
    checks,
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
    ...(taxVendorCode.trim() === '' ? {} : { taxVendorCode }),
    description: input.quotationName === '' ? revision.quotationNumber : input.quotationName,
    ...(storageId === null ? {} : { storageId }),
    moneyUnit: settings.moneyUnit,
  });

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
