import { type QuotationDraftSaveHeader } from 'src/modules/quotation/types/quotation-draft-save.type';
import { parseExactAmountToMicros } from 'src/modules/quotation/utils/quotation-draft-totals.util';

// The authority check the direct REST boundary was missing: the declared
// `(taxPolicy, taxRateBasisPoints)` pair must be a policy this workspace actually
// has. `evaluateQuotationDraftTotals` only proves the amount matches the *declared*
// rate, so without this a caller could name a rate the settings never approved.
//
// This function is pure: the caller reads the policy row and the stored draft in the
// same transaction, so the decision and the write cannot disagree.
export type DraftTaxPolicyChoice = {
  code: string;
  rateBasisPoints: string;
  isActive: boolean;
};

export type DraftTaxPolicyStored = {
  code: string | null;
  rateBasisPoints: string | null;
};

export type DraftTaxPolicyDecision =
  | { ok: true }
  | { ok: false; code: string; message: string };

const refused = (
  code: string,
  message: string,
): DraftTaxPolicyDecision => ({
  ok: false,
  code,
  message,
});

const BASIS_POINTS_MAX = BigInt(10000);

const readRate = (text: string | null): bigint | null => {
  const normalized = (text ?? '').trim();

  return /^\d{1,5}$/.test(normalized) ? BigInt(normalized) : null;
};

export const evaluateDraftTaxPolicy = ({
  header,
  policy,
  stored,
}: {
  header: QuotationDraftSaveHeader;
  policy: DraftTaxPolicyChoice | null;
  stored: DraftTaxPolicyStored | null;
}): DraftTaxPolicyDecision => {
  const code = (header.taxPolicy ?? '').trim();
  const declaredRate = readRate(header.taxRateBasisPoints);
  const declaredTaxMicros = parseExactAmountToMicros(header.taxExact);

  if (declaredTaxMicros === null) {
    // `evaluateQuotationDraftTotals` owns malformed amounts; this function must not
    // guess a zero tax and then approve a document it cannot read.
    return refused('INVALID_EXACT_AMOUNT', 'header.taxExact is not an exact decimal');
  }

  if (code === '') {
    // A rate with no policy names no authority. Tax with no policy is the same
    // hole: an amount the settings never approved.
    if (header.taxRateBasisPoints !== null) {
      return refused(
        'TAX_POLICY_REQUIRED',
        'نرخ مالیات بدون سیاست مالیات معتبر نیست',
      );
    }

    if (declaredTaxMicros !== BigInt(0)) {
      return refused('TAX_POLICY_REQUIRED', 'سیاست مالیات برای سند دارای مالیات الزامی است');
    }

    return { ok: true };
  }

  if (policy === null) {
    return refused(
      'TAX_POLICY_UNKNOWN',
      `سیاست مالیات «${code}» در تنظیمات این فضای کاری تعریف نشده است`,
    );
  }

  // An issued document keeps its own sealed numbers; a draft may also keep a policy
  // that was deactivated after it was written. Anything else is a new selection.
  const storedSamePolicy = stored !== null && (stored.code ?? '').trim() === code;

  if (!policy.isActive && !storedSamePolicy) {
    return refused('TAX_POLICY_INACTIVE', `سیاست مالیات «${code}» غیرفعال است`);
  }

  if (declaredRate === null) {
    return refused(
      'TAX_RATE_REQUIRED',
      'نرخ مالیات اعمال‌شده باید همراه سند اعلام شود',
    );
  }

  if (declaredRate > BASIS_POINTS_MAX) {
    return refused('TAX_RATE_OUT_OF_RANGE', 'درصد مالیات باید بین ۰ و ۱۰۰ باشد');
  }

  const policyRate = readRate(policy.rateBasisPoints);

  if (policyRate === null) {
    return refused(
      'TAX_POLICY_UNREADABLE',
      'نرخ ذخیره‌شدهٔ سیاست مالیات خوانده نشد',
    );
  }

  if (declaredRate === policyRate) {
    return { ok: true };
  }

  // On update only: the server itself wrote the stored rate once, so re-saving a
  // draft after a settings edit keeps the price it was quoted at instead of being
  // silently repriced. This still cannot introduce a rate the server never approved.
  const storedRate = storedSamePolicy ? readRate(stored?.rateBasisPoints ?? null) : null;

  if (storedRate !== null && declaredRate === storedRate) {
    return { ok: true };
  }

  return refused(
    'TAX_POLICY_RATE_MISMATCH',
    `نرخ اعلام‌شده با سیاست «${code}» هم‌خوان نیست`,
  );
};
