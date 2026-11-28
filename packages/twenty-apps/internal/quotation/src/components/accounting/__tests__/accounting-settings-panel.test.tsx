// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the host runtime is stubbed. The real panel, its real section components and its real
// storage handling run, so what is asserted is the screen an operator actually gets.
vi.mock('twenty-sdk/front-component', () => ({
  AppPath: { Home: '/objects/companies' },
  enqueueSnackbar: vi.fn(async () => undefined),
  openCommandConfirmationModal: vi.fn(async () => 'cancel'),
  navigate: vi.fn(async () => undefined),
}));

const {
  callAppRoute,
  callAccountingConnectionNestActionMock,
  callTaxPoliciesNestActionMock,
  callQuotationCurrenciesNestActionMock,
} = vi.hoisted(() => ({
  callAppRoute: vi.fn(),
  callAccountingConnectionNestActionMock: vi.fn(),
  callTaxPoliciesNestActionMock: vi.fn(),
  callQuotationCurrenciesNestActionMock: vi.fn(),
}));

vi.mock('src/components/quotation-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('src/components/quotation-api')>();

  return {
    ...actual,
    callAppRoute: (...args: unknown[]) => callAppRoute(...args),
    callAccountingConnectionNestAction: callAccountingConnectionNestActionMock,
    callTaxPoliciesNestAction: callTaxPoliciesNestActionMock,
    callQuotationCurrenciesNestAction: callQuotationCurrenciesNestActionMock,
  };
});

import { AccountingSettingsPanel } from 'src/components/accounting/accounting-settings-panel';
import { ADAPTER_DESCRIPTORS } from 'src/domain/accounting/adapter-descriptors';

const CONNECTION_STORAGE_KEY = 'quotation:accounting:working-connection';

const storedSettings = (overrides: Record<string, unknown> = {}) => ({
  baseUrl: 'https://accounting.example',
  remoteUserId: '7',
  defaultStorageId: '2',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: false },
  taxPolicyMappings: {},
  financial: {
    baseCurrency: 'IRR',
    currencyMappings: {},
    conversionRate: '',
    mockProfile: 'SIMPLE',
  },
  ...overrides,
});

const connections = () => [
  {
    id: 'conn-1',
    name: 'آسان کارخانه',
    adapterId: 'asan',
    adapterVersion: '2026-11-1',
    isActive: true,
    isDefault: true,
    settings: storedSettings(),
    healthState: 'OK',
    lastHealthCheckAt: '2026-11-21T08:00:00.000Z',
    lastHealthMessage: 'پاسخ داد',
    verificationState: 'LIVE_VERIFIED',
  },
  {
    id: 'conn-2',
    name: 'آزمایشی ساده',
    adapterId: 'mock',
    adapterVersion: '2026-11-1',
    isActive: true,
    isDefault: false,
    settings: storedSettings({ baseUrl: 'http://mock.invalid', moneyUnit: 'UNCONFIRMED' }),
    healthState: 'UNKNOWN',
    lastHealthCheckAt: null,
    lastHealthMessage: null,
    verificationState: 'MOCK',
  },
  {
    id: 'conn-3',
    name: 'آزمایشی کدمحور',
    adapterId: 'mock',
    adapterVersion: '2026-11-1',
    isActive: true,
    isDefault: false,
    settings: storedSettings({
      baseUrl: 'http://mock.invalid',
      financial: {
        baseCurrency: '',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'CODED',
      },
    }),
    healthState: 'UNKNOWN',
    lastHealthCheckAt: null,
    lastHealthMessage: null,
    verificationState: 'MOCK',
  },
];

const installRoutes = () => {
  callAccountingConnectionNestActionMock.mockImplementation(async (body: { action?: string }) => {
    if (body.action === 'list') {
      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          canManage: true,
          connections: connections(),
          supportedAdapters: ADAPTER_DESCRIPTORS.map((adapter) => ({
            id: adapter.id,
            isLive: adapter.isLive,
            contractVersion: adapter.contractVersion,
          })),
          credentials: {
            tunnelTokenConfigured: false,
            insecureWritesApproved: false,
          },
          flags: { outboundEnabled: false, documentExportEnabled: false },
          message: 'اتصال‌های حسابداری خوانده شد',
        },
      };
    }

    throw new Error(`unexpected connection action ${body.action}`);
  });

  // Import/outbound remain /s Logic Function routes. Always return a Promise so
  // panel `.catch` handlers never see undefined after mockReset.
  callAppRoute.mockImplementation(async (path: string) => {
    if (
      typeof path === 'string' &&
      (path.includes('accounting-import') || path.includes('accounting-outbound'))
    ) {
      return {
        ok: false,
        status: 503,
        data: { success: false, message: 'import/outbound unavailable in test' },
      };
    }

    throw new Error(`unexpected app route ${path}`);
  });

  callTaxPoliciesNestActionMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: { success: true, policies: [] },
  });
  callQuotationCurrenciesNestActionMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      success: true,
      currencies: [
        { code: 'IRR', name: 'ریال ایران', isActive: true, isDefault: true },
      ],
    },
  });
};

