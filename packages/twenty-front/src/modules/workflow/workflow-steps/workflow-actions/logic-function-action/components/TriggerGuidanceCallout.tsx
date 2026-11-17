import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { workflowSelectedNodeComponentState } from '@/workflow/workflow-diagram/states/workflowSelectedNodeComponentState';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';
import { Callout } from 'twenty-ui/primitives/feedback';
import { t } from '@lingui/core/macro';

type TriggerGuidanceCalloutProps = {
  readonly?: boolean;
  /** App-owned copy: the app knows what ITS trigger needs. */
  description?: string;
};

/**
 * Guidance shown when the action cannot get its values from the workflow
 * trigger.
 *
 * It is actionable rather than a bare warning: the trigger is what has to
 * change, so the callout selects the trigger node in the diagram, which is where
 * the operator sets "ویرایش رکورد" and the watched column. Nothing is saved by
 * this — it only moves the selection, exactly like clicking the node.
 */
export const TriggerGuidanceCallout = ({
  readonly,
  description,
}: TriggerGuidanceCalloutProps) => {
  const setWorkflowSelectedNode = useSetAtomComponentState(
    workflowSelectedNodeComponentState,
  );

  return (
    <Callout
      variant={'warning'}
      title={t`محرک نیاز به تنظیم دارد`}
      description={
        description ??
        t`برای ارسال پیامک هنگام تغییر اطلاعات، رویداد «ویرایش رکورد» و ستون موردنظر را انتخاب کنید.`
      }
      action={
        readonly === true
          ? undefined
          : {
              label: t`تنظیم محرک`,
              onClick: () => setWorkflowSelectedNode(TRIGGER_STEP_ID),
            }
      }
    />
  );
};
