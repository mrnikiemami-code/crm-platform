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

  const token = mintCustomerLinkToken();
  const issuedAtIso = now.toISOString();
  const expiresAtIso = expiry.value.toISOString();
  const numberLabel = readNullableString(quotation.quotationNumber) ?? id.slice(0, 8);

  const createdPayload = await dependencies.execute(
    buildCreateQuotationCustomerLinkMutation({
      name: `لینک مشتری ${numberLabel}`,
      tokenHash: token.tokenHash,
      expiresAt: expiresAtIso,
      issuedAt: issuedAtIso,
      quotationId: id,
    }),
  );

  const created = asRecord(createdPayload.createQuotationCustomerLink);

  if (created === null || readString(created.id) === '') {
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

  const lineNodes = readEdges(viewPayload, 'quotationLines');
  const person = asRecord(quotation.person);
  const personName = asRecord(person?.name);
  const company = asRecord(quotation.company);

  const viewResult = buildCustomerQuotationView({
    quotation: {
      id: quotationId,
      name: readNullableString(quotation.name),
      quotationNumber: readNullableString(quotation.quotationNumber),
      status,
      paymentTerms: readNullableString(quotation.paymentTerms),
      currencyCode: readNullableString(quotation.currencyCode),
      grossExact: readNullableString(quotation.grossExact),
      lineDiscountExact: readNullableString(quotation.lineDiscountExact),
      documentDiscountExact: readNullableString(quotation.documentDiscountExact),
      taxExact: readNullableString(quotation.taxExact),
      roundingExact: readNullableString(quotation.roundingExact),
      totalExact: readNullableString(quotation.totalExact),
      person:
        person === null
          ? null
          : {
              name:
                personName === null
                  ? {
                      firstName: readNullableString(person.nameFirstName),
                      lastName: readNullableString(person.nameLastName),
                    }
                  : {
                      firstName: readNullableString(personName.firstName),
                      lastName: readNullableString(personName.lastName),
                    },
            },
      company:
        company === null
          ? null
          : { name: readNullableString(company.name) },
    },
    lines: lineNodes.map((line) => ({
      name: readNullableString(line.name),
      kind: readNullableString(line.kind),
      unit: readNullableString(line.unit),
      quantityExact: readNullableString(line.quantityExact),
      unitPriceExact: readNullableString(line.unitPriceExact),
      totalExact: readNullableString(line.totalExact),
    })),
  });

  if (!viewResult.ok) {
    return { kind: 'BUILD_FAILED', detail: viewResult.refusal.detail };
  }

  return { kind: 'OK', view: viewResult.value };
};
