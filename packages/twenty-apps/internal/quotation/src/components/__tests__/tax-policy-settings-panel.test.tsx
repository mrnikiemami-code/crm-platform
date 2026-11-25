// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaxPolicySettingsPanel } from 'src/components/tax-policy-settings-panel';

const { callAppRouteMock } = vi.hoisted(() => ({
  callAppRouteMock: vi.fn(),
}));
const { snackbarMock } = vi.hoisted(() => ({ snackbarMock: vi.fn() }));

vi.mock('src/components/quotation-api', () => ({
  TAX_POLICIES_ROUTE: '/quotation/tax-policies',
  QUOTATION_CURRENCIES_ROUTE: '/quotation/currencies',
  callAppRoute: callAppRouteMock,
}));

vi.mock('twenty-sdk/front-component', () => ({
  enqueueSnackbar: snackbarMock,
}));

type PolicyFixture = {
  recordId: string;
  code: string;
  name: string;
  ratePercent: string;
  dutyRatePercent: string;
  totalRatePercent: string;
  accountingCode: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
  quotationCount: number;
};

const policy = (overrides: Partial<PolicyFixture> = {}): PolicyFixture => ({
  recordId: 'tp-1',
  code: 'TAX_1000',
  name: 'مالیات ۱۰٪',
  ratePercent: '10',
  dutyRatePercent: '0',
  totalRatePercent: '10',
  accountingCode: '',
  isActive: true,
  isDefault: false,
  isExempt: false,
  quotationCount: 0,
  ...overrides,
});

const catalog = (policies: PolicyFixture[]) => ({
  data: { success: true, policies, defaultCode: null },
});

const currencyCatalog = () => ({
  data: {
    success: true,
    currencies: [
      {
        recordId: 'cur-1',
        code: 'IRR',
        name: 'ریال ایران',
        isDefault: true,
        isActive: true,
        accountingCode: '',
      },
    ],
    defaultCode: 'IRR',
  },
});

const ledger = (): HTMLElement => {
  const table = document.querySelector('.tax-ledger');

  if (table === null) {
    throw new Error('ledger table was not rendered');
  }

  return table as HTMLElement;
};

const renderPanel = async () => {
  render(<TaxPolicySettingsPanel />);
  await waitFor(() => {
    if (document.querySelector('.tax-ledger') === null) {
      throw new Error('waiting for ledger');
    }
  });
  await within(ledger()).findByText('مالیات ۱۰٪');
};

const rowOf = (name: string): HTMLElement => {
  const row = within(ledger()).getByText(name).closest('tr');

  if (row === null) {
    throw new Error(`row for "${name}" was not rendered as a table row`);
  }

  return row;
};

beforeEach(() => {
  callAppRouteMock.mockReset();
  snackbarMock.mockReset();
  callAppRouteMock.mockImplementation(async (route: string) => {
    if (route === '/quotation/currencies') {
      return currencyCatalog();
    }

    return catalog([policy({ isDefault: true })]);
  });
});

afterEach(cleanup);

