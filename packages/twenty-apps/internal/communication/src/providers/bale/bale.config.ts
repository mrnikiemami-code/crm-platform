import {
  buildMissingConfigError,
  readRequiredEnv,
} from 'src/providers/config/read-required-env';
import { type ProviderConfigResult } from 'src/providers/config/provider-config-result.type';

// Official Bale Bot API base (docs.bale.ai): https://tapi.bale.ai/bot<TOKEN>/METHOD
// The production host is FIXED so a workspace cannot redirect the bot token to
// an arbitrary URL. Tests inject `apiBase` on the provider; there is no
// user-editable endpoint variable.
export const BALE_BOT_TOKEN_ENV_VAR = 'BALE_BOT_TOKEN';
export const BALE_API_BASE = 'https://tapi.bale.ai';

export type BaleConfig = {
  botToken: string;
};

export const getBaleConfig = (): ProviderConfigResult<BaleConfig> => {
  const botToken = readRequiredEnv(BALE_BOT_TOKEN_ENV_VAR);

  if (botToken === undefined) {
    return {
      success: false,
      error: buildMissingConfigError('Bale', [BALE_BOT_TOKEN_ENV_VAR]),
    };
  }

  return {
    success: true,
    config: { botToken },
  };
};
