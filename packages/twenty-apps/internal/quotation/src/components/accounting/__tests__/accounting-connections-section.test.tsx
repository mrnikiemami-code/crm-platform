// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccountingConnectionsSection } from 'src/components/accounting/accounting-connections-section';
import {
  EMPTY_FORM,
  type AdapterDescriptor,
  type ConnectionRecord,
  type FormState,
  type PanelData,
  type CurrencyCatalogView,
  type TaxPolicyView,
} from 'src/components/accounting/accounting-shared';
import { resolveFinancialModes } from 'src/components/accounting/accounting-shared';

// jsdom has no layout, so the deep-link scroll is asserted through the call, and the focus
// assertion uses the real activeElement the component sets.
beforeAll(() => {
  // eslint-disable-next-line no-extend-native -- a test-only stand-in for a browser API
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const settings = (
  overrides: Partial<ConnectionRecord['settings']> = {},
): ConnectionRecord['settings'] => ({
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

const connection = (
  overrides: Partial<ConnectionRecord> = {},
): ConnectionRecord => ({
  id: 'conn-1',
  name: 'آسان کارخانه',
  adapterId: 'asan',
  adapterVersion: '2026-11-1',
  isActive: true,
  isDefault: false,
  settings: settings(),
  healthState: 'OK',
  lastHealthCheckAt: '2026-11-21T08:00:00.000Z',
  lastHealthMessage: 'پاسخ داد',
  verificationState: 'LIVE_VERIFIED',
  ...overrides,
});

const adapters: AdapterDescriptor[] = [
  {
    id: 'asan',
    label: 'آسان (LinqToAsan)',
    vendor: 'آسان',
    contractVersion: '2026-11-1',
    isLive: true,
    transportIsSecure: false,
    readiness: 'LIVE_UNVERIFIED',
    summary: 'اتصال به API مستند آسان.',
    limitations: ['مستندات آسان انتقال امن ندارد.'],
    taxHandling: 'TAX_AMOUNT',
    dutyHandling: 'DUTY_AMOUNT',
    currencyHandling: 'SINGLE_CURRENCY',
    baseCurrency: 'IRR',
    requiresSpecialItemCodes: true,
    testProfiles: [],
  },
  {
    id: 'mock',
    label: 'آزمایشی، بدون ارتباط واقعی',
    vendor: '—',
    contractVersion: '2026-11-1',
    isLive: false,
    transportIsSecure: true,
    readiness: 'MOCK_ONLY',
    summary: 'اتصال آزمایشی.',
    limitations: ['داده‌ها ثابت است.'],
    taxHandling: null,
    dutyHandling: null,
    currencyHandling: null,
    baseCurrency: '',
    requiresSpecialItemCodes: false,
    testProfiles: [
      {
        id: 'SIMPLE',
        label: 'ساده: فقط نرخ مالیات و عوارض، ارز ثابت',
        summary: 'نرخ مالیات و عوارض و ارز ثابت.',
        taxHandling: 'TAX_RATE',
        dutyHandling: 'DUTY_RATE',
        currencyHandling: 'SINGLE_CURRENCY',
        baseCurrency: 'IRR',
        requiresSpecialItemCodes: false,
      },
      {
        id: 'CODED',
        label: 'کدمحور: یک کد مالیات برای هر سیاست، کد ارز',
        summary:
          'کد مالیات واحد، کد ارز؛ جدول کدهای مقصد ۹٪ و ۱۰٪ را تعریف کرده است.',
        taxHandling: 'TAX_CODE',
        dutyHandling: 'DUTY_WITHIN_POLICY',
        currencyHandling: 'CURRENCY_CODE',
        baseCurrency: '',
        requiresSpecialItemCodes: true,
        taxCodeCatalog: [
          {
            code: '64',
            label: 'مالیات ارزش افزوده ۹٪ (۶٪ مالیات + ۳٪ عوارض)',
            totalRateBasisPoints: '900',
            taxRateBasisPoints: '600',
            dutyRateBasisPoints: '300',
          },
          {
            code: '70',
            label: 'مالیات ارزش افزوده ۱۰٪ (۷٪ مالیات + ۳٪ عوارض)',
            totalRateBasisPoints: '1000',
            taxRateBasisPoints: '700',
            dutyRateBasisPoints: '300',
          },
        ],
      },
      {
        id: 'AMOUNT',
        label: 'مبلغ‌محور: مبلغ مالیات و مبلغ عوارض، ارز ثابت',
        summary: 'مبلغ مالیات و مبلغ عوارض.',
        taxHandling: 'TAX_AMOUNT',
        dutyHandling: 'DUTY_AMOUNT',
        currencyHandling: 'SINGLE_CURRENCY',
        baseCurrency: 'IRR',
        requiresSpecialItemCodes: false,
      },
      {
        id: 'AGGREGATE',
        label: 'تجمیعی: فقط جمع مالیات و عوارض',
        summary: 'فقط جمع مالیات و عوارض.',
        taxHandling: 'TAX_AMOUNT',
        dutyHandling: 'AGGREGATE',
        currencyHandling: 'SINGLE_CURRENCY',
        baseCurrency: 'IRR',
        requiresSpecialItemCodes: false,
      },
      {
        id: 'NO_TAX',
        label: 'بدون پشتیبانی مالیات و عوارض',
        summary: 'بدون مالیات و عوارض.',
        taxHandling: 'UNSUPPORTED',
        dutyHandling: 'UNSUPPORTED',
        currencyHandling: 'SINGLE_CURRENCY',
        baseCurrency: 'IRR',
        requiresSpecialItemCodes: false,
      },
    ],
  },
];

const policies: TaxPolicyView[] = [
  {
    code: 'IR_VAT_9',
    name: 'مالیات بر ارزش افزوده ۹٪',
    ratePercent: '۶',
    dutyRatePercent: '۳',
    totalRatePercent: '۹',
    rateBasisPoints: '600',
    dutyRateBasisPoints: '300',
    totalRateBasisPoints: '900',
    isActive: true,
    isDefault: true,
    isExempt: false,
  },
];

const currencies: CurrencyCatalogView[] = [
  {
    code: 'IRR',
    name: 'ریال ایران',
    isActive: true,
    isDefault: true,
  },
];

const threeConnections = (): ConnectionRecord[] => [
  connection(),
  connection({
    id: 'conn-2',
    name: 'آزمایشی کدمحور',
    adapterId: 'mock',
    healthState: 'UNKNOWN',
    lastHealthCheckAt: null,
    lastHealthMessage: null,
    verificationState: 'MOCK',
    settings: settings({
      baseUrl: 'http://mock.invalid',
      financial: {
        baseCurrency: '',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'CODED',
      },
    }),
  }),
  connection({
    id: 'conn-3',
    name: 'آزمایشی ساده',
    adapterId: 'mock',
    healthState: 'UNKNOWN',
    lastHealthCheckAt: null,
    lastHealthMessage: null,
    verificationState: 'MOCK',
    settings: settings({
      baseUrl: 'http://mock.invalid',
      financial: {
        baseCurrency: 'IRR',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'SIMPLE',
      },
    }),
  }),
];

const panelData = (connections: ConnectionRecord[]): PanelData => ({
  connections,
  adapters,
  credentials: { tunnelTokenConfigured: false, insecureWritesApproved: false },
  flags: { outboundEnabled: false, documentExportEnabled: false },
  canManage: true,
});

const formFrom = (record: ConnectionRecord): FormState => ({
  ...EMPTY_FORM,
  id: record.id,
  name: record.name,
  adapterId: record.adapterId,
  baseUrl: record.settings.baseUrl,
  moneyUnit: record.settings.moneyUnit,
  taxPolicyMappingsText: Object.entries(record.settings.taxPolicyMappings ?? {})
    .map(([code, destinationCode]) => `${code}=${destinationCode}`)
    .join('\n'),
  baseCurrency: record.settings.financial?.baseCurrency ?? 'IRR',
  mockProfile: record.settings.financial?.mockProfile ?? 'SIMPLE',
});

const renderSection = ({
  connections = threeConnections(),
  form = formFrom(threeConnections()[0]),
  selectedConnectionId = 'conn-1',
  view = 'list' as 'list' | 'form',
  focus = null as 'money' | 'tax' | null,
  testResult = null,
  taxPolicies = policies,
  currencyCatalog = currencies,
  onSelectConnection = vi.fn<(connection: ConnectionRecord) => void>(),
  onSetWorkspaceDefault = vi.fn<(connection: ConnectionRecord) => void>(),
  onDeactivateConnection = vi.fn<(connection: ConnectionRecord) => void>(),
  onReactivateConnection = vi.fn<(connection: ConnectionRecord) => void>(),
  onEditConnection = vi.fn<(connection: ConnectionRecord) => void>(),
  onSave = vi.fn<() => void>(),
  onChange = vi.fn<(form: FormState) => void>(),
}: {
  connections?: ConnectionRecord[];
  form?: FormState;
  selectedConnectionId?: string | null;
  view?: 'list' | 'form';
  focus?: 'money' | 'tax' | null;
  testResult?: { healthState: string; message: string; detail: string } | null;
  taxPolicies?: TaxPolicyView[];
  currencyCatalog?: CurrencyCatalogView[];
  onSelectConnection?: ReturnType<typeof vi.fn<(connection: ConnectionRecord) => void>>;
  onSetWorkspaceDefault?: ReturnType<
    typeof vi.fn<(connection: ConnectionRecord) => void>
  >;
  onDeactivateConnection?: ReturnType<
    typeof vi.fn<(connection: ConnectionRecord) => void>
  >;
  onReactivateConnection?: ReturnType<
    typeof vi.fn<(connection: ConnectionRecord) => void>
  >;
  onEditConnection?: ReturnType<typeof vi.fn<(connection: ConnectionRecord) => void>>;
  onSave?: ReturnType<typeof vi.fn<() => void>>;
  onChange?: ReturnType<typeof vi.fn<(form: FormState) => void>>;
} = {}) => {
  const data = panelData(connections);
  const modes = resolveFinancialModes({
    adapterId: form.adapterId,
    adapters: data.adapters,
    financial: {
      baseCurrency: form.baseCurrency,
      currencyMappings: {},
      conversionRate: form.conversionRate,
      mockProfile: form.mockProfile,
    },
  });

  render(
    <AccountingConnectionsSection
      data={data}
      form={form}
      modes={modes}
      policies={taxPolicies}
      currencies={currencyCatalog}
      canManage
      busy={false}
      selectedConnectionId={selectedConnectionId}
      testResult={testResult}
      view={view}
      focus={focus}
      onOpenList={vi.fn()}
      onSelectConnection={onSelectConnection}
      onSetWorkspaceDefault={onSetWorkspaceDefault}
      onDeactivateConnection={onDeactivateConnection}
      onReactivateConnection={onReactivateConnection}
      onEditConnection={onEditConnection}
      onChange={onChange}
      onSave={onSave}
      onTest={vi.fn()}
      onStartNew={vi.fn()}
    />,
  );

  return {
    onSelectConnection,
    onSetWorkspaceDefault,
    onDeactivateConnection,
    onReactivateConnection,
    onEditConnection,
    onSave,
    onChange,
  };
};

const tableRows = (): HTMLElement[] =>
  within(screen.getByRole('table', { name: 'اتصال‌های حسابداری' })).getAllByRole(
    'row',
  );

describe('choosing between several connections', () => {
  it('shows every connection as its own row', () => {
    renderSection();

    // one header row plus three connections
    expect(tableRows()).toHaveLength(4);
  });

  it('pins the selected connection to the first row and marks it', () => {
    renderSection({ selectedConnectionId: 'conn-2' });

    const [, first, ...rest] = tableRows();

    expect(first.getAttribute('data-connection-id')).toBe('conn-2');
    expect(first.getAttribute('data-selected')).toBe('true');
    // The badge and the disabled action both say the row is the temporary view.
    expect(within(first).getAllByText('نمای موقت').length).toBeGreaterThan(0);
    expect(within(first).getByRole('button', { name: 'نمای موقت فعال' })).toBeTruthy();
    expect(rest.map((row) => row.getAttribute('data-connection-id'))).toEqual([
      'conn-1',
      'conn-3',
    ]);
    expect(rest.some((row) => within(row).queryByText('نمای موقت'))).toBe(false);
  });

  it('marks only one row, even when the server returned another active record', () => {
    renderSection({ selectedConnectionId: 'conn-3' });

    const marked = tableRows().filter(
      (row) => row.getAttribute('data-selected') === 'true',
    );

    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-connection-id')).toBe('conn-3');
  });

  it('selects a temporary working connection without opening its edit form', () => {
    const { onSelectConnection, onEditConnection, onSetWorkspaceDefault } =
      renderSection();

    const row = within(
      screen.getByRole('table', { name: 'اتصال‌های حسابداری' }),
    )
      .getAllByRole('row')
      .find((entry) => entry.getAttribute('data-connection-id') === 'conn-2');

    fireEvent.click(
      within(row as HTMLElement).getByRole('button', {
        name: 'انتخاب نمای موقت',
      }),
    );

    expect(onSelectConnection).toHaveBeenCalledTimes(1);
    expect(onSelectConnection.mock.calls[0][0].id).toBe('conn-2');
    expect(onEditConnection).not.toHaveBeenCalled();
    expect(onSetWorkspaceDefault).not.toHaveBeenCalled();
  });

  it('sets the workspace default without changing temporary selection alone', () => {
    const { onSelectConnection, onSetWorkspaceDefault } = renderSection();

    const row = within(
      screen.getByRole('table', { name: 'اتصال‌های حسابداری' }),
    )
      .getAllByRole('row')
      .find((entry) => entry.getAttribute('data-connection-id') === 'conn-2');

    fireEvent.click(
      within(row as HTMLElement).getByRole('button', {
        name: 'تنظیم به‌عنوان پیش‌فرض',
      }),
    );

    expect(onSetWorkspaceDefault).toHaveBeenCalledTimes(1);
    expect(onSetWorkspaceDefault.mock.calls[0][0].id).toBe('conn-2');
    expect(onSelectConnection).not.toHaveBeenCalled();
  });

  it('opens the edit form without changing the selection', () => {
    const { onSelectConnection, onEditConnection } = renderSection();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'ویرایش تنظیمات' })[1],
    );

    expect(onEditConnection).toHaveBeenCalledTimes(1);
    expect(onSelectConnection).not.toHaveBeenCalled();
  });

  it('does not offer temporary selection on the row already selected', () => {
    renderSection({ selectedConnectionId: 'conn-1' });

    const buttons = screen.getAllByRole('button', { name: 'نمای موقت فعال' });

    expect(buttons).toHaveLength(1);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the workspace-default badge and disables promoting that row again', () => {
    renderSection({
      connections: [
        connection({ id: 'conn-1', isDefault: true }),
        connection({ id: 'conn-2', name: 'دوم' }),
      ],
      selectedConnectionId: 'conn-2',
    });

    expect(screen.getAllByText('پیش‌فرض فضای کاری').length).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole('button', {
          name: 'پیش‌فرض فضای کاری',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('offers retire on an active row and reactivate on a retired row', () => {
    const { onDeactivateConnection, onReactivateConnection } = renderSection({
      connections: [
        connection({ id: 'conn-1', isActive: true }),
        connection({ id: 'conn-2', name: 'بازنشسته', isActive: false }),
      ],
      selectedConnectionId: 'conn-1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'بازنشسته‌کردن' }));
    expect(onDeactivateConnection).toHaveBeenCalledTimes(1);
    expect(onDeactivateConnection.mock.calls[0][0].id).toBe('conn-1');

    fireEvent.click(screen.getByRole('button', { name: 'فعال‌سازی مجدد' }));
    expect(onReactivateConnection).toHaveBeenCalledTimes(1);
    expect(onReactivateConnection.mock.calls[0][0].id).toBe('conn-2');
  });

  it('blocks temporary selection of a retired connection', () => {
    renderSection({
      connections: [
        connection({ id: 'conn-1' }),
        connection({ id: 'conn-2', name: 'اتصال قدیمی', isActive: false }),
      ],
      selectedConnectionId: 'conn-1',
    });

    const retiredRow = within(
      screen.getByRole('table', { name: 'اتصال‌های حسابداری' }),
    )
      .getAllByRole('row')
      .find((entry) => entry.getAttribute('data-connection-id') === 'conn-2');

    expect(
      (
        within(retiredRow as HTMLElement).getByRole('button', {
          name: 'انتخاب نمای موقت',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      within(retiredRow as HTMLElement).getAllByText('بازنشسته').length,
    ).toBeGreaterThan(0);
  });

  it('labels a mock destination as simulated, never as a real connection', () => {
    renderSection({ selectedConnectionId: 'conn-2' });

    const table = screen.getByRole('table', { name: 'اتصال‌های حسابداری' });
    const mockRow = within(table)
      .getAllByRole('row')
      .find((row) => row.getAttribute('data-connection-id') === 'conn-2');

    expect(
      within(mockRow as HTMLElement).getByText('آزمایشی، بدون ارتباط واقعی'),
    ).toBeTruthy();
    expect(
      within(mockRow as HTMLElement).queryByText('اتصال واقعی تأییدشده'),
    ).toBeNull();
  });
});

describe('honest health states in the list', () => {
  it('labels a configured but never-probed destination as unchecked', () => {
    renderSection({
      connections: [
        connection({ healthState: 'UNKNOWN', verificationState: 'LIVE_UNVERIFIED' }),
      ],
      selectedConnectionId: 'conn-1',
    });

    expect(screen.getByText('تنظیم‌شده، بررسی‌نشده')).toBeTruthy();
  });

  it('labels a failed probe as unreachable', () => {
    renderSection({
      connections: [
        connection({ healthState: 'FAILED', verificationState: 'LIVE_UNVERIFIED' }),
      ],
      selectedConnectionId: 'conn-1',
    });

    expect(screen.getByText('ارتباط برقرار نشد')).toBeTruthy();
  });

  it('labels an unconfirmed money unit as incomplete settings', () => {
    renderSection({
      connections: [
        connection({ settings: settings({ moneyUnit: 'UNCONFIRMED' }) }),
      ],
      selectedConnectionId: 'conn-1',
    });

    expect(screen.getByText('تنظیمات ناقص')).toBeTruthy();
  });
});

describe('the form is one structure for every adapter', () => {
  it('shows the four business sections and no technical mode selector', () => {
    renderSection({ view: 'form' });

    expect(screen.getByText('۱. مشخصات اتصال')).toBeTruthy();
    expect(screen.getByText('۲. ارز و واحد پول')).toBeTruthy();
    expect(screen.getByText('۳. مالیات و عوارض')).toBeTruthy();
    expect(screen.getByText(/۴\. تنظیمات پیشرفته/)).toBeTruthy();
    expect(screen.queryByText('TAX_CODE')).toBeNull();
    expect(screen.queryByText('DUTY_AMOUNT')).toBeNull();
  });

  it('states CRM tax and currency code ownership outside the connection form', () => {
    renderSection({ view: 'form' });

    expect(
      screen.getByText(
        /کد حسابداری مالیات و ارز در صفحهٔ «مالیات و عوارض» تعریف می‌شود/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/\(Mock\)/)).toBeNull();
  });

  it('formats the last health-check time for Persian operators', () => {
    renderSection({
      view: 'form',
      form: formFrom(
        connection({
          lastHealthCheckAt: '2026-11-21T08:00:00.000Z',
        }),
      ),
    });

    expect(screen.getByText(/آخرین آزمایش:/)).toBeTruthy();
    expect(screen.queryByText(/2026-11-21T08:00:00/)).toBeNull();
  });

  it('keeps the advanced section collapsed by default', () => {
    renderSection({ view: 'form' });

    const advanced = screen
      .getByText(/۴\. تنظیمات پیشرفته/)
      .closest('details');

    expect(advanced).not.toBeNull();
    expect((advanced as HTMLDetailsElement).open).toBe(false);
  });

  it('keeps the technical row codes and destination ids inside advanced settings', () => {
    renderSection({ view: 'form' });

    expect(screen.getByLabelText('کد ردیف مالیات').closest('details')).not.toBeNull();
    expect(screen.getByLabelText('شناسهٔ کاربر مقصد').closest('details')).not.toBeNull();
    expect(screen.getByLabelText('شناسهٔ انبار پیش‌فرض').closest('details')).not.toBeNull();
  });

  it('does not wipe the draft when the destination is switched', () => {
    const { onChange } = renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[0]), name: 'نام تایپ‌شده' },
    });

    fireEvent.change(screen.getByLabelText('نرم‌افزار حسابداری'), {
      target: { value: 'mock' },
    });

    const last = onChange.mock.calls.at(-1)?.[0] as FormState;

    expect(last.adapterId).toBe('mock');
    expect(last.name).toBe('نام تایپ‌شده');
  });
});

describe('the currency form follows the declared contract', () => {
  it('asks a single-currency destination for a currency and no code', () => {
    renderSection({ view: 'form' });

    expect(screen.getByLabelText('ارز مقصد')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'نگاشت ارز CRM به ارز مقصد' })).toBeNull();
  });

  it('asks a code destination for a mapping table instead of a base currency', () => {
    const form = formFrom(threeConnections()[1]);

    renderSection({ view: 'form', form });

    expect(
      screen.getByRole('table', { name: 'نگاشت ارز CRM به ارز مقصد' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('کد ارز در مقصد برای IRR')).toBeTruthy();
    expect(screen.queryByLabelText('کد ارز در مقصد برای USD')).toBeNull();
    expect(screen.queryByLabelText('کد ارز در مقصد برای EUR')).toBeNull();
    expect(screen.queryByLabelText('ارز مقصد')).toBeNull();
  });

  it('keeps an orphan currency mapping visible without inventing CRM identity', () => {
    const form = {
      ...formFrom(threeConnections()[1]),
      currencyMappingsText: 'IRR=IRR\nUSD=USD',
    };

    renderSection({ view: 'form', form });

    expect(screen.getByLabelText('کد ارز در مقصد برای USD')).toBeTruthy();
    expect(
      screen.getByText('این ارز دیگر در کاتالوگ نیست؛ نگاشت را اصلاح یا خالی کنید.'),
    ).toBeTruthy();
  });

  it('does not make a currency code mandatory for a single-currency destination', () => {
    const { onSave } = renderSection({ view: 'form' });

    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تنظیمات' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the tax form shows one row and one destination code per policy', () => {
  it('shows the CRM rate to a rate destination and asks for no code', () => {
    const form = formFrom(threeConnections()[2]);

    renderSection({ view: 'form', form });

    expect(
      screen.getByRole('table', { name: 'سیاست‌های مالیات و عوارض این اتصال' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪')).toBeNull();
  });

  it('offers exactly one code field per policy and no duty code field', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[1]) });

    expect(
      screen.getAllByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪'),
    ).toHaveLength(1);
    expect(screen.queryByLabelText('کد عوارض برای مالیات بر ارزش افزوده ۹٪')).toBeNull();
  });

  it('shows the total rate and both internal components on the same row', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[1]) });

    expect(screen.getByText('جمع درصد')).toBeTruthy();
    expect(screen.getByText('۹٪')).toBeTruthy();
    expect(screen.getByText('مالیات ۶٪ + عوارض ۳٪')).toBeTruthy();
  });

  it('writes the single destination code into the policy mapping from the catalog picker', () => {
    const { onChange } = renderSection({
      view: 'form',
      form: formFrom(threeConnections()[1]),
    });

    const control = screen.getByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪');

    expect(control.tagName).toBe('SELECT');
    fireEvent.change(control, { target: { value: '64' } });

    const last = onChange.mock.calls.at(-1)?.[0] as FormState;

    expect(last.taxPolicyMappingsText).toBe('IR_VAT_9=64');
  });

  it('surfaces an orphan tax-policy mapping without deleting it', () => {
    renderSection({
      view: 'form',
      form: {
        ...formFrom(threeConnections()[1]),
        taxPolicyMappingsText: 'IR_VAT_9=64\nGONE_POLICY=99',
      },
    });

    expect(screen.getByText('GONE_POLICY')).toBeTruthy();
    expect(
      screen.getByText('این سیاست حذف یا غیرفعال شده؛ نگاشت را اصلاح کنید.'),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪') as HTMLSelectElement)
        .value,
    ).toBe('64');
  });

  it('warns when the code stands for a different total rate and says sending stops', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[1]), taxPolicyMappingsText: 'IR_VAT_9=70' },
    });

    expect(
      screen.getByText(
        'نرخ کل سیاست با نرخ اعلام‌شدهٔ این کد در مقصد یکسان نیست؛ تا اصلاح این نگاشت، ارسال سند متوقف می‌ماند.',
      ),
    ).toBeTruthy();
  });

  it('warns when totals match but the tax/duty split does not', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[1]), taxPolicyMappingsText: 'IR_VAT_9=64' },
      taxPolicies: [
        {
          ...policies[0],
          ratePercent: '۴.۵',
          dutyRatePercent: '۴.۵',
          rateBasisPoints: '450',
          dutyRateBasisPoints: '450',
        },
      ],
    });

    expect(
      screen.getByText(
        'جمع نرخ‌ها برابر است اما ترکیب مالیات و عوارض با تعریف مقصد یکی نیست؛ تا اصلاح این نگاشت، ارسال سند متوقف می‌ماند.',
      ),
    ).toBeTruthy();
  });

  it('does not warn when the code matches both total and split', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[1]), taxPolicyMappingsText: 'IR_VAT_9=64' },
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses to offer any tax mapping when the destination has no tax contract', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[2]), mockProfile: 'NO_TAX' },
    });

    expect(
      screen.getByText('مالیات و عوارض در این مقصد پشتیبانی نمی‌شود'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('table', { name: 'سیاست‌های مالیات و عوارض این اتصال' }),
    ).toBeNull();
  });

  it('switches mock profile fields through capabilities, not provider name checks', () => {
    const coded = formFrom(threeConnections()[1]);
    const { rerender } = render(
      <AccountingConnectionsSection
        data={panelData(threeConnections())}
        form={coded}
        modes={resolveFinancialModes({
          adapterId: coded.adapterId,
          adapters: panelData(threeConnections()).adapters,
          financial: {
            baseCurrency: coded.baseCurrency,
            currencyMappings: {},
            conversionRate: coded.conversionRate,
            mockProfile: 'CODED',
          },
        })}
        policies={policies}
        currencies={currencies}
        canManage
        busy={false}
        selectedConnectionId="conn-2"
        testResult={null}
        view="form"
        focus={null}
        onOpenList={vi.fn()}
        onSelectConnection={vi.fn()}
        onSetWorkspaceDefault={vi.fn()}
        onDeactivateConnection={vi.fn()}
        onReactivateConnection={vi.fn()}
        onEditConnection={vi.fn()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪')).toBeTruthy();

    const noTax = { ...coded, mockProfile: 'NO_TAX' };
    const data = panelData(threeConnections());

    rerender(
      <AccountingConnectionsSection
        data={data}
        form={noTax}
        modes={resolveFinancialModes({
          adapterId: noTax.adapterId,
          adapters: data.adapters,
          financial: {
            baseCurrency: noTax.baseCurrency,
            currencyMappings: {},
            conversionRate: noTax.conversionRate,
            mockProfile: 'NO_TAX',
          },
        })}
        policies={policies}
        currencies={currencies}
        canManage
        busy={false}
        selectedConnectionId="conn-2"
        testResult={null}
        view="form"
        focus={null}
        onOpenList={vi.fn()}
        onSelectConnection={vi.fn()}
        onSetWorkspaceDefault={vi.fn()}
        onDeactivateConnection={vi.fn()}
        onReactivateConnection={vi.fn()}
        onEditConnection={vi.fn()}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    expect(
      screen.getByText('مالیات و عوارض در این مقصد پشتیبانی نمی‌شود'),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪'),
    ).toBeNull();
  });
});

describe('the special tax row code', () => {
  it('is asked for only when the destination identifies tax by a row code', () => {
    renderSection({ view: 'form' });

    expect(screen.getByLabelText('کد ردیف مالیات')).toBeTruthy();
    expect(screen.getByLabelText('کد ردیف عوارض')).toBeTruthy();
  });

  it('is not asked of a rate destination', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[2]) });

    expect(screen.queryByLabelText('کد ردیف مالیات')).toBeNull();
    expect(screen.queryByLabelText('کد ردیف عوارض')).toBeNull();
  });
});

