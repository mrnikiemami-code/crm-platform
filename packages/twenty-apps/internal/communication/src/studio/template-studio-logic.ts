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

// --- W18-B: field interaction ------------------------------------------------

/**
 * How a field card was activated.
 *
 * A single CLICK only SELECTS (highlights) a field; it never inserts. Insertion
 * happens on DOUBLE_CLICK or on an explicit keyboard activation. Because the
 * click path cannot insert, a double-click can never produce "two click
 * insertions plus the double-click insertion".
 */
export const STUDIO_FIELD_ACTIVATION = {
  CLICK: 'CLICK',
  DOUBLE_CLICK: 'DOUBLE_CLICK',
  KEYBOARD: 'KEYBOARD',
} as const;

export type StudioFieldActivation =
  (typeof STUDIO_FIELD_ACTIVATION)[keyof typeof STUDIO_FIELD_ACTIVATION];

/** True only for the activations that may insert a token. */
export const doesFieldActivationInsert = (
  activation: StudioFieldActivation,
): boolean => activation !== STUDIO_FIELD_ACTIVATION.CLICK;

/** True for the keys that activate the selected field. */
export const isFieldActivationKey = (key: string): boolean =>
  key === 'Enter' || key === ' ' || key === 'Spacebar';

/** A caret/selection remembered from the body textarea. */
export type StudioSelection = { start: number; end: number };

/**
 * Captures a usable selection, or `null` when the element cannot report one.
 * The caller stores the result so an insertion can still land correctly after
 * focus has moved to the field palette.
 */
export const readTextareaSelection = (
  element: { selectionStart: number | null; selectionEnd: number | null } | null,
): StudioSelection | null => {
  if (
    element === null ||
    element.selectionStart === null ||
    element.selectionEnd === null
  ) {
    return null;
  }

  return { start: element.selectionStart, end: element.selectionEnd };
};

/**
 * Picks the selection an insertion should use: the LIVE selection while the
 * textarea still owns focus, otherwise the REMEMBERED one, otherwise the end of
 * the body. Offsets are clamped to the body, so a remembered selection from
 * before an edit can never corrupt the result.
 */
export const resolveInsertSelection = ({
  bodyLength,
  liveSelection,
  rememberedSelection,
  isTextareaFocused,
}: {
  bodyLength: number;
  liveSelection: StudioSelection | null;
  rememberedSelection: StudioSelection | null;
  isTextareaFocused: boolean;
}): StudioSelection => {
  const source = isTextareaFocused
    ? (liveSelection ?? rememberedSelection)
    : (rememberedSelection ?? liveSelection);

  const clamp = (value: number): number =>
    Math.min(Math.max(Math.trunc(value), 0), bodyLength);

  if (source === null) {
    return { start: bodyLength, end: bodyLength };
  }

  const start = clamp(source.start);

  return { start, end: Math.max(start, clamp(source.end)) };
};

/**
 * Finds the field behind a candidate token. A drag payload is NOT an identifier:
 * whatever string a drop carries is only ever used as a LOOKUP KEY into the
 * currently authorized catalog, so an unauthorized, stale or hand-crafted token
 * resolves to `null` and the drop changes nothing.
 */
export const findAuthorizedFieldByToken = (
  fields: readonly StudioField[],
  token: string | null | undefined,
): StudioField | null => {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  return (
    fields.find((field) => field.token === token.trim()) ?? null
  );
};

/** The text carried during a field drag. Only ever used as a lookup key. */
export const STUDIO_FIELD_DRAG_MIME = 'application/x-studio-field-token';

/** Reads the dragged token from a drop payload, preferring the typed MIME. */
export const readDroppedToken = (dataTransfer: {
  getData: (format: string) => string;
}): string => {
  const typed = dataTransfer.getData(STUDIO_FIELD_DRAG_MIME);

  return typed.length > 0 ? typed : dataTransfer.getData('text/plain');
};

// --- W18-B: sample-person preview --------------------------------------------

export type StudioPreviewUnavailableReason =
  | 'NO_PERSON'
  | 'EMPTY_BODY'
  | 'CATALOG_UNAVAILABLE';

/**
 * Whether a preview may be requested. Every gate is explicit so the button's
 * disabled state and the request share ONE decision — they cannot drift.
 */
export const resolvePreviewBlockReason = ({
  personId,
  body,
  isCatalogAvailable,
}: {
  personId: string | null;
  body: string;
  isCatalogAvailable: boolean;
}): StudioPreviewUnavailableReason | null => {
  if (!isCatalogAvailable) {
    return 'CATALOG_UNAVAILABLE';
  }

  if (personId === null || personId.length === 0) {
    return 'NO_PERSON';
  }

  return body.trim().length === 0 ? 'EMPTY_BODY' : null;
};

/** A selectable sample recipient. */
export type StudioPerson = {
  id: string;
  displayName: string;
};

const buildPersonDisplayName = (person: StudioPerson): string =>
  person.displayName.length > 0 ? person.displayName : person.id;

/** Filters the loaded accessible People by name or id, case-insensitively. */
export const filterStudioPeople = (
  people: readonly StudioPerson[],
  query: string,
): StudioPerson[] => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [...people];
  }

  return people.filter(
    (person) =>
      buildPersonDisplayName(person).toLowerCase().includes(needle) ||
      person.id.toLowerCase().includes(needle),
  );
};
