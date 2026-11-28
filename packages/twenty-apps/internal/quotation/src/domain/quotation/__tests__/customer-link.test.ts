import { describe, expect, it } from 'vitest';

import {
  canIssueCustomerLinkForStatus,
  computeCustomerLinkExpiry,
  customerLinkTokenHashesEqual,
  evaluateCustomerLinkAccess,
  hashCustomerLinkToken,
  mintCustomerLinkToken,
} from 'src/domain/quotation/customer-link-token';
import { hashQuotationRevision, type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';
import { buildCustomerQuotationView } from 'src/domain/quotation/customer-view';
import { renderCustomerQuotationHtml } from 'src/utils/render-customer-quotation-html';
import {
  createCustomerLink,
  resolveCustomerQuotationView,
  revokeCustomerLink,
} from 'src/services/customer-link.service';

const NOW = new Date('2026-11-19T10:00:00.000Z');

const sampleQuotation = {
  id: 'q-1',
  name: 'پیش‌فاکتور نمونه',
  quotationNumber: 'QF-100',
  status: 'SENT',
  paymentTerms: 'نقد',
  currencyCode: 'IRR',
  grossExact: '1000000.000000',
  lineDiscountExact: '0.000000',
  documentDiscountExact: '0.000000',
  taxExact: '90000.000000',
  roundingExact: '0.000000',
  totalExact: '1090000.000000',
  person: { name: { firstName: 'علی', lastName: 'رضایی' } },
  company: null,
};

const sampleLines = [
  {
    name: 'کالای الف',
    kind: 'PRODUCT',
    unit: 'عدد',
    quantityExact: '1.000000',
    unitPriceExact: '1000000.000000',
    totalExact: '1090000.000000',
  },
];

const sampleSeal: QuotationRevisionSnapshot = {
  schemaVersion: 2, revisionNumber: 1, version: 4, quotationId: 'q-1',
  quotationNumber: 'QF-100', documentTitle: 'پیش‌فاکتور نمونه', currencyCode: 'IRR',
  customerRef: 'p-1', customerSnapshot: {
    id: 'p-1', kind: 'PERSON', name: 'علی رضایی', nationalCode: null, economicCode: null,
    registrationNumber: null, accountingCode: null, customerCode: null, mobile: null,
    phone: null, secondPhone: null, fax: null, email: null,
    address: { street1: null, street2: null, city: null, state: null, postcode: null, country: null },
  },
  taxPolicy: 'VAT_9', taxRateBasisPoints: '900', paymentTerms: 'نقد',
  issuedAt: '2026-11-19T09:00:00.000Z',
  lines: [{ lineId: 'line-1', itemId: 'item-1', name: 'کالای الف', kind: 'PRODUCT', unit: 'عدد',
    description: 'کالای الف', quantityScaled: '1000000', unitPriceMicros: '1000000000000',
    grossMicros: '1000000000000', discountMicros: '0', documentDiscountMicros: '0',
    taxMicros: '90000000000', totalMicros: '1090000000000' }],
  totals: { grossMicros: '1000000000000', discountMicros: '0', lineDiscountMicros: '0',
    documentDiscountMicros: '0', netMicros: '1000000000000', taxMicros: '90000000000',
    totalMicros: '1090000000000' },
};

describe('customer link token', () => {
  it('mints a random token and stores only its sha256 hex', () => {
    const first = mintCustomerLinkToken();
    const second = mintCustomerLinkToken();

    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.rawToken.length).toBeGreaterThan(32);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).toBe(hashCustomerLinkToken(first.rawToken));
    expect(first.tokenHash).not.toContain(first.rawToken);
    expect(
      customerLinkTokenHashesEqual(first.tokenHash, hashCustomerLinkToken(first.rawToken)),
    ).toBe(true);
  });

  it('expires after ttl and treats revoke as independent of expiry', () => {
    const expiry = computeCustomerLinkExpiry({ now: NOW, ttlHours: 24 });
    expect(expiry.ok).toBe(true);
    if (!expiry.ok) {
      return;
    }

    expect(
      evaluateCustomerLinkAccess({
        now: NOW,
        expiresAt: expiry.value,
        revokedAt: null,
      }).kind,
    ).toBe('ACTIVE');

    expect(
      evaluateCustomerLinkAccess({
        now: new Date(expiry.value.getTime()),
        expiresAt: expiry.value,
        revokedAt: null,
      }).kind,
    ).toBe('EXPIRED');

    expect(
      evaluateCustomerLinkAccess({
        now: NOW,
        expiresAt: expiry.value,
        revokedAt: NOW,
      }).kind,
    ).toBe('REVOKED');
  });

  it('refuses links for draft quotations', () => {
    expect(canIssueCustomerLinkForStatus('DRAFT')).toBe(false);
    expect(canIssueCustomerLinkForStatus('SENT')).toBe(true);
    expect(computeCustomerLinkExpiry({ now: NOW, ttlHours: 0 }).ok).toBe(false);
  });
});

