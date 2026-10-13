import {
  readTemplateTargetObject,
  type TemplateTargetObject,
} from 'src/studio/template-studio-contract';

// The Template Studio's behavior, kept out of React so the exact semantics that
// ship can be unit-tested without the front-component sandbox.
//
// The storage contract this module enforces: the BODY is the canonical technical
// text (`سلام @person.firstName خوبی؟`). A field's Persian label is presentation
// only and is NEVER written into the body, so renaming a label can never break a
// saved template.

/** One insertable field as the route sends it. */
export type StudioField = {
  token: string;
  label: string;
  group: StudioFieldGroup;
};

export const STUDIO_FIELD_GROUP = {
  PERSON: 'PERSON',
  COMPANY: 'COMPANY',
} as const;

export type StudioFieldGroup =
  (typeof STUDIO_FIELD_GROUP)[keyof typeof STUDIO_FIELD_GROUP];

/** A template row as the studio edits it. */
export type StudioTemplate = {
  id: string;
  title: string;
  body: string;
  targetObject: TemplateTargetObject;
};

/** The editor draft. `id === null` means "a new, unsaved template". */
export type StudioDraft = {
  id: string | null;
  title: string;
  body: string;
  targetObject: TemplateTargetObject;
};

export const EMPTY_STUDIO_DRAFT: StudioDraft = {
  id: null,
  title: '',
  body: '',
  targetObject: readTemplateTargetObject(null),
};

/** The groups in display order, with their source label keys. */
export const STUDIO_FIELD_GROUPS: readonly {
  group: StudioFieldGroup;
  label: string;
}[] = [
  { group: STUDIO_FIELD_GROUP.PERSON, label: 'People' },
  { group: STUDIO_FIELD_GROUP.COMPANY, label: 'Company' },
];

/**
 * Inserts a canonical token at the current selection, replacing it.
 *
 * Returns the new body AND the caret position AFTER the token, so the caller can
 * restore focus without guessing. Offsets are clamped, so a stale selection
 * (e.g. the body changed since the textarea reported it) can never produce a
 * corrupted or duplicated body.
 */
export const insertTokenAtSelection = ({
  body,
  selectionStart,
  selectionEnd,
  token,
}: {
  body: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  token: string;
}): { body: string; caret: number } => {
  const length = body.length;
  const clamp = (value: number | null, fallback: number): number => {
    if (value === null || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.trunc(value), 0), length);
  };

  const start = clamp(selectionStart, length);
  const end = Math.max(start, clamp(selectionEnd, start));

  return {
    body: `${body.slice(0, start)}${token}${body.slice(end)}`,
    caret: start + token.length,
  };
};

/** True when the draft differs from what was loaded (or from "new & empty"). */
export const isStudioDraftDirty = (
  draft: StudioDraft,
  saved: StudioDraft | null,
): boolean => {
  if (saved === null) {
    return (
      draft.title.length > 0 ||
      draft.body.length > 0 ||
      draft.targetObject !== readTemplateTargetObject(null)
    );
  }

  return (
    draft.title !== saved.title ||
    draft.body !== saved.body ||
    draft.targetObject !== saved.targetObject
  );
};

/** True when a loaded template can be turned back into a draft. */
export const toStudioDraft = (template: StudioTemplate): StudioDraft => ({
  id: template.id,
  title: template.title,
  body: template.body,
  targetObject: readTemplateTargetObject(template.targetObject),
});

export type StudioValidationError = 'TITLE_REQUIRED' | 'BODY_REQUIRED';

/**
 * Validates a draft before saving. Persian copy for each code lives in the app
 * catalog; the codes themselves never reach the user.
 */
export const validateStudioDraft = (
  draft: StudioDraft,
): StudioValidationError[] => {
  const errors: StudioValidationError[] = [];

  if (draft.title.trim().length === 0) {
    errors.push('TITLE_REQUIRED');
  }

  if (draft.body.trim().length === 0) {
    errors.push('BODY_REQUIRED');
  }

  return errors;
};

/**
 * Filters fields by Persian label OR technical token, case-insensitively. The
 * user never has to know a field's technical name, and never has to type an
 * exact token to find it.
 */
export const filterStudioFields = (
  fields: readonly StudioField[],
  query: string,
): StudioField[] => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [...fields];
  }

  return fields.filter(
    (field) =>
      field.label.toLowerCase().includes(needle) ||
      field.token.toLowerCase().includes(needle),
  );
};

export type StudioFieldGrouping = {
  group: StudioFieldGroup;
  label: string;
  fields: StudioField[];
};

/** Groups the filtered fields, preserving the declared group order. */
export const groupStudioFields = (
  fields: readonly StudioField[],
): StudioFieldGrouping[] =>
  STUDIO_FIELD_GROUPS.map(({ group, label }) => ({
    group,
    label,
    fields: fields.filter((field) => field.group === group),
  })).filter((grouping) => grouping.fields.length > 0);
