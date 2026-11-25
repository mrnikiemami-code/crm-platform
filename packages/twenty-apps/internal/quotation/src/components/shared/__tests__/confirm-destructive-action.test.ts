import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openCommandConfirmationModalMock } = vi.hoisted(() => ({
  openCommandConfirmationModalMock: vi.fn(),
}));

vi.mock('twenty-sdk/front-component', () => ({
  openCommandConfirmationModal: openCommandConfirmationModalMock,
}));

import { confirmDestructiveAction } from 'src/components/shared/confirm-destructive-action';

describe('confirmDestructiveAction', () => {
  beforeEach(() => {
    openCommandConfirmationModalMock.mockReset();
  });

  it('opens the host confirmation modal with a danger confirm accent', async () => {
    openCommandConfirmationModalMock.mockResolvedValueOnce('confirm');

    await expect(
      confirmDestructiveAction({
        title: 'حذف سیاست مالیات',
        subtitle: 'آیا سیاست «عوارض آزمایشی» حذف شود؟ این عملیات قابل بازگشت نیست.',
        confirmButtonText: 'حذف سیاست',
      }),
    ).resolves.toBe('confirm');

    expect(openCommandConfirmationModalMock).toHaveBeenCalledWith({
      title: 'حذف سیاست مالیات',
      subtitle: 'آیا سیاست «عوارض آزمایشی» حذف شود؟ این عملیات قابل بازگشت نیست.',
      confirmButtonText: 'حذف سیاست',
      confirmButtonAccent: 'danger',
    });
  });

  it('returns cancel when the host bridge throws', async () => {
    openCommandConfirmationModalMock.mockRejectedValueOnce(new Error('bridge down'));

    await expect(
      confirmDestructiveAction({
        title: 'حذف',
        subtitle: 'متن',
      }),
    ).resolves.toBe('cancel');
  });
});
