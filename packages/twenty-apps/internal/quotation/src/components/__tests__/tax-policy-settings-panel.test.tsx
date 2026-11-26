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

const { callTaxPoliciesNestActionMock, callQuotationCurrenciesNestActionMock, callRoundingRulesNestActionMock } =
  vi.hoisted(() => ({
    callTaxPoliciesNestActionMock: vi.fn(),
    callQuotationCurrenciesNestActionMock: vi.fn(),
    callRoundingRulesNestActionMock: vi.fn(),
  }));
const { snackbarMock, confirmDestructiveActionMock } = vi.hoisted(() => ({
  snackbarMock: vi.fn(),
  confirmDestructiveActionMock: vi.fn(),
}));

vi.mock('src/components/quotation-api', () => ({
  TAX_POLICIES_ROUTE: '/quotation/tax-policies',
  QUOTATION_CURRENCIES_ROUTE: '/quotation/currencies',
  callTaxPoliciesNestAction: callTaxPoliciesNestActionMock,
  callQuotationCurrenciesNestAction: callQuotationCurrenciesNestActionMock,
  callRoundingRulesNestAction: callRoundingRulesNestActionMock,
}));

vi.mock('twenty-sdk/front-component', () => ({
  enqueueSnackbar: snackbarMock,
}));

