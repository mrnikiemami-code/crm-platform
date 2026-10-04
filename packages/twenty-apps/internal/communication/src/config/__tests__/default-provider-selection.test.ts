import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  COMMUNICATION_PROVIDER_ENV_VAR,
  resolveConfiguredProviderId,
} from 'src/config/default-provider-selection';

const SAVED_ENV = { ...process.env };

describe('resolveConfiguredProviderId', () => {
  beforeEach(() => {
    delete process.env[COMMUNICATION_PROVIDER_ENV_VAR];
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('resolves a known provider id', () => {
    process.env[COMMUNICATION_PROVIDER_ENV_VAR] = 'razpayamak';

    expect(resolveConfiguredProviderId()).toEqual({
      success: true,
      providerId: 'razpayamak',
    });
  });

  it('fails explicitly when no provider is selected', () => {
    const result = resolveConfiguredProviderId();

    expect(result.success).toBe(false);
    expect(result).toHaveProperty(
      'error',
      `No communication provider is selected. Set the ${COMMUNICATION_PROVIDER_ENV_VAR} application variable to one of: kavenegar, razpayamak.`,
    );
  });

  it('rejects an unknown provider id instead of passing it to the registry', () => {
    process.env[COMMUNICATION_PROVIDER_ENV_VAR] = 'melipayamak';

    const result = resolveConfiguredProviderId();

    expect(result.success).toBe(false);
    expect(result).toHaveProperty(
      'error',
      'Unknown communication provider "melipayamak". Supported providers: kavenegar, razpayamak.',
    );
  });
});
