import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationDraftPersistenceService } from 'src/modules/quotation/services/quotation-draft-persistence.service';

const authContext = {
  type: 'apiKey',
  workspace: { id: 'workspace-1' },
  apiKey: { id: 'api-key-1' },
} as unknown as WorkspaceAuthContext;

const rawLine = (overrides: Record<string, unknown> = {}) => ({
  name: 'کالا',
  kind: 'PRODUCT',
  description: null,
  unit: 'عدد',
  quantityExact: '1.000000',
  unitPriceExact: '1000000.000000',
  grossExact: '1000000.000000',
  discountExact: '0.000000',
  discountKind: 'NONE',
  discountInputExact: '0.000000',
  documentDiscountExact: '0.000000',
  taxExact: '90000.000000',
  totalExact: '1090000.000000',
  itemId: null,
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
  action: 'save-draft',
  quotationId: null,
  expectedVersion: null,
  header: {
    name: 'پیش‌فاکتور واحد',
    customerType: 'COMPANY',
    personId: null,
    companyId: 'company-1',
    currencyCode: 'IRR',
    taxPolicy: 'IR_VAT_9',
    taxRateBasisPoints: '900',
    paymentTerms: null,
    documentDiscountKind: 'NONE',
    documentDiscountInputExact: '0.000000',
    grossExact: '1000000.000000',
    lineDiscountExact: '0.000000',
    documentDiscountExact: '0.000000',
    netExact: '1000000.000000',
    taxExact: '90000.000000',
    roundingExact: '0.000000',
    totalExact: '1090000.000000',
  },
  lines: [rawLine()],
  ...overrides,
});

type Scope = {
  workspaceId: string;
  executeRawQuery: jest.Mock;
  getRepository: jest.Mock;
};

const buildScope = ({
  headerInsert,
  lineInsert,
  headerFindOne,
  headerUpdate,
  lineFind,
  companyFindOne,
  personFindOne,
  taxPolicyFindOne,
  quotationCurrencyFindOne,
}: {
  headerInsert?: jest.Mock;
  lineInsert?: jest.Mock;
  headerFindOne?: jest.Mock;
  headerUpdate?: jest.Mock;
  lineFind?: jest.Mock;
  companyFindOne?: jest.Mock;
  personFindOne?: jest.Mock;
  taxPolicyFindOne?: jest.Mock;
  quotationCurrencyFindOne?: jest.Mock;
} = {}): Scope => {
  const activeNinePercentPolicy = {
    id: 'tp-1',
    code: 'IR_VAT_9',
    rateBasisPoints: '900',
    dutyRateBasisPoints: '0',
    isActive: true,
    accountingCode: 'TAX-GL-9',
  };
  const irrCurrency = {
    id: 'cur-irr',
    code: 'IRR',
    accountingCode: 'CUR-IRR',
  };
  const repositories: Record<string, Record<string, jest.Mock>> = {
    quotation: {
      insert:
        headerInsert ?? jest.fn(async () => ({ identifiers: [{ id: 'q-1' }] })),
      findOne:
        headerFindOne ??
        jest.fn(async () => ({ id: 'q-1', status: 'DRAFT', version: 2 })),
      update: headerUpdate ?? jest.fn(async () => ({ affected: 1 })),
      find: jest.fn(async () => []),
    },
    quotationLine: {
      insert: lineInsert ?? jest.fn(async () => ({ identifiers: [] })),
      find: lineFind ?? jest.fn(async () => []),
      update: jest.fn(async () => ({ affected: 1 })),
      softDelete: jest.fn(async () => ({ affected: 1 })),
    },
    company: {
      findOne:
        companyFindOne ??
        jest.fn(async () => ({ id: 'company-1', name: 'شرکت آزمون' })),
    },
    person: {
      findOne: personFindOne ?? jest.fn(async () => null),
    },
    taxPolicy: {
      findOne: taxPolicyFindOne ?? jest.fn(async () => activeNinePercentPolicy),
    },
    quotationCurrency: {
      findOne:
        quotationCurrencyFindOne ?? jest.fn(async () => irrCurrency),
    },
  };

  return {
    workspaceId: 'workspace-1',
    executeRawQuery: jest.fn(async () => []),
    getRepository: jest.fn((name: string) => repositories[name]),
  };
};

