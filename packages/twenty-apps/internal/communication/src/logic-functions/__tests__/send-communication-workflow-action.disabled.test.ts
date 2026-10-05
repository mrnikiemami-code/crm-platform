import { describe, expect, it, vi } from 'vitest';

// The shipped entry point. Importing the default export executes the module,
// which is exactly what runs in production.
import workflowActionConfig from 'src/logic-functions/send-communication-workflow-action';
import * as sendHandlerModule from 'src/logic-functions/handlers/send-communication-workflow-handler';

const DISABLED_RESULT = {
  success: false,
  failureCode: 'WORKFLOW_ACTION_DISABLED',
  error: 'Communication sending from Workflow is unavailable.',
};

// `defineLogicFunction` returns a ValidationResult wrapper at runtime
// (`{ success, config, errors, warnings }`), so the definition lives on
// `.config`.
const definition = (
  workflowActionConfig as unknown as {
    config: {
      universalIdentifier: string;
      handler: (payload?: unknown, context?: unknown) => Promise<unknown>;
      workflowActionTriggerSettings?: unknown;
      httpRouteTriggerSettings?: unknown;
      toolTriggerSettings?: unknown;
      databaseEventTriggerSettings?: unknown;
      cronTriggerSettings?: unknown;
      serverRouteTriggerSettings?: unknown;
    };
  }
).config;

const config = definition;

describe('disabled Workflow send action — configuration', () => {
  it('is no longer registered as a Workflow action', () => {
    expect(config.workflowActionTriggerSettings).toBeUndefined();
  });

  it('exposes no alternative trigger that could send', () => {
    expect(config.httpRouteTriggerSettings).toBeUndefined();
    expect(config.toolTriggerSettings).toBeUndefined();
    expect(config.databaseEventTriggerSettings).toBeUndefined();
    expect(config.cronTriggerSettings).toBeUndefined();
    expect(config.serverRouteTriggerSettings).toBeUndefined();
  });

  it('keeps its universal identifier stable', () => {
    expect(config.universalIdentifier).toBe(
      'e55f7b79-cf61-45b4-a1c4-259fa7089b28',
    );
  });
});

describe('disabled Workflow send action — entry behavior', () => {
  it('returns WORKFLOW_ACTION_DISABLED for valid input', async () => {
    const result = await config.handler(
      {
        channel: 'SMS',
        recipient: '09120000000',
        body: 'hello',
      },
      { workspaceMemberId: 'member-1' },
    );

    expect(result).toEqual(DISABLED_RESULT);
  });

  it('stays disabled for empty input', async () => {
    expect(await config.handler({})).toEqual(DISABLED_RESULT);
  });

  it('stays disabled for malformed input', async () => {
    expect(await config.handler(null)).toEqual(DISABLED_RESULT);
    expect(await config.handler('not-an-object')).toEqual(DISABLED_RESULT);
    expect(await config.handler({ channel: 42, body: [] })).toEqual(
      DISABLED_RESULT,
    );
  });

  it('cannot be enabled by supplying sender or workspace fields', async () => {
    const result = await config.handler(
      {
        channel: 'SMS',
        recipient: '09120000000',
        body: 'hello',
        providerId: 'razpayamak',
        targetPersonId: 'person-1',
        workspaceMemberId: 'member-1',
        senderId: 'member-1',
        workspaceId: 'workspace-1',
        enabled: true,
        force: true,
      },
      { workspaceMemberId: 'member-1', workspaceId: 'workspace-1' },
    );

    expect(result).toEqual(DISABLED_RESULT);
  });

  it('never calls the reusable send handler', async () => {
    const sendHandlerSpy = vi.spyOn(sendHandlerModule, 'sendCommunicationWorkflowHandler');

    await config.handler(
      { channel: 'SMS', recipient: '09120000000', body: 'hello' },
      { workspaceMemberId: 'member-1' },
    );
    await config.handler({});
    await config.handler(null);

    expect(sendHandlerSpy).not.toHaveBeenCalled();

    sendHandlerSpy.mockRestore();
  });
});
