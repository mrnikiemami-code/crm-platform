// Server-side record access.
//
// Uses the workspace record API with this app's own token, exactly like the
// existing internal apps do. The token's role carries read+update per object,
// and Twenty's own ORM treats `insert` as `canUpdateObjectRecords`, so creation
// is authorized by the SAME permission — no schema or permission special case
// is needed for this feature.

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

export type RecordGraphqlPayload = {
  data: Record<string, unknown>;
};

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
    // Partial data must never be read as an empty result: a failed lookup that
    // returned `null` because of a permission error would look like "no
    // existing registration" and could create a duplicate.
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

/**
 * Record access with the app's own token. Every business read and write goes
 * through here.
 */
export const executeRecordGraphql = async (
  query: string,
): Promise<Record<string, unknown>> => {
  const token = process.env.TWENTY_APP_ACCESS_TOKEN;

  if (!token) {
    throw new RecordApiError('AUTH_REQUIRED', 'Record API credentials missing');
  }

  return runGraphql({ endpoint: '/graphql', query, accessToken: token });
};

/**
 * Metadata-schema access, where `currentUser` lives. Used only to ask the
 * platform who is acting, always with the caller's own token so the answer
 * describes that exact session.
 */
export const executeMetadataGraphql = async (
  query: string,
  accessToken: string,
): Promise<Record<string, unknown>> =>
  runGraphql({ endpoint: '/metadata', query, accessToken });
