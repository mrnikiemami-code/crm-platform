import { buildQuotationDraftEditQuery } from 'src/data/quotation-queries';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  irrMicrosToTomanMicros,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  formatExactDecimalForPeople,
  toPersianDigits,
} from 'src/domain/money/display-format';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';
import { canEditQuotationLines, type QuotationStatus } from 'src/domain/quotation/status';
import { buildQuotationCustomerLabel } from 'src/domain/quotation/customer-label';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Reads a saved draft back into the same shape the edit form holds in state.
//
// WHY A SEPARATE READER: the form must never derive an amount by parsing a
// people-facing string (grouping separators, Persian digits) back into money.
// Stored exacts are converted here, once, and the form only ever sees input text.

export type EditableDraftDiscountKind = 'NONE' | 'RATE' | 'AMOUNT';

export type EditableDraftLine = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  unit: string;
  unitRecordId?: string | null;
  quantityText: string;
  unitPriceText: string;
  discountKind: EditableDraftDiscountKind;
  discountPercentText: string;
  discountAmountText: string;
  // Null on legacy header-only tax documents; form copies header policy once.
  taxPolicy: string | null;
};

export type EditableDraft = {
  quotationId: string;
  status: QuotationStatus;
  version: number;
  name: string;
  customerType: 'PERSON' | 'COMPANY';
  personId: string | null;
  companyId: string | null;
  // Readable name of the relation the draft points at, so reopening a draft shows
  // the customer instead of an empty picker the operator would have to re-choose.
  customerLabel: string | null;
  paymentTerms: string;
  taxPolicy: string | null;
  // The rate the document was priced at, in basis points. Kept so reopening a
  // draft does not adopt a rate the settings changed after it was saved.
  taxRateBasisPoints: string | null;
  // The duty component of the same frozen policy. Absent on documents saved before
  // a policy could carry duty, which are re-priced with zero duty.
  dutyRateBasisPoints: string | null;
  // ISO document currency (IRR in phase 1). Distinct from moneyUnit display scale.
  currencyCode: string | null;
  // Goal 032: sealed rounding snapshot. Draft reopen keeps these until the
  // operator explicitly picks another catalog rule.
  roundingRuleCode: string | null;
  roundingRuleName: string | null;
  roundingStepRials: string | null;
  roundingRuleRecordId: string | null;
  moneyUnit: MoneyUnit;
  documentDiscountKind: EditableDraftDiscountKind;
  documentDiscountPercentText: string;
  documentDiscountAmountText: string;
  lines: EditableDraftLine[];
  contentEditable: boolean;
};

export type DraftEditDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readNullableText = (value: unknown): string | null => {
  const text = readText(value);

  return text === '' ? null : text;
};

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : null;

const readRelationId = (value: unknown): string | null => {
  const node = asRecord(value);

  return typeof node?.id === 'string' && node.id.trim() !== ''
    ? node.id.trim()
    : null;
};

const readRelationLabel = (quotation: Record<string, unknown>): string | null => {
  const person = asRecord(quotation.person);
  const company = asRecord(quotation.company);

  return buildQuotationCustomerLabel({
    person:
      person === null
        ? null
        : {
            name: asRecord(person.name) as
              | { firstName?: string | null; lastName?: string | null }
              | null,
          },
    company: company === null ? null : { name: readNullableText(company.name) },
  });
};

const parseExact = (text: string): bigint | null => {
  const parsed = parseMicrosExact(text);

  return parsed.ok ? parsed.value : null;
};

const isWholeToman = (text: string): boolean => {
  const micros = parseExact(text);

  return micros !== null && irrMicrosToTomanMicros(micros).ok;
};

// Shown to a person: Persian digits, and toman only when the rial value is a
// whole number of tomans. A fraction of a rial is not rounded into a different
// price — the whole document falls back to rial instead.
const formatAmountInput = (
  exactText: string,
  unit: MoneyUnit,
): string | null => {
  const micros = parseExact(exactText);

  if (micros === null) {
    return null;
  }

  if (unit === 'IRR') {
    return formatExactDecimalForPeople(formatMicrosExact(micros));
  }

  const tomanMicros = irrMicrosToTomanMicros(micros);

  if (!tomanMicros.ok) {
    return null;
  }

  return formatExactDecimalForPeople(formatMicrosExact(tomanMicros.value));
};

