import {
  buildCreateQuotationCustomerLinkMutation,
  buildQuotationCustomerLinkByHashQuery,
  buildQuotationCustomerViewQuery,
  buildQuotationForCustomerLinkQuery,
  buildRevokeQuotationCustomerLinkMutation,
} from 'src/data/quotation-queries';
import {
  buildCustomerQuotationView,
  type CustomerQuotationView,
} from 'src/domain/quotation/customer-view';
import {
  canIssueCustomerLinkForStatus,
  computeCustomerLinkExpiry,
  evaluateCustomerLinkAccess,
  hashCustomerLinkToken,
  mintCustomerLinkToken,
} from 'src/domain/quotation/customer-link-token';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { buildExportIssuedRevisionQuery } from 'src/data/quotation-export-queries';
import { decodeRevisionLine, hashQuotationRevision, validateRevisionFinancialFacts, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import { formatMicrosExact } from 'src/domain/money/micros';

export type CustomerLinkDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
  now?: () => Date;
  apiBaseUrl?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readNullableString = (value: unknown): string | null => {
  const text = readString(value);

  return text === '' ? null : text;
};

const readEdges = (
  payload: Record<string, unknown>,
  connectionName: string,
): Array<Record<string, unknown>> => {
  const connection = asRecord(payload[connectionName]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  const nodes: Array<Record<string, unknown>> = [];

  for (const edge of edges) {
    const record = asRecord(edge);
    const node = asRecord(record?.node);

    if (node !== null) {
      nodes.push(node);
    }
  }

  return nodes;
};

const parseInstant = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const buildPublicViewUrl = ({
  apiBaseUrl,
  rawToken,
}: {
  apiBaseUrl: string;
  rawToken: string;
}): string => {
  const configured = apiBaseUrl.replace(/\/$/, '');
  // Inside the Dev container, SERVER_URL is the process listen address. The
  // published Dev port is 3002; other deployments keep their configured host.
  const base = configured.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost):3000$/,
    '$1localhost:3002',
  );

  return `${base}/s/quotation/customer-view?token=${encodeURIComponent(rawToken)}`;
};

const readIssuedSeal = async (quotationId: string, dependencies: CustomerLinkDependencies) => {
  const payload = await dependencies.execute(buildExportIssuedRevisionQuery(quotationId));
  const connection = asRecord(payload.quotationRevisions);
  const rows = readEdges(payload, 'quotationRevisions');
  if (asRecord(connection?.pageInfo)?.hasNextPage !== false || rows.length !== 1 ||
      !Array.isArray(connection?.edges) || connection.edges.length !== 1) return null;
  const row = rows[0];
  const snapshot = asRecord(row.snapshotJson) as QuotationRevisionSnapshot | null;
  const hash = readString(row.snapshotHash);
  if (!snapshot || snapshot.quotationId !== quotationId || snapshot.currencyCode !== 'IRR' ||
    !hash || hashQuotationRevision(snapshot) !== hash ||
    !parseInstant(snapshot.issuedAt) || !validateRevisionFinancialFacts(snapshot).ok ||
    (snapshot.schemaVersion === 2 && (snapshot.revisionNumber !== row.version ||
      !snapshot.customerSnapshot || snapshot.customerSnapshot.id !== snapshot.customerRef ||
      typeof snapshot.customerSnapshot.name !== 'string' || !snapshot.customerSnapshot.name.trim()))) return null;
  return { snapshot, hash };
};

export type CreatedCustomerLink = {
  linkId: string;
  quotationId: string;
  expiresAt: string;
  rawToken: string;
  viewUrl: string;
};

