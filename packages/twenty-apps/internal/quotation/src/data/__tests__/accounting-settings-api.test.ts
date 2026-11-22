import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callAccountingSettingsAction } from 'src/data/accounting-settings-api';

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

describe('callAccountingSettingsAction', () => {
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
      .mockResolvedValue(jsonResponse(200, { success: true, connections: [] }));

    await callAccountingSettingsAction({
      body: { action: 'accounting-connection-save' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(readHeaders(fetchMock.mock.calls[0]).Authorization).toBe(
      'Bearer caller-token',
    );
  });

  it('does not retry a rejected write under the application identity', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse(403, { message: 'forbidden' }));

    const outcome = await callAccountingSettingsAction({
      body: { action: 'accounting-connection-save' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a write with no caller header, without asking the server', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await callAccountingSettingsAction({
      body: { action: 'accounting-connection-save' },
      authorizationHeader: null,
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_UNAVAILABLE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to target the intranet deployment on port 6080', async () => {
    process.env.TWENTY_API_URL = 'http://intranet.example:6080';
    const fetchMock = vi.spyOn(global, 'fetch');

    const outcome = await callAccountingSettingsAction({
      body: { action: 'accounting-connection-list' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_UNAVAILABLE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the server refusal code instead of a generic failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        success: false,
        code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED',
        message: 'آدرس سرویس در شبکهٔ داخلی است',
      }),
    );

    const outcome = await callAccountingSettingsAction({
      body: { action: 'accounting-connection-save' },
      authorizationHeader: 'Bearer caller-token',
    });

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED',
    });
  });
});