const formatPercentInput = (exactText: string): string | null => {
  const micros = parseExact(exactText);

  if (micros === null) {
    return null;
  }

  return formatExactDecimalForPeople(formatMicrosExact(micros));
};

const formatQuantityForInput = (exactText: string): string => {
  const exact = exactText.trim();
  const trimmed = exact.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const normalized = trimmed === '' || trimmed === '-0' ? '0' : trimmed;

  return toPersianDigits(normalized).replace('.', '\u066b');
};

const readDiscountKind = (value: unknown): EditableDraftDiscountKind => {
  const kind = readText(value).toUpperCase();

  return kind === 'RATE' || kind === 'AMOUNT' ? kind : 'NONE';
};

type RawLine = {
  id: string;
  name: string;
  kind: CatalogItemKind;
  description: string | null;
  unit: string;
  unitRecordId?: string | null;
  quantityExact: string;
  unitPriceExact: string;
  discountExact: string;
  discountKind: EditableDraftDiscountKind;
  discountInputExact: string;
  itemId: string | null;
  taxPolicy: string | null;
};

const readLines = (data: Record<string, unknown>): RawLine[] => {
  const connection = asRecord(data.quotationLines);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    if (node === null || typeof node.id !== 'string') {
      return [];
    }

    return [
      {
        id: node.id,
        name: readText(node.name),
        kind: readText(node.kind) === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
        description: readNullableText(node.description),
        unit: readText(node.unit),
        unitRecordId: readNullableText(node.unitRecordId),
        quantityExact: readText(node.quantityExact) || '0.000000',
        unitPriceExact: readText(node.unitPriceExact) || '0.000000',
        discountExact: readText(node.discountExact) || '0.000000',
        discountKind: readDiscountKind(node.discountKind),
        discountInputExact: readText(node.discountInputExact) || '0.000000',
        itemId: readRelationId(node.item),
        taxPolicy: readNullableText(node.taxPolicy),
      },
    ];
  });
};

const resolveMoneyUnit = (
  rawLines: RawLine[],
  rawQuotation: Record<string, unknown>,
): MoneyUnit => {
  const moneyExacts = [
    ...rawLines.flatMap((line) =>
      line.discountKind === 'AMOUNT'
        ? [line.unitPriceExact, line.discountInputExact]
        : [line.unitPriceExact],
    ),
    ...(readDiscountKind(rawQuotation.documentDiscountKind) === 'AMOUNT'
      ? [readText(rawQuotation.documentDiscountInputExact) || '0.000000']
      : []),
  ];

  return moneyExacts.every(isWholeToman) ? 'TOMAN' : 'IRR';
};