export const createCustomerLink = async (
  {
    quotationId,
    ttlHours,
  }: {
    quotationId: string;
    ttlHours?: number;
  },
  dependencies: CustomerLinkDependencies,
): Promise<Result<CreatedCustomerLink>> => {
  const id = quotationId.trim();

  if (id === '') {
    return refused('QUOTATION_ID_REQUIRED', 'quotationId is required');
  }

  const now = dependencies.now?.() ?? new Date();
  const expiry = computeCustomerLinkExpiry({ now, ttlHours });

  if (!expiry.ok) {
    return expiry;
  }

  const quotationPayload = await dependencies.execute(
    buildQuotationForCustomerLinkQuery(id),
  );
  const quotation = asRecord(
    readEdges(quotationPayload, 'quotations')[0] ?? null,
  );

  if (quotation === null) {
    return refused('QUOTATION_NOT_FOUND', 'quotation was not found');
  }

  const status = readString(quotation.status);

  if (!canIssueCustomerLinkForStatus(status)) {
    return refused(
      'CUSTOMER_LINK_STATUS_FORBIDDEN',
      'customer links can only be issued for ready/sent/decided quotations',
    );
  }

  const seal = await readIssuedSeal(id, dependencies);
  if (!seal || seal.snapshot.schemaVersion !== 2 || Date.parse(seal.snapshot.issuedAt) > now.getTime()) {
    return refused('REVISION_MISMATCH', 'a valid identified issued revision is required for a new link');
  }
  const token = mintCustomerLinkToken();
  const issuedAtIso = now.toISOString();
  const expiresAtIso = expiry.value.toISOString();
  const numberLabel = readNullableString(quotation.quotationNumber) ?? id.slice(0, 8);

  const createdPayload = await dependencies.execute(
    buildCreateQuotationCustomerLinkMutation({
      name: `لینک مشتری ${numberLabel}`,
      tokenHash: token.tokenHash,
      revisionHash: seal.hash,
      expiresAt: expiresAtIso,
      issuedAt: issuedAtIso,
      quotationId: id,
    }),
  );

  const created = asRecord(createdPayload.createQuotationCustomerLink);

  if (created === null || readString(created.id) === '' || created.revisionHash !== seal.hash) {
    return refused('CUSTOMER_LINK_CREATE_FAILED', 'could not create link row');
  }

  const apiBaseUrl =
    dependencies.apiBaseUrl ??
    (typeof process.env.TWENTY_API_URL === 'string'
      ? process.env.TWENTY_API_URL
      : '');

  if (apiBaseUrl.trim() === '') {
    return refused('API_URL_MISSING', 'TWENTY_API_URL is required to build the link');
  }

  return accepted({
    linkId: readString(created.id),
    quotationId: id,
    expiresAt: expiresAtIso,
    rawToken: token.rawToken,
    viewUrl: buildPublicViewUrl({
      apiBaseUrl,
      rawToken: token.rawToken,
    }),
  });
};

export const revokeCustomerLink = async (
  { linkId }: { linkId: string },
  dependencies: CustomerLinkDependencies,
): Promise<Result<{ linkId: string; revokedAt: string }>> => {
  const id = linkId.trim();

  if (id === '') {
    return refused('LINK_ID_REQUIRED', 'linkId is required');
  }

  const now = dependencies.now?.() ?? new Date();
  const revokedAt = now.toISOString();
  const payload = await dependencies.execute(
    buildRevokeQuotationCustomerLinkMutation({
      linkId: id,
      revokedAt,
    }),
  );
  const updated = asRecord(payload.updateQuotationCustomerLink);

  if (updated === null || readString(updated.id) === '') {
    return refused('CUSTOMER_LINK_REVOKE_FAILED', 'could not revoke link');
  }

  return accepted({ linkId: id, revokedAt });
};

export type ResolvedCustomerView =
  | { kind: 'OK'; view: CustomerQuotationView }
  | { kind: 'INVALID_TOKEN' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'REVOKED' }
  | { kind: 'EXPIRED' }
  | { kind: 'FORBIDDEN_STATUS' }
  | { kind: 'BUILD_FAILED'; detail: string };

