// Document numbers belong to the server, not to a screen: two approvers acting at
// the same second must not receive the same number, and a number must never be
// reused. This file is the pure half of that protocol — scope, formatting and the
// fiscal year — so the single-statement claim in QuotationNumberService stays thin.
//
// Mirrors packages/twenty-apps/internal/quotation/src/domain/quotation/numbering.ts.
// Keep the two aligned: the app defines the rules, the server performs the write.

export const QUOTATION_SEQUENCE_DOCUMENT_TYPE = 'QUOTATION';
export const QUOTATION_NUMBER_PREFIX = 'QT';
export const QUOTATION_NUMBER_WIDTH = 6;

// Same string the app writes into a draft's label; the list shows it verbatim.
export const DRAFT_QUOTATION_NUMBER_LABEL = 'بدون شماره';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const JALALI_YEAR_FORMATTER = new Intl.DateTimeFormat(
  'en-u-ca-persian-nu-latn',
  {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
  },
);

export const resolveQuotationFiscalYear = (instant: Date): number | null => {
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const yearPart = JALALI_YEAR_FORMATTER.formatToParts(instant).find(
    (part) => part.type === 'year',
  );
  const year = Number(yearPart?.value);

  return Number.isInteger(year) && year > 0 ? year : null;
};

export const buildQuotationSequenceScopeKey = (fiscalYear: number): string =>
  `${QUOTATION_SEQUENCE_DOCUMENT_TYPE}:${fiscalYear}`;

export const formatQuotationNumber = ({
  fiscalYear,
  sequence,
  width = QUOTATION_NUMBER_WIDTH,
}: {
  fiscalYear: number;
  sequence: number;
  width?: number;
}): string | null => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    return null;
  }

  const padded = String(sequence).padStart(width, '0');

  // Overflowing the width would silently change the shape of every later number,
  // which breaks text sorting and any downstream parser.
  if (padded.length > width) {
    return null;
  }

  return `${QUOTATION_NUMBER_PREFIX}-${fiscalYear}-${padded}`;
};

export const readSequenceWidth = (width: unknown): number =>
  typeof width === 'number' && Number.isInteger(width) && width > 0
    ? width
    : QUOTATION_NUMBER_WIDTH;

// The number as printed on a Persian document, and the value the list column shows.
export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);

export const formatQuotationNumberLabel = (
  quotationNumber: string | null,
): string | null => {
  const trimmed = quotationNumber?.trim() ?? '';

  // Drafts have no number yet; the list says so explicitly instead of showing an
  // empty cell that reads like a missing document.
  return trimmed === '' ? null : toPersianDigits(trimmed);
};
