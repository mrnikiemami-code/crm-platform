import {
  findTemplateVariable,
  type TemplateRecipientData,
} from 'src/templates/template-variable-catalog';

// A placeholder is `@` followed by a NAMESPACED identifier: one or more
// segments of letters/digits/underscore joined by single dots (e.g. `@name`,
// `@person.jobTitle`, `@company.name`).
//
// The grammar is deliberately strict and is the FIRST line of defence:
//  - every segment must START with a letter, so `@1x` is not a token;
//  - a dot must be FOLLOWED by a valid segment, so `@person.` stops at
//    `@person` and a trailing dot is never swallowed;
//  - there is no `..`, no leading/trailing dot, no bracket, no parenthesis and
//    no quote — so a placeholder can only ever match a flat token in the
//    catalog. It cannot express property traversal, an expression or an
//    injection, even before the allow-list lookup rejects it.
const PLACEHOLDER_PATTERN =
  /@([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)/g;

export type TemplateInterpolationIssue = {
  /** The variable token as written, including the leading `@`. */
  token: string;
  kind: 'UNKNOWN_VARIABLE' | 'EMPTY_FIELD';
};

export type TemplateInterpolationResult = {
  /** Body with resolved values substituted and unresolved tokens left intact. */
  text: string;
  /**
   * True when at least one placeholder could not be resolved to a value. An
   * unresolved result must NEVER be presented as ready to send.
   */
  hasUnresolvedVariables: boolean;
  /** Every placeholder that could not be resolved, in first-seen order. */
  issues: TemplateInterpolationIssue[];
};

// Interpolates a template body for ONE recipient.
//
// Rules:
//  - A placeholder in the catalog whose field has a non-empty value is
//    substituted with that value.
//  - A placeholder in the catalog whose field is empty/null is an EMPTY_FIELD
//    issue and is left visible in the text.
//  - A placeholder NOT in the catalog is an UNKNOWN_VARIABLE issue and is left
//    visible in the text.
//  - Any issue sets `hasUnresolvedVariables`, so the caller can refuse to treat
//    the result as ready to send.
//
// The substitution is a plain string walk over an allow-listed identifier
// grammar: no eval, no template engine, no dynamic property access.
export const interpolateTemplate = ({
  body,
  recipient,
}: {
  body: string;
  recipient: TemplateRecipientData;
}): TemplateInterpolationResult => {
  const issues: TemplateInterpolationIssue[] = [];
  const seenTokens = new Set<string>();

  const text = body.replace(
    PLACEHOLDER_PATTERN,
    (match: string, token: string): string => {
      const definition = findTemplateVariable(token);
      const tokenWithAt = `@${token}`;

      if (definition === null) {
        if (!seenTokens.has(tokenWithAt)) {
          seenTokens.add(tokenWithAt);
          issues.push({ token: tokenWithAt, kind: 'UNKNOWN_VARIABLE' });
        }

        return match;
      }

      const value = definition.read(recipient);

      if (value === null || value.trim().length === 0) {
        if (!seenTokens.has(tokenWithAt)) {
          seenTokens.add(tokenWithAt);
          issues.push({ token: tokenWithAt, kind: 'EMPTY_FIELD' });
        }

        return match;
      }

      return value;
    },
  );

  return {
    text,
    hasUnresolvedVariables: issues.length > 0,
    issues,
  };
};
