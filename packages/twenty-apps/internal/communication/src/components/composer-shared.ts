// Shared, sandbox-safe building blocks for the composer front components. The
// sandbox ships no UI kit, so these are plain data/styles reused by both the
// single-person and the bulk composer.

// RTL languages, by ISO 639-1 subtag. Kept local because the app bundle cannot
// depend on `twenty-shared`; mirrors the platform's own list.
export const RIGHT_TO_LEFT_LANGUAGES = [
  'ar',
  'dv',
  'fa',
  'he',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
];

export const getTextDirection = (locale: string): 'rtl' | 'ltr' =>
  RIGHT_TO_LEFT_LANGUAGES.includes(locale.split('-')[0]) ? 'rtl' : 'ltr';

// The client-side waiting deadline for ONE bulk send request. It covers the
// fetch, the response-body read and the response parse. When it expires the
// client STOPS WAITING — that is NOT proof the server or provider cancelled the
// send, so the coordinator reports the recipient as UNKNOWN and stops the group.
export const BULK_SEND_DEADLINE_MS = 60_000;

export type CallAppRouteOptions = {
  /**
   * When set to a POSITIVE FINITE number, the request is abandoned after this
   * many milliseconds. The default (undefined) keeps the original behavior with
   * no deadline, so the single-send path is unchanged. An invalid value (<= 0,
   * NaN, Infinity) is ignored rather than creating an immediate or unbounded
   * accidental timeout.
   */
  timeoutMs?: number;
};

const normalizeTimeoutMs = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

// A genuinely MONOTONIC elapsed-time source (milliseconds since an arbitrary
// origin). `performance.now()` never jumps with a system-clock correction, so a
// backwards wall-clock adjustment cannot make a late result look in time.
//
// Fallback semantics (stated honestly): when `performance.now` is unavailable
// the best available substitute is `Date.now()`, which is a WALL clock and is
// NOT monotonic. The sandbox used by this app provides `performance.now`, so the
// fallback is a defensive last resort, not the normal path.
const monotonicNowMs = (): number =>
  typeof performance !== 'undefined' &&
  typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

// Calls one of the app's own authenticated logic-function routes. The base URL
// and token come from the trusted execution context, never from user input.
//
// When `timeoutMs` is set, the returned promise settles as a REJECTION at the
// deadline INDEPENDENTLY of the transport: a `fetch` or `response.text()` that
// ignores AbortSignal can never keep the caller waiting. AbortController is kept
// only as a best-effort cancellation signal — it is NOT what guarantees
// settlement, and an abort is never proof the server/provider cancelled the send.
export const callAppRoute = async (
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  options?: CallAppRouteOptions,
) => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing');
  }

  const timeoutMs = normalizeTimeoutMs(options?.timeoutMs);

  if (timeoutMs === null) {
    const response = await fetch(`${apiBaseUrl}/s${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    const parsed = text.length > 0 ? JSON.parse(text) : {};

    return { ok: response.ok, status: response.status, data: parsed };
  }

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;

  // A monotonic start/deadline pair: the same elapsed-time source the timer
  // uses decides whether a parsed result completed in time. `performance.now()`
  // cannot be moved by a wall-clock correction.
  const startMs = monotonicNowMs();
  const deadlineMs = startMs + timeoutMs;

  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  // A timer whose rejection is RACED against the work. It is disposed on every
  // terminal path so a settled request leaves nothing behind.
  const deadlinePromise = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      controller?.abort();
      reject(new Error('Request deadline exceeded'));
    }, timeoutMs);
  });

  const dispose = (): void => {
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
  };

  const work = (async () => {
    const response = await fetch(`${apiBaseUrl}/s${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(controller !== null ? { signal: controller.signal } : {}),
    });

    const text = await response.text();

    // Refuse to parse once the deadline has already elapsed (the timer callback
    // may not have run yet if the JS thread was busy).
    if (monotonicNowMs() >= deadlineMs) {
      throw new Error('Request deadline exceeded');
    }

    const parsed = text.length > 0 ? JSON.parse(text) : {};

    // A synchronous parse can itself cross the deadline without the timer
    // callback ever running: discard a result that finished too late.
    if (monotonicNowMs() >= deadlineMs) {
      throw new Error('Request deadline exceeded');
    }

    return { ok: response.ok, status: response.status, data: parsed };
  })();

  // The late work is observed so a settlement after the race cannot become an
  // unhandled rejection.
  work.catch(() => {});

  try {
    return await Promise.race([work, deadlinePromise]);
  } finally {
    dispose();
  }
};

// The form is plain HTML styled to match the host Twenty surface: same
// border/radius/typography and a single primary action. Kept as data so RTL
// only has to flip alignment, not layout.
export const composerStyles = {
  container: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    color: '#333',
  },
  heading: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#111',
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: '#666',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#555',
  },
  control: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#111',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    outlineColor: '#333',
  },
  controlDisabled: {
    background: '#f6f6f6',
    color: '#888',
  },
  error: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    color: '#b42318',
    background: '#fef3f2',
    border: '1px solid #fecdca',
    borderRadius: 4,
  },
  warning: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    color: '#93370d',
    background: '#fffaeb',
    border: '1px solid #fedf89',
    borderRadius: 4,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primaryButton: {
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#fff',
    background: '#333',
    border: '1px solid #333',
    borderRadius: 4,
    cursor: 'pointer',
  },
  primaryButtonDisabled: {
    background: '#bdbdbd',
    borderColor: '#bdbdbd',
    cursor: 'default',
  },
  secondaryButton: {
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#333',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    cursor: 'pointer',
  },
  recipientList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    maxHeight: 260,
    overflowY: 'auto' as const,
  },
  recipientRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    padding: '8px 10px',
    border: '1px solid #e4e4e4',
    borderRadius: 4,
    background: '#fbfbfb',
  },
  recipientHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  recipientBadge: {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    background: '#fef3f2',
    color: '#b42318',
    border: '1px solid #fecdca',
    whiteSpace: 'nowrap' as const,
  },
  preview: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    background: '#f8f8f8',
    border: '1px solid #e4e4e4',
    borderRadius: 4,
  },
  variableChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  chip: {
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    color: '#333',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 12,
    cursor: 'pointer',
  },
  muted: {
    margin: 0,
    fontSize: 12,
    color: '#666',
  },
  // Per-result severity. The four states are visually DISTINCT so a success, a
  // definite failure, a warning and a neutral/pending row never look alike.
  badgeSuccess: {
    background: '#ecfdf3',
    color: '#027a48',
    border: '1px solid #abefc6',
  },
  badgeError: {
    background: '#fef3f2',
    color: '#b42318',
    border: '1px solid #fecdca',
  },
  badgeWarning: {
    background: '#fffaeb',
    color: '#93370d',
    border: '1px solid #fedf89',
  },
  badgeNeutral: {
    background: '#f2f4f7',
    color: '#475467',
    border: '1px solid #d0d5dd',
  },
};

// Numbers are a technical identifier: keep them left-to-right even inside an
// RTL form, matching how the CRM renders phone values elsewhere.
export const phoneValueStyle = {
  direction: 'ltr' as const,
  unicodeBidi: 'plaintext' as const,
};
