import { describe, expect, it } from 'vitest';

import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';

describe('createCommunicationProviderRegistry', () => {
  it('registers every shipped provider side by side', () => {
    const registry = createCommunicationProviderRegistry();

    expect(registry.listProviderIds()).toEqual([
      'kavenegar',
      'razpayamak',
      'bale',
    ]);
    expect(registry.getProvider('kavenegar').channel).toBe('SMS');
    expect(registry.getProvider('razpayamak').channel).toBe('SMS');
    expect(registry.getProvider('bale').channel).toBe('BALE');
  });

  it('resolves each provider for its channel', () => {
    const registry = createCommunicationProviderRegistry();

    expect(registry.resolve('kavenegar', 'SMS').id).toBe('kavenegar');
    expect(registry.resolve('razpayamak', 'SMS').id).toBe('razpayamak');
    expect(registry.resolve('bale', 'BALE').id).toBe('bale');
  });

  it('returns a fresh registry per call', () => {
    const first = createCommunicationProviderRegistry();
    const second = createCommunicationProviderRegistry();

    expect(first).not.toBe(second);
    expect(first.getProvider('razpayamak')).not.toBe(
      second.getProvider('razpayamak'),
    );
  });
});
