import {
  confirmDestructiveAction,
  type ConfirmDestructiveActionInput,
} from 'src/components/shared/confirm-destructive-action';

// Synchronous single-flight latch so two rapid Delete clicks cannot open two
// host confirmation dialogs before React state updates (UX-R1).
let destructiveConfirmInFlight = false;

export const runDestructiveConfirm = async (
  input: ConfirmDestructiveActionInput,
): Promise<'confirm' | 'cancel'> => {
  if (destructiveConfirmInFlight) {
    return 'cancel';
  }

  destructiveConfirmInFlight = true;

  try {
    return await confirmDestructiveAction(input);
  } finally {
    destructiveConfirmInFlight = false;
  }
};
