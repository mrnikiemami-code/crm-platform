import { describe, expect, it } from 'vitest';

import {
  assertCrmUnitCompatibleWithVendorObservation,
  assertVendorPrimaryUnitMatchesCrm,
} from 'src/domain/unit/vendor-unit-equivalence';

describe('vendor primary unit equivalence', () => {
  it('matches CRM unit by normalized vendor name', () => {
    const result = assertVendorPrimaryUnitMatchesCrm({
      observation: { vendorUnitName: '  عدد  ' },
      crmUnit: { recordId: 'u1', name: 'عدد' },
    });

    expect(result.ok).toBe(true);
  });

  it('refuses mismatched primary unit names', () => {
    const result = assertVendorPrimaryUnitMatchesCrm({
      observation: { vendorUnitName: 'کیلو' },
      crmUnit: { recordId: 'u1', name: 'عدد' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.code).toBe('VENDOR_UNIT_MISMATCH');
    }
  });

  it('allows CRM selection when vendor unit was not observed', () => {
    expect(
      assertCrmUnitCompatibleWithVendorObservation({
        observation: { vendorUnitName: null, vendorUnitId: null },
        crmUnit: { recordId: 'u1', name: 'عدد' },
      }).ok,
    ).toBe(true);
  });
});
