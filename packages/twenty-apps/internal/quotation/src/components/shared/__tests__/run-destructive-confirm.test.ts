import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmDestructiveActionMock } = vi.hoisted(() => ({
  confirmDestructiveActionMock: vi.fn(),
}));

vi.mock('src/components/shared/confirm-destructive-action', () => ({
  confirmDestructiveAction: confirmDestructiveActionMock,
}));

import { runDestructiveConfirm } from 'src/components/shared/run-destructive-confirm';

describe('runDestructiveConfirm', () => {
  beforeEach(() => {
    confirmDestructiveActionMock.mockReset();
  });

  it('forwards a single confirmation and returns the host result', async () => {
    confirmDestructiveActionMock.mockResolvedValueOnce('confirm');

    await expect(
      runDestructiveConfirm({
        title: 'حذف',
        subtitle: 'متن',
        confirmButtonText: 'حذف',
      }),
    ).resolves.toBe('confirm');

    expect(confirmDestructiveActionMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a second overlapping confirm while the first is in flight', async () => {
    let release!: (value: 'confirm') => void;
    confirmDestructiveActionMock.mockImplementationOnce(
      () =>
        new Promise<'confirm'>((resolve) => {
          release = resolve;
        }),
    );

    const first = runDestructiveConfirm({
      title: 'حذف',
      subtitle: 'اول',
    });
    const second = runDestructiveConfirm({
      title: 'حذف',
      subtitle: 'دوم',
    });

    await expect(second).resolves.toBe('cancel');
    release('confirm');
    await expect(first).resolves.toBe('confirm');
    expect(confirmDestructiveActionMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the latch through afterConfirm mutation', async () => {
    confirmDestructiveActionMock.mockResolvedValueOnce('confirm');
    let releaseMutation!: () => void;
    const mutation = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });

    const first = runDestructiveConfirm(
      { title: 'حذف', subtitle: 'اول' },
      async () => {
        await mutation;
      },
    );
    await Promise.resolve();
    const second = runDestructiveConfirm({
      title: 'حذف',
      subtitle: 'دوم',
    });

    await expect(second).resolves.toBe('cancel');
    releaseMutation();
    await expect(first).resolves.toBe('confirm');
  });
});
