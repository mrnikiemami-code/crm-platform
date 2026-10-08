import { isDefined } from 'twenty-shared/utils';

// Pure state helpers for the SMS settings tab. Kept out of the component so the
// secret-intent rules, the load-state split and the partial-save accounting can
// be tested directly, without the Apollo/React harness.

export type CommunicationSmsLoadState =
  | { kind: 'LOADING' }
  /** The app is not installed in this workspace. */
  | { kind: 'NOT_INSTALLED' }
  /** The request failed (network, permission, server). NOT the same as absent. */
  | { kind: 'ERROR' }
  | { kind: 'READY' };

/**
 * Distinguishes "still loading", "not installed" and "the request failed".
 * A failed request must never be shown as "not installed": that would tell the
 * user to install an app that is already there, or hide a permission problem.
 */
export const resolveCommunicationSmsLoadState = ({
  loading,
  hasError,
  hasApplication,
}: {
  loading: boolean;
  hasError: boolean;
  hasApplication: boolean;
}): CommunicationSmsLoadState => {
  if (loading) {
    return { kind: 'LOADING' };
  }

  if (hasError) {
    return { kind: 'ERROR' };
  }

  if (!hasApplication) {
    return { kind: 'NOT_INSTALLED' };
  }

  return { kind: 'READY' };
};

/**
 * What the user intends for a secret field. The three intents are explicit so
 * an empty input can mean KEEP and only an explicit action can mean CLEAR.
 */
export type SecretIntent = 'KEEP' | 'REPLACE' | 'CLEAR';

export type SecretFieldState = {
  /** The replacement value the user typed. Never the stored secret. */
  replacement: string;
  /** True only after the explicit Clear action. */
  isClearRequested: boolean;
};

export const EMPTY_SECRET_FIELD_STATE: SecretFieldState = {
  replacement: '',
  isClearRequested: false,
};

export const resolveSecretIntent = (
  state: SecretFieldState | undefined,
): SecretIntent => {
  if (state?.isClearRequested === true) {
    return 'CLEAR';
  }

  if (isDefined(state) && state.replacement.length > 0) {
    return 'REPLACE';
  }

  return 'KEEP';
};

/**
 * Typing a new value cancels a pending clear: an explicit CLEAR is only undone
 * by typing, and typing a value turns the intent into REPLACE. Typing nothing
 * (an empty input) leaves the intent at KEEP, so an empty input never clears.
 */
export const applySecretDraftChange = ({
  previous,
  text,
}: {
  previous: SecretFieldState | undefined;
  text: string;
}): SecretFieldState => ({
  replacement: text,
  isClearRequested:
    text.length > 0 ? false : (previous?.isClearRequested ?? false),
});

export const requestSecretClear = (): SecretFieldState => ({
  replacement: '',
  isClearRequested: true,
});

export const cancelSecretClear = (): SecretFieldState =>
  EMPTY_SECRET_FIELD_STATE;

/**
 * The value the secret input must show. It is ONLY the replacement the user
 * typed, never the stored (or masked) value, so a saved secret can never leak
 * back into the field.
 */
export const resolveSecretInputValue = (
  state: SecretFieldState | undefined,
): string => state?.replacement ?? '';

/**
 * The value to write for a secret field, or `undefined` when nothing must be
 * written. A KEEP intent writes nothing, so the stored secret is untouched.
 */
export const resolveSecretWriteValue = (
  state: SecretFieldState | undefined,
): string | undefined => {
  const intent = resolveSecretIntent(state);

  if (intent === 'CLEAR') {
    return '';
  }

  if (intent === 'REPLACE') {
    return state?.replacement;
  }

  return undefined;
};

export type SaveOutcome = 'ALL_SAVED' | 'PARTIAL' | 'NONE_SAVED';

/**
 * Classifies a save by how many writes actually landed, so a partial failure is
 * never reported as a full success and never as "nothing changed".
 */
export const summarizeSaveOutcome = ({
  succeededCount,
  totalCount,
}: {
  succeededCount: number;
  totalCount: number;
}): SaveOutcome => {
  if (totalCount === 0) {
    return 'ALL_SAVED';
  }

  if (succeededCount === 0) {
    return 'NONE_SAVED';
  }

  if (succeededCount === totalCount) {
    return 'ALL_SAVED';
  }

  return 'PARTIAL';
};

/**
 * The value a provider field's input must show. A SECRET field reads ONLY from
 * the secret draft state (its typed replacement, or empty) — the decision comes
 * from the field's own `isSecret` flag, never from whether a value is present,
 * so an unset secret can never fall through to the stored-value branch.
 */
export const resolveSmsFieldInputValue = ({
  field,
  draftValueByKey,
  storedValueByKey,
  secretFieldStateByKey,
}: {
  field: { key: string; isSecret: boolean };
  draftValueByKey: Record<string, string>;
  storedValueByKey: Record<string, string>;
  secretFieldStateByKey: Record<string, SecretFieldState>;
}): string =>
  field.isSecret
    ? resolveSecretInputValue(secretFieldStateByKey[field.key])
    : (draftValueByKey[field.key] ?? storedValueByKey[field.key] ?? '');

/**
 * The writes a provider save must issue, in order. A secret writes only when
 * its intent is REPLACE (the typed value) or CLEAR (empty); KEEP writes
 * nothing. A non-secret writes only when its draft differs from what is stored.
 */
export const buildSmsProviderPendingWrites = ({
  fields,
  draftValueByKey,
  storedValueByKey,
  secretFieldStateByKey,
}: {
  fields: { key: string; isSecret: boolean }[];
  draftValueByKey: Record<string, string>;
  storedValueByKey: Record<string, string>;
  secretFieldStateByKey: Record<string, SecretFieldState>;
}): { key: string; value: string }[] => {
  const pendingWrites: { key: string; value: string }[] = [];

  for (const field of fields) {
    if (field.isSecret) {
      const secretWriteValue = resolveSecretWriteValue(
        secretFieldStateByKey[field.key],
      );

      if (isDefined(secretWriteValue)) {
        pendingWrites.push({ key: field.key, value: secretWriteValue });
      }
      continue;
    }

    const draftValue = draftValueByKey[field.key];

    if (isDefined(draftValue) && draftValue !== storedValueByKey[field.key]) {
      pendingWrites.push({ key: field.key, value: draftValue });
    }
  }

  return pendingWrites;
};

/**
 * Removes only the keys whose draft is UNCHANGED since the save started. A
 * field edited while the save was in flight (a newer revision) keeps its draft,
 * and a field whose write failed keeps its draft for a retry. Comparing
 * revisions — not just "did the write succeed" — is what makes an edit on the
 * SAME key survive the cleanup.
 */
export const dropUnchangedSucceededDrafts = <TValue>({
  latestDrafts,
  draftsAtSaveStart,
  succeededKeys,
}: {
  latestDrafts: Record<string, TValue>;
  draftsAtSaveStart: Record<string, TValue>;
  succeededKeys: string[];
}): Record<string, TValue> => {
  const next = { ...latestDrafts };

  for (const key of succeededKeys) {
    const draftIsUnchanged = latestDrafts[key] === draftsAtSaveStart[key];

    if (draftIsUnchanged) {
      delete next[key];
    }
  }

  return next;
};