const buildService = ({
  permissions,
  scope,
  transactionError,
}: {
  permissions: string[];
  scope: Scope;
  transactionError?: Error;
}) => {
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(async (callback: () => unknown) =>
      callback(),
    ),
    runInWorkspaceTransaction: jest.fn(
      async (work: (scope: Scope) => unknown) => {
        if (transactionError) {
          throw transactionError;
        }

        return work(scope);
      },
    ),
  };
  const permissionService = {
    resolveHeldPermissions: jest.fn(async () => permissions),
  };

  const service = new QuotationDraftPersistenceService(
    workspaceOrmManager as never,
    permissionService as never,
  );

  return { service, workspaceOrmManager, permissionService };
};

describe('QuotationDraftPersistenceService', () => {
  it('refuses client-supplied accounting snapshot fields before opening a transaction', async () => {
    const scope = buildScope();
    const { service, workspaceOrmManager } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: {
          ...body().header,
          taxAccountingCode: 'CLIENT-FORGED',
        },
      }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'ACCOUNTING_SNAPSHOT_CLIENT_FORBIDDEN',
    });
    expect(
      workspaceOrmManager.runInWorkspaceTransaction,
    ).not.toHaveBeenCalled();
  });

  it('refuses an actor without quotation.edit before opening a transaction', async () => {
    const scope = buildScope();
    const { service, workspaceOrmManager } = buildService({
      permissions: [],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'PERMISSION_MISSING',
    });
    expect(
      workspaceOrmManager.runInWorkspaceTransaction,
    ).not.toHaveBeenCalled();
    expect(scope.getRepository).not.toHaveBeenCalled();
  });

  it('fail-closes when the tax policy catalog cannot be read for accounting snapshot', async () => {
    const scope = buildScope({
      taxPolicyFindOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'tp-1',
          code: 'IR_VAT_9',
          rateBasisPoints: '900',
          dutyRateBasisPoints: '0',
          isActive: true,
          accountingCode: 'TAX-GL-9',
        })
        .mockRejectedValueOnce(new Error('tax table missing')),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'TAX_POLICY_UNAVAILABLE',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('fail-closes when the currency catalog cannot be read for accounting snapshot', async () => {
    const scope = buildScope({
      quotationCurrencyFindOne: jest.fn(async () => {
        throw new Error('currency catalog missing');
      }),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'CURRENCY_CATALOG_UNAVAILABLE',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('fail-closes when the selected currency row is missing from the catalog', async () => {
    const scope = buildScope({
      quotationCurrencyFindOne: jest.fn(async () => null),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'CURRENCY_REFERENCE_NOT_FOUND',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('allows an empty tax accountingCode when the resolved tax policy row exists', async () => {
    const scope = buildScope({
      taxPolicyFindOne: jest.fn(async () => ({
        id: 'tp-1',
        code: 'IR_VAT_9',
        rateBasisPoints: '900',
        dutyRateBasisPoints: '0',
        isActive: true,
        accountingCode: '',
      })),
      quotationCurrencyFindOne: jest.fn(async () => ({
        id: 'cur-irr',
        code: 'IRR',
        accountingCode: '',
      })),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({ kind: 'SAVED', quotationId: 'q-1' });
    expect(scope.getRepository('quotation').insert.mock.calls[0][0]).toMatchObject({
      taxPolicyRecordId: 'tp-1',
      taxAccountingCode: '',
      quotationCurrencyRecordId: 'cur-irr',
      currencyAccountingCode: '',
    });
  });

  it('writes the header and every line inside one transaction', async () => {
    const scope = buildScope();
    const { service, workspaceOrmManager } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'SAVED',
      quotationId: 'q-1',
      version: 1,
    });
    expect(workspaceOrmManager.runInWorkspaceTransaction).toHaveBeenCalledTimes(
      1,
    );
    // Fixed order Tax → Currency shared locks before any row repository work.
    expect(scope.executeRawQuery.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
      ['quotation-tax-policy:workspace-1'],
    ]);
    expect(scope.executeRawQuery.mock.calls[1]).toEqual([
      'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
      ['quotation-currency-catalog:workspace-1'],
    ]);
    expect(scope.executeRawQuery.mock.invocationCallOrder[1]).toBeLessThan(
      scope.getRepository.mock.invocationCallOrder[0],
    );

    const headerInsert = scope.getRepository('quotation').insert;

    expect(headerInsert).toHaveBeenCalledTimes(1);
    expect(headerInsert.mock.calls[0][0]).toMatchObject({
      name: 'پیش‌فاکتور واحد',
      status: 'DRAFT',
      version: 1,
      customerName: 'شرکت آزمون',
      totalExact: '1090000.000000',
      taxAccountingCode: 'TAX-GL-9',
      taxPolicyRecordId: 'tp-1',
      currencyAccountingCode: 'CUR-IRR',
      quotationCurrencyRecordId: 'cur-irr',
    });
    expect(headerInsert.mock.calls[0][0]).not.toHaveProperty('quotationNumber');

    const lineInsert = scope.getRepository('quotationLine').insert;

    expect(lineInsert).toHaveBeenCalledTimes(1);
    expect(lineInsert.mock.calls[0][0][0]).toMatchObject({
      quotationId: 'q-1',
      sortOrder: 0,
      totalExact: '1090000.000000',
    });
  });

  it('labels a person draft from the composite name the ORM returns', async () => {
    const personFindOne = jest.fn(async () => ({
      id: 'person-1',
      name: { firstName: 'فرید', lastName: 'رفیعی' },
    }));
    const scope = buildScope({ personFindOne });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: {
          ...body().header,
          customerType: 'PERSON',
          personId: 'person-1',
          companyId: null,
        },
      }),
    });

    expect(result).toMatchObject({ kind: 'SAVED' });

    const headerInsert = scope.getRepository('quotation').insert;

    expect(headerInsert.mock.calls[0][0]).toMatchObject({
      customerName: 'فرید رفیعی',
    });
  });

  it('refuses a person draft whose name is empty', async () => {
    const personFindOne = jest.fn(async () => ({
      id: 'person-1',
      name: { firstName: null, lastName: null },
    }));
    const scope = buildScope({ personFindOne });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: {
          ...body().header,
          customerType: 'PERSON',
          personId: 'person-1',
          companyId: null,
        },
      }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'CUSTOMER_NOT_FOUND',
    });
  });

  it('reports a failure instead of a partial save when a line write fails', async () => {
    const scope = buildScope({
      lineInsert: jest.fn(async () => {
        throw new Error('insert failed');
      }),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    await expect(
      service.saveDraft({ authContext, body: body() }),
    ).rejects.toThrow('insert failed');
  });

  it('claims the observed version and bumps it in one conditional update', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: 2 }),
    });

    expect(result).toMatchObject({ kind: 'SAVED', version: 3 });

    const headerUpdate = scope.getRepository('quotation').update;

    expect(headerUpdate).toHaveBeenCalledTimes(1);
    expect(headerUpdate.mock.calls[0][0]).toMatchObject({
      id: 'q-1',
      version: 2,
    });
    expect(headerUpdate.mock.calls[0][1]).toMatchObject({ version: 3 });
    expect(headerUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('refuses a save when the version moved on', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: 1 }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'QUOTATION_VERSION_CONFLICT',
    });
    expect(scope.getRepository('quotation').update).not.toHaveBeenCalled();
  });

  it('refuses an update that carries no version instead of skipping the claim', async () => {
    const scope = buildScope();
    const { service, workspaceOrmManager } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: null }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'QUOTATION_VERSION_REQUIRED',
    });
    expect(
      workspaceOrmManager.runInWorkspaceTransaction,
    ).not.toHaveBeenCalled();
    expect(scope.getRepository('quotation').update).not.toHaveBeenCalled();
    expect(scope.getRepository('quotationLine').insert).not.toHaveBeenCalled();
    expect(
      scope.getRepository('quotationLine').softDelete,
    ).not.toHaveBeenCalled();
  });

  it('refuses to write a document that is no longer a draft', async () => {
    const scope = buildScope({
      headerFindOne: jest.fn(async () => ({
        id: 'q-1',
        status: 'SENT',
        version: 4,
      })),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: 4 }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'QUOTATION_IMMUTABLE',
    });
    expect(scope.getRepository('quotation').update).not.toHaveBeenCalled();
    expect(scope.getRepository('quotationLine').insert).not.toHaveBeenCalled();
  });

  it('refuses a fabricated customer before touching the header', async () => {
    const scope = buildScope({
      companyFindOne: jest.fn(async () => null),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: { ...body().header, companyId: 'company-missing' },
      }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'CUSTOMER_NOT_FOUND',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
    expect(scope.getRepository('quotationLine').insert).not.toHaveBeenCalled();
  });

  it('refuses a rate that no policy of this workspace carries', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    // Amounts are internally consistent at 12%, so only the policy authority can
    // catch this: the rate was never approved in the settings.
    const result = await service.saveDraft({
      authContext,
      body: body({
        header: {
          ...body().header,
          taxRateBasisPoints: '1200',
          taxExact: '120000.000000',
          totalExact: '1120000.000000',
        },
        lines: [
          rawLine({
            taxExact: '120000.000000',
            totalExact: '1120000.000000',
          }),
        ],
      }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'TAX_POLICY_RATE_MISMATCH',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
    expect(scope.getRepository('quotationLine').insert).not.toHaveBeenCalled();
  });

  it('refuses a policy code this workspace does not define', async () => {
    const scope = buildScope({
      taxPolicyFindOne: jest.fn(async () => null),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'TAX_POLICY_UNKNOWN',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('refuses a deactivated policy for a new draft', async () => {
    const scope = buildScope({
      taxPolicyFindOne: jest.fn(async () => ({
        id: 'tp-1',
        code: 'IR_VAT_9',
        rateBasisPoints: '900',
        isActive: false,
      })),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({ authContext, body: body() });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'TAX_POLICY_INACTIVE',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('keeps the stored rate when its policy was edited after the draft was saved', async () => {
    const scope = buildScope({
      headerFindOne: jest.fn(async () => ({
        id: 'q-1',
        status: 'DRAFT',
        version: 2,
        taxPolicy: 'IR_VAT_9',
        taxRateBasisPoints: '900',
      })),
      // The settings moved to 12% after this draft was written.
      taxPolicyFindOne: jest.fn(async () => ({
        id: 'tp-1',
        code: 'IR_VAT_9',
        rateBasisPoints: '1200',
        isActive: true,
      })),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: 2 }),
    });

    expect(result).toMatchObject({ kind: 'SAVED', version: 3 });
  });

  it('accepts a draft whose policy was deactivated after it was saved', async () => {
    const scope = buildScope({
      headerFindOne: jest.fn(async () => ({
        id: 'q-1',
        status: 'DRAFT',
        version: 2,
        taxPolicy: 'IR_VAT_9',
        taxRateBasisPoints: '900',
      })),
      taxPolicyFindOne: jest.fn(async () => ({
        id: 'tp-1',
        code: 'IR_VAT_9',
        rateBasisPoints: '900',
        isActive: false,
      })),
    });
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({ quotationId: 'q-1', expectedVersion: 2 }),
    });

    expect(result).toMatchObject({ kind: 'SAVED', version: 3 });
  });

  it('refuses tax whose declared rate is missing', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: { ...body().header, taxRateBasisPoints: null },
      }),
    });

    expect(result).toMatchObject({
      kind: 'REJECTED',
      code: 'TAX_RATE_REQUIRED',
    });
    expect(scope.getRepository('quotation').insert).not.toHaveBeenCalled();
  });

  it('still saves a legacy draft with no policy and no tax', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
    });

    const result = await service.saveDraft({
      authContext,
      body: body({
        header: {
          ...body().header,
          taxPolicy: null,
          taxRateBasisPoints: null,
          taxExact: '0.000000',
          totalExact: '1000000.000000',
        },
        lines: [
          rawLine({ taxExact: '0.000000', totalExact: '1000000.000000' }),
        ],
      }),
    });

    expect(result).toMatchObject({ kind: 'SAVED' });
  });

  it('lets a transaction failure escape so the caller never sees success', async () => {
    const scope = buildScope();
    const { service } = buildService({
      permissions: ['quotation.edit'],
      scope,
      transactionError: new Error('connection reset'),
    });

    await expect(
      service.saveDraft({ authContext, body: body() }),
    ).rejects.toThrow('connection reset');
  });
});
