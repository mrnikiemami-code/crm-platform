import { describe, expect, it } from 'vitest';
import { isPublicAsanIpv4, isApprovedAsanRead, matchesAsanReadBinding, createApprovedAsanReadTransport } from 'src/domain/accounting/adapters/asan/asan-approved-transport';

const binding = { connectionId: 'connection-a', baseUrl: 'https://gateway.example/api', ipv4: '93.184.216.34' };

describe('approved Asan read-only destination', () => {
  it('requires exact connection, base and a public address', () => {
    expect(matchesAsanReadBinding(binding, 'connection-a', 'https://gateway.example/api/')).toBe(true);
    expect(matchesAsanReadBinding(binding, 'connection-b', binding.baseUrl)).toBe(false);
    expect(matchesAsanReadBinding(binding, 'connection-a', 'https://gateway.example/other')).toBe(false);
    for (const ipv4 of ['127.0.0.1', '10.0.0.2', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::ffff:127.0.0.1', '198.18.0.1', '192.0.2.1']) {
      expect(isPublicAsanIpv4(ipv4)).toBe(false);
      expect(matchesAsanReadBinding({ ...binding, ipv4 }, 'connection-a', binding.baseUrl)).toBe(false);
    }
  });
  it('admits only implemented read endpoints, not mutations disguised as GET', async () => {
    expect(isApprovedAsanRead(binding, binding.baseUrl + '/ProductsNew/LastProducts?Count=1', 'GET')).toBe(true);
    for (const [url, method] of [
      [binding.baseUrl + '/FactorInformation/UpdateFactorState', 'GET'],
      [binding.baseUrl + '/PishFactors/RegisterPishFactor', 'POST'],
      ['https://different.example/api/ProductsNew/LastProducts', 'GET'],
      [binding.baseUrl + '/nested/ProductsNew/LastProducts', 'GET'],
    ]) {
      expect(isApprovedAsanRead(binding, url, method)).toBe(false);
      await expect(createApprovedAsanReadTransport(binding)(url, { method, headers: {} })).rejects.toThrow('not allowed');
    }
  });
});
