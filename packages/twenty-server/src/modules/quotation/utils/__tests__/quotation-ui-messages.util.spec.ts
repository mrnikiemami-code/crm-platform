import {
  extractQuotationErrorCode,
  persianMessageForQuotationCode,
} from 'src/modules/quotation/utils/quotation-ui-messages.util';

describe('quotation-ui-messages', () => {
  it('maps known codes to Persian copy', () => {
    expect(persianMessageForQuotationCode('PERMISSION_MISSING')).toContain(
      'مجوز',
    );
    expect(persianMessageForQuotationCode('QUOTATION_VERSION_CONFLICT')).toContain(
      'هم‌زمان',
    );
  });

  it('extracts prefixed codes from English messages', () => {
    expect(
      extractQuotationErrorCode(
        'QUOTATION_VERSION_CONFLICT: quotation was changed concurrently',
      ),
    ).toBe('QUOTATION_VERSION_CONFLICT');
  });
});
