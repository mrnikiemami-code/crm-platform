import {
  formatExactDecimalForPeople,
  resolveCurrencyLabel,
} from 'src/domain/money/display-format';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { canIssueCustomerLinkForStatus } from 'src/domain/quotation/customer-link-token';
import { buildQuotationCustomerLabel } from 'src/domain/quotation/customer-label';

export type CustomerViewLine = {
  name: string;
  kindLabel: string;
  unit: string;
  quantityDisplay: string;
  unitPriceDisplay: string;
  lineTotalDisplay: string;
};

export type CustomerQuotationView = {
  quotationNumber: string | null;
  title: string;
  statusLabel: string;
  customerLabel: string;
  paymentTerms: string | null;
  currencyLabel: string;
  lines: CustomerViewLine[];
  grossDisplay: string | null;
  lineDiscountDisplay: string | null;
  documentDiscountDisplay: string | null;
  taxDisplay: string | null;
  roundingDisplay: string | null;
  totalDisplay: string;
  issuedHint: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  READY_TO_SEND: 'آماده ارسال',
  SENT: 'ارسال‌شده',
  CUSTOMER_ACCEPTED: 'مورد قبول مشتری',
  CUSTOMER_REJECTED: 'رد شده توسط مشتری',
};

const moneyPeople = (exact: string | null | undefined): string | null => {
  if (typeof exact !== 'string' || exact.trim() === '') {
    return null;
  }

  return formatExactDecimalForPeople(exact);
};

const quantityPeople = (exact: string | null | undefined): string => {
  if (typeof exact !== 'string' || exact.trim() === '') {
    return '—';
  }

  return formatExactDecimalForPeople(exact);
};

export type CustomerViewSourceQuotation = {
  id: string;
  name: string | null;
  quotationNumber: string | null;
  status: string;
  paymentTerms: string | null;
  currencyCode: string | null;
  grossExact: string | null;
  lineDiscountExact: string | null;
  documentDiscountExact: string | null;
  taxExact: string | null;
  roundingExact: string | null;
  totalExact: string | null;
  person: { name: { firstName?: string | null; lastName?: string | null } | null } | null;
  company: { name: string | null } | null;
};

export type CustomerViewSourceLine = {
  name: string | null;
  kind: string | null;
  unit: string | null;
  quantityExact: string | null;
  unitPriceExact: string | null;
  totalExact: string | null;
};

// Builds the only payload a customer page may render. Internal CRM ids, other
// customers, opportunity, API keys, and member identities are intentionally absent.
export const buildCustomerQuotationView = ({
  quotation,
  lines,
}: {
  quotation: CustomerViewSourceQuotation;
  lines: CustomerViewSourceLine[];
}): Result<CustomerQuotationView> => {
  if (!canIssueCustomerLinkForStatus(quotation.status)) {
    return refused(
      'CUSTOMER_VIEW_STATUS_FORBIDDEN',
      'this quotation is not available for customer viewing',
    );
  }

  const totalExact = quotation.totalExact;

  if (typeof totalExact !== 'string' || totalExact.trim() === '') {
    return refused('CUSTOMER_VIEW_TOTAL_MISSING', 'quotation total is missing');
  }

  const customerLabel =
    buildQuotationCustomerLabel({
      person: quotation.person,
      company: quotation.company,
    }) ?? 'مشتری';

  const currencyLabel = resolveCurrencyLabel(quotation.currencyCode);

  const viewLines: CustomerViewLine[] = lines.map((line) => ({
    name: line.name?.trim() || '—',
    kindLabel: line.kind === 'SERVICE' ? 'خدمت' : line.kind === 'PRODUCT' ? 'کالا' : '—',
    unit: line.unit?.trim() || '—',
    quantityDisplay: quantityPeople(line.quantityExact),
    unitPriceDisplay: `${moneyPeople(line.unitPriceExact) ?? '—'} ${currencyLabel}`,
    lineTotalDisplay: `${moneyPeople(line.totalExact) ?? '—'} ${currencyLabel}`,
  }));

  const roundingExact = quotation.roundingExact;
  const roundingDisplay =
    typeof roundingExact === 'string' &&
    roundingExact.trim() !== '' &&
    roundingExact.trim() !== '0.000000'
      ? `${moneyPeople(roundingExact)} ${currencyLabel}`
      : null;

  return accepted({
    quotationNumber: quotation.quotationNumber,
    title: quotation.name?.trim() || 'پیش‌فاکتور',
    statusLabel: STATUS_LABELS[quotation.status] ?? 'پیش‌فاکتور',
    customerLabel,
    paymentTerms: quotation.paymentTerms,
    currencyLabel,
    lines: viewLines,
    grossDisplay: moneyPeople(quotation.grossExact)
      ? `${moneyPeople(quotation.grossExact)} ${currencyLabel}`
      : null,
    lineDiscountDisplay: moneyPeople(quotation.lineDiscountExact)
      ? `${moneyPeople(quotation.lineDiscountExact)} ${currencyLabel}`
      : null,
    documentDiscountDisplay: moneyPeople(quotation.documentDiscountExact)
      ? `${moneyPeople(quotation.documentDiscountExact)} ${currencyLabel}`
      : null,
    taxDisplay: moneyPeople(quotation.taxExact)
      ? `${moneyPeople(quotation.taxExact)} ${currencyLabel}`
      : null,
    roundingDisplay,
    totalDisplay: `${formatExactDecimalForPeople(totalExact)} ${currencyLabel}`,
    issuedHint: null,
  });
};
