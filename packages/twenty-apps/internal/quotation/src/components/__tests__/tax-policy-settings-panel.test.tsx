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

    // One green badge for the one default; the other row offers an action whose label
    // cannot be mistaken for the badge.
    expect(screen.getAllByText('پیش‌فرض')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'پیش‌فرض' })).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'انتخاب پیش‌فرض' }),
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

    // The four figures are adjacent, each under its own label, so a rate can be read
    // without decoding an unlabelled pair like "۶٪ + ۴٪".
    expect(within(row).getByText('مالیات')).toBeTruthy();
    expect(within(row).getByText('۶٪')).toBeTruthy();
    expect(within(row).getByText('عوارض')).toBeTruthy();
    expect(within(row).getByText('۴٪')).toBeTruthy();
    expect(within(row).getByText('جمع')).toBeTruthy();
    expect(within(row).getByText('۱۰٪')).toBeTruthy();
    expect(within(row).getByText('اسناد')).toBeTruthy();
    expect(within(row).getByText('۵')).toBeTruthy();
  });

  it('has no exemption checkbox and states that both rates at zero mean exempt', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));

    // Exemption stays derived: no tick to drift away from the two rates.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('هر دو نرخ صفر یعنی معاف از مالیات.')).toBeTruthy();
  });

  it('shows the usage count on a used policy instead of a delete it cannot honour', async () => {
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

    // The default row and the used row both lack a delete button; the explanation says
    // why, with the real count, so the operator never presses a button that must fail.
    expect(screen.queryAllByRole('button', { name: 'حذف' })).toHaveLength(0);
    expect(
      screen.getByText(
        'در ۳ سند استفاده شده است؛ به‌جای حذف، غیرفعال می‌شود.',
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

    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف' }));

    await waitForElementToBeRemoved(() => screen.queryByText('سیاست آزمایشی'));
    expect(snackbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('offers no deactivation or delete path on the default row', async () => {
    await renderPanel();

    expect(screen.queryByRole('button', { name: 'غیرفعال' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'حذف' })).toBeNull();
    expect(
      screen.getByText(
        'پیش‌فرض فعلی است؛ برای تغییر، ابتدا پیش‌فرض دیگری انتخاب کنید.',
      ),
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

    fireEvent.click(screen.getByRole('button', { name: 'انتخاب پیش‌فرض' }));

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'set-default', recordId: 'tp-2' },
    );
    expect(await screen.findByText('پیش‌فرض')).toBeTruthy();
    expect(screen.getAllByText('پیش‌فرض')).toHaveLength(1);
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

    fireEvent.click(screen.getByRole('button', { name: 'انتخاب پیش‌فرض' }));

    await screen.findByText('پیش‌فرض');
    expect(screen.getAllByText('پیش‌فرض')).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'انتخاب پیش‌فرض' }),
    ).toHaveLength(1);
  });

  it('reports a bad rate under its own field with aria-invalid, not as a page error', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست' }));

    const taxField = screen.getByLabelText('درصد مالیات');
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
    fireEvent.change(screen.getByLabelText('درصد مالیات'), {
      target: { value: '۵٫۵' },
    });
    fireEvent.change(screen.getByLabelText('درصد عوارض'), {
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
    fireEvent.click(within(row).getByRole('button', { name: 'ویرایش' }));

    expect(screen.getByText('ویرایش سیاست مالیات')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره سیاست' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }));
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره سیاست' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'سیاستی با همین نرخ از قبل وجود دارد',
    );
    expect(screen.getByRole('button', { name: 'ذخیره سیاست' })).toBeTruthy();
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
    await screen.findByText('هنوز سیاست مالیاتی ثبت نشده است.');

    fireEvent.click(screen.getByRole('button', { name: 'ساخت سیاست پایهٔ ۹٪' }));

    expect(callAppRouteMock).toHaveBeenLastCalledWith(
      '/quotation/tax-policies',
      { action: 'bootstrap' },
    );
    expect(await screen.findByText('مالیات ۹٪')).toBeTruthy();
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
});
