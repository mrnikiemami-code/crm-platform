// Front-component side of the app routes. The sandbox provides `fetch` and the
// trusted execution context (base URL + app token); nothing here reads user
// input as a credential.

export type AppRouteResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

const REQUEST_DEADLINE_MS = 30_000;

export const callAppRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${apiBaseUrl}/s${path}`, {
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
