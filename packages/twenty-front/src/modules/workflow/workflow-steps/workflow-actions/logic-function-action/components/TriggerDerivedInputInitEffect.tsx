import { useEffect } from 'react';

import { type WorkflowLogicFunctionAction } from '@/workflow/types/Workflow';

type TriggerDerivedInputInitEffectProps = {
  action: WorkflowLogicFunctionAction;
  /** Trigger-supplied values, already resolved by the caller. */
  values: Record<string, string>;
  onActionUpdate: (action: WorkflowLogicFunctionAction) => void;
};

/**
 * Writes trigger-supplied values into the step input.
 *
 * It only ever OPENS or RE-ALIGNS the step input to what the trigger can supply:
 * every other property is preserved, and nothing is written when the values
 * already match, so this cannot loop. When the trigger cannot supply them the
 * caller passes no values and this does nothing — a missing value is left
 * missing rather than replaced by a guess, and the function refuses the call.
 */
export const TriggerDerivedInputInitEffect = ({
  action,
  values,
  onActionUpdate,
}: TriggerDerivedInputInitEffectProps) => {
  const signature = JSON.stringify(values);

  useEffect(() => {
    const currentInput = action.settings.input.logicFunctionInput ?? {};

    const nextInput: Record<string, unknown> = { ...currentInput };
    let hasChanged = false;

    for (const [key, value] of Object.entries(values)) {
      if (nextInput[key] !== value) {
        nextInput[key] = value;
        hasChanged = true;
      }
    }

    if (!hasChanged) {
      return;
    }

    onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: { ...action.settings.input, logicFunctionInput: nextInput },
      },
    });
    // `signature` is the stable form of `values`; the remaining arguments are
    // recreated every render and must not re-trigger this.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
};
