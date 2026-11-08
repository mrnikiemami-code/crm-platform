// Minimal GraphQL literal writer for the values this app sends.
//
// The record API is called with INLINE literals rather than declared variables:
// the generated input type names for a workspace's custom objects are not part
// of the SDK this app compiles against, and guessing them would break on the
// first differently-named workspace. Field names and values are the only things
// baked in, and both are validated here.

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class GraphqlLiteralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphqlLiteralError';
  }
}

export type GraphqlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | GraphqlValue[]
  | { [field: string]: GraphqlValue };

export const toGraphqlFieldName = (value: string): string => {
  if (!NAME_PATTERN.test(value)) {
    throw new GraphqlLiteralError(`Invalid field name: ${value}`);
  }

  return value;
};

export const toGraphqlLiteral = (value: GraphqlValue): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    // JSON string escaping is a superset of GraphQL string escaping for the
    // characters that can appear here.
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new GraphqlLiteralError('Non-finite number in GraphQL literal');
    }

    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => toGraphqlLiteral(item)).join(', ')}]`;
  }

  const fields = Object.entries(value).filter(
    ([, fieldValue]) => fieldValue !== undefined,
  );

  if (fields.length === 0) {
    throw new GraphqlLiteralError('Empty object in GraphQL literal');
  }

  return `{${fields
    .map(
      ([fieldName, fieldValue]) =>
        `${toGraphqlFieldName(fieldName)}: ${toGraphqlLiteral(fieldValue)}`,
    )
    .join(', ')}}`;
};
