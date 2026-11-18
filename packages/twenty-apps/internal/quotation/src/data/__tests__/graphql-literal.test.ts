import { describe, expect, it } from 'vitest';

import {
  GraphqlLiteralError,
  toGraphqlLiteral,
} from 'src/data/graphql-literal';

describe('toGraphqlLiteral', () => {
  it('escapes Persian and quoted strings', () => {
    expect(toGraphqlLiteral('مسئول پیگیری')).toBe('"مسئول پیگیری"');
    expect(toGraphqlLiteral('name with "quote"')).toBe('"name with \\"quote\\""');
  });

  it('serializes numbers and null', () => {
    expect(toGraphqlLiteral(3900000)).toBe('3900000');
    expect(toGraphqlLiteral(null)).toBe('null');
    expect(() => toGraphqlLiteral(Number.NaN)).toThrow(GraphqlLiteralError);
  });

  it('serializes objects without undefined fields', () => {
    expect(toGraphqlLiteral({ amountToman: 1000, name: undefined })).toBe(
      '{amountToman: 1000}',
    );
  });
});
