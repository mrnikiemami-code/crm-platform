// Pure client-side interpretation of the two read-only bulk routes. Kept out of
// the React component so the shipped behavior can be unit-tested without the
// front-component sandbox.

import {
  computeSharedPhoneWarnings,
  type SharedPhoneWarning,
} from 'src/bulk/shared-phone-warnings';

export type { SharedPhoneWarning };

export type BulkRecipientStatus = 'SENDABLE' | 'NO_PHONE' | 'NOT_ACCESSIBLE';

export type BulkPhoneOption = {
  id: string;
  value: string;
  isPrimary: boolean;
};

export type BulkRecipient = {
  personId: string;
  displayName: string;
  status: BulkRecipientStatus;
  phones: BulkPhoneOption[];
  selectedPhone: string | null;
};

export type BulkRecipientsLoadState =
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      recipients: BulkRecipient[];
      duplicatePersonIds: string[];
      sharedPhoneWarnings: SharedPhoneWarning[];
      sendableCount: number;
      unsendableCount: number;
    }
  /** The request failed; a failure is never an empty selection. */
  | { kind: 'ERROR' };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const toBulkPhone = (value: unknown): BulkPhoneOption | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.id) || !isNonEmptyString(record.value)) {
    return null;
  }

  return {
    id: record.id,
    value: record.value,
    isPrimary: record.isPrimary === true,
  };
};

const toStatus = (value: unknown): BulkRecipientStatus =>
  value === 'SENDABLE' || value === 'NO_PHONE' ? value : 'NOT_ACCESSIBLE';

const toBulkRecipient = (value: unknown): BulkRecipient | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.personId)) {
    return null;
  }

  const phones = Array.isArray(record.phones)
    ? record.phones
        .map(toBulkPhone)
        .filter((phone): phone is BulkPhoneOption => phone !== null)
    : [];

  return {
    personId: record.personId,
    displayName: isNonEmptyString(record.displayName)
      ? record.displayName
      : record.personId,
    status: toStatus(record.status),
    phones,
    selectedPhone: isNonEmptyString(record.selectedPhone)
      ? record.selectedPhone
      : null,
  };
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const toSharedPhoneWarnings = (value: unknown): SharedPhoneWarning[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const warnings: SharedPhoneWarning[] = [];

  for (const item of value) {
    if (item === null || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;

    if (!isNonEmptyString(record.phone)) {
      continue;
    }

    warnings.push({
      phone: record.phone,
      personIds: toStringArray(record.personIds),
    });
  }

  return warnings;
};

/**
 * Interprets a bulk-recipients response. A non-ok response, a missing
 * `success: true` flag or a malformed body are all ERROR — never an empty list.
 */
export const resolveBulkRecipientsLoadState = (response: {
  ok: boolean;
  data: unknown;
}): BulkRecipientsLoadState => {
  if (!response.ok || response.data === null || typeof response.data !== 'object') {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true || !Array.isArray(payload.recipients)) {
    return { kind: 'ERROR' };
  }

  const recipients = payload.recipients
    .map(toBulkRecipient)
    .filter((recipient): recipient is BulkRecipient => recipient !== null);

  // A response that carried entries but yielded none is malformed, not empty.
  if (payload.recipients.length > 0 && recipients.length === 0) {
    return { kind: 'ERROR' };
  }

  const sendableCount =
    typeof payload.sendableCount === 'number'
      ? payload.sendableCount
      : recipients.filter((recipient) => recipient.status === 'SENDABLE').length;

  return {
    kind: 'READY',
    recipients,
    duplicatePersonIds: toStringArray(payload.duplicatePersonIds),
    sharedPhoneWarnings: toSharedPhoneWarnings(payload.sharedPhoneWarnings),
    sendableCount,
    unsendableCount:
      typeof payload.unsendableCount === 'number'
        ? payload.unsendableCount
        : recipients.length - sendableCount,
  };
};

export type PreviewIssue = {
  token: string;
  kind: 'UNKNOWN_VARIABLE' | 'EMPTY_FIELD';
};

export type RecipientPreview = {
  personId: string;
  displayName: string;
  phone: string | null;
  previewText: string;
  hasUnresolvedVariables: boolean;
  issues: PreviewIssue[];
  isReadyToSend: boolean;
};

export type PreviewLoadState =
  | { kind: 'IDLE' }
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      previews: RecipientPreview[];
      hasUnresolvedVariables: boolean;
      /** True when the body the server evaluated was empty/whitespace. */
      isBodyEmpty: boolean;
      readyCount: number;
      sharedPhoneWarnings: SharedPhoneWarning[];
      duplicatePersonIds: string[];
      /** Person ids whose phone override was rejected by the server. */
      invalidOverrides: string[];
    }
  | { kind: 'ERROR' };

