import { createHash } from 'node:crypto';

import {
  isExactAmountText,
  parseExactAmountToMicros,
} from 'src/modules/quotation/utils/quotation-draft-totals.util';

// The sealed record of what the customer was shown. The shape is the app's
// `QuotationRevisionSnapshot`, reproduced here because the server is the only writer and
// app packages cannot be imported across the bundle boundary.
//
// WHY THE HASH EXISTS: the platform has no immutability guard on rows. The hash is the
// guard — a stored revision is never edited, and any later attempt can be compared
// against bytes that were sealed at issue time.
export type SealedQuotationCustomer = {
  id: string;
  kind: 'PERSON' | 'COMPANY';
  name: string;
  nationalCode: string | null;
  economicCode: string | null;
  registrationNumber: string | null;
  accountingCode: string | null;
  customerCode: string | null;
  mobile: string | null;
  phone: string | null;
  secondPhone: string | null;
  fax: string | null;
  email: string | null;
  address: { street1: string | null; street2: string | null; city: string | null; state: string | null; postcode: string | null; country: string | null };
};

export type QuotationRevisionLine = {
  lineId: string;
  // V2 captures product identity and displayed content; old hashes stay untouched.
  itemId?: string | null;
  name?: string;
  kind?: 'PRODUCT' | 'SERVICE';
  itemSku?: string | null;
  itemAccountingCode?: string | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string;
  grossMicros?: string;
  documentDiscountMicros?: string;
  description: string;
  unit: string;
  unitRecordId?: string | null;
  unitCode?: string;
  unitAccountingCode?: string;
  quantityScaled: string;
  unitPriceMicros: string;
  discountMicros: string;
  taxMicros: string;
  totalMicros: string;
  // WS3: optional; omitted on pre-WS3 seals so hashes stay stable.
  taxPolicy?: string;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
  selectedPriceListId?: string | null;
  selectedPriceId?: string | null;
  selectedPriceValidFrom?: string | null;
};

export type QuotationRevisionSnapshot = {
  // Absent on historical seals, which also used integer micros.
  schemaVersion?: 2;
  revisionNumber?: number;
  documentTitle?: string;
  customerSnapshot?: SealedQuotationCustomer;
  expiresAt?: string | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string;
  currencyRecordId?: string | null;
  currencyAccountingCode?: string;
  quotationId: string;
  version: number;
  quotationNumber: string;
  currencyCode: string;
  customerRef: string;
  taxPolicy: string;
  taxRateBasisPoints: string | null;
  // Absent on revisions sealed before duty existed. Those documents must keep hashing
  // to the bytes they were sealed with, so a duty-free snapshot never gains the field.
  dutyRateBasisPoints?: string | null;
  paymentTerms: string | null;
  paymentDueDate?: string | null;
  deliveryTerms?: string | null;
  documentNotes?: string | null;
  issuerSnapshot?: {
    legalName: string;
    nationalId: string | null;
    economicCode: string | null;
    address: string | null;
    phone: string | null;
  };
  visitorName?: string | null;
  selectedPriceListName?: string | null;
  lines: QuotationRevisionLine[];
  totals: {
    grossMicros: string;
    discountMicros: string;
    lineDiscountMicros?: string;
    documentDiscountMicros?: string;
    netMicros: string;
    taxOnlyMicros?: string;
    dutyMicros?: string;
    taxMicros: string;
    roundingMicros?: string;
    preRoundTotalMicros?: string;
    totalMicros: string;
  };
  // Goal 032: present only when the draft stored a named rounding snapshot.
  roundingRuleCode?: string;
  roundingRuleName?: string;
  roundingStepRials?: string;
  issuedAt: string;
};

