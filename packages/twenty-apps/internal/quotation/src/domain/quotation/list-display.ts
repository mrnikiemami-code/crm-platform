// The list table renders stored strings, so the Persian, grouped, unit-labelled
// form of a quotation has to be a stored projection. These three values are the
// only things the table shows that are not the record itself.
//
// totalExact stays the authority: this module never parses, rounds or recomputes
// an amount, it only renders the exact string through the shared money formatter.
import { formatExactAmountWithCurrency } from 'src/domain/money/display-format';
import {
  buildQuotationCustomerLabel,
  type QuotationCustomerSource,
} from 'src/domain/quotation/customer-label';
import { formatQuotationNumberForPrinting } from 'src/domain/quotation/numbering';

export const DRAFT_QUOTATION_NUMBER_LABEL = 'بدون شماره';

export type QuotationListDisplay = {
  quotationNumberLabel: string;
  customerName: string | null;
  totalDisplay: string | null;
};

export const buildQuotationListDisplay = ({
  quotationNumber,
  customer,
  totalExact,
  currencyCode,
}: {
  quotationNumber: string | null;
  customer: QuotationCustomerSource;
  totalExact: string | null;
  currencyCode: string | null;
}): QuotationListDisplay => {
  const number = quotationNumber?.trim() ?? '';

  return {
    quotationNumberLabel:
      number === ''
        ? DRAFT_QUOTATION_NUMBER_LABEL
        : formatQuotationNumberForPrinting(number),
    customerName: buildQuotationCustomerLabel(customer),
    totalDisplay:
      totalExact === null || totalExact.trim() === ''
        ? null
        : formatExactAmountWithCurrency(totalExact, currencyCode),
  };
};

export const buildQuotationTotalDisplay = ({
  totalExact,
  currencyCode,
}: {
  totalExact: string | null;
  currencyCode: string | null;
}): string | null =>
  totalExact === null || totalExact.trim() === ''
    ? null
    : formatExactAmountWithCurrency(totalExact, currencyCode);
