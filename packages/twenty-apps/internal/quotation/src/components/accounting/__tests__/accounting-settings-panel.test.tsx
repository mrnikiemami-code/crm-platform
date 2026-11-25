// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the host runtime is stubbed. The real panel, its real section components and its real
// storage handling run, so what is asserted is the screen an operator actually gets.
vi.mock('twenty-sdk/front-component', () => ({
  AppPath: { Home: '/objects/companies' },
  enqueueSnackbar: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
}));

const callAppRoute = vi.fn();

vi.mock('src/components/quotation-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('src/components/quotation-api')>();

  return {
    ...actual,
    callAppRoute: (...args: unknown[]) => callAppRoute(...args),
  };
});

import {
  ACCOUNTING_CONNECTION_ROUTE,
  TAX_POLICIES_ROUTE,
} from 'src/components/quotation-api';
import { AccountingSettingsPanel } from 'src/components/accounting/accounting-settings-panel';
import { ADAPTER_DESCRIPTORS } from 'src/domain/accounting/adapter-registry';

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
  callAppRoute.mockImplementation(async (path: string, body: { action?: string }) => {
    if (path === ACCOUNTING_CONNECTION_ROUTE && body.action === 'list') {
      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          canManage: true,
          connections: connections(),
          adapters: ADAPTER_DESCRIPTORS,
          credentials: {
            tunnelTokenConfigured: false,
            insecureWritesApproved: false,
          },
          flags: { outboundEnabled: false, documentExportEnabled: false },
          message: 'اتصال‌های حسابداری خوانده شد',
        },
      };
    }

    if (path === TAX_POLICIES_ROUTE) {
      return { ok: true, status: 200, data: { success: true, policies: [] } };
    }

    throw new Error(`unexpected route ${path}`);
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
  it('starts on the workspace default and names it separately from temporary view', async () => {
    render(<AccountingSettingsPanel />);

    expect(
      await screen.findByText(/پیش‌فرض فضای کاری: آسان کارخانه/),
    ).toBeTruthy();
    expect(screen.getByText(/نمای موقت: آسان کارخانه — /)).toBeTruthy();
  });

  it('keeps the temporary connection first and marked after choosing another', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-3')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    const rows = within(
      screen.getByRole('table', { name: 'اتصال‌های حسابداری' }),
    ).getAllByRole('row');

    expect(rows[1].getAttribute('data-connection-id')).toBe('conn-3');
    expect(rows[1].getAttribute('data-selected')).toBe('true');
    expect(screen.getByText(/نمای موقت: آزمایشی کدمحور — /)).toBeTruthy();
    expect(screen.getByText(/پیش‌فرض فضای کاری: آسان کارخانه/)).toBeTruthy();
  });

  it('selects a temporary view without opening the edit form', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-2')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    expect(screen.getByText(/نمای موقت: آزمایشی ساده — /)).toBeTruthy();
    expect(screen.queryByText(/در حال ویرایش/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'اتصال‌ها' })).toBeTruthy();
  });

  it('opens the edit form of a connection without making it the selected one', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-3')).getByRole('button', {
        name: 'ویرایش تنظیمات',
      }),
    );

    expect(await screen.findByText('در حال ویرایش: آزمایشی کدمحور')).toBeTruthy();
    // Temporary view stays on the workspace default until the operator opts in.
    expect(screen.getByText(/نمای موقت: آسان کارخانه — /)).toBeTruthy();
  });

  it('remembers the temporary selection across a reload without changing the default', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-3')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    expect(window.localStorage.getItem(CONNECTION_STORAGE_KEY)).toBe('conn-3');

    cleanup();
    render(<AccountingSettingsPanel />);

    expect(await screen.findByText(/نمای موقت: آزمایشی کدمحور — /)).toBeTruthy();
    expect(screen.getByText(/پیش‌فرض فضای کاری: آسان کارخانه/)).toBeTruthy();

    const reloaded = await openConnections();
    const rows = within(reloaded).getAllByRole('row');

    expect(rows[1].getAttribute('data-connection-id')).toBe('conn-3');
  });

  it('names the same destination in another section', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    fireEvent.click(
      within(rowFor(table, 'conn-2')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    const overviewButton = screen
      .getAllByRole('button', { name: /نمای کلی/ })
      .find((button) => button.getAttribute('aria-current') !== 'true');

    fireEvent.click(overviewButton as HTMLElement);

    expect(await screen.findByRole('heading', { name: 'نمای کلی' })).toBeTruthy();
    expect(screen.getByText(/نمای موقت: آزمایشی ساده — /)).toBeTruthy();
  });
});

describe('deep links from the readiness list', () => {
  it('opens the selected connection at its currency section', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    // A destination whose money unit is not confirmed is the one this button fixes.
    fireEvent.click(
      within(rowFor(table, 'conn-2')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    const documentsButton = screen
      .getAllByRole('button', { name: /اسناد/ })
      .find((button) => button.getAttribute('aria-current') !== 'true');

    fireEvent.click(documentsButton as HTMLElement);

    const fixMoney = await screen.findByRole('button', { name: 'تعیین واحد پول' });

    fireEvent.click(fixMoney);

    expect(
      await screen.findByText('در حال ویرایش: آزمایشی ساده'),
    ).toBeTruthy();
    expect(document.querySelector('[data-form-section="money"]')).not.toBeNull();
  });

  it('opens the selected connection at its tax section', async () => {
    render(<AccountingSettingsPanel />);
    const table = await openConnections();

    // A code-based destination with no mapping yet is the one this button fixes.
    fireEvent.click(
      within(rowFor(table, 'conn-3')).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    const documentsButton = screen
      .getAllByRole('button', { name: /اسناد/ })
      .find((button) => button.getAttribute('aria-current') !== 'true');

    fireEvent.click(documentsButton as HTMLElement);

    const fixTax = await screen.findByRole('button', {
      name: 'تنظیم مالیات حسابداری',
    });

    fireEvent.click(fixTax);

    expect(
      await screen.findByText('در حال ویرایش: آزمایشی کدمحور'),
    ).toBeTruthy();
    expect(document.querySelector('[data-form-section="tax"]')).not.toBeNull();
  });
});
