// Server-side atomic draft save. The app route validates and computes money with
// the app's Money Domain; this client hands the finished plan to the one
// transactional endpoint that writes header and lines together.
//
// There is deliberately no fallback to per-record GraphQL writes: a fallback would
// silently restore the non-atomic behaviour this path exists to remove.

export type AtomicSaveLinePayload = {
  name: string;
  kind: 'PRODUCT' | 'SERVICE';
  description: string | null;
  unit: string;
  quantityExact: string;
  unitPriceExact: string;
  grossExact: string;
  discountExact: string;
  discountKind: 'NONE' | 'RATE' | 'AMOUNT';
  discountInputExact: string;
  documentDiscountExact: string;
  taxExact: string;
  totalExact: string;
  itemId: string | null;
  // Stable line order on the document (0-based). Server also derives index order.
  sortOrder: number;
  taxPolicy?: string | null;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
  currencyCode?: string | null;
};

export type AtomicSaveHeaderPayload = {
  name: string;
  customerType: 'PERSON' | 'COMPANY';
  personId: string | null;
  companyId: string | null;
  currencyCode: string;
  taxPolicy: string | null;
  // The rate the amounts were computed with, in basis points. Recorded so the
  // server can re-check the tax it is asked to store instead of trusting it.
  taxRateBasisPoints: string | null;
  // The duty component of the same policy. Kept apart from the tax rate so the
  // server can re-check each component instead of one combined figure.
  dutyRateBasisPoints: string | null;
  paymentTerms: string | null;
  documentDiscountKind: 'NONE' | 'RATE' | 'AMOUNT';
  documentDiscountInputExact: string;
  grossExact: string;
  lineDiscountExact: string;
  documentDiscountExact: string;
  netExact: string;
  taxExact: string;
  // The duty part of `taxExact`; tax = taxExact - dutyExact.
  dutyExact: string;
  roundingExact: string;
  totalExact: string;
  roundingRuleCode?: string | null;
  roundingRuleName?: string | null;
  roundingStepRials?: string | null;
  preRoundTotalExact?: string | null;
  roundingRuleRecordId?: string | null;
};

export type AtomicSaveRequest = {
  quotationId: string | null;
  expectedVersion: number | null;
  header: AtomicSaveHeaderPayload;
  lines: AtomicSaveLinePayload[];
};

export type AtomicSaveOutcome =
  | { kind: 'SAVED'; quotationId: string; version: number }
  | { kind: 'REJECTED'; code: string; message: string };

const REQUEST_DEADLINE_MS = 25_000;

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const resolveApiBaseUrl = (): string | null => {
  const baseUrl = process.env.TWENTY_API_URL;

  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return null;
  }

  const trimmed = baseUrl.trim().replace(/\/$/, '');

  // The intranet deployment is a different system; never write to it by accident.
  return trimmed.includes(':6080') ? null : trimmed;
};

export const saveDraftAtomically = async (
  request: AtomicSaveRequest,
): Promise<AtomicSaveOutcome> => {
  const baseUrl = resolveApiBaseUrl();
  const token =
    process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ??
    process.env.TWENTY_APP_ACCESS_TOKEN;

  if (baseUrl === null || !token) {
    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/rest/quotation/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'save-draft', ...request }),
      signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
    });
  } catch {
    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ارتباط با سرور برقرار نشد',
    };
  }

  const text = await response.text();
  let parsed: unknown = {};

  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  const envelope = readRecord(parsed) ?? {};

  if (!response.ok) {
    return {
      kind: 'REJECTED',
      code: response.status === 403 ? 'PERMISSION_DENIED' : 'PERSISTENCE_FAILED',
      message:
        readText(envelope.message) ||
        'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  if (envelope.success !== true) {
    return {
      kind: 'REJECTED',
      code: readText(envelope.code) || 'PERSISTENCE_FAILED',
      message: readText(envelope.message) || 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  const quotationId = readText(envelope.quotationId);
  const version =
    typeof envelope.version === 'number' ? envelope.version : null;

  if (quotationId === '' || version === null) {
    return {
      kind: 'REJECTED',
      code: 'PERSISTENCE_FAILED',
      message: 'ذخیره پیش‌فاکتور انجام نشد',
    };
  }

  return { kind: 'SAVED', quotationId, version };
};
