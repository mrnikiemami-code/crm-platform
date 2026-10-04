// Explicit configuration outcome. A missing variable is reported by name, and
// a configured value is never echoed back, so a secret cannot leak through a
// failure message.
export type ProviderConfigResult<TConfig> =
  | { success: true; config: TConfig }
  | { success: false; error: string };