describe('customer quotation view', () => {
  it('exposes only the customer-facing quotation and escapes html', () => {
    const view = buildCustomerQuotationView({
      quotation: sampleQuotation,
      lines: sampleLines,
    });

    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }

    const serialized = JSON.stringify(view.value);
    expect(serialized).not.toMatch(/apiKey|tokenHash|opportunity|workspaceMember/i);
    expect(view.value.customerLabel).toBe('علی رضایی');
    expect(view.value.lines).toHaveLength(1);

    const html = renderCustomerQuotationHtml({
      ...view.value,
      title: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('QF-100');
  });

  it('refuses a cancelled quotation', () => {
    const view = buildCustomerQuotationView({
      quotation: { ...sampleQuotation, status: 'CANCELLED' },
      lines: sampleLines,
    });

    expect(view.ok).toBe(false);
  });
});

describe('customer link service', () => {
  it('creates a hashed link and resolves only that quotation', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    let seal = sampleSeal;
    const execute = async (query: string) => {
      if (query.includes('QuotationForCustomerLink')) {
        return {
          quotations: {
            edges: [{ node: { id: 'q-1', status: 'SENT', quotationNumber: 'QF-100' } }],
          },
        };
      }

      if (query.includes('QuotationRevisionForAccounting')) {
        return { quotationRevisions: { edges: [{ node: { id: 'r-1', version: 1, snapshotJson: seal, snapshotHash: hashQuotationRevision(seal) } }], pageInfo: { hasNextPage: false } } };
      }

      if (query.includes('CreateQuotationCustomerLink')) {
        const hash = query.match(/tokenHash: "([0-9a-f]+)"/)?.[1] ?? '';
        rows.set(hash, {
          id: 'link-1',
          tokenHash: hash,
          revisionHash: hashQuotationRevision(seal),
          issuedAt: NOW.toISOString(),
          expiresAt: '2026-11-26T10:00:00.000Z',
          revokedAt: null,
          quotationId: 'q-1',
        });
        return { createQuotationCustomerLink: { id: 'link-1', revisionHash: hashQuotationRevision(seal) } };
      }

      if (query.includes('QuotationCustomerLinkByHash')) {
        const hash = query.match(/tokenHash: \{ eq: "([0-9a-f]+)"/)?.[1] ?? '';
        const row = rows.get(hash);
        return {
          quotationCustomerLinks: {
            edges: row ? [{ node: row }] : [],
          },
        };
      }

      if (query.includes('QuotationCustomerView')) {
        expect(query).toContain('q-1');
        expect(query).not.toContain('person {\\n        id');
        return {
          quotation: { ...sampleQuotation, name: 'changed', totalExact: '1.000000' },
          quotationLines: { edges: [] },
        };
      }

      throw new Error(`unexpected query ${query.slice(0, 40)}`);
    };

    const created = await createCustomerLink(
      { quotationId: 'q-1', ttlHours: 168 },
      { execute, now: () => NOW, apiBaseUrl: 'http://localhost:3002' },
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    expect(created.value.viewUrl).toContain(encodeURIComponent(created.value.rawToken));
    const stored = [...rows.values()][0];
    expect(stored?.tokenHash).not.toBe(created.value.rawToken);
    expect(JSON.stringify(stored)).not.toContain(created.value.rawToken);

    const resolved = await resolveCustomerQuotationView(
      { rawToken: created.value.rawToken },
      { execute, now: () => NOW },
    );
    expect(resolved.kind).toBe('OK');
    if (resolved.kind === 'OK') {
      expect(resolved.view.title).toBe(sampleSeal.documentTitle);
      expect(resolved.view.customerLabel).toBe('علی رضایی');
      expect(resolved.view.lines).toHaveLength(1);
    }
    seal = { ...sampleSeal, documentTitle: 'new document' };
    expect((await resolveCustomerQuotationView({ rawToken: created.value.rawToken }, { execute, now: () => NOW })).kind).toBe('BUILD_FAILED');

    const other = await resolveCustomerQuotationView(
      { rawToken: mintCustomerLinkToken().rawToken },
      { execute, now: () => NOW },
    );
    expect(other.kind).toBe('NOT_FOUND');
  });

  it('rejects expired, revoked, and draft quotations', async () => {
    const hash = hashCustomerLinkToken('known-token');
    const row = {
      id: 'link-1',
      tokenHash: hash,
      expiresAt: '2026-11-19T09:00:00.000Z',
      revokedAt: null as string | null,
      quotationId: 'q-1',
    };

    const execute = async (query: string) => {
      if (query.includes('QuotationCustomerLinkByHash')) {
        return { quotationCustomerLinks: { edges: [{ node: row }] } };
      }

      if (query.includes('QuotationForCustomerLink')) {
        return {
          quotations: { edges: [{ node: { id: 'q-1', status: 'DRAFT' } }] },
        };
      }

      if (query.includes('RevokeQuotationCustomerLink')) {
        row.revokedAt = '2026-11-19T10:00:00.000Z';
        return { updateQuotationCustomerLink: { id: 'link-1' } };
      }

      return {
        quotation: { ...sampleQuotation, status: 'SENT' },
        quotationLines: { edges: [] },
      };
    };

    const expired = await resolveCustomerQuotationView(
      { rawToken: 'known-token' },
      { execute, now: () => NOW },
    );
    expect(expired.kind).toBe('EXPIRED');

    row.expiresAt = '2026-11-26T10:00:00.000Z';
    const revoked = await revokeCustomerLink(
      { linkId: 'link-1' },
      { execute, now: () => NOW },
    );
    expect(revoked.ok).toBe(true);

    const afterRevoke = await resolveCustomerQuotationView(
      { rawToken: 'known-token' },
      { execute, now: () => NOW },
    );
    expect(afterRevoke.kind).toBe('REVOKED');

    const draft = await createCustomerLink(
      { quotationId: 'q-1' },
      { execute, now: () => NOW, apiBaseUrl: 'http://localhost:3002' },
    );
    expect(draft.ok).toBe(false);
    if (!draft.ok) {
      expect(draft.refusal.code).toBe('CUSTOMER_LINK_STATUS_FORBIDDEN');
    }
  });
});
