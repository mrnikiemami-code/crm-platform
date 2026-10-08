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

// Calls one of the app's own authenticated logic-function routes. The base URL
// and token come from the trusted execution context, never from user input.
export const callAppRoute = async (
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
) => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing');
  }

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
};

// Numbers are a technical identifier: keep them left-to-right even inside an
// RTL form, matching how the CRM renders phone values elsewhere.
export const phoneValueStyle = {
  direction: 'ltr' as const,
  unicodeBidi: 'plaintext' as const,
};
