import {
  confirmDestructiveAction,
  type ConfirmDestructiveActionInput,
} from 'src/components/shared/confirm-destructive-action';

// Synchronous single-flight latch covering confirm AND optional follow-up
// mutation so two rapid Delete clicks cannot open two dialogs or fire two
// deletes (UX-R1 / Goal 034 architect note).
let destructiveOperationInFlight = false;

export const runDestructiveConfirm = async (
  input: ConfirmDestructiveActionInput,
  afterConfirm?: () => Promise<void>,
): Promise<'confirm' | 'cancel'> => {
  if (destructiveOperationInFlight) {
    return 'cancel';
  }

  destructiveOperationInFlight = true;

  try {
    const result = await confirmDestructiveAction(input);

    if (result === 'confirm' && afterConfirm !== undefined) {
      await afterConfirm();
    }

    return result;
  } finally {
    destructiveOperationInFlight = false;
  }
};
