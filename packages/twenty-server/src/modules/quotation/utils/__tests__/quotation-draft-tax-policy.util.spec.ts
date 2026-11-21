import { type QuotationDraftSaveHeader } from 'src/modules/quotation/types/quotation-draft-save.type';
import { evaluateDraftTaxPolicy } from 'src/modules/quotation/utils/quotation-draft-tax-policy.util';

const header = (
  overrides: Partial<QuotationDraftSaveHeader> = {},
): QuotationDraftSaveHeader => ({
  name: 'پیش‌فاکتور',
  customerType: 'COMPANY',
  personId: null,
  companyId: 'company-1',
  currencyCode: 'IRR',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: '900',
  paymentTerms: null,
  documentDiscountKind: 'NONE',
  documentDiscountInputExact: '0.000000',
  grossExact: '1000000.000000',
  lineDiscountExact: '0.000000',
  documentDiscountExact: '0.000000',
  netExact: '1000000.000000',
  taxExact: '90000.000000',
  roundingExact: '0.000000',
  totalExact: '1090000.000000',
  ...overrides,
});

const activePolicy = {
  code: 'IR_VAT_9',
  rateBasisPoints: '900',
  isActive: true,
};

describe('evaluateDraftTaxPolicy', () => {
  it('accepts the active policy at its current rate', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header(),
        policy: activePolicy,
        stored: null,
      }),
    ).toEqual({ ok: true });
  });

  it('refuses a rate the policy does not carry', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxRateBasisPoints: '1200' }),
        policy: activePolicy,
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_RATE_MISMATCH' });
  });

  it('refuses a policy code the workspace does not define', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxPolicy: 'IR_VAT_99' }),
        policy: null,
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_UNKNOWN' });
  });

  it('refuses a deactivated policy for a new draft', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header(),
        policy: { ...activePolicy, isActive: false },
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_INACTIVE' });
  });

  it('allows a deactivated policy on the draft that already carries it', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header(),
        policy: { ...activePolicy, isActive: false },
        stored: { code: 'IR_VAT_9', rateBasisPoints: '900' },
      }),
    ).toEqual({ ok: true });
  });

  it('keeps the stored rate after the policy rate changed', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header(),
        policy: { ...activePolicy, rateBasisPoints: '1200' },
        stored: { code: 'IR_VAT_9', rateBasisPoints: '900' },
      }),
    ).toEqual({ ok: true });
  });

  it('does not let a stored rate authorize a different policy', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxPolicy: 'TAX_1000', taxRateBasisPoints: '900' }),
        policy: { code: 'TAX_1000', rateBasisPoints: '1000', isActive: true },
        stored: { code: 'IR_VAT_9', rateBasisPoints: '900' },
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_RATE_MISMATCH' });
  });

  it('refuses tax without a declared rate', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxRateBasisPoints: null }),
        policy: activePolicy,
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_RATE_REQUIRED' });
  });

  it('refuses tax with no policy at all', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxPolicy: null, taxRateBasisPoints: null }),
        policy: null,
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_REQUIRED' });
  });

  it('refuses a rate declared without a policy', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({ taxPolicy: null }),
        policy: null,
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_REQUIRED' });
  });

  it('accepts a legacy document with no policy and no tax', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header({
          taxPolicy: null,
          taxRateBasisPoints: null,
          taxExact: '0.000000',
          totalExact: '1000000.000000',
        }),
        policy: null,
        stored: null,
      }),
    ).toEqual({ ok: true });
  });

  it('refuses a policy whose stored rate cannot be read', () => {
    expect(
      evaluateDraftTaxPolicy({
        header: header(),
        policy: { ...activePolicy, rateBasisPoints: '' },
        stored: null,
      }),
    ).toMatchObject({ ok: false, code: 'TAX_POLICY_UNREADABLE' });
  });
});
