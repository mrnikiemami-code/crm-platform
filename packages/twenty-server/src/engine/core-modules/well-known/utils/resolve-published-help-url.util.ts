import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';

/**
 * Resolves the published, operator-configured origin of this installation's UI.
 *
 * Why this is NOT derived from the request: the API and the front can live on
 * different public origins (`api.example.com` vs `app.example.com`), and the
 * `Host` header of an API call says nothing about where the Help UI is served.
 * A request-derived value would let any caller pick the Help destination and
 * could point a reader at a host that does not serve `/help` at all.
 *
 * Only validated configuration is trusted:
 *  - `FRONTEND_URL` (the UI origin) wins when it is a valid absolute origin;
 *  - otherwise `SERVER_URL`, which is the single-origin deployment case where
 *    the server also serves the front;
 *  - anything else (missing, relative, wrong protocol, credentials, garbage)
 *    resolves to `null`, and the caller must then OMIT the help link rather
 *    than emit a broken or relative one.
 */
const toHttpOrigin = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // `https://user:pass@host` would leak credentials into a public link.
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return null;
  }

  if (parsed.hostname.length === 0) {
    return null;
  }

  return parsed.origin;
};

export const resolvePublishedHelpOrigin = ({
  frontendUrl,
  serverUrl,
}: {
  frontendUrl?: string | null;
  serverUrl?: string | null;
}): string | null => toHttpOrigin(frontendUrl) ?? toHttpOrigin(serverUrl);

/** Absolute same-installation Help URL, or `null` when no valid origin exists. */
export const resolvePublishedHelpUrl = (config: {
  frontendUrl?: string | null;
  serverUrl?: string | null;
}): string | null => {
  const origin = resolvePublishedHelpOrigin(config);

  return origin === null ? null : `${origin}${HELP_CENTER_BASE_PATH}`;
};

/**
 * Convenience wrapper for callers that already inject `TwentyConfigService`.
 * Returns the validated origin, or `undefined` so an email template omits the
 * Help link instead of emitting a relative one.
 */
export const getPublishedHelpOriginFromConfig = (config: {
  get: (key: 'FRONTEND_URL' | 'SERVER_URL') => string | undefined;
}): string | undefined =>
  resolvePublishedHelpOrigin({
    frontendUrl: config.get('FRONTEND_URL'),
    serverUrl: config.get('SERVER_URL'),
  }) ?? undefined;
