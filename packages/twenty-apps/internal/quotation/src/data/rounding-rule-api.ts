// Transport for rounding-rule settings actions. Decisions live on the Nest
// boundary; this client only carries the caller's bearer token.

const REQUEST_DEADLINE_MS = 20_000;

export type RoundingRuleApiOutcome =
  | { kind: 'OK'; data: Record<string, unknown> }
  | { kind: 'REFUSED'; code: string; message: string };

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const resolveApiBaseUrl = (): string | null => {
  const baseUrl = process.env.TWENTY_API_URL;

  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return null;
  }

  const trimmed = baseUrl.trim().replace(/\/$/, '');

  return trimmed.includes(':6080') ? null : trimmed;
};

const refused = (code: string, message: string): RoundingRuleApiOutcome => ({
  kind: 'REFUSED',
  code,
  message,
});

export const callRoundingRuleAction = async ({
  body,
  authorizationHeader,
}: {
  body: Record<string, unknown>;
  authorizationHeader: string | null;
}): Promise<RoundingRuleApiOutcome> => {
  const baseUrl = resolveApiBaseUrl();
  const authorization = (authorizationHeader ?? '').trim();

  if (baseUrl === null || authorization === '') {
    return refused(
      'ROUNDING_SETTINGS_UNAVAILABLE',
      'تنظیمات رُند در دسترس نیست؛ نشست کاربر را بررسی کنید',
    );
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/rest/quotation/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
    });
  } catch {
    return refused('TRANSPORT_ERROR', 'ارتباط با سرور برقرار نشد');
  }

  const text = await response.text();
  let parsed: unknown = {};

  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  const envelope = readRecord(parsed) ?? {};
  const forbidden = response.status === 401 || response.status === 403;

  if (!response.ok) {
    return refused(
      forbidden ? 'ROUNDING_SETTINGS_FORBIDDEN' : 'PERSISTENCE_FAILED',
      readText(envelope.message) ||
        (forbidden
          ? 'تغییر قواعد رُند فقط برای مدیر فضای کاری مجاز است'
          : 'ذخیرهٔ قواعد رُند انجام نشد'),
    );
  }

  if (envelope.success !== true) {
    return refused(
      readText(envelope.code) || 'PERSISTENCE_FAILED',
      readText(envelope.message) || 'ذخیرهٔ قواعد رُند انجام نشد',
    );
  }

  return { kind: 'OK', data: envelope };
};
