// The stable, application-owned vocabulary the Template Studio contract uses.
//
// NOTHING here is derived from an exception, an SDK message, a URL or a
// provider. The browser only ever receives these values plus its own translated
// copy, so a stack trace, a credential or an internal path can never reach the
// UI.

/** Whether the authorized field catalog could be built at all. */
export const TEMPLATE_CATALOG_STATUS = {
  READY: 'READY',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type TemplateCatalogStatus =
  (typeof TEMPLATE_CATALOG_STATUS)[keyof typeof TEMPLATE_CATALOG_STATUS];

/** Stable failure codes for a studio mutation. */
export const TEMPLATE_STUDIO_ERROR_CODE = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  WRITE_FAILED: 'WRITE_FAILED',
  UNEXPECTED: 'UNEXPECTED',
  /**
   * The request carried no authenticated USER, only an application identity.
   *
   * A front component reaches an app route with the application token, so a route
   * invoked from the component cannot act as the person looking at the screen.
   * Every action that touches a record therefore fails closed with this code
   * rather than falling back to the app's own access.
   */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /**
   * The template's stored source/relation does not match the request, is not
   * resolvable in metadata any more, or resolves to a collection rather than a
   * single Person.
   */
  CONTEXT_MISMATCH: 'TEMPLATE_CONTEXT_MISMATCH',
  /**
   * The stored relation exists but its value is null on the selected source
   * record, so no recipient can be resolved.
   */
  RELATION_EMPTY: 'RELATION_EMPTY',
  /** Another session changed the record after it was loaded. */
  CONFLICT: 'CONFLICT',
} as const;

export type TemplateStudioErrorCode =
  (typeof TEMPLATE_STUDIO_ERROR_CODE)[keyof typeof TEMPLATE_STUDIO_ERROR_CODE];

/** The target-entity values the studio offers, with their stable stored values. */
export const TEMPLATE_TARGET_OBJECT = {
  PERSON: 'PERSON',
} as const;

export type TemplateTargetObject =
  (typeof TEMPLATE_TARGET_OBJECT)[keyof typeof TEMPLATE_TARGET_OBJECT];

/**
 * The target for a stored row. An existing template has no value, and MUST be
 * read as `PERSON` — this is a read-time default, never a write-back migration.
 */
export const readTemplateTargetObject = (
  value: unknown,
): TemplateTargetObject =>
  value === TEMPLATE_TARGET_OBJECT.PERSON
    ? TEMPLATE_TARGET_OBJECT.PERSON
    : TEMPLATE_TARGET_OBJECT.PERSON;

/** True when a raw value is an accepted target. */
export const isTemplateTargetObject = (
  value: unknown,
): value is TemplateTargetObject => value === TEMPLATE_TARGET_OBJECT.PERSON;
