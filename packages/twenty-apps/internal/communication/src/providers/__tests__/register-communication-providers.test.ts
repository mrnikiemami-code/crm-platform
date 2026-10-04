import { describe, expect, it } from 'vitest';

import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';

describe('createCommunicationProviderRegistry', () => {
  it('registers the SMS provider so the channel resolves', () => {
    const registry = createCommunicationProviderRegistry();

    expect(registry.hasProvider('SMS')).toBe(true);
    expect(registry.getProvider('SMS').channel).toBe('SMS');
  });

  it('returns a fresh registry per call', () => {
    const first = createCommunicationProviderRegistry();
    const second = createCommunicationProviderRegistry();

    expect(first).not.toBe(second);
    expect(first.getProvider('SMS')).not.toBe(second.getProvider('SMS'));
  });
});
