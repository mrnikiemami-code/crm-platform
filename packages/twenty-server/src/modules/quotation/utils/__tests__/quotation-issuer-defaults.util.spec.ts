import { mergeIssuerFieldsWithEnvDefaults } from 'src/modules/quotation/utils/quotation-issuer-defaults.util';

describe('mergeIssuerFieldsWithEnvDefaults', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it('fills empty issuer fields from env without overwriting provided values', () => {
    process.env.QUOTATION_ISSUER_LEGAL_NAME = 'شرکت پیش‌فرض';
    process.env.QUOTATION_ISSUER_PHONE = '0210000';

    const merged = mergeIssuerFieldsWithEnvDefaults({
      issuerLegalName: 'شرکت صریح',
      issuerNationalId: null,
      issuerEconomicCode: null,
      issuerAddress: null,
      issuerPhone: null,
    });

    expect(merged.issuerLegalName).toBe('شرکت صریح');
    expect(merged.issuerPhone).toBe('0210000');
  });
});
