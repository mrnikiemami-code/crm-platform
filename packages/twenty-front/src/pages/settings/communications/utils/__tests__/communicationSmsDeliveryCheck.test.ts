import {
  type SettingsDeliveryTransport,
  classifySettingsDeliveryResponse,
  runSettingsDeliveryCheck,
} from '~/pages/settings/communications/utils/communicationSmsTestSend';

const buildDeliveryTransport = (
  data: Record<string, unknown>,
  options: { delayMs?: number; reject?: boolean; neverResolve?: boolean } = {},
) => {
  const calls: { providerMessageId: string }[] = [];

  const deliveryTransport: SettingsDeliveryTransport = async (request) => {
    calls.push(request);

    if (options.neverResolve === true) return new Promise(() => {});
    if (options.reject === true) throw new Error('network down');
    if (options.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    return { ok: true, status: 200, data };
  };

  return { deliveryTransport, calls };
};

describe('classifySettingsDeliveryResponse', () => {
  it('classifies a delivered status with the provider code', () => {
    expect(
      classifySettingsDeliveryResponse({
        success: true,
        state: 'DELIVERED',
        providerCode: 1,
      }),
    ).toEqual({ kind: 'STATUS', state: 'DELIVERED', providerCode: 1 });
  });

  it('classifies a not-delivered status without claiming delivery', () => {
    expect(
      classifySettingsDeliveryResponse({
        success: true,
        state: 'NOT_DELIVERED',
        providerCode: 2,
      }),
    ).toEqual({ kind: 'STATUS', state: 'NOT_DELIVERED', providerCode: 2 });
  });

  it('classifies a failed lookup as LOOKUP_FAILED, never a delivery claim', () => {
    expect(
      classifySettingsDeliveryResponse({
        success: false,
        failureCode: 'LOOKUP_FAILED',
      }),
    ).toEqual({ kind: 'LOOKUP_FAILED' });
  });

  it('classifies a permission refusal', () => {
    expect(
      classifySettingsDeliveryResponse({
        success: false,
        failureCode: 'NOT_PERMITTED',
      }),
    ).toEqual({ kind: 'NOT_PERMITTED' });
  });
});

describe('runSettingsDeliveryCheck', () => {
  it('performs one inquiry and returns the status', async () => {
    const { deliveryTransport, calls } = buildDeliveryTransport({
      success: true,
      state: 'DELIVERED',
      providerCode: 1,
    });

    const outcome = await runSettingsDeliveryCheck(
      { providerMessageId: '555' },
      { transport: undefined as never, deliveryTransport },
    );

    expect(outcome).toEqual({
      kind: 'STATUS',
      state: 'DELIVERED',
      providerCode: 1,
    });
    expect(calls).toHaveLength(1);
  });

  it('drops a second immediate click: exactly one request', async () => {
    const { deliveryTransport, calls } = buildDeliveryTransport(
      { success: true, state: 'SENT' },
      { delayMs: 20 },
    );

    const guard = { current: false };

    const first = runSettingsDeliveryCheck(
      { providerMessageId: '555' },
      { transport: undefined as never, deliveryTransport, isSendingRef: guard },
    );
    const second = runSettingsDeliveryCheck(
      { providerMessageId: '555' },
      { transport: undefined as never, deliveryTransport, isSendingRef: guard },
    );

    const [a, b] = await Promise.all([first, second]);

    expect(calls).toHaveLength(1);
    expect([a.kind, b.kind].sort()).toEqual(['DUPLICATE_IGNORED', 'STATUS']);
  });

  it('returns LOOKUP_FAILED on a transport rejection (no retry)', async () => {
    const { deliveryTransport, calls } = buildDeliveryTransport(
      {},
      { reject: true },
    );

    const outcome = await runSettingsDeliveryCheck(
      { providerMessageId: '555' },
      { transport: undefined as never, deliveryTransport },
    );

    expect(outcome).toEqual({ kind: 'LOOKUP_FAILED' });
    expect(calls).toHaveLength(1);
  });

  it('settles at the deadline when the transport never resolves', async () => {
    const { deliveryTransport } = buildDeliveryTransport(
      {},
      { neverResolve: true },
    );

    const outcome = await runSettingsDeliveryCheck(
      { providerMessageId: '555' },
      { transport: undefined as never, deliveryTransport, deadlineMs: 30 },
    );

    expect(outcome).toEqual({ kind: 'LOOKUP_FAILED' });
  });
});
