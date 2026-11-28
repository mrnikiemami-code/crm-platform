import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { QuotationQueryValidationException } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationRevisionService } from 'src/modules/quotation/services/quotation-revision.service';

type InsertedRevision = {
  name: string;
  version: number;
  status: string;
  snapshotHash: string;
  totalExact: string;
  issuedBy: string | null;
  quotationId: string;
  snapshotJson: { totals: { totalMicros: string } };
};

const header = {
  id: 'q-1',
  version: 3,
  quotationNumber: 'QT-1405-000031',
  currencyCode: 'IRR',
  taxPolicy: 'VAT_9',
  paymentTerms: '۳۰ روز',
  grossExact: '1000.000000',
  lineDiscountExact: '0.000000',
  documentDiscountExact: '0.000000',
  netExact: '1000.000000',
  taxExact: '90.000000',
  roundingExact: '0.000000',
  totalExact: '1090.000000',
  personId: null,
  companyId: 'c-1',
};

const lines = [
  {
    id: 'l-1',
    description: 'خدمت',
    name: 'خدمت',
    unit: 'ساعت',
    quantityExact: '1.000000',
    unitPriceExact: '1000.000000',
    grossExact: '1000.000000',
    discountExact: '0.000000',
    documentDiscountExact: '0.000000',
    taxExact: '90.000000',
    totalExact: '1090.000000',
  },
];

const buildScope = ({
  existingRevisions = [] as { id: string; version: number; status: string }[],
  headerRow = header as typeof header | null,
  lineRows = lines,
} = {}) => {
  const inserted: InsertedRevision[] = [];

  const revisionRepository = {
    find: jest.fn().mockResolvedValue(existingRevisions),
    insert: jest.fn(async (row: InsertedRevision) => {
      inserted.push(row);

      return { identifiers: [{ id: 'rev-1' }] };
    }),
  };
  const quotationRepository = {
    findOne: jest.fn().mockResolvedValue(headerRow),
  };
  const lineRepository = { find: jest.fn().mockResolvedValue(lineRows) };
  const partyRepository = { findOne: jest.fn().mockResolvedValue({ id: 'c-1', name: 'شرکت نمونه' }) };
  const catalogRepository = { find: jest.fn().mockResolvedValue([{ id: 'item-1', sku: 'SKU1', accountingCode: '100' }]) };

  const scope = {
    getRepository: jest.fn((name: string) => {
      if (name === 'quotationRevision') {
        return revisionRepository;
      }

      if (name === 'quotation') {
        return quotationRepository;
      }

      if (name === 'quotationLine') {
        return lineRepository;
      }

      if (name === 'company') return partyRepository;
      if (name === 'catalogItem') return catalogRepository;
      throw new Error(`unexpected repository ${name}`);
    }),
  } as unknown as WorkspaceTransactionScope;

  return { scope, inserted, revisionRepository, lineRepository };
};

const seal = ({
  scope,
  issuedBy = 'member-1',
}: {
  scope: WorkspaceTransactionScope;
  issuedBy?: string | null;
}) =>
  new QuotationRevisionService().sealIfMissing({
    transactionScope: scope,
    quotationId: 'q-1',
    issuedBy,
    issuedAt: new Date('2026-11-21T08:00:00.000Z'),
  });

describe('QuotationRevisionService', () => {
  it('seals the approved content with its hash and the post-update version', async () => {
    const { scope, inserted } = buildScope();

    const sealed = await seal({ scope });

    expect(sealed).toEqual({
      revisionId: 'rev-1',
      version: 1,
      snapshotHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      name: 'QT-1405-000031 v1',
      version: 1,
      status: 'ISSUED',
      totalExact: '1090.000000',
      issuedBy: 'member-1',
      quotationId: 'q-1',
    });
    expect(inserted[0].snapshotJson.totals.totalMicros).toBe('1090000000');
    expect(inserted[0].snapshotJson).toMatchObject({
      schemaVersion: 2, revisionNumber: 1, version: 3,
      customerSnapshot: { id: 'c-1', kind: 'COMPANY', name: 'شرکت نمونه' },
      lines: [{ grossMicros: '1000000000', documentDiscountMicros: '0' }],
    });
  });

  it('never creates a second identity for the same approved content', async () => {
    const { scope, revisionRepository } = buildScope({
      existingRevisions: [{ id: 'rev-old', version: 1, status: 'ISSUED' }],
    });

    await expect(seal({ scope })).resolves.toBeNull();
    expect(revisionRepository.insert).not.toHaveBeenCalled();
    expect(revisionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quotationId: 'q-1' } }),
    );
  });

  it('numbers the next revision above the highest stored one', async () => {
    const { scope, inserted } = buildScope({
      existingRevisions: [{ id: 'rev-old', version: 2, status: 'SUPERSEDED' }],
    });

    const sealed = await seal({ scope });

    expect(sealed?.version).toBe(3);
    expect(inserted[0].name).toBe('QT-1405-000031 v3');
  });

  it('reads every line column the snapshot fingerprints', async () => {
    // A mock repository ignores `select`, so a column omitted here would only fail
    // against a real database — as AMOUNT_NOT_A_DECIMAL on the first approval.
    const { scope, lineRepository } = buildScope();

    await seal({ scope });

    expect(lineRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          description: true,
          name: true,
          kind: true,
          itemId: true,
          taxPolicyRecordId: true,
          taxAccountingCode: true,
          unit: true,
          quantityExact: true,
          unitPriceExact: true,
          grossExact: true,
          discountExact: true,
          documentDiscountExact: true,
          taxExact: true,
          totalExact: true,
          // WS3 seals these three columns as well; dropping them loses the tax split.
          taxPolicy: true,
          taxRateBasisPoints: true,
          dutyRateBasisPoints: true,
        },
      }),
    );
  });

  it('refuses to seal numbers that do not add up', async () => {
    const { scope, inserted } = buildScope({
      headerRow: { ...header, totalExact: '1091.000000' },
    });

    await expect(seal({ scope })).rejects.toBeInstanceOf(
      QuotationQueryValidationException,
    );
    expect(inserted).toHaveLength(0);
  });

  it('refuses a quotation with no lines instead of sealing an empty document', async () => {
    const { scope, inserted } = buildScope({ lineRows: [] });

    await expect(seal({ scope })).rejects.toBeInstanceOf(
      QuotationQueryValidationException,
    );
    expect(inserted).toHaveLength(0);
  });

  it('refuses when the quotation row disappeared mid-transaction', async () => {
    const { scope, inserted } = buildScope({ headerRow: null });

    await expect(seal({ scope })).rejects.toBeInstanceOf(
      QuotationQueryValidationException,
    );
    expect(inserted).toHaveLength(0);
  });

  it('seals without an actor when the caller is not a workspace member', async () => {
    const { scope, inserted } = buildScope();

    await seal({ scope, issuedBy: null });

    expect(inserted[0].issuedBy).toBeNull();
  });
});
