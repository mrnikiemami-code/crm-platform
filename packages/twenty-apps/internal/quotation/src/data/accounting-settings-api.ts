// Transport for the workspace accounting settings. Every decision — who may write,
// whether a destination is reachable, which address is safe — belongs to the server
// boundary; this client only carries the caller's request and the answer.
//
// WHY NO TOKEN OF ITS OWN: this route is called from a logic function that the platform
// invoked with the front component's token, which carries the person looking at the
// page. Substituting an application token whenever that header is missing would grant
// exactly the permission the missing header withholds.
const REQUEST_DEADLINE_MS = 20_000;

export type AccountingSettingsApiOutcome =
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

const refused = (
  code: string,
  message: string,
): AccountingSettingsApiOutcome => ({ kind: 'REFUSED', code, message });

export const callAccountingSettingsAction = async ({
  body,
  authorizationHeader,
}: {
  body: Record<string, unknown>;
  authorizationHeader: string | null;
}): Promise<AccountingSettingsApiOutcome> => {
  const baseUrl = resolveApiBaseUrl();
  const authorization = (authorizationHeader ?? '').trim();

  if (baseUrl === null || authorization === '') {
    return refused(
      'ACCOUNTING_SETTINGS_UNAVAILABLE',
      'تنظیمات حسابداری در دسترس نیست؛ نشست کاربر را بررسی کنید',
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
      forbidden ? 'ACCOUNTING_SETTINGS_FORBIDDEN' : 'PERSISTENCE_FAILED',
      readText(envelope.message) ||
        (forbidden
          ? 'تغییر تنظیمات حسابداری فقط برای مدیر فضای کاری مجاز است'
          : 'ذخیرهٔ تنظیمات حسابداری انجام نشد'),
    );
  }

  if (envelope.success !== true) {
    return refused(
      readText(envelope.code) || 'PERSISTENCE_FAILED',
      readText(envelope.message) || 'ذخیرهٔ تنظیمات حسابداری انجام نشد',
    );
  }

  return { kind: 'OK', data: envelope };
};
