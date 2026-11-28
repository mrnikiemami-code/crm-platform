import { describe, expect, it } from 'vitest';

import { mergeIssuerSnapshotWithDefaults } from 'src/domain/quotation/issuer-defaults';

describe('issuer defaults merge', () => {
  it('fills only empty issuer fields from workspace defaults', () => {
    const merged = mergeIssuerSnapshotWithDefaults(
      {
        issuerLegalName: null,
        issuerNationalId: '111',
        issuerEconomicCode: null,
        issuerAddress: null,
        issuerPhone: null,
      },
      {
        QUOTATION_ISSUER_LEGAL_NAME: 'شرکت نمونه',
        QUOTATION_ISSUER_ECONOMIC_CODE: '12345678901',
      },
    );

    expect(merged).toEqual({
      issuerLegalName: 'شرکت نمونه',
      issuerNationalId: '111',
      issuerEconomicCode: '12345678901',
      issuerAddress: null,
      issuerPhone: null,
    });
  });
});