import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countQuotationsPerTaxPolicy,
  deactivateTaxPolicy,
  deleteTaxPolicy,
  loadTaxPolicies,
  saveTaxPolicy,
  setDefaultTaxPolicy,
} from 'src/services/tax-policy.service';

const ORIGINAL_ENV = { ...process.env };

const jsonResponse = (
  status: number,
  body: Record<string, unknown>,
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const serverPolicy = {
  recordId: 'tp-1',
  code: 'IR_VAT_9',
  name: 'مالیات بر ارزش افزوده ۹٪',
  rateBasisPoints: '900',
  ratePercent: '9',
  isActive: true,
  isDefault: true,
  isExempt: false,
};

describe('tax-policy.service reads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('lists the catalog from one query and never writes', async () => {
    const execute = vi.fn(async (_query: string) => ({
      taxPolicies: {
        edges: [
          {
            node: {
              id: 'tp-1',
              code: 'IR_VAT_9',
              name: 'مالیات ۹٪',
              rateBasisPoints: '900',
              isActive: true,
              isDefault: true,
              isExempt: false,
            },
          },
        ],
      },
    }));

    const entries = await loadTaxPolicies({ execute });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'IR_VAT_9',
      rateBasisPoints: BigInt(900),
      isDefault: true,
    });
    const queries = execute.mock.calls.map((call) => call[0] as string);

    expect(queries.every((query) => query.trim().startsWith('query'))).toBe(true);
  });

  it('skips a row whose stored rate is unreadable instead of guessing it', async () => {
    const execute = vi.fn(async (_query: string) => ({
      taxPolicies: {
        edges: [
          {
            node: {
              id: 'tp-1',
              code: 'TAX_BROKEN',
              name: 'خراب',
              rateBasisPoints: '9.5',
            },
          },
        ],
      },
    }));

    await expect(loadTaxPolicies({ execute })).resolves.toEqual([]);
  });

  it('counts quotation usage from the policy code, not the record id', async () => {
    const execute = vi.fn(async (_query: string) => ({
      quotations: {
        edges: [
          { node: { id: 'q-1', taxPolicy: 'IR_VAT_9' } },
          { node: { id: 'q-2', taxPolicy: 'IR_VAT_9' } },
          { node: { id: 'q-3', taxPolicy: 'TAX_1000' } },
        ],
      },
    }));

    const counts = await countQuotationsPerTaxPolicy({ execute });

    expect(counts.get('IR_VAT_9')).toBe(2);
    expect(counts.get('TAX_1000')).toBe(1);
  });
});

describe('tax-policy.service mutations', () => {
  beforeEach(() => {
    process.env.TWENTY_API_URL = 'http://localhost:3002';
    process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN = 'app-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns the catalog the server answered with', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        success: true,
        policies: [serverPolicy],
        defaultCode: 'IR_VAT_9',
      }),
    );

    const outcome = await saveTaxPolicy(
      {
        recordId: null,
        name: 'مالیات ۹٪',
        ratePercentText: '۹',
        isActive: true,
        isDefault: true,
      },
      { authorizationHeader: 'Bearer caller-token' },
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.value[0]).toMatchObject({
      id: 'IR_VAT_9',
      isDefault: true,
      rateBasisPoints: BigInt(900),
    });
  });

  it('refuses a mutation with no caller identity and never asks the server', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await saveTaxPolicy(
      {
        recordId: null,
        name: 'مالیات ۹٪',
        ratePercentText: '۹',
        isActive: true,
        isDefault: true,
      },
      { authorizationHeader: null },
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.refusal.code).toBe(
      'TAX_SETTINGS_UNAVAILABLE',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a server refusal to a domain refusal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        success: false,
        code: 'TAX_POLICY_RATE_MISMATCH',
        message: 'نرخ نامعتبر',
      }),
    );

    const outcome = await setDefaultTaxPolicy('tp-2', {
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_POLICY_RATE_MISMATCH' },
    });
  });

  it('asks the server to delete a policy and returns the catalog it answered with', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, { success: true, policies: [], defaultCode: null }),
    );

    const outcome = await deleteTaxPolicy('tp-2', {
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome.ok).toBe(true);
    expect(
      JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)),
    ).toMatchObject({ action: 'tax-policy-delete', recordId: 'tp-2' });
  });

  it('maps a used-policy refusal from the delete to a domain refusal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        success: false,
        code: 'TAX_POLICY_IN_USE',
        message: 'این سیاست در ۸ سند استفاده شده است',
      }),
    );

    const outcome = await deleteTaxPolicy('tp-2', {
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_POLICY_IN_USE' },
    });
  });

  it('sends deactivation to its own server action', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, { success: true, policies: [], defaultCode: null }),
    );

    await deactivateTaxPolicy('tp-2', {
      authorizationHeader: 'Bearer caller-token',
    });

    expect(
      JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)),
    ).toMatchObject({ action: 'tax-policy-deactivate', recordId: 'tp-2' });
  });

  it('refuses when the settings route has no credentials at all', async () => {
    delete process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN;
    delete process.env.TWENTY_APP_ACCESS_TOKEN;

    const outcome = await saveTaxPolicy(
      {
        recordId: null,
        name: 'مالیات ۹٪',
        ratePercentText: '9',
        isActive: true,
        isDefault: false,
      },
      { authorizationHeader: null },
    );

    expect(outcome).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_SETTINGS_UNAVAILABLE' },
    });
  });
});


