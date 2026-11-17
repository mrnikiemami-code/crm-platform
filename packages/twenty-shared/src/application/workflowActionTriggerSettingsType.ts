import { type InputSchema } from '@/workflow/types/InputSchema';

// Exposes a logic function as a step in the visual workflow builder.
// Uses Twenty's rich InputSchema with FieldMetadataType support so the
// builder can render proper field editors, variable pickers, and labels.
// inputSchema is optional in the developer-facing SDK; the manifest builder
// fills it in by inferring from the handler source code when omitted.
export type WorkflowActionTriggerSettings = {
  inputSchema?: InputSchema;
  outputSchema?: InputSchema;
  icon?: string;
  label?: string;
  /**
   * Suppresses the editable "expected output" JSON box.
   *
   * That box is a developer-facing contract, not something a normal operator
   * should be asked to edit, so an action that already declares `outputSchema`
   * can hide it.
   */
  hideExpectedOutput?: boolean;
  /**
   * Shown when the action needs a trigger that SUPPLIES field-change data but
   * the workflow does not have one. The copy is owned by the app, so the app can
   * word it for its own users, and the core builder stays translation-neutral.
   */
  triggerRequirementMessage?: string;
};
