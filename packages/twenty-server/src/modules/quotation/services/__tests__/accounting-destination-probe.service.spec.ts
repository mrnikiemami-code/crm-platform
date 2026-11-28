import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingDestinationProbeService } from 'src/modules/quotation/services/accounting-destination-probe.service';

const auth = { type: 'user', workspace: { id: 'ws-1' } } as WorkspaceAuthContext;
const input = { adapterId: 'asan', isLive: true, healthProbe: { path: 'ProductsNew/LastProducts' },
  baseUrl: 'https://gateway.example', transportApproved: false, allowlist: [] };

describe('canonical accounting health execution', () => {
  it('uses the installed private adapter transport with the original caller and connection', async () => {
    const dispatch = jest.fn(async () => ({ success: true, health: { kind: 'REACHABLE', transportIsSecure: true, latencyMs: 7 } }));
    const service = new AccountingDestinationProbeService({ dispatch } as never);
    expect(await service.probe(input, auth, 'c')).toMatchObject({ healthState: 'OK', code: 'REACHABLE', latencyMs: 7 });
    expect(dispatch).toHaveBeenCalledWith('accounting-internal-probe-connection', { connectionId: 'c' }, auth);
  });
  it('never falls back to a direct vendor probe and never reports cleartext as healthy', async () => {
    const dispatch = jest.fn(async () => ({ success: true, health: { kind: 'REACHABLE', transportIsSecure: false, latencyMs: 7 } }));
    const service = new AccountingDestinationProbeService({ dispatch } as never);
    expect(await service.probe(input, auth, 'c')).toMatchObject({ healthState: 'FAILED' });
    dispatch.mockRejectedValueOnce(new Error('unavailable'));
    expect(await service.probe(input, auth, 'c')).toMatchObject({ healthState: 'FAILED' });
  });
  it('keeps the mock entirely in memory', async () => {
    const dispatch = jest.fn();
    const service = new AccountingDestinationProbeService({ dispatch } as never);
    expect(await service.probe({ ...input, adapterId: 'mock', isLive: false }, auth, 'c')).toMatchObject({ healthState: 'OK' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
