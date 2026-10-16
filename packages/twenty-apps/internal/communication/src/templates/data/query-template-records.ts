// The installed SDK embeds an application-only schema. Template sources belong
// to the workspace, including other applications. Use the normal record API
// with the route's delegated token; its query runners still enforce both roles.
// This module is server-only and is never exposed as a worker GraphQL proxy.

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const ORDER_DIRECTIONS = new Set([
  'AscNullsFirst',
  'AscNullsLast',
  'DescNullsFirst',
  'DescNullsLast',
]);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const name = (value: string): string => {
  if (!NAME_PATTERN.test(value)) throw new Error('Invalid record query name');
  return value;
};

const input = (value: unknown, isOrderBy = false): string => {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (isOrderBy) {
      if (!ORDER_DIRECTIONS.has(value)) throw new Error('Invalid record order');
      return value;
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value))
    return `[${value.map((item) => input(item, isOrderBy)).join(',')}]`;
  if (record(value)) {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => `${name(key)}:${input(item, isOrderBy)}`)
      .join(',')}}`;
  }
  throw new Error('Invalid record query input');
};

const selection = (fields: Record<string, unknown>): string => {
  const selected = Object.entries(fields).filter(
    ([key, value]) =>
      key !== '__args' && value !== false && value !== undefined,
  );
  if (selected.length === 0) throw new Error('Empty record selection');
  return selected
    .map(([key, value]) => {
      const fieldName = name(key);
      if (value === true) return fieldName;
      if (!record(value)) throw new Error('Invalid record selection');
      const argumentsInput = value.__args;
      if (argumentsInput !== undefined && !record(argumentsInput))
        throw new Error('Invalid record arguments');
      const argumentsText = Object.entries(argumentsInput ?? {})
        .filter(([, item]) => item !== undefined)
        .map(
          ([argumentName, item]) =>
            `${name(argumentName)}:${input(item, argumentName === 'orderBy')}`,
        )
        .join(',');
      return `${fieldName}${argumentsText ? `(${argumentsText})` : ''}{${selection(value)}}`;
    })
    .join(' ');
};

export class TemplateRecordReadError extends Error {
  constructor(readonly code: string) {
    super(
      code === 'FORBIDDEN'
        ? 'Record read permission denied'
        : 'Record read failed',
    );
  }
}

export const queryTemplateRecords = async (
  request: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const baseUrl = process.env.TWENTY_API_URL;
  const token = process.env.TWENTY_APP_ACCESS_TOKEN;
  if (!baseUrl || !token) throw new TemplateRecordReadError('AUTH_REQUIRED');

  const query = `query TemplateRecordRead { ${selection(request)} }`;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new TemplateRecordReadError(
      response.status === 401
        ? 'AUTH_REQUIRED'
        : response.status === 403
          ? 'FORBIDDEN'
          : 'TRANSPORT_ERROR',
    );
  }
  const payload: unknown = await response.json();
  if (!record(payload)) throw new TemplateRecordReadError('INVALID_RESPONSE');
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    // Partial GraphQL data must never masquerade as an empty field or table.
    const forbidden = payload.errors.some(
      (error: unknown) =>
        record(error) &&
        ((record(error.extensions) &&
          ['FORBIDDEN', 'PERMISSION_DENIED', 'UNAUTHORIZED'].includes(
            String(error.extensions.code),
          )) ||
          (typeof error.message === 'string' &&
            /permission|forbidden|not authorized|access denied/i.test(
              error.message,
            ))),
    );
    throw new TemplateRecordReadError(forbidden ? 'FORBIDDEN' : 'QUERY_ERROR');
  }
  if (!record(payload.data))
    throw new TemplateRecordReadError('INVALID_RESPONSE');
  return payload.data;
};