describe('deep links from the documents readiness list', () => {
  it('lands on the currency section of the selected connection', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[1]), focus: 'money' });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    const moneySection = document.querySelector('[data-form-section="money"]');

    expect(moneySection).not.toBeNull();
    expect(moneySection?.contains(document.activeElement)).toBe(true);
  });

  it('lands on the tax section of the selected connection', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[1]), focus: 'tax' });

    const taxSection = document.querySelector('[data-form-section="tax"]');

    expect(taxSection).not.toBeNull();
    expect(taxSection?.contains(document.activeElement)).toBe(true);
  });

  // The production host renders this tree through an adapter whose nodes answer
  // querySelector and focus but have no scrollIntoView. Calling it unguarded threw inside
  // the effect and took the whole panel to an error screen instead of opening the section.
  it('still lands on the section when the host cannot scroll', () => {
    const original = Element.prototype.scrollIntoView;

    // @ts-expect-error the host node genuinely lacks the method; jsdom's has it.
    Element.prototype.scrollIntoView = undefined;

    try {
      renderSection({ view: 'form', form: formFrom(threeConnections()[1]), focus: 'tax' });

      expect(document.querySelector('[data-form-section="tax"]')).not.toBeNull();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('saving from the form', () => {
  it('reports a missing name next to the field and refuses to save', () => {
    const { onSave } = renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[0]), name: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تنظیمات' }));

    expect(screen.getByRole('alert').textContent).toBe('نام اتصال را وارد کنید.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves once the form is complete', () => {
    const { onSave } = renderSection({ view: 'form' });

    fireEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تنظیمات' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('the result of a probe is reported without borrowing a live claim', () => {
  it('calls a mock success simulated', () => {
    renderSection({
      view: 'form',
      form: formFrom(threeConnections()[2]),
      testResult: { healthState: 'OK', message: 'شبیه‌سازی پاسخ داد', detail: '' },
    });

    expect(screen.getByText('آزمایش شبیه‌سازی‌شده موفق بود')).toBeTruthy();
  });

  it('does not claim a verified live connection from a single successful probe', () => {
    const unverified = connection({
      id: 'conn-unverified',
      verificationState: 'LIVE_UNVERIFIED',
      healthState: 'UNKNOWN',
      lastHealthCheckAt: null,
      lastHealthMessage: null,
    });

    renderSection({
      connections: [unverified],
      form: formFrom(unverified),
      selectedConnectionId: 'conn-unverified',
      view: 'form',
      testResult: { healthState: 'OK', message: 'پاسخ داد', detail: '' },
    });

    expect(
      screen.getByText('پاسخ سرور دریافت شد (اتصال واقعی تأیید نشده)'),
    ).toBeTruthy();
    expect(screen.queryByText('اتصال واقعی تأییدشده')).toBeNull();
  });

  // The badge reports what is stored, so a verified record keeps its badge; that is evidence
  // of the saved probe, not of the probe that just returned.
  it('shows the live badge only for the saved record that was verified', () => {
    renderSection({ view: 'form' });

    expect(screen.getByText('اتصال واقعی تأییدشده')).toBeTruthy();
  });
});

describe('probing only ever targets a saved record', () => {
  it('does not offer a probe for a connection that was never saved', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[0]), id: null },
    });

    const button = screen.getByRole('button', {
      name: 'آزمایش اتصال ذخیره‌شده',
    });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/این اتصال هنوز ذخیره نشده است/),
    ).toBeTruthy();
  });

  it('says unsaved edits are not what the probe checked', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[0]), name: 'نام ویرایش‌نشده' },
    });

    expect(screen.getByText(/تغییرات ذخیره‌نشده آزمایش نمی‌شوند/)).toBeTruthy();
  });
});