const openConnections = async () => {
  const railButtons = await screen.findAllByRole('button', { name: /اتصال‌ها/ });
  const railButton = railButtons.find(
    (button) => button.getAttribute('aria-current') !== 'true',
  );

  fireEvent.click(railButton as HTMLElement);

  return screen.getByRole('table', { name: 'اتصال‌های حسابداری' });
};

const rowFor = (table: HTMLElement, id: string): HTMLElement => {
  const row = within(table)
    .getAllByRole('row')
    .find((entry) => entry.getAttribute('data-connection-id') === id);

  if (row === undefined) {
    throw new Error(`no row for ${id}`);
  }

  return row;
};

beforeEach(() => {
  window.localStorage.clear();
  callAppRoute.mockReset();
  callAccountingConnectionNestActionMock.mockReset();
  callTaxPoliciesNestActionMock.mockReset();
  callQuotationCurrenciesNestActionMock.mockReset();
  installRoutes();
});

beforeAll(() => {
  // jsdom has no layout engine; the deep-link scroll is the only thing it lacks here.
  // eslint-disable-next-line no-extend-native -- a test-only stand-in for a browser API
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('the selected destination is the one every section talks about', () => {
  it('loads tax and currency catalogs from Nest list actions, not /s routes', async () => {
    render(<AccountingSettingsPanel />);

    await screen.findByRole('heading', { name: 'نمای کلی' });

    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledWith({ action: 'list' });
    expect(callQuotationCurrenciesNestActionMock).toHaveBeenCalledWith({
      action: 'list',
    });
    expect(
      callAppRoute.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0].includes('tax-policies') || call[0].includes('currencies')),
      ),
    ).toBe(false);
  });

  it('starts on the workspace default with no temporary view', async () => {
    render(<AccountingSettingsPanel />);

    expect(
      await screen.findByRole('heading', { name: 'نمای کلی' }),
    ).toBeTruthy();
    expect(screen.getByText(/آسان کارخانه — /)).toBeTruthy();
    expect(screen.queryByText(/نمای موقت/)).toBeNull();
  });

  it('keeps catalog on the workspace default after opening another connection for edit', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-3')).getByRole('button', { name: /^عملیات / }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'ویرایش' }));

    expect(await screen.findByText('در حال ویرایش: آزمایشی کدمحور')).toBeTruthy();
    expect(screen.queryByText(/پیش‌فرض فضای کاری: آسان کارخانه/)).toBeNull();
    expect(screen.queryByText(/نمای موقت/)).toBeNull();
  });

  it('does not persist a temporary connection id in localStorage', async () => {
    render(<AccountingSettingsPanel />);
    await openConnections();

    expect(window.localStorage.getItem(CONNECTION_STORAGE_KEY)).toBeNull();
  });

  it('keeps the workspace default name when switching to overview', async () => {
    render(<AccountingSettingsPanel />);
    await openConnections();

    const overviewButton = screen
      .getAllByRole('button', { name: /نمای کلی/ })
      .find((button) => button.getAttribute('aria-current') !== 'true');

    fireEvent.click(overviewButton as HTMLElement);

    expect(await screen.findByRole('heading', { name: 'نمای کلی' })).toBeTruthy();
    expect(screen.queryByText(/پیش‌فرض فضای کاری: آسان کارخانه/)).toBeNull();
    expect(screen.queryByText(/نمای موقت/)).toBeNull();
  });
});

describe('deep links from the readiness list', () => {
  it('opens the workspace-default connection for edit from the connections menu', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-1')).getByRole('button', { name: /^عملیات / }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'ویرایش' }));

    expect(await screen.findByText(/در حال ویرایش:/)).toBeTruthy();
    expect(screen.queryByText(/پیش‌فرض فضای کاری: آسان کارخانه/)).toBeNull();
  });
});