describe('tax policy settings panel', () => {
  it('paints exactly one default badge and no action labelled like it', async () => {
    callAppRouteMock.mockResolvedValue(
      catalog([
        policy({ recordId: 'tp-1', code: 'TAX_1000', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'مالیات ۶٪',
          quotationCount: 3,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await within(await screen.findByRole('table')).findByText('مالیات ۶٪');

    const defaultRow = rowOf('مالیات ۱۰٪');
    expect(within(defaultRow).getByText('پیش‌فرض').closest('button')).toBeNull();
    expect(
      within(defaultRow).queryByRole('button', { name: /^پیش‌فرض/ }),
    ).toBeNull();
    expect(
      within(ledger()).getAllByRole('button', { name: /^پیش‌فرض/ }),
    ).toHaveLength(1);
  });

  it('shows tax, duty, total and document count in ledger columns', async () => {
    callAppRouteMock.mockResolvedValue(
      catalog([
        policy({
          recordId: 'tp-1',
          name: 'مالیات ۱۰٪',
          ratePercent: '6',
          dutyRatePercent: '4',
          totalRatePercent: '10',
          isDefault: true,
          quotationCount: 5,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);

    await waitFor(() => {
      if (document.querySelector('.tax-ledger') === null) {
        throw new Error('waiting for ledger');
      }
    });
    const row = within(ledger()).getByText('مالیات ۱۰٪').closest('tr');

    if (row === null) {
      throw new Error('row was not rendered as a table row');
    }

    expect(screen.getByRole('columnheader', { name: 'مالیات' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'عوارض' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'نرخ کل' })).toBeTruthy();
    expect(within(row).getByText('۶٪')).toBeTruthy();
    expect(within(row).getByText('۴٪')).toBeTruthy();
    expect(within(row).getByText('۱۰٪')).toBeTruthy();
    expect(within(row).getByText(/در ۵ سند استفاده شده است/)).toBeTruthy();
  });

  it('has no exemption checkbox and states that both rates at zero mean exempt', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('هر دو نرخ صفر یعنی معاف از مالیات.')).toBeTruthy();
  });

  it('keeps the delete control on a used policy and explains why it is disabled', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'سیاست استفاده‌شده',
          quotationCount: 3,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await within(await screen.findByRole('table')).findByText(
      'سیاست استفاده‌شده',
    );

    const deleteButton = within(rowOf('سیاست استفاده‌شده')).getByRole(
      'button',
      { name: /^حذف/ },
    );

    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(rowOf('سیاست استفاده‌شده')).getByText(
        'در ۳ سند استفاده شده است؛ حذف‌شدنی نیست.',
      ),
    ).toBeTruthy();
  });

  it('asks on the first delete press and cancels without touching the server', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'سیاست بی‌استفاده',
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await within(await screen.findByRole('table')).findByText(
      'سیاست بی‌استفاده',
    );
    fireEvent.click(
      within(rowOf('سیاست بی‌استفاده')).getByRole('button', { name: /^حذف/ }),
    );

    expect(screen.getByText(/«سیاست بی‌استفاده» حذف شود؟/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'تأیید حذف' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'انصراف از حذف' }));

    expect(screen.queryByRole('button', { name: 'تأیید حذف' })).toBeNull();
    expect(callAppRouteMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a delete the server rejects on the row, so a stale count cannot delete history', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(
        catalog([
          policy({ recordId: 'tp-1', isDefault: true }),
          policy({
            recordId: 'tp-2',
            code: 'TAX_1050',
            name: 'سیاست بی‌استفاده',
          }),
        ]),
      )
      .mockResolvedValueOnce({
        data: {
          success: false,
          code: 'TAX_POLICY_IN_USE',
          message:
            'این سیاست در ۸ سند استفاده شده است؛ حذف نمی‌شود، فقط غیرفعال می‌شود',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست بی‌استفاده');
    fireEvent.click(
      within(rowOf('سیاست بی‌استفاده')).getByRole('button', { name: /^حذف/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف' }));

    expect((await screen.findByRole('alert')).textContent).toContain('۸ سند');
    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'delete', recordId: 'tp-2' },
    );
    expect(snackbarMock).not.toHaveBeenCalled();
  });

  it('deletes an unused policy after confirm and reports success', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(
        catalog([
          policy({ recordId: 'tp-1', isDefault: true }),
          policy({
            recordId: 'tp-2',
            code: 'TAX_550_2',
            name: 'سیاست آزمایشی',
            quotationCount: 0,
          }),
        ]),
      )
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [policy({ recordId: 'tp-1', isDefault: true })],
          message: 'سیاست مالیات حذف شد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست آزمایشی');
    fireEvent.click(
      within(rowOf('سیاست آزمایشی')).getByRole('button', { name: /^حذف/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف' }));

    await waitForElementToBeRemoved(() => screen.queryByText('سیاست آزمایشی'));
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('keeps the same action set on the default row and only disables what is refused', async () => {
    await renderPanel();

    const row = rowOf('مالیات ۱۰٪');

    const deactivate = within(row).getByRole('button', {
      name: /^غیرفعال/,
    }) as HTMLButtonElement;
    const remove = within(row).getByRole('button', {
      name: /^حذف/,
    }) as HTMLButtonElement;

    expect(deactivate.disabled).toBe(true);
    expect(remove.disabled).toBe(true);
    expect(within(row).queryByRole('button', { name: /^پیش‌فرض/ })).toBeNull();
    expect(within(row).getByRole('button', { name: /^ویرایش/ })).toBeTruthy();
    expect(
      within(row).getByText(/سیاست پیش‌فرض غیرفعال یا حذف نمی‌شود/),
    ).toBeTruthy();
  });

  it('sets the default from the row and keeps a single default badge afterwards', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(
        catalog([
          policy({ recordId: 'tp-1', isDefault: true }),
          policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
        ]),
      )
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [
            policy({ recordId: 'tp-1', isDefault: false }),
            policy({
              recordId: 'tp-2',
              code: 'TAX_900',
              name: 'مالیات ۹٪',
              isDefault: true,
            }),
          ],
          message: 'سیاست پیش‌فرض تغییر کرد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    fireEvent.click(screen.getByRole('button', { name: /^پیش‌فرض/ }));

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'set-default', recordId: 'tp-2' },
    );

    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the default move has not completed yet');
      }
    });

    const promoted = rowOf('مالیات ۹٪');

    expect(within(promoted).getByText('پیش‌فرض').closest('button')).toBeNull();
    expect(
      within(promoted).queryByRole('button', { name: /^پیش‌فرض/ }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /^پیش‌فرض/ }),
    ).toHaveLength(1);
  });

  it('repaints a demoted row as non-default when the payload still flags it', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(
        catalog([
          policy({ recordId: 'tp-1', name: 'مالیات ۹٪', isDefault: true }),
          policy({ recordId: 'tp-2', name: 'مالیات ۱۰٪' }),
        ]),
      )
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [
            policy({ recordId: 'tp-1', name: 'مالیات ۹٪', isDefault: true }),
            policy({ recordId: 'tp-2', name: 'مالیات ۱۰٪', isDefault: true }),
          ],
          message: 'سیاست پیش‌فرض تغییر کرد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    fireEvent.click(screen.getByRole('button', { name: /^پیش‌فرض/ }));

    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the default move has not completed yet');
      }
    });

    const demoted = rowOf('مالیات ۹٪');
    expect(within(demoted).getByRole('button', { name: /^پیش‌فرض/ })).toBeTruthy();
    expect(within(rowOf('مالیات ۱۰٪')).getByText('پیش‌فرض')).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /^پیش‌فرض/ }),
    ).toHaveLength(1);
  });

  it('reports a bad rate under its own field with aria-invalid, not as a page error', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));

    const taxField = screen.getByLabelText('مالیات ٪');
    fireEvent.change(taxField, { target: { value: 'abc' } });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('درصد مالیات باید عددی');
    expect(taxField.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the typed values and the computed total in the editor', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));
    fireEvent.change(screen.getByLabelText('نام سیاست'), {
      target: { value: 'مالیات ۷٫۶٪' },
    });
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۵٫۵' },
    });
    fireEvent.change(screen.getByLabelText('عوارض ٪'), {
      target: { value: '۲٫۱' },
    });

    expect(screen.getByText(/۷[.٫]۶٪/)).toBeTruthy();
    expect(
      (screen.getByLabelText('نام سیاست') as HTMLInputElement).value,
    ).toBe('مالیات ۷٫۶٪');
  });

  it('opens the inspector on the row being edited and saves it back', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]))
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [
            policy({ recordId: 'tp-1', name: 'مالیات ۱۰٪', isDefault: false }),
          ],
          message: 'سیاست مالیات ذخیره شد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    const row = rowOf('مالیات ۱۰٪');
    fireEvent.click(within(row).getByRole('button', { name: /^ویرایش/ }));

    expect(screen.getByText('ویرایش سیاست')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      {
        action: 'save',
        recordId: 'tp-1',
        name: 'مالیات ۱۰٪',
        ratePercentText: '10',
        dutyRatePercentText: '0',
        accountingCodeText: '',
        isActive: true,
      },
    );
    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the save has not completed yet');
      }
    });
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('shows the unsaved mark while the editor differs from the row it opened', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([policy({ recordId: 'tp-1' })]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    expect(screen.queryByText('ذخیره‌نشده')).toBeNull();

    fireEvent.change(screen.getByDisplayValue('مالیات ۱۰٪'), {
      target: { value: 'مالیات ۱۲٪' },
    });

    expect(screen.getByText('ذخیره‌نشده')).toBeTruthy();
  });

  it('keeps the editor open with the server message when a save is refused', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]))
      .mockResolvedValueOnce({
        data: {
          success: false,
          code: 'TAX_POLICY_DUPLICATE_RATE',
          message: 'سیاستی با همین نرخ از قبل وجود دارد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    fireEvent.click(screen.getByRole('button', { name: /^ویرایش/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'سیاستی با همین نرخ از قبل وجود دارد',
    );
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeTruthy();
  });

  it('offers the base 9% policy when the catalog is empty', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(catalog([]))
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [
            policy({
              recordId: 'tp-1',
              name: 'مالیات ۹٪',
              isDefault: true,
            }),
          ],
          message: 'سیاست پایه آماده شد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('هنوز سیاست مالیات و عوارضی ثبت نشده است.');

    fireEvent.click(
      screen.getByRole('button', { name: 'ساخت سیاست پایهٔ ۹٪' }),
    );

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'bootstrap' },
    );
    expect(await screen.findByText('مالیات ۹٪')).toBeTruthy();
  });

  it('gives every row action a bounded control and keeps the height in the stylesheet', async () => {
    callAppRouteMock.mockResolvedValue(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'سیاست استفاده‌شده',
          ratePercent: '6',
          dutyRatePercent: '4',
          totalRatePercent: '10',
          quotationCount: 4,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست استفاده‌شده');

    const rowButtons = within(rowOf('سیاست استفاده‌شده')).getAllByRole(
      'button',
    );

    expect(rowButtons.length).toBeGreaterThan(0);

    for (const button of rowButtons) {
      expect(button.className).toContain('tax-btn');
      expect(button.style.border).toBe('');
      expect(button.style.background).toBe('');
    }

    const panelCss = document.querySelector('style')?.textContent ?? '';
    expect(panelCss).toContain('.tax-btn {');
    expect(panelCss).toContain('height: 32px');
    expect(panelCss).toContain('.tax-btn:disabled');
    expect(panelCss).toContain('border-color: var(--t-color-gray5)');
    expect(panelCss).toMatch(/@media \(max-width: 720px\)[\s\S]*height: 44px/);
  });

  it('marks an inactive policy with an explicit badge', async () => {
    callAppRouteMock.mockResolvedValue(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'نرخ قدیم',
          isActive: false,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('نرخ قدیم');

    const row = rowOf('نرخ قدیم');

    expect(within(row).getByText('غیرفعال')).toBeTruthy();
    expect(row.className).toContain('is-inactive');
    expect(within(row).getByRole('button', { name: /^فعال/ })).toBeTruthy();

    const remove = within(row).getByRole('button', {
      name: /^حذف/,
    }) as HTMLButtonElement;

    expect(remove.disabled).toBe(false);
  });

  it('renders a labelled ledger table for the catalog', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('columnheader', { name: 'سیاست' })).toBeTruthy();
  });

  it('names each row control after the policy it acts on', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
        policy({ recordId: 'tp-3', code: 'TAX_800', name: 'مالیات ۸٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    const edits = within(screen.getByRole('table')).getAllByRole('button', {
      name: /^ویرایش/,
    });

    expect(edits.map((button) => button.getAttribute('aria-label'))).toEqual([
      'ویرایش — مالیات ۱۰٪',
      'ویرایش — مالیات ۹٪',
      'ویرایش — مالیات ۸٪',
    ]);
  });

  it('refuses to replace an editor holding typed numbers and says why', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    fireEvent.click(
      within(rowOf('مالیات ۹٪')).getByRole('button', { name: /^ویرایش/ }),
    );
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۷' },
    });

    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    expect(screen.getByText(/تغییرات ذخیره‌نشده دارید/)).toBeTruthy();
    expect(
      (screen.getByLabelText('مالیات ٪') as HTMLInputElement).value,
    ).toBe('۷');
    expect(callAppRouteMock).toHaveBeenCalledTimes(1);
  });

  it('lets the operator discard deliberately, by cancelling', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));
    fireEvent.change(screen.getByLabelText('نام سیاست'), {
      target: { value: 'نیمه‌کاره' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));

    expect(screen.queryByLabelText('نام سیاست')).toBeNull();
  });

  it('offers a retry when the list cannot be read', async () => {
    callAppRouteMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]));

    render(<TaxPolicySettingsPanel />);

    expect(
      await screen.findByText(/فهرست سیاست‌های مالیات خوانده نشد/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }));

    expect(await screen.findByText('مالیات ۱۰٪')).toBeTruthy();
    expect(callAppRouteMock).toHaveBeenCalledTimes(2);
  });

  it('states an exempt policy in words instead of a zero that reads as unfilled', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({
          recordId: 'tp-1',
          name: 'سیاست معاف',
          ratePercent: '0',
          dutyRatePercent: '0',
          totalRatePercent: '0',
          isExempt: true,
          isDefault: true,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست معاف');

    const row = rowOf('سیاست معاف');
    const cells = within(row).getAllByRole('cell');

    // Components stay ۰٪; the total column is the statement «معاف», not a blank zero.
    expect(within(cells[3]).getByText('معاف')).toBeTruthy();
    expect(within(cells[3]).queryByText('۰٪')).toBeNull();
  });

  it('keeps the row mounted and opens the inspector beside the ledger', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    const toggle = within(rowOf('مالیات ۹٪')).getByRole('button', {
      name: /^ویرایش/,
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    const reopened = within(rowOf('مالیات ۹٪')).getByRole('button', {
      name: /^ویرایش/,
    });

    expect(reopened.getAttribute('aria-expanded')).toBe('true');
    expect(reopened.textContent).toBe('بستن');
    expect(screen.getByLabelText('نام سیاست')).toBeTruthy();
    expect(document.getElementById('tax-inspector')).toBeTruthy();

    fireEvent.click(reopened);

    expect(screen.queryByLabelText('نام سیاست')).toBeNull();
    expect(
      within(rowOf('مالیات ۹٪'))
        .getByRole('button', { name: /^ویرایش/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('saves from the keyboard when Enter is pressed in a field', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]))
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [policy({ recordId: 'tp-1' })],
          message: 'سیاست مالیات ذخیره شد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    const nameField = screen.getByLabelText('نام سیاست').closest('form');
    expect(nameField).not.toBeNull();

    fireEvent.submit(nameField as HTMLFormElement);

    await waitFor(() => {
      if (callAppRouteMock.mock.calls.length < 2) {
        throw new Error('the submit has not reached the server yet');
      }
    });

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      expect.objectContaining({ action: 'save', recordId: 'tp-1' }),
    );
  });

  it('puts a missing name on the name field only', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۶' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    const nameField = screen.getByLabelText('نام سیاست');

    expect(nameField.getAttribute('aria-invalid')).toBe('true');
    expect(nameField.getAttribute('aria-describedby')).toBe(
      'tax-policy-name-error',
    );
    expect(screen.getByText('نام سیاست مالیات را وارد کنید')).toBeTruthy();
    expect(screen.getByLabelText('مالیات ٪').getAttribute('aria-invalid')).toBe(
      'false',
    );
    expect(callAppRouteMock).toHaveBeenCalledTimes(1);
  });

  it('shows the retry and nothing else when the first read fails', async () => {
    callAppRouteMock.mockRejectedValueOnce(new Error('offline'));

    render(<TaxPolicySettingsPanel />);

    expect(
      await screen.findByText(/فهرست سیاست‌های مالیات خوانده نشد/),
    ).toBeTruthy();

    expect(
      screen.queryByText(/هنوز سیاست مالیات و عوارضی ثبت نشده/),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /ساخت سیاست پایه/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /سیاست جدید/ }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'تلاش مجدد' })).toBeTruthy();
  });

  it('writes the unsaved refusal on the row that was pressed', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    fireEvent.click(
      within(rowOf('مالیات ۹٪')).getByRole('button', { name: /^ویرایش/ }),
    );
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۷' },
    });
    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    const refusal = within(rowOf('مالیات ۱۰٪')).getByRole('status');

    expect(refusal.textContent).toContain('تغییرات ذخیره‌نشده دارید');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('مالیات ٪')).toBeTruthy();
  });

  it('paints no colour literal, so the panel follows the shell theme', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({
          recordId: 'tp-2',
          code: 'TAX_1050',
          name: 'سیاست استفاده‌شده',
          quotationCount: 2,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست استفاده‌شده');

    const root = document.querySelector('.tax-root');
    const css = document.querySelector('style')?.textContent ?? '';
    const markup = root?.outerHTML ?? '';

    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).toContain('var(--t-color-');
  });

  it('surfaces the active default above the ledger', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({
          recordId: 'tp-1',
          name: 'مالیات بر ارزش افزوده ۹٪',
          isDefault: true,
          totalRatePercent: '9',
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات بر ارزش افزوده ۹٪');

    expect(
      screen.getByRole('region', { name: 'سیاست پیش‌فرض فعال' }),
    ).toBeTruthy();
    expect(screen.getByText(/پیش‌فرض فعال:/)).toBeTruthy();
  });
});