const toIssue = (value: unknown): PreviewIssue | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.token)) {
    return null;
  }

  return {
    token: record.token,
    kind:
      record.kind === 'EMPTY_FIELD' ? 'EMPTY_FIELD' : 'UNKNOWN_VARIABLE',
  };
};

const toRecipientPreview = (value: unknown): RecipientPreview | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.personId)) {
    return null;
  }

  return {
    personId: record.personId,
    displayName: isNonEmptyString(record.displayName)
      ? record.displayName
      : record.personId,
    phone: isNonEmptyString(record.phone) ? record.phone : null,
    previewText: typeof record.previewText === 'string' ? record.previewText : '',
    hasUnresolvedVariables: record.hasUnresolvedVariables === true,
    issues: Array.isArray(record.issues)
      ? record.issues
          .map(toIssue)
          .filter((issue): issue is PreviewIssue => issue !== null)
      : [],
    isReadyToSend: record.isReadyToSend === true,
  };
};

/**
 * Interprets a preview response. `ok: false` yields ERROR; a genuinely empty
 * preview list is a valid (if useless) READY result only when the server said
 * so with `success: true`.
 */
export const resolvePreviewLoadState = (response: {
  ok: boolean;
  data: unknown;
}): PreviewLoadState => {
  if (!response.ok || response.data === null || typeof response.data !== 'object') {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true || !Array.isArray(payload.previews)) {
    return { kind: 'ERROR' };
  }

  const previews = payload.previews
    .map(toRecipientPreview)
    .filter((preview): preview is RecipientPreview => preview !== null);

  if (payload.previews.length > 0 && previews.length === 0) {
    return { kind: 'ERROR' };
  }

  return {
    kind: 'READY',
    previews,
    hasUnresolvedVariables: previews.some(
      (preview) => preview.hasUnresolvedVariables,
    ),
    isBodyEmpty: payload.isBodyEmpty === true,
    readyCount:
      typeof payload.readyCount === 'number'
        ? payload.readyCount
        : previews.filter((preview) => preview.isReadyToSend).length,
    sharedPhoneWarnings: toSharedPhoneWarnings(payload.sharedPhoneWarnings),
    duplicatePersonIds: toStringArray(payload.duplicatePersonIds),
    invalidOverrides: toStringArray(payload.invalidOverrides),
  };
};

export type MessageTemplate = {
  id: string;
  title: string;
  body: string;
  channel: string;
};

export type TemplateVariable = { token: string; label: string };

export type TemplatesLoadState =
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      templates: MessageTemplate[];
      variables: TemplateVariable[];
    }
  /** The request succeeded but the workspace has no templates. */
  | { kind: 'EMPTY'; variables: TemplateVariable[] }
  | { kind: 'ERROR' };

const toTemplate = (value: unknown): MessageTemplate | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.id)) {
    return null;
  }

  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    channel: isNonEmptyString(record.channel) ? record.channel : 'SMS',
  };
};

const toVariable = (value: unknown): TemplateVariable | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record.token) || !isNonEmptyString(record.label)) {
    return null;
  }

  return { token: record.token, label: record.label };
};

export const resolveTemplatesLoadState = (response: {
  ok: boolean;
  data: unknown;
}): TemplatesLoadState => {
  if (!response.ok || response.data === null || typeof response.data !== 'object') {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true || !Array.isArray(payload.templates)) {
    return { kind: 'ERROR' };
  }

  const templates = payload.templates
    .map(toTemplate)
    .filter((template): template is MessageTemplate => template !== null);

  const variables = Array.isArray(payload.variables)
    ? payload.variables
        .map(toVariable)
        .filter((variable): variable is TemplateVariable => variable !== null)
    : [];

  // An empty workspace is EMPTY, not ERROR: a genuinely empty list is an honest
  // result, while a failure is a different state entirely.
  if (templates.length === 0) {
    return { kind: 'EMPTY', variables };
  }

  return { kind: 'READY', templates, variables };
};

// A shared number means two distinct recipients would receive the same message
// on the same line. It is a warning the user must see before any send.
export const describeSharedPhoneWarnings = (
  warnings: SharedPhoneWarning[],
): string[] =>
  warnings.map(
    (warning) => `${warning.phone} (${warning.personIds.length} recipients)`,
  );

// Recomputes the shared-number warning on the CLIENT from the recipients still
// in the form and the number each currently resolves to. This is what the user
// sees live as they remove recipients or pick an alternate number; the server
// recomputes the same rule after applying overrides for its authoritative
// response.
export const recomputeVisibleSharedPhoneWarnings = (
  recipients: readonly { personId: string; selectedPhone: string | null }[],
): SharedPhoneWarning[] =>
  computeSharedPhoneWarnings(
    recipients.map((recipient) => ({
      personId: recipient.personId,
      phone: recipient.selectedPhone,
    })),
  );
