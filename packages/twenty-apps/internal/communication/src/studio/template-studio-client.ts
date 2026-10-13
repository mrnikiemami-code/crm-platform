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
  };
};

export type StudioMutationResult =
  | { ok: true; template: StudioTemplate | null }
  | { ok: false; code: TemplateStudioErrorCode };

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
