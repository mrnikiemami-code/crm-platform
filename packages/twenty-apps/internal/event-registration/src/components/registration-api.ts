// Front-component side of the app routes. The sandbox provides `fetch` and the
// trusted execution context (base URL + app token); nothing here reads user
// input as a credential.

export type AppRouteResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

const REQUEST_DEADLINE_MS = 30_000;

/**
 * Base URL for this application's HTTP routes.
 *
 * The platform computes the supported public function URL for the workspace
 * (`buildPublicFunctionBaseUrl`: a primary public domain, or
 * `<subdomain>.<publicBaseHostname>`) and injects it as
 * `TWENTY_FUNCTIONS_URL` in the logic-function environment. That is used first.
 *
 * The `/s/` form is the OLD prefix on the API host and is being retired
 * (`route-trigger.service.ts` › `assertLegacyRouteIsServableOrThrow` rejects it
 * once `LOGIC_FUNCTION_LEGACY_ROUTE_CUTOFF` is set). It remains only as a
 * fallback for an environment that has not been given domain configuration at
 * all — never as a hardcoded host, and never preferred.
 */
export const resolveFunctionsBaseUrl = (
  functionsUrl: string | undefined,
  apiBaseUrl: string | undefined,
): string | null => {
  const supported = functionsUrl ?? process.env.TWENTY_FUNCTIONS_URL;

  if (typeof supported === 'string' && supported.trim().length > 0) {
    return supported.trim().replace(/\/$/, '');
  }

  const legacyHost = apiBaseUrl ?? process.env.TWENTY_API_URL;

  if (typeof legacyHost === 'string' && legacyHost.trim().length > 0) {
    return `${legacyHost.trim().replace(/\/$/, '')}/s`;
  }

  return null;
};

export const callAppRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  const baseUrl = resolveFunctionsBaseUrl(undefined, undefined);
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (baseUrl === null || !token) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : {};

  return {
    ok: response.ok,
    status: response.status,
    data:
      parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {},
  };
};

export const PREPARE_ROUTE = '/event-registration/prepare';
export const SAVE_ROUTE = '/event-registration/save';
