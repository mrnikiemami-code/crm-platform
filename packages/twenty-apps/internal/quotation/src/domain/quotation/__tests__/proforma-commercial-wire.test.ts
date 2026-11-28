import { describe, expect, it } from 'vitest';

import {
  isProformaVendorFieldSupported,
  PROFORMA_UNSUPPORTED_VENDOR_FIELDS,
} from 'src/domain/quotation/proforma-commercial-wire';

describe('proforma commercial wire honesty', () => {
  it('marks VisitorID, StorageID and Serial unsupported for proforma', () => {
    expect(PROFORMA_UNSUPPORTED_VENDOR_FIELDS.map((entry) => entry.wireField)).toEqual([
      'VisitorID',
      'StorageID',
      'Serial',
    ]);
    expect(isProformaVendorFieldSupported('VisitorID')).toBe(false);
    expect(isProformaVendorFieldSupported('TasvieDate')).toBe(true);
  });
});