export type QuotationRevisionHeaderRow = {
  id: string;
  name?: string | null;
  expiresAt?: string | Date | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string | null;
  quotationCurrencyRecordId?: string | null;
  currencyAccountingCode?: string | null;
  quotationNumber: string | null;
  currencyCode: string | null;
  taxPolicy: string | null;
  taxRateBasisPoints: string | null;
  dutyRateBasisPoints: string | null;
  paymentTerms: string | null;
  paymentDueDate?: string | Date | null;
  deliveryTerms?: string | null;
  documentNotes?: string | null;
  issuerLegalName?: string | null;
  issuerNationalId?: string | null;
  issuerEconomicCode?: string | null;
  issuerAddress?: string | null;
  issuerPhone?: string | null;
  visitorName?: string | null;
  selectedPriceListId?: string | null;
  selectedPriceListName?: string | null;
  grossExact: string | null;
  lineDiscountExact: string | null;
  documentDiscountExact: string | null;
  netExact: string | null;
  taxExact: string | null;
  dutyExact: string | null;
  roundingExact: string | null;
  roundingRuleCode?: string | null;
  roundingRuleName?: string | null;
  roundingStepRials?: string | null;
  preRoundTotalExact?: string | null;
  totalExact: string | null;
  personId: string | null;
  companyId: string | null;
};

export type QuotationRevisionLineRow = {
  id: string;
  itemId?: string | null;
  kind?: 'PRODUCT' | 'SERVICE' | null;
  itemSku?: string | null;
  itemAccountingCode?: string | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string | null;
  description: string | null;
  name: string | null;
  unit: string | null;
  unitRecordId?: string | null;
  unitCode?: string | null;
  unitAccountingCode?: string | null;
  quantityExact: string | null;
  unitPriceExact: string | null;
  grossExact: string | null;
  discountExact: string | null;
  documentDiscountExact: string | null;
  taxExact: string | null;
  totalExact: string | null;
  taxPolicy?: string | null;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
  selectedPriceListId?: string | null;
  selectedPriceId?: string | null;
  selectedPriceValidFrom?: string | Date | null;
};

export type QuotationRevisionSnapshotResult =
  | { ok: true; snapshot: QuotationRevisionSnapshot }
  | { ok: false; code: string; detail: string };

