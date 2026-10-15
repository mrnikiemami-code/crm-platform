import { type TemplateValueKind } from 'src/templates/template-variable-catalog';

// Converts ONE raw metadata value into the text a template placeholder becomes.
// This is a CLOSED switch over `TemplateValueKind`: there is no dynamic
// property path, no eval and no coercion of a structure the catalog did not
// explicitly allow. Anything unexpected yields `null`, which the engine reports
// as an EMPTY_FIELD issue (and therefore blocks that recipient) rather than
// substituting a meaningless value.

/**
 * The GraphQL sub-selection a kind's field needs to come back with a VALUE.
 *
 * A COMPOSITE field (`CURRENCY`, `LINKS`, `EMAILS`, `FULL_NAME`) is NOT a scalar:
 * asking for it as `true` returns the KEY with a `null` value. That is a silent
 * empty — the field looks authorized and readable, then resolves to nothing. So
 * the selection has to name the sub-fields the extractors actually read.
 *
 * This is the SINGLE definition of those shapes, shared by the per-field probe
 * and the value resolver, so what is proven readable and what is actually read
 * cannot drift apart.
 */
export const buildTemplateFieldSelection = (
  kind: TemplateValueKind,
): unknown => {
  switch (kind) {
    case 'FULL_NAME':
      return { firstName: true, lastName: true };

    case 'CURRENCY':
      return { amountMicros: true, currencyCode: true };

    case 'LINKS':
      return { primaryLinkUrl: true, primaryLinkLabel: true };

    case 'EMAILS':
      return { primaryEmail: true };

    default:
      return true;
  }
};

const readNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readNumberAsString = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return readNonEmptyString(value);
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

// A CURRENCY value is `{ amountMicros, currencyCode }`. The template shows the
// major-unit amount; micros are the platform's own storage unit.
const readCurrency = (value: unknown): string | null => {
  const record = readRecord(value);

  if (record === null) {
    return null;
  }

  const amountMicros = record.amountMicros;

  if (typeof amountMicros === 'number' && Number.isFinite(amountMicros)) {
    const major = amountMicros / 1_000_000;

    return major === 0 ? '0' : String(major);
  }

  return null;
};

const readMultiSelect = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const parts = value
    .map((entry) => readNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);

  return parts.length > 0 ? parts.join(', ') : null;
};

const readLinks = (value: unknown): string | null => {
  const record = readRecord(value);

  return record === null ? null : readNonEmptyString(record.primaryLinkUrl);
};

const readEmails = (value: unknown): string | null => {
  const record = readRecord(value);

  return record === null ? null : readNonEmptyString(record.primaryEmail);
};

/**
 * Extracts the text for one definition.
 *
 * `fieldName`/`subFieldName` are NOT used as dynamic property paths here: the
 * caller has already read the raw value for the definition's field through the
 * allow-listed record selection, and this function only interprets it.
 */
export const extractTemplateValue = ({
  kind,
  subFieldName,
  rawValue,
}: {
  kind: TemplateValueKind;
  subFieldName?: string;
  rawValue: unknown;
}): string | null => {
  switch (kind) {
    case 'TEXT':
    case 'SELECT':
    case 'DATE':
      return readNonEmptyString(rawValue);

    case 'NUMBER':
    case 'RATING':
      return readNumberAsString(rawValue);

    case 'BOOLEAN':
      return typeof rawValue === 'boolean' ? String(rawValue) : null;

    case 'MULTI_SELECT':
      return readMultiSelect(rawValue);

    case 'CURRENCY':
      return readCurrency(rawValue);

    case 'LINKS':
      return readLinks(rawValue);

    case 'EMAILS':
      return readEmails(rawValue);

    case 'FULL_NAME': {
      const record = readRecord(rawValue);

      if (record === null) {
        return null;
      }

      const firstName = readNonEmptyString(record.firstName) ?? '';
      const lastName = readNonEmptyString(record.lastName) ?? '';

      switch (subFieldName) {
        case 'firstName':
          return firstName.length > 0 ? firstName : null;
        case 'lastName':
          return lastName.length > 0 ? lastName : null;
        case 'fullName': {
          const parts = [firstName, lastName].filter(
            (part) => part.length > 0,
          );

          return parts.length > 0 ? parts.join(' ') : null;
        }
        default:
          return null;
      }
    }
  }
};
