import { parseQuotationDraftSaveRequest } from 'src/modules/quotation/utils/parse-quotation-draft-save-request.util';
import { QUOTATION_DRAFT_MAX_LINES } from 'src/modules/quotation/types/quotation-draft-save.type';

const rawLine = (overrides: Record<string, unknown> = {}) => ({
  name: 'کالا',
  kind: 'PRODUCT',
  description: null,
  unit: 'عدد',
  quantityExact: '1.000000',
  unitPriceExact: '1000.000000',
  grossExact: '1000.000000',
  discountExact: '0.000000',
  discountKind: 'NONE',
  discountInputExact: '0.000000',
  documentDiscountExact: '0.000000',
  taxExact: '90.000000',
  totalExact: '1090.000000',
  itemId: null,
  ...overrides,
});

const rawBody = (overrides: Record<string, unknown> = {}) => ({
  quotationId: null,
  expectedVersion: null,
  header: {
    name: 'پیش‌فاکتور تست',
    customerType: 'COMPANY',
    personId: null,
    companyId: 'company-1',
    currencyCode: 'irr',
    taxPolicy: 'IR_VAT_9',
    paymentTerms: null,
    documentDiscountKind: 'NONE',
    documentDiscountInputExact: '0.000000',
    grossExact: '1000.000000',
    lineDiscountExact: '0.000000',
    documentDiscountExact: '0.000000',
    netExact: '1000.000000',
    taxExact: '90.000000',
    roundingExact: '0.000000',
    totalExact: '1090.000000',
  },
  lines: [rawLine()],
  ...overrides,
});

describe('parseQuotationDraftSaveRequest', () => {
  it('normalizes a complete company draft', () => {
    const parsed = parseQuotationDraftSaveRequest(rawBody());

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(parsed.value.quotationId).toBeNull();
    expect(parsed.value.expectedVersion).toBeNull();
    expect(parsed.value.header.currencyCode).toBe('IRR');
    expect(parsed.value.header.companyId).toBe('company-1');
    expect(parsed.value.lines).toHaveLength(1);
    expect(parsed.value.lines[0].unit).toBe('عدد');
  });

  it('keeps the id and version of an existing document', () => {
    const parsed = parseQuotationDraftSaveRequest(
      rawBody({ quotationId: 'q-1', expectedVersion: 4 }),
    );

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(parsed.value.quotationId).toBe('q-1');
    expect(parsed.value.expectedVersion).toBe(4);
  });

  it('refuses an edit that omits the expected version', () => {
    const body = rawBody({ quotationId: 'q-1' });

    delete (body as Record<string, unknown>).expectedVersion;

    expect(parseQuotationDraftSaveRequest(body)).toMatchObject({
      ok: false,
      code: 'QUOTATION_VERSION_REQUIRED',
    });
  });

  it('refuses an edit that sends a null expected version', () => {
    expect(
      parseQuotationDraftSaveRequest(
        rawBody({ quotationId: 'q-1', expectedVersion: null }),
      ),
    ).toMatchObject({ ok: false, code: 'QUOTATION_VERSION_REQUIRED' });
  });

  it('refuses a body that is not an object', () => {
    expect(parseQuotationDraftSaveRequest('{}')).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'request body is not an object',
    });
  });

  it('refuses a new document that claims a version', () => {
    expect(
      parseQuotationDraftSaveRequest(
        rawBody({ quotationId: null, expectedVersion: 3 }),
      ),
    ).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  });

  it('refuses a person quotation that also points at a company', () => {
    const parsed = parseQuotationDraftSaveRequest(
      rawBody({
        header: {
          ...rawBody().header,
          customerType: 'PERSON',
          personId: 'person-1',
          companyId: 'company-1',
        },
      }),
    );

    expect(parsed).toMatchObject({ ok: false, code: 'CUSTOMER_INVALID' });
  });

  it('refuses a company quotation with no company id', () => {
    const parsed = parseQuotationDraftSaveRequest(
      rawBody({
        header: { ...rawBody().header, companyId: null },
      }),
    );

    expect(parsed).toMatchObject({ ok: false, code: 'CUSTOMER_INVALID' });
  });

  it('refuses a document with no lines', () => {
    expect(parseQuotationDraftSaveRequest(rawBody({ lines: [] }))).toMatchObject(
      { ok: false, code: 'DOCUMENT_HAS_NO_LINES' },
    );
  });

  it('refuses more lines than a document may carry', () => {
    const lines = Array.from({ length: QUOTATION_DRAFT_MAX_LINES + 1 }, () =>
      rawLine(),
    );

    expect(parseQuotationDraftSaveRequest(rawBody({ lines }))).toMatchObject({
      ok: false,
      code: 'INVALID_INPUT',
    });
  });

  it('refuses an incomplete line', () => {
    expect(
      parseQuotationDraftSaveRequest(rawBody({ lines: [rawLine({ unit: '' })] })),
    ).toMatchObject({ ok: false, code: 'LINE_INVALID' });
  });

  it('refuses a line whose exact amount is not a string', () => {
    expect(
      parseQuotationDraftSaveRequest(
        rawBody({ lines: [rawLine({ totalExact: 1090 })] }),
      ),
    ).toMatchObject({ ok: false, code: 'LINE_INVALID' });
  });

  it('refuses an unknown discount kind instead of guessing', () => {
    expect(
      parseQuotationDraftSaveRequest(
        rawBody({ lines: [rawLine({ discountKind: 'FREE' })] }),
      ),
    ).toMatchObject({ ok: false, code: 'LINE_INVALID' });
  });

  it('refuses a version that is not a positive integer', () => {
    expect(
      parseQuotationDraftSaveRequest(
        rawBody({ quotationId: 'q-1', expectedVersion: 1.5 }),
      ),
    ).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  });
});
