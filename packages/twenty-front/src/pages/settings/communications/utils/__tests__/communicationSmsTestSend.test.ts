import {
  type SettingsTestSmsTransport,
  classifySettingsTestSmsResponse,
  isSettingsTestSmsSendable,
  runSettingsTestSms,
} from '~/pages/settings/communications/utils/communicationSmsTestSend';

const buildTransport = (
  data: Record<string, unknown>,
  options: { delayMs?: number; reject?: boolean; neverResolve?: boolean } = {},
) => {
  const calls: { recipient: string; body: string }[] = [];

  const transport: SettingsTestSmsTransport = async (request) => {
    calls.push(request);

    if (options.neverResolve === true) {
      // A fetch that never settles: the deadline must still settle the caller.
      return new Promise(() => {});
    }

    if (options.reject === true) {
      throw new Error('network down');
    }

    if (options.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    return { ok: true, status: 200, data };
  };

  return { transport, calls };
};

describe('classifySettingsTestSmsResponse', () => {
  it('classifies a success with a recID', () => {
    expect(
      classifySettingsTestSmsResponse({
        success: true,
        status: 'SENT',
        providerMessageId: '555',
      }),
    ).toEqual({ kind: 'SENT', providerMessageId: '555' });
  });

  it('never labels a success as delivered', () => {
    const outcome = classifySettingsTestSmsResponse({
      success: true,
      status: 'SENT',
    });

    expect(outcome.kind).toBe('SENT');
    expect(JSON.stringify(outcome)).not.toContain('DELIVERED');
  });

  it('classifies a definite provider rejection with its code', () => {
    expect(
      classifySettingsTestSmsResponse({
        success: false,
        failureCode: 'PROVIDER_FAILED',
        providerFailureCode: 'INVALID_CREDENTIALS',
        providerCode: 0,
      }),
    ).toMatchObject({
      kind: 'PROVIDER_FAILED',
      failureCode: 'INVALID_CREDENTIALS',
      providerCode: 0,
    });
  });

  it('classifies an unknown outcome as OUTCOME_UNKNOWN', () => {
    expect(
      classifySettingsTestSmsResponse({
        success: false,
        failureCode: 'OUTCOME_UNKNOWN',
        isOutcomeKnown: false,
      }),
    ).toEqual({ kind: 'OUTCOME_UNKNOWN' });
  });

  it('classifies a permission refusal', () => {
    expect(
      classifySettingsTestSmsResponse({
        success: false,
        failureCode: 'NOT_PERMITTED',
      }),
    ).toEqual({ kind: 'NOT_PERMITTED' });
  });

  it('classifies input errors', () => {
    expect(
      classifySettingsTestSmsResponse({
        success: false,
        failureCode: 'INVALID_RECIPIENT',
      }),
    ).toEqual({ kind: 'INVALID', failureCode: 'INVALID_RECIPIENT' });
  });
});

describe('runSettingsTestSms', () => {
  it('sends once and returns SENT', async () => {
    const { transport, calls } = buildTransport({
      success: true,
      status: 'SENT',
      providerMessageId: '1',
    });

    const outcome = await runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport },
    );

    expect(outcome).toEqual({ kind: 'SENT', providerMessageId: '1' });
    expect(calls).toHaveLength(1);
  });

  it('drops a second immediate click: exactly one request', async () => {
    const { transport, calls } = buildTransport(
      { success: true, status: 'SENT' },
      { delayMs: 20 },
    );

    const guard = { current: false };

    const first = runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport, isSendingRef: guard },
    );
    const second = runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport, isSendingRef: guard },
    );

    const [a, b] = await Promise.all([first, second]);

    expect(calls).toHaveLength(1);
    expect([a.kind, b.kind].sort()).toEqual(['DUPLICATE_IGNORED', 'SENT']);
  });

  it('returns OUTCOME_UNKNOWN on a transport rejection (no retry)', async () => {
    const { transport, calls } = buildTransport(
      {},
      { reject: true },
    );

    const outcome = await runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport },
    );

    expect(outcome).toEqual({ kind: 'OUTCOME_UNKNOWN' });
    expect(calls).toHaveLength(1);
  });

  it('settles at the deadline even when the transport never resolves', async () => {
    const { transport } = buildTransport({}, { neverResolve: true });

    const outcome = await runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport, deadlineMs: 30 },
    );

    expect(outcome).toEqual({ kind: 'OUTCOME_UNKNOWN' });
  });

  it('releases the guard after settling so a later send is allowed', async () => {
    const { transport } = buildTransport({ success: true, status: 'SENT' });

    const guard = { current: false };

    await runSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { transport, isSendingRef: guard },
    );

    expect(guard.current).toBe(false);
  });
});

describe('isSettingsTestSmsSendable', () => {
  it('requires a non-empty recipient and body and no in-flight send', () => {
    expect(
      isSettingsTestSmsSendable({ recipient: '0912', body: 'x', isSending: false }),
    ).toBe(true);
    expect(
      isSettingsTestSmsSendable({ recipient: '', body: 'x', isSending: false }),
    ).toBe(false);
    expect(
      isSettingsTestSmsSendable({ recipient: '0912', body: '  ', isSending: false }),
    ).toBe(false);
    expect(
      isSettingsTestSmsSendable({ recipient: '0912', body: 'x', isSending: true }),
    ).toBe(false);
  });
});
