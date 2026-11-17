import { isNonEmptyString } from '@sniptt/guards';
import {
  type InputSchema,
  TRIGGER_STEP_ID,
  type TriggerDerivedValue,
} from 'twenty-shared/workflow';
import { isDefined } from 'twenty-shared/utils';

import { type WorkflowTrigger } from '@/workflow/types/Workflow';
import { getVariableTemplateFromPath } from '@/workflow/workflow-variables/utils/getVariableTemplateFromPath';

type DerivedInputValues = Record<string, string>;

export type TriggerDerivationResult = {
  /**
   * Values to write into the step input, keyed by property name. Empty when the
   * trigger cannot supply them — never filled with a fabricated default.
   */
  values: DerivedInputValues;
  /**
   * Whether every property marked `derivedFromTrigger` could be resolved. False
   * means the form should explain the trigger requirement instead of silently
   * running with missing data.
   */
  isDerivable: boolean;
};

const NOT_DERIVABLE: TriggerDerivationResult = {
  values: {},
  isDerivable: false,
};

/**
 * Reads the properties the action declares as trigger-supplied.
 *
 * A logic function cannot read workflow state: the executor passes only the step
 * input and `LogicFunctionExecutionContext` carries no trigger. So these values
 * are delivered as ordinary property values, resolved at run time from
 * `{{trigger.*}}` expressions by the same `resolveInput` the platform uses for
 * every other step input.
 */ const collectDerivedKinds = (
  inputSchema: InputSchema | undefined,
): Array<{ key: string; kind: TriggerDerivedValue }> => {
  const root = inputSchema?.[0];

  if (!isDefined(root) || !isDefined(root.properties)) {
    return [];
  }

  return Object.entries(root.properties).flatMap(([key, property]) =>
    isDefined(property.derivedFromTrigger)
      ? [{ key, kind: property.derivedFromTrigger }]
      : [],
  );
};

export const hasTriggerDerivedProperties = (
  inputSchema: InputSchema | undefined,
): boolean => collectDerivedKinds(inputSchema).length > 0;

/**
 * Computes the trigger-supplied values for one action.
 *
 * Only an `updated` database event can supply a before/after pair for a watched
 * column, so anything else yields no values at all: the workflow would otherwise
 * send on a change the author never specified.
 */
export const buildTriggerDerivedInputValues = ({
  inputSchema,
  trigger,
  workflowId,
}: {
  inputSchema: InputSchema | undefined;
  trigger: WorkflowTrigger | null | undefined;
  workflowId: string | undefined;
}): TriggerDerivationResult => {
  const derivedKinds = collectDerivedKinds(inputSchema);

  if (derivedKinds.length === 0) {
    return { values: {}, isDerivable: true };
  }

  if (!isDefined(trigger) || trigger.type !== 'DATABASE_EVENT') {
    return NOT_DERIVABLE;
  }

  const [objectName, action] = trigger.settings.eventName.split('.');

  // Field-change sending needs the previous AND new value of one column; only
  // `updated` events carry both.
  if (action !== 'updated') {
    return NOT_DERIVABLE;
  }

  const watchedFields = (trigger.settings.fields ?? []).filter(
    isNonEmptyString,
  );

  // Several watched columns make the before/after pair ambiguous: the change
  // could be any of them. Refusing is honest, and guessing one would send on the
  // wrong column.
  const watchedField =
    watchedFields.length === 1 ? watchedFields[0] : undefined;

  const asVariable = (path: string[]): string =>
    getVariableTemplateFromPath({ stepId: TRIGGER_STEP_ID, path });

  const resolve = (kind: TriggerDerivedValue): string | undefined => {
    switch (kind) {
      case 'recordId':
        return asVariable(['recordId']);
      case 'eventId':
        return asVariable(['eventId']);
      case 'objectName':
        return isNonEmptyString(objectName) ? objectName : undefined;
      case 'watchedField':
        return watchedField;
      case 'beforeValue':
        return isNonEmptyString(watchedField)
          ? asVariable(['properties', 'before', watchedField])
          : undefined;
      case 'afterValue':
        return isNonEmptyString(watchedField)
          ? asVariable(['properties', 'after', watchedField])
          : undefined;
      case 'workflowId':
        return isNonEmptyString(workflowId) ? workflowId : undefined;
      default:
        return undefined;
    }
  };

  const values: DerivedInputValues = {};
  let isDerivable = true;

  for (const { key, kind } of derivedKinds) {
    const value = resolve(kind);

    if (!isNonEmptyString(value)) {
      isDerivable = false;
      continue;
    }

    values[key] = value;
  }

  return { values: isDerivable ? values : {}, isDerivable };
};
