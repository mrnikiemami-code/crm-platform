import { TabListRoot } from '@/ui/layout/tab-list/components/TabListRoot';
import { WorkflowStepTabPanel } from '@/workflow/workflow-steps/components/WorkflowStepTabPanel';
import { useIsThirdPartyApplication } from '@/applications/hooks/useIsThirdPartyApplication';
import { LogicFunctionExecutionResult } from '@/logic-functions/components/LogicFunctionExecutionResult';
import { LogicFunctionLogs } from '@/logic-functions/components/LogicFunctionLogs';
import { LogicFunctionTestInputInitEffect } from '@/logic-functions/components/LogicFunctionTestInputInitEffect';
import { useExecuteLogicFunction } from '@/logic-functions/hooks/useExecuteLogicFunction';
import { useGetOneLogicFunction } from '@/logic-functions/hooks/useGetOneLogicFunction';
import { InputLabel } from 'twenty-ui/primitives/input';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type WorkflowLogicFunctionAction } from '@/workflow/types/Workflow';
import { WorkflowExpectedOutputBodyInput } from '@/workflow/workflow-steps/components/WorkflowExpectedOutputBodyInput';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { WorkflowEditActionCodeFields } from '@/workflow/workflow-steps/workflow-actions/code-action/components/WorkflowEditActionCodeFields';
import { mergeDefaultFunctionInputAndFunctionInput } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/mergeDefaultFunctionInputAndFunctionInput';
import { setNestedValue } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/setNestedValue';
import { WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/WorkflowLogicFunctionActionTabListComponentId';
import { TriggerDerivedInputInitEffect } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/components/TriggerDerivedInputInitEffect';
import { TriggerGuidanceCallout } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/components/TriggerGuidanceCallout';
import {
  buildTriggerDerivedInputValues,
  hasTriggerDerivedProperties,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/buildTriggerDerivedInputValues';
import { flowComponentState } from '@/workflow/states/flowComponentState';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString, isObject } from '@sniptt/guards';
import { useMemo } from 'react';
import { getOutputSchemaFromValue } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';
import { getFunctionInputFromInputSchema } from 'twenty-shared/workflow';
import { Callout } from 'twenty-ui/primitives/feedback';
import { IconPlayerPlay, IconSettingsAutomation } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

const INPUT_TAB_ID = 'input';
const TEST_TAB_ID = 'test';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledTabListContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
`;

type WorkflowEditActionLogicFunctionProps = {
  action: WorkflowLogicFunctionAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowLogicFunctionAction) => void;
      };
};

export const WorkflowEditActionLogicFunction = ({
  action,
  actionOptions,
}: WorkflowEditActionLogicFunctionProps) => {
  const { t } = useLingui();

  const logicFunctionId = action.settings.input.logicFunctionId;

  const { logicFunction, loading } = useGetOneLogicFunction({
    id: logicFunctionId,
  });

  const isThirdPartyApp = useIsThirdPartyApplication(
    logicFunction?.applicationId,
  );

  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
  );

  // The flow — including its trigger — is already in memory: the diagram effect
  // loads it once and the side panel reads the same atom. Fetching the workflow
  // record again here would add a request per action-node mount for data that is
  // already on screen.
  const flow = useAtomComponentStateValue(flowComponentState);

  const workflowActionSettings = logicFunction?.workflowActionTriggerSettings;

  // Keyed on the two VALUES the derivation reads, not on the flow object and not
  // on a serialisation of the whole trigger: the trigger's `outputSchema`
  // carries every field of the object, so stringifying it on each render would
  // cost more than the derivation it guards. While these two are unchanged the
  // cached result is still correct, because they are the only inputs read.
  const triggerType = flow?.trigger?.type;
  const databaseEventSettings =
    flow?.trigger?.type === 'DATABASE_EVENT'
      ? (flow.trigger.settings as {
          eventName?: string;
          fields?: string[] | null;
        })
      : undefined;
  const triggerEventName = databaseEventSettings?.eventName;
  const triggerFieldsSignature = (databaseEventSettings?.fields ?? []).join(
    '\u0001',
  );

  const triggerDerivation = useMemo(
    () =>
      buildTriggerDerivedInputValues({
        inputSchema: workflowActionSettings?.inputSchema,
        trigger: flow?.trigger,
        workflowId: workflowVisualizerWorkflowId,
      }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      workflowActionSettings?.inputSchema,
      triggerType,
      triggerEventName,
      triggerFieldsSignature,
      workflowVisualizerWorkflowId,
    ],
  );

  const showsTriggerGuidance =
    hasTriggerDerivedProperties(workflowActionSettings?.inputSchema) &&
    !triggerDerivation.isDerivable;

  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID,
  );

  const functionInput = useMemo(() => {
    const inputSchema =
      logicFunction?.workflowActionTriggerSettings?.inputSchema;

    if (!isDefined(inputSchema)) {
      return action.settings.input.logicFunctionInput ?? {};
    }

    const defaultInput = getFunctionInputFromInputSchema(inputSchema)[0];

    if (!isObject(defaultInput)) {
      return action.settings.input.logicFunctionInput ?? {};
    }

    return mergeDefaultFunctionInputAndFunctionInput({
      newInput: defaultInput,
      oldInput: action.settings.input.logicFunctionInput ?? {},
    });
  }, [
    logicFunction?.workflowActionTriggerSettings?.inputSchema,
    action.settings.input.logicFunctionInput,
  ]);

  const updateAction = useDebouncedCallback(
    (actionUpdate: Partial<WorkflowLogicFunctionAction>) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        ...actionUpdate,
      });
    },
    500,
  );

  const updateOutputSchemaFromTestResult = (testResult: object) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const newOutputSchema = getOutputSchemaFromValue(testResult);

    updateAction({
      ...action,
      settings: { ...action.settings, outputSchema: newOutputSchema },
    });
  };

  const {
    executeLogicFunction,
    isExecuting,
    logicFunctionTestData,
    updateLogicFunctionInput,
  } = useExecuteLogicFunction({
    logicFunctionId,
    callback: updateOutputSchemaFromTestResult,
  });

  const testInput = mergeDefaultFunctionInputAndFunctionInput({
    newInput: functionInput,
    oldInput: logicFunctionTestData.input,
  });

  const handleInputChange = (value: unknown, path: string[]) => {
    const updatedFunctionInput = setNestedValue(functionInput, path, value);

    updateAction({
      settings: {
        ...action.settings,
        input: {
          ...action.settings.input,
          logicFunctionInput: updatedFunctionInput,
        },
      },
    });
  };

  const handleTestInputChange = (value: unknown, path: string[]) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const updatedTestFunctionInput = setNestedValue(testInput, path, value);

    updateLogicFunctionInput(updatedTestFunctionInput);
  };

  const handleExpectedOutputBodyChange = (
    parsedValue: Record<string, unknown>,
  ) => {
    if (actionOptions.readonly === true) {
      return;
    }

    updateAction({
      settings: {
        ...action.settings,
        expectedOutputSchema: parsedValue,
      },
    });
  };

  const handleTestFunction = async () => {
    if (actionOptions.readonly === true) {
      return;
    }

    await executeLogicFunction();
  };

  if (loading) {
    return null;
  }

  const hasInputFields = Object.keys(functionInput).length > 0;

  const isTestTabActive = !isThirdPartyApp && activeTabId === TEST_TAB_ID;

  const tabs = [
    {
      id: INPUT_TAB_ID,
      title: t`Input`,
      Icon: IconSettingsAutomation,
    },
    {
      id: TEST_TAB_ID,
      title: t`Test`,
      Icon: IconPlayerPlay,
    },
  ];

  const stepBody = (
    <WorkflowStepBody>
      {isTestTabActive ? (
        <>
          <WorkflowEditActionCodeFields
            functionInput={testInput}
            inputSchema={
              logicFunction?.workflowActionTriggerSettings?.inputSchema
            }
            onInputChange={handleTestInputChange}
            readonly={actionOptions.readonly}
          />
          <StyledResultContainer>
            <InputLabel>{t`Result`}</InputLabel>
            <LogicFunctionExecutionResult
              logicFunctionTestData={logicFunctionTestData}
              isTesting={isExecuting}
            />
          </StyledResultContainer>
          {logicFunctionTestData.output.logs.length > 0 && (
            <StyledResultContainer>
              <LogicFunctionLogs
                componentInstanceId={`workflow-edit-action-logs-${action.id}`}
                value={isExecuting ? '' : logicFunctionTestData.output.logs}
              />
            </StyledResultContainer>
          )}
        </>
      ) : (
        <StyledContainer>
          {showsTriggerGuidance && (
            <TriggerGuidanceCallout
              readonly={actionOptions.readonly === true}
              description={workflowActionSettings?.triggerRequirementMessage}
            />
          )}
          {hasInputFields ? (
            <WorkflowEditActionCodeFields
              functionInput={functionInput}
              inputSchema={
                logicFunction?.workflowActionTriggerSettings?.inputSchema
              }
              readonly={actionOptions.readonly}
              onInputChange={handleInputChange}
              VariablePicker={WorkflowVariablePicker}
              fullWidth
            />
          ) : (
            <Callout
              variant={'neutral'}
              title={t`No input fields for this action`}
              description={t`You can see the function logic in your application settings.`}
            />
          )}
          {workflowActionSettings?.hideExpectedOutput === true ? null : (
            <WorkflowExpectedOutputBodyInput
              defaultValue={action.settings.expectedOutputSchema}
              onChange={handleExpectedOutputBodyChange}
              readonly={actionOptions.readonly}
            />
          )}
        </StyledContainer>
      )}
    </WorkflowStepBody>
  );

  return (
    <TabListRoot
      componentInstanceId={WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID}
      enabled={!isThirdPartyApp}
    >
      <LogicFunctionTestInputInitEffect logicFunctionId={logicFunctionId} />
      {actionOptions.readonly !== true &&
        triggerDerivation.isDerivable &&
        Object.keys(triggerDerivation.values).length > 0 && (
          <TriggerDerivedInputInitEffect
            action={action}
            values={triggerDerivation.values}
            onActionUpdate={actionOptions.onActionUpdate}
          />
        )}
      {!isThirdPartyApp && (
        <StyledTabListContainer>
          <TabList
            aria-label={t`Function step`}
            tabs={tabs}
            behaveAsLinks={false}
            componentInstanceId={
              WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID
            }
          />
        </StyledTabListContainer>
      )}
      {isThirdPartyApp ? (
        stepBody
      ) : (
        <WorkflowStepTabPanel value={activeTabId ?? ''}>
          {stepBody}
        </WorkflowStepTabPanel>
      )}
      {!actionOptions.readonly && (
        <WorkflowStepFooter
          stepId={action.id}
          additionalActions={
            isTestTabActive
              ? [
                  <WorkflowStepCmdEnterButton
                    title={t`Test`}
                    onClick={handleTestFunction}
                    disabled={isExecuting}
                  />,
                ]
              : []
          }
        />
      )}
    </TabListRoot>
  );
};
