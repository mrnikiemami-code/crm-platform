// The authorized recipient fields a template may reference. This is the ONLY
// data shape the interpolation engine ever sees: it is built server-side from
// the Person fields the workspace is permitted to read, so a template can never
// traverse into an arbitrary record or another workspace's data.
export type TemplateRecipientData = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  companyName: string | null;
};

// A variable definition. `token` is the canonical `@name` without the leading
// `@`; `aliases` are alternative spellings that resolve to the SAME value.
// `read` is a closed, typed accessor — there is deliberately no dynamic
// property lookup, no eval, and no SQL: adding a variable means adding one
// entry to the catalog below.
export type TemplateVariableDefinition = {
  token: string;
  aliases: readonly string[];
  /** Source string shown in the picker and translated by the app catalog. */
  label: string;
  read: (recipient: TemplateRecipientData) => string | null;
};

// The standard variables, in picker order. `@name` maps explicitly to the
// first name and `@company` maps explicitly to the company name, as required.
// Further authorized fields are added by appending a definition here — the
// engine, the picker and the server route all read this one catalog, so they
// cannot drift.
export const TEMPLATE_VARIABLES: readonly TemplateVariableDefinition[] = [
  {
    token: 'name',
    aliases: ['firstName'],
    label: 'First name',
    read: (recipient) => recipient.firstName,
  },
  {
    token: 'lastName',
    aliases: [],
    label: 'Last name',
    read: (recipient) => recipient.lastName,
  },
  {
    token: 'fullName',
    aliases: [],
    label: 'Full name',
    read: (recipient) => recipient.fullName,
  },
  {
    token: 'company',
    aliases: ['companyName'],
    label: 'Company',
    read: (recipient) => recipient.companyName,
  },
];

// Case-insensitive lookup of a token (or alias) to its definition. Returns
// `null` for anything not in the allow-list, which the engine reports as an
// unknown variable rather than silently substituting.
export const findTemplateVariable = (
  token: string,
): TemplateVariableDefinition | null => {
  const normalized = token.toLowerCase();

  for (const definition of TEMPLATE_VARIABLES) {
    if (definition.token.toLowerCase() === normalized) {
      return definition;
    }

    if (
      definition.aliases.some((alias) => alias.toLowerCase() === normalized)
    ) {
      return definition;
    }
  }

  return null;
};

export type TemplateVariablePickerItem = {
  /** The `@token` a user inserts into the body. */
  token: string;
  /** Source label, translated by the app catalog at render time. */
  label: string;
};

// The picker descriptors. Only tokens and labels are exposed — never a value —
// so the frontend receives no recipient data and remains a presentation layer.
export const listTemplateVariables = (): TemplateVariablePickerItem[] =>
  TEMPLATE_VARIABLES.map((definition) => ({
    token: `@${definition.token}`,
    label: definition.label,
  }));
