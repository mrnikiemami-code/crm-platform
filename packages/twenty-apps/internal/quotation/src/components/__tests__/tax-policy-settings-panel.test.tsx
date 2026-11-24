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
  isActive: true,
  isDefault: false,
  isExempt: false,
  quotationCount: 0,
  ...overrides,
});

const catalog = (policies: PolicyFixture[]) => ({
  data: { success: true, policies, defaultCode: null },
});

const renderPanel = async () => {
  render(<TaxPolicySettingsPanel />);
  await screen.findByText('مالیات ۱۰٪');
};

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByText(name).closest('li');

  if (row === null) {
    throw new Error(`row for "${name}" was not rendered as a list item`);
  }

  return row;
};

beforeEach(() => {
  callAppRouteMock.mockReset();
  snackbarMock.mockReset();
  callAppRouteMock.mockResolvedValue(catalog([policy({ isDefault: true })]));
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
    await screen.findByText('مالیات ۶٪');

    // One badge for the one default, and it is not a control; only the non-default row
    // offers an action, and that action is a button.
    const defaultRow = rowOf('مالیات ۱۰٪');
    expect(within(defaultRow).getByText('پیش‌فرض').closest('button')).toBeNull();
    expect(
      within(defaultRow).queryByRole('button', { name: /^پیش‌فرض/ }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /^پیش‌فرض/ }),
    ).toHaveLength(1);
  });

  it('shows tax, duty, total and document count as separate labelled figures', async () => {
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

    const row = await screen.findByText('مالیات ۱۰٪').then((node) => {
      const found = node.closest('li');

      if (found === null) {
        throw new Error('row was not rendered as a list item');
      }

      return found;
    });

    // Every figure is labelled and none is an unlabelled pair: the total leads, the two
    // components read as their formula, and the document count is contextual.
    expect(within(row).getByText('نرخ کل')).toBeTruthy();
    expect(within(row).getByText('۱۰٪')).toBeTruthy();
    expect(within(row).getByText('مالیات: ۶٪')).toBeTruthy();
    expect(within(row).getByText('عوارض: ۴٪')).toBeTruthy();
    expect(within(row).getByText(/در ۵ سند استفاده شده است/)).toBeTruthy();
  });

  it('has no exemption checkbox and states that both rates at zero mean exempt', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));

    // Exemption stays derived: no tick to drift away from the two rates.
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
    await screen.findByText('سیاست استفاده‌شده');

    // The control does not vanish and reappear as a different one: it stays where it is
    // and the same visible line that carries the count carries the reason, because a
    // description reached from a disabled control is unreachable by keyboard and screen
    // reader alike.
    const deleteButton = within(rowOf('سیاست استفاده‌شده')).getByRole('button', {
      name: /^حذف/,
    });

    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(deleteButton.getAttribute('aria-describedby')).toBeNull();
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
    await screen.findByText('سیاست بی‌استفاده');
    fireEvent.click(within(rowOf('سیاست بی‌استفاده')).getByRole('button', { name: /^حذف/ }));
    fireEvent.click(screen.getByRole('button', { name: /^حذف/ }));

    // The first press only asks, naming the policy it would drop.
    expect(screen.getByText('«سیاست بی‌استفاده» حذف شود؟')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'تأیید حذف' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));

    expect(screen.queryByRole('button', { name: 'تأیید حذف' })).toBeNull();
    expect(callAppRouteMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a delete the server rejects on the row, so a stale count cannot delete history', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(
        catalog([
          policy({ recordId: 'tp-1', isDefault: true }),
          policy({ recordId: 'tp-2', code: 'TAX_1050', name: 'سیاست بی‌استفاده' }),
        ]),
      )
      .mockResolvedValueOnce({
        data: {
          success: false,
          code: 'TAX_POLICY_IN_USE',
          message: 'این سیاست در ۸ سند استفاده شده است؛ حذف نمی‌شود، فقط غیرفعال می‌شود',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست بی‌استفاده');
    fireEvent.click(within(rowOf('سیاست بی‌استفاده')).getByRole('button', { name: /^حذف/ }));
    fireEvent.click(screen.getByRole('button', { name: /^حذف/ }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف' }));

    expect((await screen.findByRole('alert')).textContent).toContain('۸ سند');
    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'delete', recordId: 'tp-2' },
    );
    expect(snackbarMock).not.toHaveBeenCalled();
  });

  it('deletes an unused policy after the second press and reports success', async () => {
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
    fireEvent.click(within(rowOf('سیاست آزمایشی')).getByRole('button', { name: /^حذف/ }));
    fireEvent.click(screen.getByRole('button', { name: /^حذف/ }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف' }));

    await waitForElementToBeRemoved(() => screen.queryByText('سیاست آزمایشی'));
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('keeps the same action set on the default row and only disables what is refused', async () => {
    await renderPanel();

    const row = rowOf('مالیات ۱۰٪');

    // The row still carries the controls; they are disabled with a stated reason rather
    // than removed, so the operator reads "not allowed here" instead of "permissions
    // changed".
    const deactivate = within(row).getByRole('button', {
      name: /^غیرفعال‌سازی/,
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

    // The row that flips to default is remounted, so the assertion has to wait for the
    // committed state instead of holding the pre-update node.
    await waitFor(() => {
      if (snackbarMock.mock.calls.length === 0) {
        throw new Error('the default move has not completed yet');
      }
    });

    const promoted = rowOf('مالیات ۹٪');

    // The badge moved to the pressed row and is not a control; exactly one row still
    // offers the action.
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

    // Even though the payload still flags the demoted row, the pressed row is the only
    // default in the DOM, and the demoted row is the only one offering the action.
    const demoted = rowOf('مالیات ۹٪');
    expect(within(demoted).getByRole('button', { name: /^پیش‌فرض/ })).toBeTruthy();
    expect(within(rowOf('مالیات ۱۰٪')).getByText('پیش‌فرض')).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /^پیش‌فرض/ }),
    ).toHaveLength(1);
  });

  it('reports a bad rate under its own field with aria-invalid, not as a page error', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));

    const taxField = screen.getByLabelText('مالیات (٪)');
    fireEvent.change(taxField, { target: { value: 'abc' } });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('درصد مالیات باید عددی');
    expect(taxField.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the typed values and the computed total in the editor', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));
    fireEvent.change(screen.getByLabelText('نام سیاست'), {
      target: { value: 'مالیات ۷٫۶٪' },
    });
    fireEvent.change(screen.getByLabelText('مالیات (٪)'), {
      target: { value: '۵٫۵' },
    });
    fireEvent.change(screen.getByLabelText('عوارض (٪)'), {
      target: { value: '۲٫۱' },
    });

    // The total is computed, never typed, and it survives every keystroke.
    expect(screen.getByText(/۷[.٫]۶٪/)).toBeTruthy();
    expect(
      (screen.getByLabelText('نام سیاست') as HTMLInputElement).value,
    ).toBe('مالیات ۷٫۶٪');
  });

  it('opens the editor on the row being edited and saves it back', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      {
        action: 'save',
        recordId: 'tp-1',
        name: 'مالیات ۱۰٪',
        ratePercentText: '10',
        dutyRatePercentText: '0',
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
    callAppRouteMock.mockResolvedValueOnce(catalog([policy({ recordId: 'tp-1' })]));

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۱۰٪');

    fireEvent.click(within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }));

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
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'سیاستی با همین نرخ از قبل وجود دارد',
    );
    expect(screen.getByRole('button', { name: 'ذخیره تغییرات' })).toBeTruthy();
  });

  it('offers the base 9% policy when the catalog is empty', async () => {
    callAppRouteMock
      .mockResolvedValueOnce(catalog([]))
      .mockResolvedValueOnce({
        data: {
          success: true,
          policies: [policy({ recordId: 'tp-1', name: 'مالیات ۹٪', isDefault: true })],
          message: 'سیاست پایه آماده شد',
        },
      });

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('هنوز سیاست مالیات و عوارضی ثبت نشده است.');

    fireEvent.click(screen.getByRole('button', { name: 'ساخت سیاست پایهٔ ۹٪' }));

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
          totalRatePercent: '4',
          quotationCount: 4,
        }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('سیاست استفاده‌شده');

    // The designer's rule: no text-only controls. Every action in a row is a button with
    // a real 32 px box and a border that is not transparent, in every state.
    const rowButtons = screen
      .getAllByRole('listitem')
      .flatMap((row) => within(row).getAllByRole('button'));

    expect(rowButtons.length).toBeGreaterThan(0);

    for (const button of rowButtons) {
      // Height and look are owned by the stylesheet, not by an inline style, so both the
      // 767 px block and the disabled skin can override them; an inline border or
      // background would pin the enabled look onto a refused control.
      expect(button.className).toContain('tax-btn');
      expect(button.style.border).toBe('');
      expect(button.style.background).toBe('');
    }

    const panelCss = document.querySelector('style')?.textContent ?? '';
    expect(panelCss).toContain('.tax-btn {');
    expect(panelCss).toContain('height: 32px');
    // A refused control is visibly refused, not merely unclickable.
    expect(panelCss).toContain('.tax-btn:disabled');
    expect(panelCss).toContain('border-color: var(--t-color-gray5)');
    expect(panelCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.tax-btn, \.tax-add \{ height: 44px; \}/,
    );

    // The name outranks the number it labels, and the accent stays on the total alone,
    // painted from the design token rather than a literal so it follows the shell theme.
    const total = within(rowOf('سیاست استفاده‌شده')).getByText('۴٪');
    expect(total.style.fontSize).toBe('16px');
    expect(total.style.fontWeight).toBe('600');
    expect(total.style.color).toBe('var(--t-color-blue9)');
    expect(within(rowOf('سیاست استفاده‌شده')).getByText('نرخ کل')).toBeTruthy();
    const name = within(rowOf('سیاست استفاده‌شده')).getByRole('heading');
    expect(name.style.fontSize).toBe('17px');
  });

  it('marks an inactive policy with an explicit badge instead of a faded row alone', async () => {
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
    expect(row.className).toContain('tax-row-inactive');
    expect(within(row).getByRole('button', { name: /^فعال‌سازی/ })).toBeTruthy();

    // An inactive, never-used policy is deletable in one write. Making the operator
    // reactivate it first put it back in front of new quotations.
    const remove = within(row).getByRole('button', {
      name: /^حذف/,
    }) as HTMLButtonElement;

    expect(remove.disabled).toBe(false);
  });

  it('renders rows as list items with a heading, not as an unlabelled table', async () => {
    callAppRouteMock.mockResolvedValueOnce(
      catalog([
        policy({ recordId: 'tp-1', isDefault: true }),
        policy({ recordId: 'tp-2', code: 'TAX_900', name: 'مالیات ۹٪' }),
      ]),
    );

    render(<TaxPolicySettingsPanel />);
    await screen.findByText('مالیات ۹٪');

    // A screen reader can jump policy to policy: one list, one heading per row.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'مالیات ۹٪' })).toBeTruthy();
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

    // Three «ویرایش» entries used to be indistinguishable in a rotor.
    const edits = screen.getAllByRole('button', { name: /^ویرایش/ });

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
    fireEvent.change(screen.getByLabelText('مالیات (٪)'), {
      target: { value: '۷' },
    });

    // A different row's «ویرایش» is one click away; it must not throw the 7% away.
    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    expect(screen.getByText(/تغییرات ذخیره‌نشده دارید/)).toBeTruthy();
    expect(
      (screen.getByLabelText('مالیات (٪)') as HTMLInputElement).value,
    ).toBe('۷');
    expect(callAppRouteMock).toHaveBeenCalledTimes(1);
  });

  it('lets the operator discard deliberately, by cancelling', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));
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

    expect(await screen.findByText(/فهرست سیاست‌های مالیات خوانده نشد/)).toBeTruthy();
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

    expect(within(row).getByText('معاف')).toBeTruthy();
    expect(within(row).queryByText('۰٪')).toBeNull();
  });

  it('keeps the row mounted and opens the editor as its next card', async () => {
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

    // The pressed button is not unmounted, so the browser never moves focus to <body>;
    // the editor is the row's sibling and the toggle becomes its closer.
    const reopened = within(rowOf('مالیات ۹٪')).getByRole('button', {
      name: /^ویرایش/,
    });

    expect(reopened.getAttribute('aria-expanded')).toBe('true');
    expect(reopened.textContent).toBe('بستن');
    expect(screen.getByLabelText('نام سیاست')).toBeTruthy();

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

    // A form, so Enter submits instead of dropping the operator back on a dead field.
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

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));
    fireEvent.change(screen.getByLabelText('مالیات (٪)'), {
      target: { value: '۶' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    const nameField = screen.getByLabelText('نام سیاست');

    expect(nameField.getAttribute('aria-invalid')).toBe('true');
    expect(nameField.getAttribute('aria-describedby')).toBe(
      'tax-policy-name-error',
    );
    expect(screen.getByText('نام سیاست مالیات را وارد کنید')).toBeTruthy();
    // The rate is valid and must not inherit the name's refusal.
    expect(screen.getByLabelText('مالیات (٪)').getAttribute('aria-invalid')).toBe(
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

    // A failed read is not an empty catalog: no bootstrap action, no empty copy, no
    // header add that would invite a write the screen has not verified.
    expect(screen.queryByText(/هنوز سیاست مالیات و عوارضی ثبت نشده/)).toBeNull();
    expect(screen.queryByRole('button', { name: /ساخت سیاست پایه/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'افزودن سیاست' })).toBeNull();
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
    fireEvent.change(screen.getByLabelText('مالیات (٪)'), {
      target: { value: '۷' },
    });
    fireEvent.click(
      within(rowOf('مالیات ۱۰٪')).getByRole('button', { name: /^ویرایش/ }),
    );

    // An instruction, not a failure: it is announced as a status, and it lands in the
    // row that was pressed rather than in an editor card further up the list.
    const refusal = within(rowOf('مالیات ۱۰٪')).getByRole('status');

    expect(refusal.textContent).toContain('تغییرات ذخیره‌نشده دارید');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('مالیات (٪)')).toBeTruthy();
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

    const markup = document.body.innerHTML;
    const paint = `${markup}${document.querySelector('style')?.textContent ?? ''}`;

    expect(paint).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(paint).toContain('var(--t-color-blue9)');
    expect(paint).toContain('var(--t-color-red11)');
  });
});

