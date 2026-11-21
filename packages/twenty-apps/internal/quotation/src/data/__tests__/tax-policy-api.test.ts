import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callTaxPolicyAction } from 'src/data/tax-policy-api';

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

const readHeaders = (call: unknown[]): Record<string, string> =>
  (call[1] as { headers: Record<string, string> }).headers;

describe('callTaxPolicyAction', () => {
  beforeEach(() => {
    process.env.TWENTY_API_URL = 'http://localhost:3002';
    process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN = 'app-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('forwards the caller header instead of the app token', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse(200, { success: true, policies: [] }));

    await callTaxPolicyAction({
      body: { action: 'tax-policy-save' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(readHeaders(fetchMock.mock.calls[0]).Authorization).toBe(
      'Bearer caller-token',
    );
  });

  it('does not fall back to the app token when the caller header is rejected', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse(403, { message: 'forbidden' }));

    const outcome = await callTaxPolicyAction({
      body: { action: 'tax-policy-save' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_SETTINGS_FORBIDDEN',
    });
    // Exactly one request: no retry with the application identity.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readHeaders(fetchMock.mock.calls[0]).Authorization).toBe(
      'Bearer caller-token',
    );
  });

  it('refuses a mutation that carries no caller header, without asking the server', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await callTaxPolicyAction({
      body: { action: 'tax-policy-set-default', recordId: 'tp-1' },
      authorizationHeader: null,
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_SETTINGS_UNAVAILABLE',
    });
    // The application identity is never substituted for the missing caller.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a blank caller header, without asking the server', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await callTaxPolicyAction({
      body: { action: 'tax-policy-save' },
      authorizationHeader: '   ',
    });

    expect(outcome).toMatchObject({ kind: 'REFUSED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to target the intranet deployment on port 6080', async () => {
    process.env.TWENTY_API_URL = 'http://intranet.example:6080';
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await callTaxPolicyAction({
      body: { action: 'tax-policy-list' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_SETTINGS_UNAVAILABLE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the server refusal code instead of a generic failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        success: false,
        code: 'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
        message: 'سیاست غیرفعال را نمی‌توان پیش‌فرض کرد',
      }),
    );

    const outcome = await callTaxPolicyAction({
      body: { action: 'tax-policy-set-default', recordId: 'tp-1' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
    });
  });
});


