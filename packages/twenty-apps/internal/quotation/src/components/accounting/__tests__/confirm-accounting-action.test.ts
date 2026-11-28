import { beforeEach, describe, expect, it, vi } from 'vitest';
const { modal, snackbar } = vi.hoisted(() => ({ modal: vi.fn(), snackbar: vi.fn() }));
vi.mock('twenty-sdk/front-component', () => ({ openCommandConfirmationModal: modal, enqueueSnackbar: snackbar }));
import { confirmAccountingAction } from 'src/components/accounting/confirm-accounting-action';
beforeEach(() => { modal.mockReset(); snackbar.mockReset(); });
describe('worker-safe accounting confirmation', () => {
  it('requires an explicit host confirm and honors cancellation', async () => {
    modal.mockResolvedValueOnce('confirm').mockResolvedValueOnce('cancel');
    expect(await confirmAccountingAction('انتقال مشتری')).toBe(true);
    expect(await confirmAccountingAction('انتقال کالا')).toBe(false);
  });
  it('fails closed on a missing host bridge without throwing', async () => {
    modal.mockRejectedValueOnce(new Error('host unavailable'));
    expect(await confirmAccountingAction('انتقال مشتری')).toBe(false);
    expect(snackbar).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
  });
  it('refuses simultaneous confirmations', async () => {
    let resolve!: (value: string) => void;
    modal.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; }));
    const first = confirmAccountingAction('انتقال');
    expect(await confirmAccountingAction('ارسال')).toBe(false);
    resolve('confirm');
    expect(await first).toBe(true);
  });
});
