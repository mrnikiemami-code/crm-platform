import { isDefined } from 'twenty-shared/utils';

// Host-side transport + state for the RazPayamak settings test-send. Kept out
// of the React component so the exact shipped behavior (deadline, in-flight
// guard, truthful classification) is unit-testable.

// The same 60-second deadline the app's front components use. It covers the
// fetch, the body read and the parse; when it expires the client STOPS WAITING,
// which is NOT proof the server/provider cancelled the send.
export const SETTINGS_TEST_SMS_DEADLINE_MS = 60_000;

const monotonicNowMs = (): number =>
  typeof performance !== 'undefined' &&
  typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export type SettingsTestSmsOutcome =
  | { kind: 'SENT'; providerMessageId?: string }
  | { kind: 'PROVIDER_FAILED'; failureCode?: string; providerCode?: number; providerDetail?: string }
  | { kind: 'NOT_PERMITTED' }
  | { kind: 'INVALID'; failureCode: string }
  | { kind: 'OUTCOME_UNKNOWN' }
  /** A request was dropped because one is already in flight. Not a result. */
  | { kind: 'DUPLICATE_IGNORED' };

// The result of a delivery-status inquiry («استعلام») for one recID.
export type SettingsDeliveryState =
  | 'DELIVERED'
  | 'IN_TRANSIT'
  | 'SENT'
  | 'PENDING'
  | 'NOT_DELIVERED'
  | 'FAILED'
  | 'UNKNOWN';

export type SettingsDeliveryOutcome =
  | { kind: 'STATUS'; state: SettingsDeliveryState; providerCode?: number }
  | { kind: 'NOT_PERMITTED' }
  | { kind: 'INVALID' }
  /** The lookup itself failed: never presented as a delivery claim. */
  | { kind: 'LOOKUP_FAILED' }
  | { kind: 'DUPLICATE_IGNORED' };

export const classifySettingsDeliveryResponse = (
  data: Record<string, unknown>,
): SettingsDeliveryOutcome => {
  if (data.failureCode === 'NOT_PERMITTED') {
    return { kind: 'NOT_PERMITTED' };
  }

  if (data.failureCode === 'INVALID_RECIPIENT') {
    return { kind: 'INVALID' };
  }

  if (data.success !== true) {
    return { kind: 'LOOKUP_FAILED' };
  }

  const state = readString(data.state);

  if (state === undefined) {
    return { kind: 'LOOKUP_FAILED' };
  }

  const providerCode =
    typeof data.providerCode === 'number' ? data.providerCode : undefined;

  return {
    kind: 'STATUS',
    state: state as SettingsDeliveryState,
    ...(providerCode === undefined ? {} : { providerCode }),
  };
};

export type SettingsTestSmsTransportResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

export type SettingsTestSmsTransport = (
  request: { recipient: string; body: string },
  options: { signal?: AbortSignal; timeoutMs: number },
) => Promise<SettingsTestSmsTransportResponse>;

export type SettingsDeliveryTransport = (
  request: { providerMessageId: string },
  options: { signal?: AbortSignal; timeoutMs: number },
) => Promise<SettingsTestSmsTransportResponse>;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Interprets the route response into a truthful outcome. A success requires
 * `success === true`; the provider is never reported as delivering.
 */
export const classifySettingsTestSmsResponse = (
  data: Record<string, unknown>,
): SettingsTestSmsOutcome => {
  if (data.success === true) {
    const providerMessageId = readString(data.providerMessageId);

    return providerMessageId === undefined
      ? { kind: 'SENT' }
      : { kind: 'SENT', providerMessageId };
  }

  if (data.failureCode === 'NOT_PERMITTED') {
    return { kind: 'NOT_PERMITTED' };
  }

  if (data.failureCode === 'INVALID_RECIPIENT' || data.failureCode === 'EMPTY_MESSAGE') {
    return { kind: 'INVALID', failureCode: String(data.failureCode) };
  }

  // An unknown outcome is never a definite failure and is never retried
  // automatically. The server flag wins over the message text.
  if (data.isOutcomeKnown === false) {
    return { kind: 'OUTCOME_UNKNOWN' };
  }

  const failureCode = readString(data.providerFailureCode);
  const providerCode =
    typeof data.providerCode === 'number' ? data.providerCode : undefined;
  const providerDetail = readString(data.providerDetail);

  return {
    kind: 'PROVIDER_FAILED',
    ...(failureCode === undefined ? {} : { failureCode }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerDetail === undefined ? {} : { providerDetail }),
  };
};

