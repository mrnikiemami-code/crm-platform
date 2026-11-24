// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
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
    expect(
      screen.queryByRole('button', { name: 'پیش‌فرض' }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'انتخاب به‌عنوان پیش‌فرض' }),
    ).toHaveLength(1);
  });

  it('has no exemption checkbox and derives the zero policy from its rates', async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سیاست مالیات' }));

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(/معاف از مالیات/)).toBeNull();
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
        'این سیاست در ۳ سند استفاده شده است؛ حذف نمی‌شود و فقط غیرفعال می‌شود.',
      ),
    ).toBeTruthy();
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

    expect(
      screen.queryByRole('button', { name: 'غیرفعال' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'حذف' })).toBeNull();
    expect(
      screen.getByText(
        'پیش‌فرض فعلی است؛ برای حذف یا غیرفعال‌سازی، ابتدا پیش‌فرض دیگری انتخاب کنید.',
      ),
    ).toBeTruthy();
  });
});
