import {
  TEMPLATE_CATALOG_STATUS,
  TEMPLATE_STUDIO_ERROR_CODE,
  readTemplateTargetObject,
  type TemplateCatalogStatus,
  type TemplateStudioErrorCode,
} from 'src/studio/template-studio-contract';
import {
  STUDIO_FIELD_GROUP,
  type StudioField,
  type StudioFieldGroup,
  type StudioPerson,
  type StudioTemplate,
} from 'src/studio/template-studio-logic';

// Interprets the studio route's responses. Kept out of React so the exact
// parsing that ships is unit-testable.
//
// Every failure is mapped to a STABLE, application-owned code. A raw
// `error.message`, a stack trace, an SDK string, a URL or a provider detail is
// DISCARDED here and never stored in the returned state, so it cannot reach the
// UI even if a server (or an intermediary) started sending one.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toStudioFieldGroup = (value: unknown): StudioFieldGroup =>
  value === STUDIO_FIELD_GROUP.COMPANY
    ? STUDIO_FIELD_GROUP.COMPANY
    : STUDIO_FIELD_GROUP.PERSON;

const toStudioField = (value: unknown): StudioField | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!isNonEmptyString(value.token) || !isNonEmptyString(value.label)) {
    return null;
  }

  return {
    token: value.token,
    label: value.label,
    group: toStudioFieldGroup(value.group),
  };
};

const toStudioTemplate = (value: unknown): StudioTemplate | null => {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return null;
  }

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : '',
    body: typeof value.body === 'string' ? value.body : '',
    targetObject: readTemplateTargetObject(value.targetObject),
  };
};

export type StudioLoadState =
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      templates: StudioTemplate[];
      fields: StudioField[];
      catalogStatus: TemplateCatalogStatus;
      /**
       * The stable, application-owned reason the catalog is unavailable. Kept as
       * a code so a support surface can show it without any exception text.
       */
      catalogStage: string;
    }
  | { kind: 'ERROR'; code: TemplateStudioErrorCode };

/** Parses the studio list response. A malformed body is an ERROR, never empty. */
export const resolveStudioLoadState = (response: {
  ok: boolean;
  data: unknown;
}): StudioLoadState => {
  if (!response.ok || !isRecord(response.data)) {
    return { kind: 'ERROR', code: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED };
  }

  const payload = response.data;

  if (payload.success !== true || !Array.isArray(payload.templates)) {
    return { kind: 'ERROR', code: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED };
  }

  const templates = payload.templates
    .map(toStudioTemplate)
    .filter((template): template is StudioTemplate => template !== null);

  // Entries that were sent but yielded none is malformed, not empty.
  if (payload.templates.length > 0 && templates.length === 0) {
    return { kind: 'ERROR', code: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED };
  }

  const fields = Array.isArray(payload.fields)
    ? payload.fields
        .map(toStudioField)
        .filter((field): field is StudioField => field !== null)
    : [];

  return {
    kind: 'READY',
    templates,
    fields,
    // Only the two known values are accepted; anything else is UNAVAILABLE,
    // which fails closed rather than implying the catalog is fine.
    catalogStatus:
      payload.catalogStatus === TEMPLATE_CATALOG_STATUS.READY
        ? TEMPLATE_CATALOG_STATUS.READY
        : TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
    catalogStage:
      isNonEmptyString(payload.catalogStage) &&
      /^[A-Z_]{1,32}$/.test(payload.catalogStage)
        ? payload.catalogStage
        : 'UNKNOWN',
  };
};

export type StudioMutationResult =
  | { ok: true; template: StudioTemplate | null }
  | { ok: false; code: TemplateStudioErrorCode };

// --- W18-B: sample-person preview --------------------------------------------

export type StudioPreviewIssue = {
  token: string;
  kind: 'UNKNOWN_VARIABLE' | 'EMPTY_FIELD';
};

/**
 * The preview outcome. Every branch is explicit so the UI never has to infer
 * meaning from a partially-populated object, and no raw server text is carried.
 */
