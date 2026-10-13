// The template-variable catalog. It is NOT a static list of fields any more:
// it is assembled at RUNTIME from the workspace's own object/field metadata (see
// `build-template-catalog.ts`). This module owns only the SHAPE and the pure
// lookups, so the same catalog object can be used by every consumer — the
// template Variables page, preview interpolation, the single send and the bulk
// send — and they cannot drift.

/** The two objects a template may read from. A closed set. */
export type TemplateObjectName = 'person' | 'company';

/**
 * How a raw metadata value becomes text. This is a CLOSED set: adding a type
 * means adding one extractor in `extract-template-value.ts`, never an eval, an
 * arbitrary property path or a dynamic lookup.
 */
export type TemplateValueKind =
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'RATING'
  | 'CURRENCY'
  | 'LINKS'
  | 'EMAILS'
  /** A FULL_NAME field, exposed as three tokens via `subFieldName`. */
  | 'FULL_NAME';

/**
 * One catalog entry. `token` is the canonical `@`-less token; `aliases` are
 * alternative spellings that resolve to the SAME definition (the six legacy
 * names); `objectName` + `fieldName` (+ optional `subFieldName`) are the ONLY
 * data ever used to build a record read, and both come from server-side
 * metadata — never from client input.
 */
export type TemplateVariableDefinition = {
  token: string;
  aliases: readonly string[];
  /** Source string, translated by the app catalog at render time. */
  label: string;
  objectName: TemplateObjectName;
  fieldName: string;
  subFieldName?: string;
  kind: TemplateValueKind;
};

export type TemplateVariableCatalog = {
  /** Canonical entries, in picker order. */
  variables: readonly TemplateVariableDefinition[];
  /** Canonical token AND every alias (lower-cased) to its definition. */
  lookup: ReadonlyMap<string, TemplateVariableDefinition>;
};

/** Builds a catalog from definitions, indexing canonical tokens and aliases. */
export const buildTemplateVariableCatalog = (
  variables: readonly TemplateVariableDefinition[],
): TemplateVariableCatalog => {
  const lookup = new Map<string, TemplateVariableDefinition>();

  for (const variable of variables) {
    lookup.set(variable.token.toLowerCase(), variable);

    for (const alias of variable.aliases) {
      // A canonical token always wins over an alias collision.
      if (!lookup.has(alias.toLowerCase())) {
        lookup.set(alias.toLowerCase(), variable);
      }
    }
  }

  return { variables, lookup };
};

/** An empty catalog, used when metadata cannot be read. */
export const EMPTY_TEMPLATE_VARIABLE_CATALOG: TemplateVariableCatalog =
  buildTemplateVariableCatalog([]);

/**
 * Case-insensitive lookup of a token (or alias). Returns `null` for anything
 * not in the allow-list, which the engine reports as an unknown variable rather
 * than silently substituting.
 */
export const findTemplateVariable = (
  catalog: TemplateVariableCatalog,
  token: string,
): TemplateVariableDefinition | null =>
  catalog.lookup.get(token.toLowerCase()) ?? null;

export type TemplateVariablePickerItem = {
  /** The `@token` a user inserts into the body. */
  token: string;
  /** Source label, translated by the app catalog at render time. */
  label: string;
};

/**
 * The picker descriptors: CANONICAL tokens only (never aliases). Only tokens
 * and labels are exposed — never a value — so the frontend receives no
 * recipient data and remains a presentation layer.
 */
export const listTemplateVariables = (
  catalog: TemplateVariableCatalog,
): TemplateVariablePickerItem[] =>
  catalog.variables.map((variable) => ({
    token: `@${variable.token}`,
    label: variable.label,
  }));

/** A resolved value per CANONICAL token for one recipient, or `null` if empty. */
export type TemplateValueMap = ReadonlyMap<string, string | null>;
