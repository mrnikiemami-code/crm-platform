// System identity for unattended workflow sending.
//
// A workflow triggered by a database event has NO person behind it: the run is
// created with `createdBy.source = WORKFLOW` and `workspaceMemberId = null`, and
// the executor injects the same token for both the application and the
// "delegated" caller. That is exactly why a person-based permission check
// returns CALLER_NOT_A_USER and why the workflow must NOT borrow an employee's
// identity: an employee's permissions can be revoked or the employee
// deactivated, which would silently stop a running workflow.
//
// So the authority is a WORKSPACE-level switch, not a member:
//  - it is an application variable, materialised per workspace and injected into
//    the function's execution context;
//  - only a caller holding the platform's APPLICATIONS settings permission (an
//    administrator) can write it — `updateOneApplicationVariable` is guarded by
//    `SettingsPermissionGuard(PermissionFlagType.APPLICATIONS)`;
//  - it grants exactly one capability, "may unattended workflows send SMS". It
//    carries no record-reading power of its own: the function still reads the
//    recipient and the template through the app's own scoped role.
//
// Revocation is therefore a single value change, and disabling the workflow
// stops it independently because the trigger no longer dispatches.
export const WORKFLOW_SMS_SENDING_VARIABLE_NAME = 'WORKFLOW_SMS_SENDING';

export const WORKFLOW_SMS_SENDING_ENABLED = 'enabled';
export const WORKFLOW_SMS_SENDING_DISABLED = 'disabled';

export type WorkflowSmsAuthorization =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'NOT_CONFIGURED' | 'DISABLED';
      message: string;
    };

const readVariable = (): string | undefined => {
  const value = process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME];

  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
};

/**
 * Whether unattended workflow sending is authorized in this workspace.
 *
 * Fails CLOSED: an unset variable is NOT_CONFIGURED rather than "allowed", so a
 * workspace that never opted in cannot send, and an installation that predates
 * the variable cannot send by accident.
 */
export const readWorkflowSmsAuthorization = (): WorkflowSmsAuthorization => {
  const value = readVariable();

  if (value === undefined || value.length === 0) {
    return {
      allowed: false,
      reason: 'NOT_CONFIGURED',
      message:
        'Workflow SMS sending is not configured for this workspace. An administrator must enable it in the Communication application settings.',
    };
  }

  if (value !== WORKFLOW_SMS_SENDING_ENABLED) {
    return {
      allowed: false,
      reason: 'DISABLED',
      message:
        'Workflow SMS sending is disabled for this workspace. An administrator can enable it in the Communication application settings.',
    };
  }

  return { allowed: true };
};
