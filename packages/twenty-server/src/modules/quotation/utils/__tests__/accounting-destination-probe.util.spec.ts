import { probeAccountingDestination } from 'src/modules/quotation/utils/accounting-destination-probe.util';

const asanInput = (overrides: Record<string, unknown> = {}) => ({
  adapterId: 'asan',
  isLive: true,
  healthProbe: { path: 'ProductsNew/LastProducts', query: { Count: '1' } },
  baseUrl: 'https://asan.example.ir',
  transportApproved: false,
  allowlist: [],
  ...overrides,
});

const now = () => new Date('2026-11-22T00:00:00.000Z');

describe('probeAccountingDestination', () => {
  it('answers a mock destination in memory, with no name and no socket', async () => {
    const resolveHost = jest.fn();
    const request = jest.fn();

    const outcome = await probeAccountingDestination(
      {
        adapterId: 'mock',
        isLive: false,
        healthProbe: null,
        baseUrl: 'https://mock.invalid',
        transportApproved: false,
        allowlist: [],
      },
      { resolveHost, request, now },
    );

    expect(outcome).toMatchObject({ healthState: 'OK', code: 'REACHABLE' });
    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('pins the request to the address it validated', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '93.184.216.34', family: 4 },
    ]);
    const request = jest.fn(async () => ({ status: 200, latencyMs: 7 }));

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({
      healthState: 'OK',
      code: 'REACHABLE',
      latencyMs: 7,
    });
    expect(resolveHost).toHaveBeenCalledWith('asan.example.ir');
    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      '93.184.216.34',
      4,
      8_000,
    );
  });

  it('refuses a public name that resolves into the private network', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '10.0.0.5', family: 4 },
    ]);
    const request = jest.fn();

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({
      healthState: 'FAILED',
      code: 'DESTINATION_NOT_ALLOWED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses a name that mixes a public and an internal answer', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    const request = jest.fn();

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses an IPv4-mapped loopback answer', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '::ffff:127.0.0.1', family: 6 },
    ]);
    const request = jest.fn();

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses a loopback answer even when transport and allowlist are granted', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '127.0.0.1', family: 4 },
    ]);
    const request = jest.fn();

    const outcome = await probeAccountingDestination(
      asanInput({
        baseUrl: 'http://127.0.0.1:8080',
        transportApproved: true,
        allowlist: [{ host: '127.0.0.1', port: 8080 }],
      }),
      { resolveHost, request, now },
    );

    expect(outcome).toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('admits an internal destination only with approval and an allowlist entry', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '10.0.0.5', family: 4 },
    ]);
    const request = jest.fn(async () => ({ status: 200, latencyMs: 3 }));

    const outcome = await probeAccountingDestination(
      asanInput({
        baseUrl: 'http://10.0.0.5:8080',
        transportApproved: true,
        allowlist: [{ host: '10.0.0.5', port: 8080 }],
      }),
      { resolveHost, request, now },
    );

    expect(outcome).toMatchObject({ healthState: 'OK', code: 'REACHABLE' });
    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      '10.0.0.5',
      4,
      8_000,
    );
  });

  it('refuses to follow a redirect instead of reporting the new host as healthy', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '93.184.216.34', family: 4 },
    ]);
    const request = jest.fn(async () => ({ status: 302, latencyMs: 2 }));

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({
      healthState: 'FAILED',
      code: 'REDIRECT_REFUSED',
    });
  });

  it('reports an unresolvable name as a transport failure, not a healthy destination', async () => {
    const resolveHost = jest.fn(async () => {
      throw new Error('ENOTFOUND');
    });

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request: jest.fn(),
      now,
    });

    expect(outcome).toMatchObject({
      healthState: 'FAILED',
      code: 'TRANSPORT_ERROR',
    });
  });

  it('reports a timeout distinctly from a refusal', async () => {
    const resolveHost = jest.fn(async () => [
      { address: '93.184.216.34', family: 4 },
    ]);
    const request = jest.fn(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });

    const outcome = await probeAccountingDestination(asanInput(), {
      resolveHost,
      request,
      now,
    });

    expect(outcome).toMatchObject({ healthState: 'FAILED', code: 'TIMEOUT' });
  });

  it('never resolves a blocked literal address', async () => {
    const resolveHost = jest.fn();
    const request = jest.fn();

    const outcome = await probeAccountingDestination(
      asanInput({ baseUrl: 'http://169.254.169.254/latest' }),
      { resolveHost, request, now },
    );

    expect(outcome).toMatchObject({ code: 'DESTINATION_NOT_ALLOWED' });
    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