export const resolveCustomerQuotationView = async (
  { rawToken }: { rawToken: string },
  dependencies: CustomerLinkDependencies,
): Promise<ResolvedCustomerView> => {
  const token = rawToken.trim();

  if (token === '') {
    return { kind: 'INVALID_TOKEN' };
  }

  const tokenHash = hashCustomerLinkToken(token);
  const linkPayload = await dependencies.execute(
    buildQuotationCustomerLinkByHashQuery(tokenHash),
  );
  const link = asRecord(
    readEdges(linkPayload, 'quotationCustomerLinks')[0] ?? null,
  );

  if (link === null) {
    return { kind: 'NOT_FOUND' };
  }

  const now = dependencies.now?.() ?? new Date();
  const access = evaluateCustomerLinkAccess({
    now,
    expiresAt: parseInstant(link.expiresAt),
    revokedAt: parseInstant(link.revokedAt),
  });

  if (access.kind === 'REVOKED') {
    return { kind: 'REVOKED' };
  }

  if (access.kind === 'EXPIRED' || access.kind === 'MISSING') {
    return { kind: 'EXPIRED' };
  }

  const quotationId =
    readString(link.quotationId) ||
    readString(asRecord(link.quotation)?.id);

  if (quotationId === '') {
    return { kind: 'NOT_FOUND' };
  }

  const viewPayload = await dependencies.execute(
    buildQuotationCustomerViewQuery(quotationId),
  );
  const quotation = asRecord(viewPayload.quotation);

  if (quotation === null) {
    return { kind: 'NOT_FOUND' };
  }

  const status = readString(quotation.status);

  if (!canIssueCustomerLinkForStatus(status)) {
    return { kind: 'FORBIDDEN_STATUS' };
  }

  const seal = await readIssuedSeal(quotationId, dependencies);
  const issued = parseInstant(link.issuedAt);
  // Old links predate the explicit revision pin. Do not let them open a newer seal.
  // Unpinned links to V2 are not accepted: V2 issuance always requires an explicit pin.
  if (!seal || !issued || Date.parse(seal.snapshot.issuedAt) > issued.getTime() ||
    (readString(link.revisionHash) ? link.revisionHash !== seal.hash : seal.snapshot.schemaVersion === 2)) {
    return { kind: 'BUILD_FAILED', detail: 'customer link does not identify the current issued revision' };
  }
  const snapshot = seal.snapshot;
  let lineDiscount = 0n;
  let documentDiscount = 0n;
  for (const line of snapshot.lines) {
    const decoded = decodeRevisionLine(line);
    if (!decoded.ok) return { kind: 'BUILD_FAILED', detail: 'invalid sealed line' };
    lineDiscount += decoded.value.lineDiscount;
    documentDiscount += decoded.value.documentDiscount;
  }
  const exact = (value: string | undefined) => formatMicrosExact(BigInt(value ?? '0'));
  const viewResult = buildCustomerQuotationView({
    quotation: {
      id: quotationId, name: snapshot.documentTitle ?? 'پیش‌فاکتور',
      quotationNumber: snapshot.quotationNumber, status,
      paymentTerms: snapshot.paymentTerms, currencyCode: snapshot.currencyCode,
      grossExact: exact(snapshot.totals.grossMicros),
      lineDiscountExact: formatMicrosExact(lineDiscount),
      documentDiscountExact: formatMicrosExact(documentDiscount),
      taxExact: exact(snapshot.totals.taxMicros),
      roundingExact: exact(snapshot.totals.roundingMicros),
      totalExact: exact(snapshot.totals.totalMicros),
      person: null,
      company: snapshot.customerSnapshot ? { name: snapshot.customerSnapshot.name } : null,
    },
    lines: snapshot.lines.map(line => ({
      name: line.name ?? line.description, kind: line.kind ?? null, unit: line.unit,
      quantityExact: exact(line.quantityScaled), unitPriceExact: exact(line.unitPriceMicros),
      totalExact: exact(line.totalMicros),
    })),
  });
  if (!viewResult.ok) return { kind: 'BUILD_FAILED', detail: viewResult.refusal.detail };
  return { kind: 'OK', view: {
    ...viewResult.value,
    // Public projection only: do not include national IDs, contacts, CRM IDs or the raw seal.
    ...(snapshot.schemaVersion === 2 ? {} : { issuedHint: 'نسخه قدیمی: مشخصات مشتری ثبت نشده است.' }),
  } };
};