vi.mock('src/components/shared/confirm-destructive-action', () => ({
  confirmDestructiveAction: confirmDestructiveActionMock,
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
  const register = document.querySelector('.tl-register');

  if (register === null) {
    throw new Error('ledger register was not rendered');
  }

  return register as HTMLElement;
};

const renderPanel = async () => {
  render(<TaxPolicySettingsPanel />);
  await waitFor(() => {
    if (document.querySelector('.tl-register') === null) {
      throw new Error('waiting for ledger');
    }
  });
  await within(ledger()).findByText('مالیات ۱۰٪');
};

const rowOf = (name: string): HTMLElement => {
  const row = within(ledger()).getByText(name).closest('.tl-row');

  if (row === null) {
    throw new Error(`row for "${name}" was not rendered as a register row`);
  }

  return row as HTMLElement;
};

const openMoreMenu = async (name: string) => {
  fireEvent.click(
    within(rowOf(name)).getByRole('button', { name: /^عملیات / }),
  );
  await screen.findByRole('menu');
};

const editRow = async (name: string) => {
  await openMoreMenu(name);
  fireEvent.click(screen.getByRole('menuitem', { name: /^ویرایش$/ }));
};

const moreItem = (_name: string, itemName: RegExp | string) =>
  screen.getByRole('menuitem', { name: itemName });

beforeEach(() => {
  callTaxPoliciesNestActionMock.mockReset();
  snackbarMock.mockReset();
  confirmDestructiveActionMock.mockReset();
  confirmDestructiveActionMock.mockResolvedValue('confirm');
  callTaxPoliciesNestActionMock.mockResolvedValue(catalog([policy({ isDefault: true })]));
  callQuotationCurrenciesNestActionMock.mockReset();
  callRoundingRulesNestActionMock.mockReset();
  callQuotationCurrenciesNestActionMock.mockResolvedValue(currencyCatalog());
  callRoundingRulesNestActionMock.mockResolvedValue({ data: { success: true, rules: [], defaultCode: null } });
});

afterEach(cleanup);

describe('tax policy settings panel', () => {
  it('paints exactly one default badge and keeps set-default in the more menu', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValue(
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
    await screen.findByText('مالیات ۶٪');

    const defaultRow = rowOf('مالیات ۱۰٪');
    expect(within(defaultRow).getByText('پیش‌فرض').closest('button')).toBeNull();
    expect(
      within(defaultRow).queryByRole('button', { name: /^پیش‌فرض$/ }),
    ).toBeNull();

    await openMoreMenu('مالیات ۶٪');
    expect(moreItem('مالیات ۶٪', /^پیش‌فرض$/)).toBeTruthy();
  });

  it('shows tax, duty, total and status in ledger columns', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValue(
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
      if (document.querySelector('.tl-register') === null) {
        throw new Error('waiting for ledger');
      }
    });
    const row = within(ledger()).getByText('مالیات ۱۰٪').closest('.tl-row');

    if (row === null) {
      throw new Error('row was not rendered as a register row');
    }

    expect(within(row as HTMLElement).getByText('مالیات')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('عوارض')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('مجموع')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('۶٪')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('۴٪')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('۱۰٪')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('پیش‌فرض')).toBeTruthy();
  });

  it('has no exemption checkbox and states that both rates at zero mean exempt', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /سیاست جدید/ }));

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('هر دو نرخ صفر یعنی معاف از مالیات.')).toBeTruthy();
  });

  it('keeps the delete control on a used policy and explains why it is disabled', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
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
    await screen.findByText(
      'سیاست استفاده‌شده',
    );

    await openMoreMenu('سیاست استفاده‌شده');
    const deleteButton = moreItem('سیاست استفاده‌شده', /^حذف/);

    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(deleteButton.getAttribute('title')).toContain('پیش‌فاکتور');
  });

  it('opens the shared confirm dialog on delete and cancels without touching the server', async () => {
    confirmDestructiveActionMock.mockResolvedValueOnce('cancel');
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
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
    await screen.findByText(
      'سیاست بی‌استفاده',
    );
    await openMoreMenu('سیاست بی‌استفاده');
    fireEvent.click(moreItem('سیاست بی‌استفاده', /^حذف/));

    await waitFor(() => {
      expect(confirmDestructiveActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'حذف سیاست مالیات',
          confirmButtonText: 'حذف سیاست',
          subtitle: expect.stringContaining('سیاست بی‌استفاده'),
        }),
      );
    });
    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a delete the server rejects on the row, so a stale count cannot delete history', async () => {
    callTaxPoliciesNestActionMock
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
    await openMoreMenu('سیاست بی‌استفاده');
    fireEvent.click(moreItem('سیاست بی‌استفاده', /^حذف/));

    expect((await screen.findByRole('alert')).textContent).toContain('۸ سند');
    expect(callTaxPoliciesNestActionMock).toHaveBeenLastCalledWith(
      { action: 'delete', recordId: 'tp-2' },
    );
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('deletes an unused policy after confirm and reports success', async () => {
    callTaxPoliciesNestActionMock
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
    await openMoreMenu('سیاست آزمایشی');
    fireEvent.click(moreItem('سیاست آزمایشی', /^حذف/));

    await waitForElementToBeRemoved(() => screen.queryByText('سیاست آزمایشی'));
    expect(confirmDestructiveActionMock).toHaveBeenCalled();
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('keeps the same action set on the default row and only disables what is refused', async () => {
    await renderPanel();

    const row = rowOf('مالیات ۱۰٪');
    await openMoreMenu('مالیات ۱۰٪');

    const deactivate = moreItem('مالیات ۱۰٪', /^غیرفعال/) as HTMLButtonElement;
    const remove = moreItem('مالیات ۱۰٪', /^حذف/) as HTMLButtonElement;

    expect(deactivate.disabled).toBe(true);
    expect(remove.disabled).toBe(true);
    expect(screen.queryByRole('menuitem', { name: /^پیش‌فرض$/ })).toBeNull();
    expect(row).toBeTruthy();
    expect(remove.getAttribute('title')).toContain('پیش‌فرض');
  });

  it('sets the default from the row and keeps a single default badge afterwards', async () => {
    callTaxPoliciesNestActionMock
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

    await openMoreMenu('مالیات ۹٪');
    fireEvent.click(moreItem('مالیات ۹٪', /^پیش‌فرض$/));

    expect(callTaxPoliciesNestActionMock).toHaveBeenLastCalledWith(
      { action: 'set-default', recordId: 'tp-2' },
    );

    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the default move has not completed yet');
      }
    });

    const promoted = rowOf('مالیات ۹٪');

    expect(within(promoted).getByText('پیش‌فرض').closest('button')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /^پیش‌فرض$/ })).toBeNull();
  });

  it('repaints a demoted row as non-default when the payload still flags it', async () => {
    callTaxPoliciesNestActionMock
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

    await openMoreMenu('مالیات ۱۰٪');
    fireEvent.click(moreItem('مالیات ۱۰٪', /^پیش‌فرض$/));

    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the default move has not completed yet');
      }
    });

    await openMoreMenu('مالیات ۹٪');
    expect(moreItem('مالیات ۹٪', /^پیش‌فرض$/)).toBeTruthy();
    expect(within(rowOf('مالیات ۱۰٪')).getByText('پیش‌فرض')).toBeTruthy();
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

  it('opens the inspector from the dedicated edit control and saves it back', async () => {
    callTaxPoliciesNestActionMock
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

    await editRow('مالیات ۱۰٪');

    expect(screen.getByText('ویرایش سیاست')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    expect(callTaxPoliciesNestActionMock).toHaveBeenLastCalledWith(
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
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([policy({ recordId: 'tp-1' })]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    await editRow('مالیات ۱۰٪');

    expect(screen.queryByText('ذخیره‌نشده')).toBeNull();

    fireEvent.change(screen.getByDisplayValue('مالیات ۱۰٪'), {
      target: { value: 'مالیات ۱۲٪' },
    });

    expect(screen.getByText('ذخیره‌نشده')).toBeTruthy();
  });

  it('keeps the editor open with the server message when a save is refused', async () => {
    callTaxPoliciesNestActionMock
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

    await editRow('مالیات ۱۰٪');
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'سیاستی با همین نرخ از قبل وجود دارد',
    );
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeTruthy();
  });

  it('offers the base 9% policy when the catalog is empty', async () => {
    callTaxPoliciesNestActionMock
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

    expect(callTaxPoliciesNestActionMock).toHaveBeenLastCalledWith(
      { action: 'bootstrap' },
    );
    expect(await screen.findByText('مالیات ۹٪')).toBeTruthy();
  });

  it('gives every row action a bounded control and keeps the height in the stylesheet', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValue(
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
      expect(button.style.border).toBe('');
      expect(button.style.background).toBe('');
    }

    const styles = Array.from(document.querySelectorAll('style'))
      .map((node) => node.textContent ?? '')
      .join('\n');
    expect(styles).toContain('.fs-menu-trigger');
    expect(styles).toContain('height: 32px');
    expect(styles).toContain('.fs-menu-item:disabled');
    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*height: 44px/);
  });

  it('marks an inactive policy with an explicit badge', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValue(
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
    expect(row.className).toContain('is-off');

    await openMoreMenu('نرخ قدیم');
    expect(moreItem('نرخ قدیم', /^فعال/)).toBeTruthy();

    const remove = moreItem('نرخ قدیم', /^حذف/) as HTMLButtonElement;

    expect(remove.disabled).toBe(false);
  });

  it('renders a register ledger for the catalog', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    expect(document.querySelector('.tl-register')).toBeTruthy();
    expect(document.querySelectorAll('.tl-row').length).toBe(2);
    expect(screen.getByText('سیاست')).toBeTruthy();
    expect(screen.getByText('نرخ‌ها')).toBeTruthy();
  });

  it('names each row control after the policy it acts on', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
        policy({ recordId: 'tp-3', code: 'TAX_800', name: 'مالیات ۸٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    const menus = within(ledger()).getAllByRole('button', {
      name: /^عملیات /,
    });

    expect(menus.map((button) => button.getAttribute('aria-label'))).toEqual([
      'عملیات مالیات ۱۰٪',
      'عملیات مالیات ۹٪',
      'عملیات مالیات ۸٪',
    ]);
  });

  it('does not open the edit dialog when the more menu is opened', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    fireEvent.click(rowOf('مالیات ۹٪'));
    expect(screen.queryByRole('dialog')).toBeNull();

    await openMoreMenu('مالیات ۹٪');
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('نام سیاست')).toBeNull();
  });

  it('refuses to replace an editor holding typed numbers and says why', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    await editRow('مالیات ۹٪');
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۷' },
    });

    await editRow('مالیات ۱۰٪');

    expect(screen.getByText(/تغییرات ذخیره‌نشده دارید/)).toBeTruthy();
    expect(
      (screen.getByLabelText('مالیات ٪') as HTMLInputElement).value,
    ).toBe('۷');
    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledTimes(1);
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
    callTaxPoliciesNestActionMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]));

    render(<TaxPolicySettingsPanel />);

    expect(
      await screen.findByText(/فهرست سیاست‌های مالیات خوانده نشد/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }));

    expect(await screen.findByText('مالیات ۱۰٪')).toBeTruthy();
    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledTimes(2);
  });

  it('states an exempt policy in words instead of a zero that reads as unfilled', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
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

    // Exempt register states معاف as the rate block, not a blank zero total.
    expect(within(row).getAllByText('معاف').length).toBeGreaterThan(0);
    expect(within(row).queryByText('۰٪')).toBeNull();
  });

  it('keeps the row mounted and opens the editor dialog without shrinking the ledger', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    await editRow('مالیات ۹٪');

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('نام سیاست')).toBeTruthy();
    expect(document.querySelector('.tl-register')).toBeTruthy();
    expect(within(rowOf('مالیات ۹٪')).getByText('مالیات ۹٪')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('نام سیاست')).toBeNull();
  });

  it('saves from the dialog save action', async () => {
    callTaxPoliciesNestActionMock
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

    await editRow('مالیات ۱۰٪');

    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    await waitFor(() => {
      if (callTaxPoliciesNestActionMock.mock.calls.length < 2) {
        throw new Error('the submit has not reached the server yet');
      }
    });

    expect(callTaxPoliciesNestActionMock).toHaveBeenLastCalledWith(
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
    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledTimes(1);
  });

  it('shows the retry and nothing else when the first read fails', async () => {
    callTaxPoliciesNestActionMock.mockRejectedValueOnce(new Error('offline'));

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
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    await editRow('مالیات ۹٪');
    fireEvent.change(screen.getByLabelText('مالیات ٪'), {
      target: { value: '۷' },
    });
    await editRow('مالیات ۱۰٪');

    expect(
      screen.getByText(/تغییرات ذخیره‌نشده دارید/),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('مالیات ٪')).toBeTruthy();
  });

  it('paints no colour literal, so the panel follows the shell theme', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
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
    const css = Array.from(document.querySelectorAll('style'))
      .map((node) => node.textContent ?? '')
      .join('\n');
    const markup = root?.outerHTML ?? '';

    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).toContain('var(--t-color-');
  });

  it('marks the default policy on the ledger row instead of a banner', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce(
      catalog([
        policy({
          recordId: 'tp-1',
          name: 'مالیات بر ارزش افزوده ۹٪',
          isDefault: true,
          totalRatePercent: '9',
        }),
      ]),
    );

    const { container } = render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات بر ارزش افزوده ۹٪');

    expect(screen.queryByRole('region', { name: 'سیاست پیش‌فرض فعال' })).toBeNull();
    expect(container.querySelector('.tl-row.is-def')).toBeTruthy();
    expect(
      within(rowOf('مالیات بر ارزش افزوده ۹٪')).getByText('پیش‌فرض'),
    ).toBeTruthy();
  });
});
