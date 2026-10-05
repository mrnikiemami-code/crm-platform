import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sendCommunicationWorkflowHandler } from 'src/logic-functions/handlers/send-communication-workflow-handler';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';

// ---------------------------------------------------------------------------
// CONTRACT SIMULATION OF THE NATIVE RUNTIME BOUNDARY — NOT A RUNTIME TEST.
//
// This file models the *documented* server behavior it was verified against, so
// the consequence of the adapter's return shape is locked in code rather than
// only in prose. The server itself is never executed here.
//
// Verified sources (packages/twenty-server/src/modules/workflow/...):
//   logic-function.workflow-action.ts:
//       if (result.error) return { error: result.error.errorMessage };
//       return { result: result.data || {} };
//   workflow-executor.workspace-service.ts (processStepExecutionResult):
//       const isSuccess = isDefined(actionOutput.result);
//       ... isSuccess -> StepStatus.SUCCESS, shouldProcessNextSteps = true
//
// Consequence: a returned `{ success: false, error }` reaches the executor as
// `actionOutput.result` (defined), so the step is reported SUCCESS and
// downstream steps continue. The step only FAILS when the executor produces
// `actionOutput.error`, which happens when the logic function THROWS.
// ---------------------------------------------------------------------------

// Mirrors `LogicFunctionWorkflowAction.execute` result mapping.
const mapHandlerOutputToActionOutput = (
  handlerOutput: unknown,
  didHandlerThrow = false,
): { result?: unknown; error?: string } =>
  didHandlerThrow
    ? { error: 'boom' }
    : { result: (handlerOutput ?? {}) as object };

// Mirrors `processStepExecutionResult` classification.
const classifyStep = (actionOutput: {
  result?: unknown;
  error?: string;
}): 'SUCCESS' | 'FAILED' => (actionOutput.error === undefined ? 'SUCCESS' : 'FAILED');

const buildRegistry = (
  result: { status: 'SENT'; providerMessageId: string } | (() => never),
) => {
  const provider: CommunicationProvider = {
    id: 'razpayamak',
    channel: 'SMS',
    capabilities: () => ({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    }),
    send: async () => (typeof result === 'function' ? result() : result),
  };

  const registry = new CommunicationProviderRegistry();

  registry.register(provider);

  return registry;
};

const buildClient = (failCreate = false) => ({
  query: async () => ({ person: null }),
  mutation: async (payload: Record<string, Record<string, unknown>>) => {
    const [name] = Object.keys(payload);

    if (name === 'createCommunication') {
      if (failCreate) {
        throw new Error('createCommunication failed');
      }

      return { createCommunication: { id: 'communication-1' } };
    }

    return { updateCommunication: { id: 'communication-1' } };
  },
});

const SAVED_ENV = { ...process.env };

describe('native Workflow step-status contract (simulated boundary)', () => {
  beforeEach(() => {
    process.env.COMMUNICATION_PROVIDER = 'razpayamak';
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('reports a business failure as a SUCCESS step — the verified native behavior', async () => {
    const handlerOutput = await sendCommunicationWorkflowHandler(
      { channel: 'SMS', recipient: '09120000000', body: 'hello' },
      {
        client: buildClient() as never,
        registry: buildRegistry(() => {
          throw new Error('provider down');
        }),
      },
    );

    expect(handlerOutput.success).toBe(false);

    const actionOutput = mapHandlerOutputToActionOutput(handlerOutput);

    // This is the documented, undesired consequence: no `error` field is
    // produced, so the executor classifies the step as SUCCESS.
    expect(actionOutput.error).toBeUndefined();
    expect(classifyStep(actionOutput)).toBe('SUCCESS');
  });

  it('does not throw, which is what would trigger native step retry', async () => {
    // A thrown exception is the only path to `actionOutput.error`, and that
    // path also feeds the retry machinery (retryOnFailure). The adapter must
    // therefore never throw, or a possible send could be repeated.
    const handlerOutput = await sendCommunicationWorkflowHandler(
      { channel: 'SMS', recipient: '09120000000', body: 'hello' },
      { client: buildClient(true) as never, registry: buildRegistry({ status: 'SENT', providerMessageId: '1' }) },
    );

    expect(handlerOutput).toBeTypeOf('object');
    expect(handlerOutput.success).toBe(false);
  });

  it('reports a successful send as a SUCCESS step', async () => {
    const handlerOutput = await sendCommunicationWorkflowHandler(
      { channel: 'SMS', recipient: '09120000000', body: 'hello' },
      {
        client: buildClient() as never,
        registry: buildRegistry({ status: 'SENT', providerMessageId: '1' }),
      },
    );

    expect(handlerOutput.success).toBe(true);
    expect(classifyStep(mapHandlerOutputToActionOutput(handlerOutput))).toBe(
      'SUCCESS',
    );
  });
});
