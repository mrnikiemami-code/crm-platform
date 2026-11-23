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
    taxHandling: 'TAX_CODE_AND_AMOUNT',
    dutyHandling: 'DUTY_AMOUNT',
    currencyHandling: 'SINGLE_CURRENCY',
    baseCurrency: 'IRR',
    requiresSpecialItemCodes: true,
    testProfiles: [],
  },
  {
    id: 'mock',
    label: 'آزمایشی (Mock)',
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
  onSelectConnection = vi.fn<(connection: ConnectionRecord) => void>(),
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
  onSelectConnection?: ReturnType<typeof vi.fn<(connection: ConnectionRecord) => void>>;
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
      canManage
      busy={false}
      selectedConnectionId={selectedConnectionId}
      testResult={testResult}
      view={view}
      focus={focus}
      onOpenList={vi.fn()}
      onSelectConnection={onSelectConnection}
      onEditConnection={onEditConnection}
      onChange={onChange}
      onSave={onSave}
      onTest={vi.fn()}
      onStartNew={vi.fn()}
    />,
  );

  return { onSelectConnection, onEditConnection, onSave, onChange };
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
    // The badge and the disabled action both say the row is the selected one.
    expect(within(first).getAllByText('اتصال انتخاب‌شده').length).toBeGreaterThan(0);
    expect(rest.map((row) => row.getAttribute('data-connection-id'))).toEqual([
      'conn-1',
      'conn-3',
    ]);
    expect(rest.some((row) => within(row).queryByText('اتصال انتخاب‌شده'))).toBe(
      false,
    );
  });

  it('marks only one row, even when the server returned another active record', () => {
    renderSection({ selectedConnectionId: 'conn-3' });

    const marked = tableRows().filter(
      (row) => row.getAttribute('data-selected') === 'true',
    );

    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-connection-id')).toBe('conn-3');
  });

  it('selects a connection without opening its edit form', () => {
    const { onSelectConnection, onEditConnection } = renderSection();

    const row = within(
      screen.getByRole('table', { name: 'اتصال‌های حسابداری' }),
    )
      .getAllByRole('row')
      .find((entry) => entry.getAttribute('data-connection-id') === 'conn-2');

    fireEvent.click(
      within(row as HTMLElement).getByRole('button', { name: 'انتخاب این اتصال' }),
    );

    expect(onSelectConnection).toHaveBeenCalledTimes(1);
    expect(onSelectConnection.mock.calls[0][0].id).toBe('conn-2');
    expect(onEditConnection).not.toHaveBeenCalled();
  });

  it('opens the edit form without changing the selection', () => {
    const { onSelectConnection, onEditConnection } = renderSection();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'ویرایش تنظیمات' })[1],
    );

    expect(onEditConnection).toHaveBeenCalledTimes(1);
    expect(onSelectConnection).not.toHaveBeenCalled();
  });

  it('does not offer selection on the row already selected', () => {
    renderSection({ selectedConnectionId: 'conn-1' });

    const buttons = screen.getAllByRole('button', { name: 'اتصال انتخاب‌شده' });

    expect(buttons).toHaveLength(1);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('honest health states in the list', () => {
  it('labels a mock connection as simulated, never as a verified connection', () => {
    renderSection({ selectedConnectionId: 'conn-2' });

    const table = screen.getByRole('table', { name: 'اتصال‌های حسابداری' });
    const mockRow = within(table)
      .getAllByRole('row')
      .find((row) => row.getAttribute('data-connection-id') === 'conn-2');

    expect(within(mockRow as HTMLElement).getByText('آزمایشی — Mock')).toBeTruthy();
    expect(
      within(mockRow as HTMLElement).queryByText('اتصال واقعی تأییدشده'),
    ).toBeNull();
    expect(
      within(mockRow as HTMLElement).queryByText('تنظیم‌شده، بررسی‌نشده'),
    ).toBeNull();
  });

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

describe('the currency form follows the declared contract', () => {
  it('asks a single-currency destination for a base currency and no code', () => {
    renderSection({ view: 'form' });

    expect(screen.getByLabelText('ارز پایهٔ مقصد')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'نگاشت ارز CRM به ارز مقصد' })).toBeNull();
  });

  it('asks a code destination for a mapping table instead of a base currency', () => {
    const form = formFrom(threeConnections()[1]);

    renderSection({ view: 'form', form });

    expect(
      screen.getByRole('table', { name: 'نگاشت ارز CRM به ارز مقصد' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('کد ارز در مقصد برای IRR')).toBeTruthy();
    expect(screen.queryByLabelText('ارز پایهٔ مقصد')).toBeNull();
  });
});

describe('the tax form follows the declared contract', () => {
  it('shows the CRM rate to a rate destination and asks for no code', () => {
    const form = formFrom(threeConnections()[2]);

    renderSection({ view: 'form', form });

    expect(screen.getByRole('table', { name: 'نرخ سیاست‌های مالیات CRM' })).toBeTruthy();
    expect(
      screen.queryByRole('table', {
        name: 'نگاشت سیاست مالیات CRM به یک کد مالیات در این اتصال',
      }),
    ).toBeNull();
    expect(screen.queryByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪')).toBeNull();
  });

  it('asks a code destination for a mapping of this connection only', () => {
    const form = formFrom(threeConnections()[1]);

    renderSection({ view: 'form', form });

    expect(
      screen.getByRole('table', {
        name: 'نگاشت سیاست مالیات CRM به یک کد مالیات در این اتصال',
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪'),
    ).toBeTruthy();
  });

  it('refuses to offer any tax mapping when the destination has no tax contract', () => {
    const record = threeConnections()[2];

    renderSection({
      view: 'form',
      form: { ...formFrom(record), mockProfile: 'NO_TAX' },
    });

    expect(
      screen.getByText('مالیات در این مقصد پشتیبانی نمی‌شود'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('table', {
        name: 'نگاشت سیاست مالیات CRM به یک کد مالیات در این اتصال',
      }),
    ).toBeNull();
    expect(screen.queryByRole('table', { name: 'نرخ سیاست‌های مالیات CRM' })).toBeNull();
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
    const { onSave } = renderSection({ view: 'form', form: { ...formFrom(threeConnections()[0]), name: '' } });

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
    renderSection({
      view: 'form',
      testResult: { healthState: 'OK', message: 'پاسخ داد', detail: '' },
    });

    expect(
      screen.getByText('پاسخ سرور دریافت شد (اتصال واقعی تأیید نشده)'),
    ).toBeTruthy();
    expect(screen.queryByText('اتصال واقعی تأییدشده')).toBeNull();
  });
});

describe('one tax policy, one destination code', () => {
  const codedForm = (mapping: string): FormState => ({
    ...formFrom(threeConnections()[1]),
    taxPolicyMappingsText: mapping,
  });

  it('offers exactly one code field per policy and no duty code field', () => {
    renderSection({ view: 'form', form: codedForm('') });

    expect(
      screen.getByRole('table', {
        name: 'نگاشت سیاست مالیات CRM به یک کد مالیات در این اتصال',
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪'),
    ).toHaveLength(1);
    expect(screen.queryByLabelText('کد عوارض برای مالیات بر ارزش افزوده ۹٪')).toBeNull();
    expect(
      screen.queryByRole('table', { name: 'نگاشت سیاست CRM به کد عوارض این اتصال' }),
    ).toBeNull();
  });

  it('shows the total rate and both internal components on the same row', () => {
    renderSection({ view: 'form', form: codedForm('') });

    expect(screen.getByText('نرخ کل (مالیات + عوارض)')).toBeTruthy();
    expect(screen.getByText('۹٪ (۶ + ۳)')).toBeTruthy();
  });

  it('writes the single destination code into the policy mapping', () => {
    const { onChange } = renderSection({ view: 'form', form: codedForm('') });

    fireEvent.change(
      screen.getByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪'),
      { target: { value: '64' } },
    );

    const last = onChange.mock.calls.at(-1)?.[0] as FormState;

    expect(last.taxPolicyMappingsText).toBe('IR_VAT_9=64');
    expect(Object.keys(last)).not.toContain('dutyPolicyMappingsText');
  });

  it('maps the same policy to a different code per connection', () => {
    renderSection({ view: 'form', form: codedForm('IR_VAT_9=64') });

    const first = screen.getByLabelText(
      'کد مالیات برای مالیات بر ارزش افزوده ۹٪',
    ) as HTMLInputElement;

    expect(first.value).toBe('64');

    cleanup();
    renderSection({ view: 'form', form: codedForm('IR_VAT_9=70') });

    const second = screen.getByLabelText(
      'کد مالیات برای مالیات بر ارزش افزوده ۹٪',
    ) as HTMLInputElement;

    expect(second.value).toBe('70');
  });

  it('warns when the code stands for a different total rate', () => {
    renderSection({ view: 'form', form: codedForm('IR_VAT_9=70') });

    expect(
      screen.getByText(
        'نرخ کل سیاست با نرخ اعلام‌شدهٔ این کد در مقصد یکسان نیست.',
      ),
    ).toBeTruthy();
  });

  it('warns when totals match but the tax/duty split does not', () => {
    renderSection({
      view: 'form',
      form: codedForm('IR_VAT_9=64'),
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
        'جمع نرخ‌ها برابر است اما ترکیب مالیات و عوارض با تعریف مقصد یکی نیست.',
      ),
    ).toBeTruthy();
  });

  it('does not warn when the code matches both total and split', () => {
    renderSection({ view: 'form', form: codedForm('IR_VAT_9=64') });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the CRM duty rate to a rate destination and asks for no code', () => {
    renderSection({ view: 'form', form: formFrom(threeConnections()[2]) });

    expect(screen.getByText('نرخ عوارضی که به مقصد می‌رسد')).toBeTruthy();
    expect(screen.queryByLabelText('کد مالیات برای مالیات بر ارزش افزوده ۹٪')).toBeNull();
  });

  it('says a policy-code destination carries duty inside the one code', () => {
    renderSection({ view: 'form', form: codedForm('') });

    expect(screen.getByText('یک کد، کل سیاست')).toBeTruthy();
    expect(screen.getByText('عوارض داخل کد واحد سیاست')).toBeTruthy();
  });

  it('says an aggregate destination receives only the combined figure', () => {
    const record = threeConnections()[2];

    renderSection({
      view: 'form',
      form: { ...formFrom(record), mockProfile: 'AGGREGATE' },
    });

    expect(screen.getByText('قرارداد تجمیعی')).toBeTruthy();
    expect(
      screen.queryByRole('table', { name: 'نگاشت سیاست CRM به کد عوارض این اتصال' }),
    ).toBeNull();
  });

  it('refuses the duty contract when the destination does not support it', () => {
    renderSection({
      view: 'form',
      form: { ...formFrom(threeConnections()[2]), mockProfile: 'NO_TAX' },
    });

    expect(screen.getByText('عوارض در این مقصد پشتیبانی نمی‌شود')).toBeTruthy();
    expect(
      screen.queryByRole('table', { name: 'نگاشت سیاست CRM به کد عوارض این اتصال' }),
    ).toBeNull();
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

    expect(screen.getByText(/تغییرات ذخیر.*آزمایش نمی.*شوند/)).toBeTruthy();
  });
});
