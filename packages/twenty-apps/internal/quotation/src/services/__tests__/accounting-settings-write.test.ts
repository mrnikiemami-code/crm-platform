import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAccountingSettingsAction = vi.fn();

vi.mock('src/data/accounting-settings-api', () => ({
  callAccountingSettingsAction: (...args: unknown[]) =>
    callAccountingSettingsAction(...args),
}));

const { readAccountingSettingsAuthority, saveConnectionThroughServer } =
  await import('src/services/accounting-connection.service');

describe('accounting settings write boundary (app side)', () => {
  beforeEach(() => {
    callAccountingSettingsAction.mockReset();
  });

  it('reports a refusal as a refusal, never as an implicit permission', async () => {
    callAccountingSettingsAction.mockResolvedValueOnce({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
      message: 'forbidden',
    });

    const authority = await readAccountingSettingsAuthority({
      authorizationHeader: 'Bearer caller-token',
    });

    expect(authority).toMatchObject({ ok: false });
  });

  it('does not attempt a second write path when the server refuses the save', async () => {
    callAccountingSettingsAction.mockResolvedValueOnce({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
      message: 'forbidden',
    });

    const saved = await saveConnectionThroughServer(
      {
        id: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://asan.example.ir' },
      },
      { authorizationHeader: 'Bearer caller-token' },
    );

    expect(saved).toMatchObject({
      ok: false,
      refusal: { code: 'ACCOUNTING_SETTINGS_FORBIDDEN' },
    });
    expect(callAccountingSettingsAction).toHaveBeenCalledTimes(1);
  });
});
