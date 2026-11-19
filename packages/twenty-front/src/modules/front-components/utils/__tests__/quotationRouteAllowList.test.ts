import { isAllowedQuotationAction } from '@/front-components/utils/quotationRouteAllowList';

describe('quotationRouteAllowList', () => {
  it('allows lifecycle, pdf, customer-link, and share actions only', () => {
    expect(isAllowedQuotationAction('get-lifecycle')).toBe(true);
    expect(isAllowedQuotationAction('transition')).toBe(true);
    expect(isAllowedQuotationAction('generate-pdf')).toBe(true);
    expect(isAllowedQuotationAction('create-customer-link')).toBe(true);
    expect(isAllowedQuotationAction('revoke-customer-link')).toBe(true);
    expect(isAllowedQuotationAction('share-quotation')).toBe(true);
    expect(isAllowedQuotationAction('delete-everything')).toBe(false);
  });
});
