import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { AsanHttpAdapter } from 'src/domain/accounting/adapters/asan/asan-http-adapter';
import { ASAN_ADAPTER_CONTRACT_VERSION } from 'src/domain/accounting/adapter-contract';
import { ASAN_GUIDE_FIELD_MODELS, ASAN_GUIDE_OPERATIONS } from 'src/domain/accounting/adapters/asan/asan-wire-contract';
import { ASAN_ENDPOINTS } from 'src/domain/accounting/adapters/asan/asan-endpoints';

describe('Asan guide inventory', () => {
  it('covers all 47 distinct routes and 17 data models, without duplicating paths', () => {
    expect(ASAN_GUIDE_OPERATIONS).toHaveLength(47);
    expect(new Set(ASAN_GUIDE_OPERATIONS.map((op) => op.method + ' ' + op.path)).size).toBe(47);
    expect(Object.keys(ASAN_GUIDE_FIELD_MODELS)).toHaveLength(17);
    expect(new Set(ASAN_GUIDE_OPERATIONS.map((op) => op.path))).toEqual(new Set(Object.values(ASAN_ENDPOINTS)));
  });
  it('keeps customer input and output separate and classifies the mutating GET', () => {
    expect(ASAN_GUIDE_FIELD_MODELS.CustomerViewModel.PersonCode).toBe('int');
    expect(ASAN_GUIDE_FIELD_MODELS.CustomerServiceViewModel.Code).toBe('long');
    expect(ASAN_GUIDE_FIELD_MODELS.Products.TotalCount).toBe('double');
    expect(ASAN_GUIDE_OPERATIONS.find((op) => op.path === ASAN_ENDPOINTS.updateFactorState))
      .toMatchObject({ method: 'GET', effect: 'WRITE' });
    expect(ASAN_GUIDE_OPERATIONS.find((op) => op.path === ASAN_ENDPOINTS.lastCustomerPishFactors))
      .toMatchObject({ method: 'POST', effect: 'READ' });
  });
});

describe('Asan app/Nest capability parity', () => {
  it('evaluates the actual Nest descriptor and compares its full value and contract version', () => {
    // Nest descriptor is a standalone module. Transpile its real source without pulling
    // the Nest server or its source aliases into the app's composite TypeScript project.
    const path = new URL('../../../../../../../../../twenty-server/src/modules/quotation/utils/accounting-adapter-contract.util.ts', import.meta.url);
    const source = readFileSync(path, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const sandbox = { exports: {} };
    runInNewContext(js, sandbox, { timeout: 1000 });
    const exports = sandbox.exports as { accountingAdapterContract(id: string): {
      contractVersion: string; capabilities: unknown;
    } };
    const nest = exports.accountingAdapterContract('asan');
    expect(nest.contractVersion).toBe(ASAN_ADAPTER_CONTRACT_VERSION);
    expect(JSON.parse(JSON.stringify(nest.capabilities))).toEqual(ASAN_CAPABILITIES);
  });

  it('does not present documented but absent document operations as executable', () => {
    const adapter = new AsanHttpAdapter({ baseUrl: 'https://example.invalid', remoteUserId: '1' });
    expect(adapter.capabilities.documents.createInvoice).toBe(false);
    expect(adapter.capabilities.documents.readDocuments).toBe(true);
    expect(typeof adapter.listRecentProformas).toBe('function');
    expect(adapter.capabilities.documents.readById).toBe(false);
    expect(typeof adapter.readItem).toBe('function');
    expect(typeof adapter.listPrices).toBe('function');
    expect(typeof adapter.listStores).toBe('function');
    expect(typeof adapter.readStockByStore).toBe('function');
    expect(typeof adapter.readPartiesByMobile).toBe('function');
  });
});
