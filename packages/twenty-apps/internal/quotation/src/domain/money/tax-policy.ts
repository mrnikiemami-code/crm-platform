import { accepted, refused, type Result } from 'src/domain/shared/result';

// Known tax policies only. Rates are business/legal facts already used since S1
// (IR_VAT_9 = 9% VAT). New policies must not be invented here without commercial
// and accounting approval — unknown ids are refused, never guessed.

export type TaxPolicyId = 'IR_VAT_9';

export type TaxPolicyDefinition = {
  id: TaxPolicyId;
  label: string;
  // Basis points: 900 = 9.00%.
  rateBasisPoints: bigint;
};

const TAX_POLICIES: Record<TaxPolicyId, TaxPolicyDefinition> = {
  IR_VAT_9: {
    id: 'IR_VAT_9',
    label: 'مالیات بر ارزش افزوده ۹٪',
    rateBasisPoints: 900n,
  },
};

export const DEFAULT_TAX_POLICY_ID: TaxPolicyId = 'IR_VAT_9';

export const resolveTaxPolicy = (
  policyId: string | null | undefined,
): Result<TaxPolicyDefinition> => {
  const normalized = (policyId ?? '').trim();

  if (normalized === '') {
    return refused(
      'TAX_POLICY_REQUIRED',
      'سیاست مالیات الزامی است (مثلاً IR_VAT_9)',
    );
  }

  const policy = TAX_POLICIES[normalized as TaxPolicyId];

  if (policy === undefined) {
    return refused(
      'TAX_POLICY_UNKNOWN',
      `سیاست مالیات «${normalized}» در فهرست معتبر نیست`,
    );
  }

  return accepted(policy);
};