export const parseDraftForEdit = (
  data: Record<string, unknown>,
): Result<EditableDraft> => {
  const quotation = asRecord(data.quotation);

  if (quotation === null || typeof quotation.id !== 'string') {
    return refused('QUOTATION_NOT_FOUND', 'پیش‌فاکتور برای ویرایش پیدا نشد');
  }

  const status = readText(quotation.status) as QuotationStatus;
  const version = readNumber(quotation.version);

  if (version === null) {
    return refused(
      'QUOTATION_VERSION_REQUIRED',
      'نسخهٔ پیش‌فاکتور خوانده نشد؛ صفحه را تازه کنید و دوباره تلاش کنید',
    );
  }

  const personId = readRelationId(quotation.person);
  const companyId = readRelationId(quotation.company);
  const customerType =
    readText(quotation.customerType) === 'PERSON' || personId !== null
      ? ('PERSON' as const)
      : ('COMPANY' as const);

  const rawLines = readLines(data);
  const moneyUnit = resolveMoneyUnit(rawLines, quotation);

  if (rawLines.length === 0) {
    return refused(
      'DOCUMENT_HAS_NO_LINES',
      'این پیش‌فاکتور ردیف قابل ویرایش ندارد',
    );
  }

  const lines: EditableDraftLine[] = [];

  for (const rawLine of rawLines) {
    const unitPriceText = formatAmountInput(rawLine.unitPriceExact, moneyUnit);

    if (unitPriceText === null) {
      return refused(
        'UNIT_PRICE_INVALID',
        `قیمت «${rawLine.name}» قابل خواندن نیست`,
      );
    }

    const discountKind =
      rawLine.discountKind === 'NONE' && rawLine.discountExact !== '0.000000'
        ? 'AMOUNT'
        : rawLine.discountKind;
    const discountInputExact =
      rawLine.discountKind === 'NONE' && discountKind === 'AMOUNT'
        ? rawLine.discountExact
        : rawLine.discountInputExact;

    const discountPercentText =
      discountKind === 'RATE'
        ? (formatPercentInput(discountInputExact) ?? '')
        : '';
    const discountAmountText =
      discountKind === 'AMOUNT'
        ? (formatAmountInput(discountInputExact, moneyUnit) ?? '')
        : '';

    lines.push({
      clientLineId: rawLine.id,
      catalogItemId: rawLine.itemId,
      kind: rawLine.kind,
      name: rawLine.name,
      description: rawLine.description,
      unit: rawLine.unit,
      unitRecordId: rawLine.unitRecordId ?? null,
      quantityText: formatQuantityForInput(rawLine.quantityExact),
      unitPriceText,
      discountKind,
      discountPercentText,
      discountAmountText,
      taxPolicy: rawLine.taxPolicy,
    });
  }

  const documentDiscountKind = readDiscountKind(
    quotation.documentDiscountKind,
  );
  const documentDiscountInputExact =
    readText(quotation.documentDiscountInputExact) || '0.000000';
  // Older records only stored the allocated amount, never the instruction.
  const resolvedDocumentDiscountKind =
    documentDiscountKind === 'NONE' &&
    readText(quotation.documentDiscountExact) !== '' &&
    readText(quotation.documentDiscountExact) !== '0.000000'
      ? ('AMOUNT' as const)
      : documentDiscountKind;

  return accepted({
    quotationId: quotation.id,
    status,
    version,
    name: readText(quotation.name),
    customerType,
    personId: customerType === 'PERSON' ? personId : null,
    companyId: customerType === 'COMPANY' ? companyId : null,
    customerLabel: readRelationLabel(quotation),
    paymentTerms: readText(quotation.paymentTerms),
    taxPolicy: readNullableText(quotation.taxPolicy),
    taxRateBasisPoints: readNullableText(quotation.taxRateBasisPoints),
    dutyRateBasisPoints: readNullableText(quotation.dutyRateBasisPoints),
    currencyCode: readNullableText(quotation.currencyCode),
    roundingRuleCode: readNullableText(quotation.roundingRuleCode),
    roundingRuleName: readNullableText(quotation.roundingRuleName),
    roundingStepRials: readNullableText(quotation.roundingStepRials),
    roundingRuleRecordId: readNullableText(quotation.roundingRuleRecordId),
    moneyUnit,
    documentDiscountKind: resolvedDocumentDiscountKind,
    documentDiscountPercentText:
      resolvedDocumentDiscountKind === 'RATE'
        ? (formatPercentInput(documentDiscountInputExact) ?? '')
        : '',
    documentDiscountAmountText:
      resolvedDocumentDiscountKind === 'AMOUNT'
        ? (formatAmountInput(documentDiscountInputExact, moneyUnit) ?? '')
        : '',
    lines,
    contentEditable: canEditQuotationLines(status),
  });
};

export const loadDraftForEdit = async (
  quotationId: string,
  dependencies: DraftEditDependencies,
): Promise<Result<EditableDraft>> => {
  const data = await dependencies.execute(
    buildQuotationDraftEditQuery(quotationId),
  );

  return parseDraftForEdit(data);
};
