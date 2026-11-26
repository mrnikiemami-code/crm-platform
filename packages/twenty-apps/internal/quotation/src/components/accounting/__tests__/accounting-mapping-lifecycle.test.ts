import { describe, expect, it } from 'vitest';

import {
  mappingRowAllowsEdit,
  parseKeyValueLines,
  resolveCurrencyMappingRows,
  resolveTaxPolicyMappingRows,
  setMappingRow,
  type CurrencyCatalogView,
  type TaxPolicyView,
} from 'src/components/accounting/accounting-shared';

const policy = (
  overrides: Partial<TaxPolicyView> & Pick<TaxPolicyView, 'code'>,
): TaxPolicyView => ({
  name: overrides.code,
  ratePercent: '9',
  dutyRatePercent: '0',
  totalRatePercent: '9',
  rateBasisPoints: '900',
  dutyRateBasisPoints: '0',
  totalRateBasisPoints: '900',
  isActive: true,
  isDefault: false,
  isExempt: false,
  ...overrides,
});

const currency = (
  overrides: Partial<CurrencyCatalogView> & Pick<CurrencyCatalogView, 'code'>,
): CurrencyCatalogView => ({
  name: overrides.code,
  isActive: true,
  isDefault: false,
  ...overrides,
});

describe('resolveTaxPolicyMappingRows lifecycle', () => {
  it('labels inactive catalog rows inactive, not orphan', () => {
    const rows = resolveTaxPolicyMappingRows({
      policies: [
        policy({ code: 'ACTIVE', isActive: true }),
        policy({ code: 'OLD', isActive: false }),
      ],
      mappingKeys: ['OLD', 'ACTIVE'],
    });

    expect(rows.find((row) => row.code === 'OLD')).toMatchObject({
      referenceStatus: 'inactive',
      orphan: false,
      policy: expect.objectContaining({ code: 'OLD' }),
    });
    expect(rows.find((row) => row.code === 'ACTIVE')?.referenceStatus).toBe(
      'active',
    );
  });

  it('labels keys missing from a successful catalog as orphan', () => {
    const rows = resolveTaxPolicyMappingRows({
      policies: [policy({ code: 'ACTIVE' })],
      mappingKeys: ['GONE'],
    });

    expect(rows.find((row) => row.code === 'GONE')).toMatchObject({
      referenceStatus: 'orphan',
      orphan: true,
      policy: null,
    });
  });

  it('marks mapping keys unverified when the catalog was not successfully read', () => {
    const rows = resolveTaxPolicyMappingRows({
      policies: [],
      mappingKeys: ['STD'],
      catalogVerified: false,
    });

    expect(rows).toEqual([
      {
        policy: null,
        code: 'STD',
        referenceStatus: 'unverified',
        orphan: false,
      },
    ]);
    expect(mappingRowAllowsEdit('unverified')).toBe(false);
  });
});

describe('resolveCurrencyMappingRows lifecycle', () => {
  it('does not invent IRR when the successful catalog is empty', () => {
    expect(
      resolveCurrencyMappingRows({
        currencies: [],
        mappingKeys: [],
      }),
    ).toEqual([]);
  });

  it('keeps a legacy USD mapping as orphan without inventing CRM identity', () => {
    const rows = resolveCurrencyMappingRows({
      currencies: [currency({ code: 'IRR', name: 'ریال ایران' })],
      mappingKeys: ['IRR', 'USD'],
    });

    expect(rows.map((row) => row.code)).toEqual(['IRR', 'USD']);
    expect(rows.find((row) => row.code === 'USD')).toMatchObject({
      referenceStatus: 'orphan',
      orphan: true,
    });
    expect(rows.find((row) => row.code === 'IRR')?.referenceStatus).toBe(
      'active',
    );
  });

  it('labels inactive currency rows inactive and blocks new edits', () => {
    const rows = resolveCurrencyMappingRows({
      currencies: [currency({ code: 'IRR', isActive: false })],
      mappingKeys: ['IRR'],
    });

    expect(rows[0]).toMatchObject({
      referenceStatus: 'inactive',
      inactive: true,
      orphan: false,
    });
    expect(mappingRowAllowsEdit('inactive')).toBe(false);
    expect(mappingRowAllowsEdit('active')).toBe(true);
  });

  it('does not synthesize a catalog when the fetch failed', () => {
    const rows = resolveCurrencyMappingRows({
      currencies: [currency({ code: 'IRR' })],
      mappingKeys: ['USD'],
      catalogVerified: false,
    });

    expect(rows).toEqual([
      {
        code: 'USD',
        name: 'USD',
        referenceStatus: 'unverified',
        orphan: false,
        inactive: false,
      },
    ]);
  });
});

describe('mapping text round-trip preserves historical keys', () => {
  it('parseKeyValueLines keeps every non-empty key including legacy USD', () => {
    expect(parseKeyValueLines('IRR=IRR\nUSD=Dollar\n=skip\nNOVALUE=\n')).toEqual({
      IRR: 'IRR',
      USD: 'Dollar',
    });
  });

  it('setMappingRow updates one row without dropping unrelated legacy keys', () => {
    const text = 'IRR=IRR\nUSD=USD\nGONE=99';

    expect(setMappingRow(text, 'IRR', 'ریال')).toBe(
      'IRR=ریال\nUSD=USD\nGONE=99',
    );
  });
});
