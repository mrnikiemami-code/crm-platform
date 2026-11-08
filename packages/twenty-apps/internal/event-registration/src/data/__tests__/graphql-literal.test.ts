import { describe, expect, it } from 'vitest';

import {
  GraphqlLiteralError,
  toGraphqlFieldName,
  toGraphqlLiteral,
} from 'src/data/graphql-literal';

describe('toGraphqlLiteral', () => {
  it('writes strings with quotes escaped', () => {
    expect(toGraphqlLiteral('name with "quote"')).toBe('"name with \\"quote\\""');
  });

  it('writes Persian text unchanged', () => {
    expect(toGraphqlLiteral('مسئول پیگیری')).toBe('"مسئول پیگیری"');
  });

  it('writes finite numbers and rejects non-finite ones', () => {
    expect(toGraphqlLiteral(3900000)).toBe('3900000');
    expect(() => toGraphqlLiteral(Number.NaN)).toThrow(GraphqlLiteralError);
  });

  it('writes null for absent values', () => {
    expect(toGraphqlLiteral(null)).toBe('null');
    expect(toGraphqlLiteral(undefined)).toBe('null');
  });

  it('drops undefined object members instead of writing them', () => {
    expect(
      toGraphqlLiteral({ amountToman: 1000, name: undefined }),
    ).toBe('{amountToman: 1000}');
  });

  it('rejects an empty object, which is never a valid write payload', () => {
    expect(() => toGraphqlLiteral({})).toThrow(GraphqlLiteralError);
  });

  it('rejects a field name that is not an identifier', () => {
    expect(() => toGraphqlFieldName('name: evil')).toThrow(GraphqlLiteralError);
    expect(toGraphqlFieldName('amountToman')).toBe('amountToman');
  });

  it('writes booleans', () => {
    expect(toGraphqlLiteral({ flag: true })).toBe('{flag: true}');
  });
});