export type StudioPreviewState =
  | { kind: 'IDLE' }
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      personId: string;
      resolvedText: string;
      /** Unresolved tokens, rendered SEPARATELY from the resolved text. */
      issues: StudioPreviewIssue[];
    }
  /** The person could not be read (missing, or no longer permitted). */
  | { kind: 'PERSON_NOT_ACCESSIBLE' }
  /** The person was read but has no usable destination number. */
  | { kind: 'NOT_SENDABLE' }
  | { kind: 'EMPTY_BODY' }
  /** The body is whitespace only, as judged by the server. */
  | { kind: 'ERROR' };

const toPreviewIssue = (value: unknown): StudioPreviewIssue | null => {
  if (!isRecord(value) || !isNonEmptyString(value.token)) {
    return null;
  }

  return {
    token: value.token,
    kind: value.kind === 'EMPTY_FIELD' ? 'EMPTY_FIELD' : 'UNKNOWN_VARIABLE',
  };
};

/**
 * Parses the existing server-authoritative preview response for ONE recipient.
 *
 * A response that succeeded but carries no entry for the requested person means
 * the server did not return that record, which is reported as
 * PERSON_NOT_ACCESSIBLE rather than as a successful preview of nothing.
 */
export const resolveStudioPreviewState = ({
  response,
  personId,
}: {
  response: { ok: boolean; data: unknown };
  personId: string;
}): StudioPreviewState => {
  if (!response.ok || !isRecord(response.data)) {
    return { kind: 'ERROR' };
  }

  const payload = response.data;
  const previews = Array.isArray(payload.previews) ? payload.previews : null;

  if (payload.success !== true || previews === null) {
    return { kind: 'ERROR' };
  }

  const entry = previews
    .filter(isRecord)
    .find((candidate) => candidate.personId === personId);

  if (entry === undefined) {
    return { kind: 'PERSON_NOT_ACCESSIBLE' };
  }

  if (entry.phone === null || entry.phone === undefined) {
    // The record was read but no usable number was resolved for it. This is
    // never treated as a successful preview.
    return { kind: 'NOT_SENDABLE' };
  }

  if (typeof entry.previewText !== 'string') {
    return { kind: 'ERROR' };
  }

  if (entry.previewText.trim().length === 0) {
    return { kind: 'EMPTY_BODY' };
  }

  return {
    kind: 'READY',
    personId,
    resolvedText: entry.previewText,
    issues: Array.isArray(entry.issues)
      ? entry.issues
          .map(toPreviewIssue)
          .filter((issue): issue is StudioPreviewIssue => issue !== null)
      : [],
  };
};

/** Parses the accessible-People list used by the sample-person picker. */
export const resolveStudioPeople = (response: {
  ok: boolean;
  data: unknown;
}): { ok: true; people: StudioPerson[] } | { ok: false } => {
  if (!isRecord(response.data) || response.data.success !== true) {
    return { ok: false };
  }

  const people = Array.isArray(response.data.people)
    ? response.data.people
        .map((value): StudioPerson | null => {
          if (!isRecord(value) || !isNonEmptyString(value.id)) {
            return null;
          }

          return {
            id: value.id,
            displayName:
              typeof value.displayName === 'string' ? value.displayName : '',
          };
        })
        .filter((person): person is StudioPerson => person !== null)
    : [];

  return { ok: true, people };
};

const readErrorCode = (value: unknown): TemplateStudioErrorCode => {
  if (!isRecord(value)) {
    return TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED;
  }

  switch (value.errorCode) {
    case TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT:
    case TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND:
    case TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED:
    case TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED:
      return value.errorCode;
    default:
      return TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED;
  }
};

/** Parses a create/update/delete response into a code-only result. */
export const resolveStudioMutationResult = (response: {
  ok: boolean;
  data: unknown;
}): StudioMutationResult => {
  if (!isRecord(response.data)) {
    return { ok: false, code: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED };
  }

  if (response.data.success !== true) {
    return { ok: false, code: readErrorCode(response.data) };
  }

  return { ok: true, template: toStudioTemplate(response.data.template) };
};
