import {
  openCommandConfirmationModal,
  type CommandConfirmationModalResult,
} from 'twenty-sdk/front-component';

export type ConfirmDestructiveActionInput = {
  title: string;
  subtitle: string;
  confirmButtonText?: string;
};

// Host-owned ConfirmationDialog via the front-component bridge. One shared path
// for every destructive confirm on financial settings — never window.confirm or
// per-row inline confirm.
export const confirmDestructiveAction = async (
  input: ConfirmDestructiveActionInput,
): Promise<CommandConfirmationModalResult> => {
  try {
    return await openCommandConfirmationModal({
      title: input.title,
      subtitle: input.subtitle,
      confirmButtonText: input.confirmButtonText ?? 'حذف',
      confirmButtonAccent: 'danger',
    });
  } catch {
    // Host bridge unavailable (storybook/tests): refuse the destructive path.
    return 'cancel';
  }
};
