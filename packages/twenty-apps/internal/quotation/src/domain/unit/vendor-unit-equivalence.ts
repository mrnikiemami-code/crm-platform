import { accepted, refused, type Result } from 'src/domain/shared/result';

export type VendorPrimaryUnitObservation = {
  vendorUnitId?: string | null;
  vendorUnitName?: string | null;
};

export type CrmUnitEquivalenceTarget = {
  recordId: string;
  name: string;
  accountingCode?: string | null;
};

const normalizeLabel = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

// Primary vendor unit must match the selected CRM unit by exact observed name
// (or id string when both sides expose the same text). No inferred conversion.
export const assertVendorPrimaryUnitMatchesCrm = ({
  observation,
  crmUnit,
}: {
  observation: VendorPrimaryUnitObservation | null | undefined;
  crmUnit: CrmUnitEquivalenceTarget;
}): Result<true> => {
  const vendorName = (observation?.vendorUnitName ?? '').trim();
  const vendorId = (observation?.vendorUnitId ?? '').trim();

  // Unobserved primary unit cannot be silently equated; callers that only need a
  // CRM unit pick should skip this assert when both vendor fields are empty.
  if (vendorName === '' && vendorId === '') {
    return refused(
      'VENDOR_UNIT_UNOBSERVED',
      'واحد اصلی مقصد مشاهده نشده است',
    );
  }

  const crmName = normalizeLabel(crmUnit.name);

  if (crmName === '') {
    return refused('CRM_UNIT_NAME_REQUIRED', 'نام واحد CRM نامعتبر است');
  }

  if (vendorName !== '' && normalizeLabel(vendorName) === crmName) {
    return accepted(true);
  }

  // Some destinations reuse the same human label as the CRM accounting code.
  const accountingCode = (crmUnit.accountingCode ?? '').trim();

  if (
    vendorName !== '' &&
    accountingCode !== '' &&
    normalizeLabel(vendorName) === normalizeLabel(accountingCode)
  ) {
    return accepted(true);
  }

  if (vendorId !== '' && vendorId === crmUnit.recordId.trim()) {
    return accepted(true);
  }

  return refused(
    'VENDOR_UNIT_MISMATCH',
    'واحد انتخاب‌شده با واحد اصلی مشاهده‌شده از مقصد یکی نیست',
  );
};

// Import selection: require exact match only when the destination exposed a primary unit.
export const assertCrmUnitCompatibleWithVendorObservation = ({
  observation,
  crmUnit,
}: {
  observation: VendorPrimaryUnitObservation | null | undefined;
  crmUnit: CrmUnitEquivalenceTarget;
}): Result<true> => {
  const vendorName = (observation?.vendorUnitName ?? '').trim();
  const vendorId = (observation?.vendorUnitId ?? '').trim();

  if (vendorName === '' && vendorId === '') {
    return accepted(true);
  }

  return assertVendorPrimaryUnitMatchesCrm({ observation, crmUnit });
};
