import { describe, expect, it } from 'vitest';

import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';

describe('createCommunicationProviderRegistry', () => {
  it('registers every shipped SMS provider side by side', () => {
    const registry = createCommunicationProviderRegistry();

    expect(registry.listProviderIds()).toEqual(['kavenegar', 'razpayamak']);
    expect(registry.getProvider('kavenegar').channel).toBe('SMS');
    expect(registry.getProvider('razpayamak').channel).toBe('SMS');
  });

  it('resolves each provider for its channel', () => {
    const registry = createCommunicationProviderRegistry();

    expect(registry.resolve('kavenegar', 'SMS').id).toBe('kavenegar');
    expect(registry.resolve('razpayamak', 'SMS').id).toBe('razpayamak');
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
