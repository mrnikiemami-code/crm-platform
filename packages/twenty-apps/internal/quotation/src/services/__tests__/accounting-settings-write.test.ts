import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAccountingSettingsAction = vi.fn();

vi.mock('src/data/accounting-settings-api', () => ({
  callAccountingSettingsAction: (...args: unknown[]) =>
    callAccountingSettingsAction(...args),
}));

const {
  readAccountingSettingsAuthority,
  saveConnectionThroughServer,
  testConnectionThroughServer,
} = await import('src/services/accounting-connection.service');

const savedRow = {
  recordId: 'connection-1',
  name: 'آسان',
  adapterId: 'asan',
  isActive: true,
  settings: { baseUrl: 'https://asan.example.ir' },
  capabilities: null,
  healthState: 'UNKNOWN',
  verificationState: 'LIVE_UNVERIFIED',
};

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

  it('never sends a capabilities object: the server derives it', async () => {
    callAccountingSettingsAction.mockResolvedValueOnce({
      kind: 'OK',
      data: { success: true, connections: [savedRow] },
    });

    await saveConnectionThroughServer(
      {
        id: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://asan.example.ir' },
      },
      { authorizationHeader: 'Bearer caller-token' },
    );

    const body = (
      callAccountingSettingsAction.mock.calls[0][0] as {
        body: Record<string, unknown>;
      }
    ).body;

    expect(body).not.toHaveProperty('capabilities');
  });

  it('asks the server to test the connection without posting a health claim', async () => {
    callAccountingSettingsAction.mockResolvedValueOnce({
      kind: 'OK',
      data: {
        success: true,
        connections: [{ ...savedRow, healthState: 'OK' }],
        health: {
          healthState: 'OK',
          message: 'ok',
          detail: 'ok',
          checkedAt: '2026-11-22T00:00:00.000Z',
          latencyMs: 3,
        },
      },
    });

    const outcome = await testConnectionThroughServer('connection-1', {
      authorizationHeader: 'Bearer caller-token',
    });

    const body = (
      callAccountingSettingsAction.mock.calls[0][0] as {
        body: Record<string, unknown>;
      }
    ).body;

    expect(body).toEqual({
      action: 'accounting-connection-test',
      recordId: 'connection-1',
    });
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        healthState: 'OK',
        verificationState: 'LIVE_UNVERIFIED',
      },
    });
  });
});
