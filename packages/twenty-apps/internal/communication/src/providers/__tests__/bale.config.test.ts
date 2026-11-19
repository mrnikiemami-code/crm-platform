import { afterEach, describe, expect, it } from 'vitest';

import {
  BALE_BOT_TOKEN_ENV_VAR,
  getBaleConfig,
} from 'src/providers/bale/bale.config';

describe('getBaleConfig', () => {
  afterEach(() => {
    delete process.env[BALE_BOT_TOKEN_ENV_VAR];
  });

  it('requires BALE_BOT_TOKEN and never invents a default', () => {
    delete process.env[BALE_BOT_TOKEN_ENV_VAR];

    const result = getBaleConfig();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(BALE_BOT_TOKEN_ENV_VAR);
    }
  });

  it('returns the workspace bot token when set', () => {
    process.env[BALE_BOT_TOKEN_ENV_VAR] = 'secret-token';

    expect(getBaleConfig()).toEqual({
      success: true,
      config: { botToken: 'secret-token' },
    });
  });
});
