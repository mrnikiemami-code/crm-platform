// Transport for the tax settings actions. Every decision — who may write, whether
// the rate is valid, which row is the single default — belongs to the server
// boundary; this client only carries the request and the answer.
//
// WHY NO TOKEN OF ITS OWN: the application token is a workspace-wide identity, so
// using it whenever the caller's header is absent would grant exactly the permission
// a missing header is supposed to withhold. Only the caller's own header is sent, and
// a 401/403 stays a refusal.
const REQUEST_DEADLINE_MS = 20_000;

export type TaxPolicyApiOutcome =
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

  // The intranet deployment is a different system; never write to it by accident.
  return trimmed.includes(':6080') ? null : trimmed;
};

const refused = (code: string, message: string): TaxPolicyApiOutcome => ({
  kind: 'REFUSED',
  code,
  message,
});

export const callTaxPolicyAction = async ({
  body,
  authorizationHeader,
}: {
  body: Record<string, unknown>;
  authorizationHeader: string | null;
}): Promise<TaxPolicyApiOutcome> => {
  const baseUrl = resolveApiBaseUrl();
  const authorization = (authorizationHeader ?? '').trim();

  if (baseUrl === null || authorization === '') {
    return refused(
      'TAX_SETTINGS_UNAVAILABLE',
      'تنظیمات مالیات در دسترس نیست؛ نشست کاربر را بررسی کنید',
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
      forbidden ? 'TAX_SETTINGS_FORBIDDEN' : 'PERSISTENCE_FAILED',
      readText(envelope.message) ||
        (forbidden
          ? 'تغییر تنظیمات مالیات فقط برای مدیر فضای کاری مجاز است'
          : 'ذخیرهٔ تنظیمات مالیات انجام نشد'),
    );
  }

  if (envelope.success !== true) {
    return refused(
      readText(envelope.code) || 'PERSISTENCE_FAILED',
      readText(envelope.message) || 'ذخیرهٔ تنظیمات مالیات انجام نشد',
    );
  }

  return { kind: 'OK', data: envelope };
};
