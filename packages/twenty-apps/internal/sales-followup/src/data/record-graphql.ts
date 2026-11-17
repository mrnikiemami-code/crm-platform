// Record access for this app.
//
// WHY RAW HTTP AND NOT THE GENERATED CLIENT: the SDK's `CoreApiClient` is
// generated against a schema snapshot that contains only STANDARD objects, so
// every custom object query fails with `type Query does not have a field
// salesInteraction` — verified on Dev, where the same token reads `person` fine.
// The precedent in this repository (`event-registration/src/data/record-api.ts`)
// is to call `/graphql` directly with the app's own token, which does see the
// workspace's custom objects.
//
// Nothing here logs a token, a full query result, or a customer value: a logic
// function's logs are readable by workspace members, so failures are reported by
// PHASE and a stable code only.

export type RecordGraphqlPhase =
  | 'READ_INTERACTION'
  | 'READ_LEAD'
  | 'READ_PERSON'
  | 'LIST_LEADS'
  | 'LIST_INTERACTIONS'
  | 'WRITE_TITLE';

export class RecordGraphqlError extends Error {
  constructor(
    readonly phase: RecordGraphqlPhase,
    readonly detail:
      | 'AUTH_MISSING'
      | 'BASE_URL_MISSING'
      | 'TRANSPORT'
      | 'REJECTED'
      | 'NO_DATA',
  ) {
    super(`${phase}:${detail}`);
    this.name = 'RecordGraphqlError';
  }
}

type GraphqlEnvelope = {
  data?: unknown;
  errors?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Runs one operation and returns the `data` object.
 *
 * A response carrying `errors` is a FAILURE even when it also carries partial
 * data: treating a rejected read as "empty" is exactly how a missing customer
 * would silently become «مشتری بدون نام» and how a failed write would look like
 * success.
 */
export const executeRecordGraphql = async ({
  phase,
  query,
  variables,
}: {
  phase: RecordGraphqlPhase;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const baseUrl = process.env.TWENTY_API_URL;
  const token = process.env.TWENTY_APP_ACCESS_TOKEN;

  if (!baseUrl) {
    throw new RecordGraphqlError(phase, 'BASE_URL_MISSING');
  }

  if (!token) {
    throw new RecordGraphqlError(phase, 'AUTH_MISSING');
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new RecordGraphqlError(phase, 'TRANSPORT');
  }

  if (!response.ok) {
    throw new RecordGraphqlError(phase, 'TRANSPORT');
  }

  let envelope: GraphqlEnvelope;

  try {
    envelope = (await response.json()) as GraphqlEnvelope;
  } catch {
    throw new RecordGraphqlError(phase, 'NO_DATA');
  }

  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    throw new RecordGraphqlError(phase, 'REJECTED');
  }

  const data = asRecord(envelope.data);

  if (data === null) {
    throw new RecordGraphqlError(phase, 'NO_DATA');
  }

  return data;
};

/** A connection's nodes, without trusting the shape blindly. */
export const readConnectionNodes = (
  value: unknown,
): Record<string, unknown>[] => {
  const connection = asRecord(value);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges
    .map((edge) => asRecord(asRecord(edge)?.node))
    .filter((node): node is Record<string, unknown> => node !== null);
};