export type RunSettingsTestSmsDependencies = {
  transport: SettingsTestSmsTransport;
  /** Transport for the delivery-status inquiry. */
  deliveryTransport?: SettingsDeliveryTransport;
  /** Synchronous in-flight guard shared across submissions. */
  isSendingRef?: { current: boolean };
  deadlineMs?: number;
};

/**
 * Runs ONE settings test-send.
 *
 * The in-flight guard is checked synchronously, before any `await`, so two
 * immediate clicks cannot both reach the transport. The 60s deadline is
 * enforced by an INDEPENDENT timer race, so a `fetch`/body-read that ignores
 * AbortSignal can never keep the caller waiting. A failure never triggers an
 * automatic retry.
 */
export const runSettingsTestSms = async (
  request: { recipient: string; body: string },
  dependencies: RunSettingsTestSmsDependencies,
): Promise<SettingsTestSmsOutcome> => {
  const guard = dependencies.isSendingRef;

  if (guard?.current === true) {
    return { kind: 'DUPLICATE_IGNORED' };
  }

  if (guard !== undefined) {
    guard.current = true;
  }

  const timeoutMs = dependencies.deadlineMs ?? SETTINGS_TEST_SMS_DEADLINE_MS;

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;

  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  const startMs = monotonicNowMs();
  const deadlineMs = startMs + timeoutMs;

  const deadlinePromise = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      controller?.abort();
      reject(new Error('Request deadline exceeded'));
    }, timeoutMs);
  });

  const work = (async (): Promise<SettingsTestSmsOutcome> => {
    const response = await dependencies.transport(request, {
      ...(controller === null ? {} : { signal: controller.signal }),
      timeoutMs,
    });

    if (monotonicNowMs() >= deadlineMs) {
      throw new Error('Request deadline exceeded');
    }

    return classifySettingsTestSmsResponse(response.data);
  })();

  // Observe the late work so a settlement after the race cannot become an
  // unhandled rejection.
  work.catch(() => {});

  try {
    return await Promise.race([work, deadlinePromise]);
  } catch {
    // A deadline, an abort, a transport rejection or a parse failure all mean
    // the request MAY have reached the server/provider.
    return { kind: 'OUTCOME_UNKNOWN' };
  } finally {
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }

    if (guard !== undefined) {
      guard.current = false;
    }
  }
};

/** Whether the send button must be disabled for the given draft. */
export const isSettingsTestSmsSendable = ({
  recipient,
  body,
  isSending,
}: {
  recipient: string;
  body: string;
  isSending: boolean;
}): boolean =>
  !isSending && isDefined(recipient) && recipient.trim().length > 0 && body.trim().length > 0;

/**
 * Runs ONE delivery-status inquiry for a recID.
 *
 * Same deadline and synchronous in-flight guard as the send: two immediate
 * clicks produce one request, and the caller is never left waiting past the
 * deadline. It never sends and never retries automatically.
 */
export const runSettingsDeliveryCheck = async (
  request: { providerMessageId: string },
  dependencies: RunSettingsTestSmsDependencies,
): Promise<SettingsDeliveryOutcome> => {
  const guard = dependencies.isSendingRef;

  if (guard?.current === true) {
    return { kind: 'DUPLICATE_IGNORED' };
  }

  if (guard !== undefined) {
    guard.current = true;
  }

  const timeoutMs = dependencies.deadlineMs ?? SETTINGS_TEST_SMS_DEADLINE_MS;

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;

  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  const startMs = monotonicNowMs();
  const deadlineMs = startMs + timeoutMs;

  const deadlinePromise = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      controller?.abort();
      reject(new Error('Request deadline exceeded'));
    }, timeoutMs);
  });

  const work = (async (): Promise<SettingsDeliveryOutcome> => {
    const response = await dependencies.deliveryTransport!(request, {
      ...(controller === null ? {} : { signal: controller.signal }),
      timeoutMs,
    });

    if (monotonicNowMs() >= deadlineMs) {
      throw new Error('Request deadline exceeded');
    }

    return classifySettingsDeliveryResponse(response.data);
  })();

  work.catch(() => {});

  try {
    return await Promise.race([work, deadlinePromise]);
  } catch {
    return { kind: 'LOOKUP_FAILED' };
  } finally {
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }

    if (guard !== undefined) {
      guard.current = false;
    }
  }
};
