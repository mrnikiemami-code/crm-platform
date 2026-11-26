// Server-side record access via the workspace GraphQL API and this app's token.

export class RecordApiError extends Error {
  constructor(
    readonly code:
      | 'AUTH_REQUIRED'
      | 'FORBIDDEN'
      | 'QUERY_ERROR'
      | 'TRANSPORT_ERROR'
      | 'INVALID_RESPONSE',
    message: string,
  ) {
    super(message);
    this.name = 'RecordApiError';
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const runGraphql = async ({
  endpoint,
  query,
  accessToken,
}: {
  endpoint: string;
  query: string;
  accessToken: string;
}): Promise<Record<string, unknown>> => {
  const baseUrl = process.env.TWENTY_API_URL;

  if (!baseUrl) {
    throw new RecordApiError('AUTH_REQUIRED', 'Record API credentials missing');
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new RecordApiError('TRANSPORT_ERROR', 'Record API request failed');
  }

  if (!response.ok) {
    throw new RecordApiError(
      response.status === 401
        ? 'AUTH_REQUIRED'
        : response.status === 403
          ? 'FORBIDDEN'
          : 'TRANSPORT_ERROR',
      `Record API responded ${response.status}`,
    );
  }

  const payload: unknown = await response.json();
  const envelope = asRecord(payload);

  if (envelope === null) {
    throw new RecordApiError('INVALID_RESPONSE', 'Unreadable API response');
  }

  const errors = envelope.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    const forbidden = errors.some((error: unknown) => {
      const entry = asRecord(error);
      const extensions = asRecord(entry?.extensions);
      const code = String(extensions?.code ?? '');

      return (
        ['FORBIDDEN', 'PERMISSION_DENIED', 'UNAUTHORIZED'].includes(code) ||
        (typeof entry?.message === 'string' &&
          /permission|forbidden|not authorized|access denied/i.test(
            entry.message,
          ))
      );
    });

    throw new RecordApiError(
      forbidden ? 'FORBIDDEN' : 'QUERY_ERROR',
      `Record API rejected the operation`,
    );
  }

  const data = asRecord(envelope.data);

  if (data === null) {
    throw new RecordApiError('INVALID_RESPONSE', 'Missing data envelope');
  }

  return data;
};

export const executeRecordGraphql = async (
  query: string,
): Promise<Record<string, unknown>> => {
  // Prefer the application token so catalog/quotation reads use the app role
  // (not the triggering user's delegated JWT, which often lacks object perms).
  const token =
    process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ??
    process.env.TWENTY_APP_ACCESS_TOKEN;

  if (!token) {
    throw new RecordApiError('AUTH_REQUIRED', 'Record API credentials missing');
  }

  return runGraphql({ endpoint: '/graphql', query, accessToken: token });
};


// CRM person/company writes act as the triggering user, never as the broad app
// identity. The platform supplies a distinct delegated token for user invocations.
export const executeCallerRecordGraphql = async (
  query: string,
): Promise<Record<string, unknown>> => {
  const token = process.env.TWENTY_APP_ACCESS_TOKEN;
  const applicationToken = process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN;
  if (!token || !applicationToken || token === applicationToken) {
    throw new RecordApiError('FORBIDDEN', 'A delegated CRM user is required');
  }
  return runGraphql({ endpoint: '/graphql', query, accessToken: token });
};
