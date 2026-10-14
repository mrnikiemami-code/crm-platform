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
  /** ISO timestamp of the last write; shown as «آخرین ویرایش». */
  updatedAt: string;
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
 * Picks the selection an insertion should use.
 *
 * A LIVE selection always wins when the textarea reports one: it is the caret the
 * user can currently see, and it stays valid even after a synthetic activation or
 * a focus shift, so insertion can never silently fall back to a stale position.
 * The REMEMBERED selection is the fallback for when the textarea reports none
 * (for example after the field palette took focus in a way that cleared the
 * range), and the end of the body is the last resort. Every offset is clamped, so
 * a remembered selection from before an edit can never corrupt the result.
 */
export const resolveInsertSelection = ({
  bodyLength,
  liveSelection,
  rememberedSelection,
}: {
  bodyLength: number;
  liveSelection: StudioSelection | null;
  rememberedSelection: StudioSelection | null;
}): StudioSelection => {
  const source = liveSelection ?? rememberedSelection;

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

// --- W19-A: table, combobox, target adapters, drag safety --------------------

/** A generic option for the searchable Combobox controls. */
export type ComboboxOption = {
  /** The STABLE stored value. */
  value: string;
  /** The workspace-facing label. */
  label: string;
};

/** Filters options by label or value, case-insensitively. */
export const filterComboboxOptions = (
  options: readonly ComboboxOption[],
  query: string,
): ComboboxOption[] => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [...options];
  }

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      option.value.toLowerCase().includes(needle),
  );
};

/**
 * Moves the active option index by `delta`, clamped to the available options.
 * Returns -1 for an empty list, so "Enter selects" cannot pick a non-existent
 * option.
 */
export const nextComboboxActiveIndex = ({
  activeIndex,
  optionCount,
  delta,
}: {
  activeIndex: number;
  optionCount: number;
  delta: number;
}): number => {
  if (optionCount <= 0) {
    return -1;
  }

  const start = activeIndex < 0 ? (delta > 0 ? -1 : optionCount) : activeIndex;

  return Math.min(Math.max(start + delta, 0), optionCount - 1);
};

/** The stable value of the active option, or `null` when there is none. */
export const activeComboboxValue = (
  options: readonly ComboboxOption[],
  activeIndex: number,
): string | null =>
  activeIndex >= 0 && activeIndex < options.length
    ? options[activeIndex].value
    : null;

/**
 * The target-entity adapter contract.
 *
 * The target control is NOT a hardcoded JSX option list: it consumes an adapter,
 * which supplies the STABLE stored value and the workspace-facing label of each
 * supported target. Adding a target (for example a Company recipient in W19-B)
 * means adding an adapter entry, not editing the control.
 */
export type StudioTargetOption = {
  /** The stable value persisted in `targetObject`. */
  value: string;
  /** The source label, translated by the app catalog at render time. */
  label: string;
};

export type StudioTargetAdapter = {
  id: string;
  options: readonly StudioTargetOption[];
  /** The option selected for a template that has no stored target. */
  defaultOptionValue: string;
};

export const STUDIO_TARGET_ADAPTERS: readonly StudioTargetAdapter[] = [
  {
    id: 'PERSON',
    options: [{ value: 'PERSON', label: 'People' }],
    defaultOptionValue: 'PERSON',
  },
];

/** The adapter for an id, falling back to the first declared adapter. */
export const getStudioTargetAdapter = (id: string): StudioTargetAdapter =>
  STUDIO_TARGET_ADAPTERS.find((adapter) => adapter.id === id) ??
  (STUDIO_TARGET_ADAPTERS[0] as StudioTargetAdapter);

/** The adapter's options as Combobox options. */
export const toTargetComboboxOptions = (
  adapter: StudioTargetAdapter,
): ComboboxOption[] =>
  adapter.options.map((option) => ({
    value: option.value,
    label: option.label,
  }));

/** The label shown for a stored target value, falling back to the value. */
export const targetValueLabel = (value: string): string =>
  getStudioTargetAdapter(value).options.find(
    (option) => option.value === value,
  )?.label ?? value;

// --- drag safety -------------------------------------------------------------

/**
 * True when the payload carries our field token. `dataTransfer` is typed as
 * unknown because the DOM may hand us `undefined` (a synthetic drag event) or an
 * object without `types`, and dereferencing either used to throw.
 */
export const hasFieldDragPayload = (dataTransfer: unknown): boolean => {
  if (dataTransfer === null || dataTransfer === undefined) {
    return false;
  }

  const types = (dataTransfer as { types?: unknown }).types;

  return Array.isArray(types) && types.includes(STUDIO_FIELD_DRAG_MIME);
};

/**
 * Reads a token from a drop payload WITHOUT ever throwing: a missing
 * `dataTransfer`, a missing `getData`, or a `getData` that rejects all yield an
 * empty string.
 */
export const readDroppedTokenSafely = (dataTransfer: unknown): string => {
  if (dataTransfer === null || dataTransfer === undefined) {
    return '';
  }

  const getData = (dataTransfer as { getData?: unknown }).getData;

  if (typeof getData !== 'function') {
    return '';
  }

  try {
    const typed = (
      getData as (format: string) => unknown
    ).call(dataTransfer, STUDIO_FIELD_DRAG_MIME);

    if (typeof typed === 'string' && typed.length > 0) {
      return typed;
    }

    const plain = (getData as (format: string) => unknown).call(
      dataTransfer,
      'text/plain',
    );

    return typeof plain === 'string' ? plain : '';
  } catch {
    return '';
  }
};

/**
 * The token a drop should insert: the payload's token when it is authorized,
 * otherwise the token remembered from `dragstart`, and `null` when neither is in
 * the CURRENT authorized catalog. A fabricated or stale token therefore changes
 * nothing.
 */
export const resolveDroppedFieldToken = ({
  typedToken,
  rememberedToken,
  fields,
}: {
  typedToken: string;
  rememberedToken: string | null;
  fields: readonly StudioField[];
}): string | null =>
  findAuthorizedFieldByToken(fields, typedToken)?.token ??
  findAuthorizedFieldByToken(fields, rememberedToken)?.token ??
  null;

// --- text integrity ----------------------------------------------------------

// LRM, RLM, ALM, the explicit embedding/override controls and the isolate
// controls. None of these may ever be persisted as part of a template body.
const HIDDEN_BIDI_PATTERN = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/;

/** True when a string carries a hidden bidi control character. */
export const containsHiddenBidiCharacter = (value: string): boolean =>
  HIDDEN_BIDI_PATTERN.test(value);

// --- table -------------------------------------------------------------------

/** Filters templates by title, case-insensitively. */
export const filterStudioTemplates = (
  templates: readonly StudioTemplate[],
  query: string,
): StudioTemplate[] => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [...templates];
  }

  return templates.filter(
    (template) =>
      template.title.toLowerCase().includes(needle) ||
      template.id.toLowerCase().includes(needle),
  );
};

/**
 * A compact display value for «آخرین ویرایش». Returns the date portion of a
 * valid ISO timestamp, or an empty string when there is nothing usable — the
 * component decides the "unknown" copy.
 */
export const formatStudioUpdatedAt = (updatedAt: string): string => {
  const trimmed = updatedAt.trim();

  if (trimmed.length === 0) {
    return '';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);

  return match === null ? '' : `${match[1]}-${match[2]}-${match[3]}`;
};