// Key order is normalised before hashing so two structurally equal snapshots can never
// hash differently because a different code path built them.
export const canonicalizeForHash = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeForHash).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : 1))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${canonicalizeForHash(entryValue)}`,
      );

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

export const hashQuotationRevision = (
  snapshot: QuotationRevisionSnapshot,
): string =>
  createHash('sha256')
    .update(canonicalizeForHash(snapshot), 'utf8')
    .digest('hex');

const microsOf = (value: string | null): bigint | null =>
  isExactAmountText(value) ? parseExactAmountToMicros(value) : null;

const readDateStamp = (value: string | Date | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();

  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
};

// Amounts are never derived here: the snapshot records the stored plan and only checks
// that it adds up. A quotation whose totals disagree with its lines is refused at issue
// time instead of being sealed with numbers no accountant could reproduce.
export const buildQuotationRevisionSnapshot = ({
  header,
  lines,
  version,
  issuedAt,
  identity,
}: {
  // Transactional writer always supplies V2 identity; legacy encoding retained for hash compatibility tests.
  identity?: { revisionNumber: number; customer: SealedQuotationCustomer };
  header: QuotationRevisionHeaderRow;
  lines: QuotationRevisionLineRow[];
  version: number;
  issuedAt: Date;
}): QuotationRevisionSnapshotResult => {
  const quotationNumber = (header.quotationNumber ?? '').trim();
  // Only a readable rate is sealed; an absent one stays null so an older document
  // remains explicable instead of being given an invented percentage.
  const declaredTaxRate = (header.taxRateBasisPoints ?? '').trim();
  const taxRateBasisPoints = /^\d{1,5}$/.test(declaredTaxRate)
    ? declaredTaxRate
    : null;
  // Same rule for duty: a document sealed before duty existed records no duty rate
  // and is never given one retroactively.
  const declaredDutyRate = (header.dutyRateBasisPoints ?? '').trim();
  const dutyRateBasisPoints = /^\d{1,5}$/.test(declaredDutyRate)
    ? declaredDutyRate
    : null;

  if (quotationNumber === '') {
    return {
      ok: false,
      code: 'QUOTATION_NUMBER_MISSING',
      detail: 'an issued quotation must have a document number',
    };
  }

  if (lines.length === 0) {
    return {
      ok: false,
      code: 'DOCUMENT_HAS_NO_LINES',
      detail: 'a quotation needs at least one line to be sealed',
    };
  }

  const headerAmounts = {
    gross: microsOf(header.grossExact),
    lineDiscount: microsOf(header.lineDiscountExact),
    documentDiscount: microsOf(header.documentDiscountExact),
    net: microsOf(header.netExact),
    tax: microsOf(header.taxExact),
    rounding: microsOf(header.roundingExact),
    total: microsOf(header.totalExact),
  };
  const unreadableHeaderKey = Object.entries(headerAmounts).find(
    ([, value]) => value === null,
  )?.[0];

  if (unreadableHeaderKey !== undefined) {
    return {
      ok: false,
      code: 'AMOUNT_NOT_A_DECIMAL',
      detail: `header ${unreadableHeaderKey} is not an exact decimal`,
    };
  }

  const customerRef = (header.companyId ?? header.personId ?? '').trim();
  if (identity && (!customerRef || (!!header.companyId === !!header.personId) ||
    identity.customer.id !== customerRef ||
    identity.customer.kind !== (header.companyId ? 'COMPANY' : 'PERSON') ||
    !identity.customer.name.trim() || !Number.isSafeInteger(identity.revisionNumber) || identity.revisionNumber < 1 ||
    !Number.isSafeInteger(version) || version < 1)) {
    return { ok: false, code: 'REVISION_MISMATCH', detail: 'issued customer or revision identity is not authoritative' };
  }
  const sealedLines: QuotationRevisionLine[] = [];
  let lineGross = BigInt(0);
  let lineDiscount = BigInt(0);
  let lineDocumentDiscount = BigInt(0);
  let lineTax = BigInt(0);
  let lineTotal = BigInt(0);

  for (const line of lines) {
    const lineAmounts = {
      quantity: microsOf(line.quantityExact),
      unitPrice: microsOf(line.unitPriceExact),
      gross: microsOf(line.grossExact),
      discount: microsOf(line.discountExact),
      documentDiscount: microsOf(line.documentDiscountExact),
      tax: microsOf(line.taxExact),
      total: microsOf(line.totalExact),
    };

    const unreadableLineKey = Object.entries(lineAmounts).find(
      ([, value]) => value === null,
    )?.[0];

    if (unreadableLineKey !== undefined) {
      return {
        ok: false,
        code: 'AMOUNT_NOT_A_DECIMAL',
        detail: `line ${line.id} ${unreadableLineKey} is not an exact decimal`,
      };
    }

    const {
      quantity,
      unitPrice,
      gross,
      discount,
      documentDiscount,
      tax,
      total,
    } = lineAmounts as Record<keyof typeof lineAmounts, bigint>;

    if (identity && (quantity <= BigInt(0) || unitPrice < BigInt(0) || gross < BigInt(0) ||
      discount < BigInt(0) || documentDiscount < BigInt(0) || tax < BigInt(0) ||
      discount + documentDiscount > gross ||
      gross !== (quantity * unitPrice + BigInt(500000)) / BigInt(1000000) ||
      total !== gross - discount - documentDiscount + tax ||
      !line.id || sealedLines.some((entry) => entry.lineId === line.id))) {
      return { ok: false, code: 'TOTALS_INCONSISTENT', detail: 'line financial facts do not add up: ' + line.id };
    }
    lineGross += gross;
    lineDiscount += discount;
    lineDocumentDiscount += documentDiscount;
    lineTax += tax;
    lineTotal += total;

    const lineTaxPolicy = (line.taxPolicy ?? '').trim();
    const lineTaxRate = (line.taxRateBasisPoints ?? '').trim();
    const lineDutyRate = (line.dutyRateBasisPoints ?? '').trim();

    sealedLines.push({
      lineId: line.id,
      ...(identity ? {
        itemId: line.itemId ?? null,
        name: (line.name ?? '').trim(),
        kind: line.kind === 'SERVICE' ? 'SERVICE' as const : 'PRODUCT' as const,
        itemSku: line.itemSku ?? null,
        itemAccountingCode: line.itemAccountingCode ?? null,
        ...(line.unitRecordId ? { unitRecordId: line.unitRecordId, unitCode: (line.unitCode ?? '').trim(), unitAccountingCode: (line.unitAccountingCode ?? '').trim() } : {}),
        taxPolicyRecordId: line.taxPolicyRecordId ?? null,
        taxAccountingCode: (line.taxAccountingCode ?? '').trim(),
        grossMicros: gross.toString(),
        documentDiscountMicros: documentDiscount.toString(),
      } : {}),
      description: (line.description ?? line.name ?? '').trim(),
      unit: (line.unit ?? '').trim(),
      quantityScaled: quantity.toString(),
      unitPriceMicros: unitPrice.toString(),
      discountMicros: discount.toString(),
      taxMicros: tax.toString(),
      totalMicros: total.toString(),
        ...(lineTaxPolicy !== ''
        ? {
            taxPolicy: lineTaxPolicy,
            taxRateBasisPoints: /^\d{1,5}$/.test(lineTaxRate)
              ? lineTaxRate
              : null,
            dutyRateBasisPoints: /^\d{1,5}$/.test(lineDutyRate)
              ? lineDutyRate
              : null,
          }
        : {}),
      ...((line.selectedPriceListId ?? '').trim() === ''
        ? {}
        : {
            selectedPriceListId: (line.selectedPriceListId as string).trim(),
            selectedPriceId: (line.selectedPriceId ?? '').trim() || null,
            selectedPriceValidFrom: readDateStamp(line.selectedPriceValidFrom),
          }),
    });
  }

  const headerGross = headerAmounts.gross as bigint;
  const headerLineDiscount = headerAmounts.lineDiscount as bigint;
  const headerDocumentDiscount = headerAmounts.documentDiscount as bigint;
  const headerNet = headerAmounts.net as bigint;
  const headerTax = headerAmounts.tax as bigint;
  const headerRounding = headerAmounts.rounding as bigint;
  const headerTotal = headerAmounts.total as bigint;

  // Duty is the part of the stored tax that belongs to the duty component. A document
  // saved before the split has no duty field and seals with zero, which is exactly what
  // its stored tax already meant.
  const headerDutyText = (header.dutyExact ?? '').trim();
  const headerDuty = headerDutyText === '' ? BigInt(0) : microsOf(headerDutyText);

  if (headerDuty === null) {
    return {
      ok: false,
      code: 'AMOUNT_NOT_A_DECIMAL',
      detail: 'header dutyExact is not an exact decimal',
    };
  }

  const headerTaxOnly = headerTax - headerDuty;

  const consistencyChecks: { ok: boolean; detail: string }[] = [
    {
      ok:
        headerNet === headerGross - headerLineDiscount - headerDocumentDiscount,
      detail: 'header net is not gross minus all discounts',
    },
    {
      ok: headerTotal === headerNet + headerTax + headerRounding,
      detail: 'header total is not net plus tax plus rounding',
    },
    {
      ok: lineGross === headerGross,
      detail: 'line gross amounts do not add up to the header gross',
    },
    {
      ok: lineDiscount === headerLineDiscount,
      detail: 'line discounts do not add up to the header line discount',
    },
    {
      ok: lineDocumentDiscount === headerDocumentDiscount,
      detail:
        'document-discount shares do not add up to the header document discount',
    },
    {
      ok: lineTax === headerTax,
      detail: 'line taxes do not add up to the header tax',
    },
    {
      ok: lineTotal === headerNet + headerTax,
      detail: 'line totals do not add up to header net plus tax',
    },
    {
      // The components must be the tax they came from, in the right direction: a
      // negative tax-only share or a duty larger than the tax would seal a split no
      // destination could post consistently.
      ok: headerDuty >= BigInt(0) && headerTaxOnly >= BigInt(0),
      detail: 'header duty is not a part of header tax',
    },
    {
      ok: headerDuty === BigInt(0) || dutyRateBasisPoints !== null,
      detail: 'header carries duty but no duty rate was sealed',
    },
  ];

  const failing = consistencyChecks.find((check) => !check.ok);

  if (failing !== undefined) {
    return {
      ok: false,
      code: 'TOTALS_INCONSISTENT',
      detail: failing.detail,
    };
  }

  return {
    ok: true,
    snapshot: {
      ...(identity ? {
        schemaVersion: 2 as const,
        revisionNumber: identity.revisionNumber,
        documentTitle: (header.name ?? '').trim(),
        customerSnapshot: identity.customer,
        expiresAt: header.expiresAt instanceof Date
          ? header.expiresAt.toISOString().slice(0, 10) : header.expiresAt ?? null,
        taxPolicyRecordId: header.taxPolicyRecordId ?? null,
        taxAccountingCode: (header.taxAccountingCode ?? '').trim(),
        currencyRecordId: header.quotationCurrencyRecordId ?? null,
        currencyAccountingCode: (header.currencyAccountingCode ?? '').trim(),
      } : {}),
      quotationId: header.id,
      version,
      quotationNumber,
      currencyCode: (header.currencyCode ?? '').trim() || 'IRR',
      customerRef,
      taxPolicy: (header.taxPolicy ?? '').trim(),
      taxRateBasisPoints,
      // Emitted only when a duty rate was actually declared: a duty-free revision must
      // canonicalize to the same bytes it was sealed with before the split existed.
      ...(dutyRateBasisPoints === null ? {} : { dutyRateBasisPoints }),
      paymentTerms:
        (header.paymentTerms ?? '').trim() === ''
          ? null
          : (header.paymentTerms as string).trim(),
      ...(identity
        ? {
            paymentDueDate: readDateStamp(header.paymentDueDate),
            deliveryTerms:
              (header.deliveryTerms ?? '').trim() === ''
                ? null
                : (header.deliveryTerms as string).trim(),
            documentNotes:
              (header.documentNotes ?? '').trim() === ''
                ? null
                : (header.documentNotes as string).trim(),
            ...((header.issuerLegalName ?? '').trim() === ''
              ? {}
              : {
                  issuerSnapshot: {
                    legalName: (header.issuerLegalName as string).trim(),
                    nationalId: (header.issuerNationalId ?? '').trim() || null,
                    economicCode:
                      (header.issuerEconomicCode ?? '').trim() || null,
                    address: (header.issuerAddress ?? '').trim() || null,
                    phone: (header.issuerPhone ?? '').trim() || null,
                  },
                }),
            visitorName:
              (header.visitorName ?? '').trim() === ''
                ? null
                : (header.visitorName as string).trim(),
            selectedPriceListName:
              (header.selectedPriceListName ?? '').trim() === ''
                ? null
                : (header.selectedPriceListName as string).trim(),
          }
        : {}),
      lines: sealedLines,
      totals: {
        grossMicros: headerGross.toString(),
        ...(identity ? { lineDiscountMicros: headerLineDiscount.toString(), documentDiscountMicros: headerDocumentDiscount.toString() } : {}),
        // Every discount the customer received: line-level plus the document-level share.
        discountMicros: (
          headerLineDiscount + headerDocumentDiscount
        ).toString(),
        netMicros: headerNet.toString(),
        // Same rule as the rate: a zero duty share is not restated, so revisions sealed
        // before the split keep their original hash instead of being reinterpreted.
        ...(headerDuty === BigInt(0)
          ? {}
          : {
              taxOnlyMicros: headerTaxOnly.toString(),
              dutyMicros: headerDuty.toString(),
            }),
        taxMicros: headerTax.toString(),
        ...(headerRounding === BigInt(0)
          ? {}
          : { roundingMicros: headerRounding.toString() }),
        ...((header.preRoundTotalExact ?? '').trim() === ''
          ? {}
          : {
              preRoundTotalMicros: (
                headerNet + headerTax
              ).toString(),
            }),
        totalMicros: headerTotal.toString(),
      },
      ...((header.roundingRuleCode ?? '').trim() === ''
        ? {}
        : {
            roundingRuleCode: (header.roundingRuleCode as string).trim(),
            roundingRuleName: (header.roundingRuleName ?? '').trim(),
            roundingStepRials: (header.roundingStepRials ?? '').trim(),
          }),
      issuedAt: issuedAt.toISOString(),
    },
  };
};
