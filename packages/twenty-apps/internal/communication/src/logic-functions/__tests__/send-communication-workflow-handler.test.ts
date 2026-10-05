import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sendCommunicationWorkflowHandler } from 'src/logic-functions/handlers/send-communication-workflow-handler';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';

const SAVED_ENV = { ...process.env };

type QueryResult = {
  person?: { id: string; phones: unknown } | null;
};

const PERSON_WITH_PHONE: QueryResult = {
  person: {
    id: 'person-1',
    phones: { primaryPhoneNumber: '09120000000' },
  },
};

type MutationCall = { mutationName: string; args: Record<string, unknown> };

const buildFakeClient = ({
  queryResult = PERSON_WITH_PHONE,
  failCreate = false,
  failOutcomeUpdate = false,
}: {
  queryResult?: QueryResult;
  failCreate?: boolean;
  failOutcomeUpdate?: boolean;
} = {}) => {
  const mutations: MutationCall[] = [];

  return {
    mutations,
    client: {
      query: async () => queryResult,
      mutation: async (payload: Record<string, Record<string, unknown>>) => {
        const [mutationName] = Object.keys(payload);
        const body = payload[mutationName] as { __args: Record<string, unknown> };

        mutations.push({ mutationName, args: body.__args });

        if (mutationName === 'createCommunication') {
          if (failCreate) {
            throw new Error('createCommunication failed');
          }

          return { createCommunication: { id: 'communication-1' } };
        }

        if (failOutcomeUpdate) {
          throw new Error('updateCommunication failed');
        }

        return { updateCommunication: { id: 'communication-1' } };
      },
    },
  };
};

const buildRegistry = (
  result: CommunicationSendResult | (() => never),
): { registry: CommunicationProviderRegistry; sent: number[] } => {
  const sent: number[] = [];

  const provider: CommunicationProvider = {
    id: 'razpayamak',
    channel: 'SMS',
    capabilities: () => ({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    }),
    send: async () => {
      sent.push(1);

      if (typeof result === 'function') {
        return result();
      }

      return result;
    },
  };

  const registry = new CommunicationProviderRegistry();

  registry.register(provider);

  return { registry, sent };
};

describe('sendCommunicationWorkflowHandler', () => {
  beforeEach(() => {
    process.env.COMMUNICATION_PROVIDER = 'razpayamak';
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  const baseParameters = {
    channel: 'SMS',
    recipient: '09120000000',
    body: 'hello',
  };

  it('maps a valid request onto the durable service exactly once', async () => {
    const { client, mutations } = buildFakeClient();
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '42',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: true,
      status: 'SENT',
      communicationId: 'communication-1',
      message: 'Message sent.',
    });
    expect(sent).toHaveLength(1);

    const created = mutations.find(
      (mutation) => mutation.mutationName === 'createCommunication',
    );

    expect(created?.args).toMatchObject({
      data: {
        channel: 'SMS',
        recipient: '09120000000',
        status: 'QUEUED',
      },
    });
  });

  it('sends and persists exactly the supplied subject', async () => {
    const { client, mutations } = buildFakeClient();
    const providerMessages: { subject?: string }[] = [];

    const provider: CommunicationProvider = {
      id: 'razpayamak',
      channel: 'SMS',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send: async (message) => {
        providerMessages.push({ ...(message.subject === undefined ? {} : { subject: message.subject }) });

        return { status: 'SENT', providerMessageId: '42' };
      },
    };

    const registry = new CommunicationProviderRegistry();

    registry.register(provider);

    const result = await sendCommunicationWorkflowHandler(
      { ...baseParameters, subject: 'موضوع پیام' },
      { client: client as never, registry },
    );

    expect(result.success).toBe(true);

    const created = mutations.find(
      (mutation) => mutation.mutationName === 'createCommunication',
    );
    const persistedSubject = (
      created?.args.data as Record<string, unknown>
    ).subject;

    // The provider received the subject...
    expect(providerMessages[0].subject).toBe('موضوع پیام');
    // ...and history snapshotted that exact same value.
    expect(persistedSubject).toBe('موضوع پیام');
    expect(persistedSubject).toBe(providerMessages[0].subject);
  });

  it('omits the subject when none is supplied', async () => {
    const { client, mutations } = buildFakeClient();
    const providerMessages: Record<string, unknown>[] = [];

    const provider: CommunicationProvider = {
      id: 'razpayamak',
      channel: 'SMS',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send: async (message) => {
        providerMessages.push({ ...message });

        return { status: 'SENT', providerMessageId: '42' };
      },
    };

    const registry = new CommunicationProviderRegistry();

    registry.register(provider);

    await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    const created = mutations.find(
      (mutation) => mutation.mutationName === 'createCommunication',
    );

    expect(providerMessages[0]).not.toHaveProperty('subject');
    expect(created?.args.data).not.toHaveProperty('subject');
  });

  it('rejects an unsupported channel without sending', async () => {
    const { client } = buildFakeClient();
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(
      { ...baseParameters, channel: 'TELEGRAM' },
      { client: client as never, registry },
    );

    expect(result).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Unsupported channel "TELEGRAM".',
    });
    expect(sent).toHaveLength(0);
  });

  it('rejects an empty body without sending', async () => {
    const { client } = buildFakeClient();
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(
      { ...baseParameters, body: '   ' },
      { client: client as never, registry },
    );

    expect(result).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Message body is required.',
    });
    expect(sent).toHaveLength(0);
  });

  it('rejects an empty recipient without sending', async () => {
    const { client } = buildFakeClient();
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(
      { ...baseParameters, recipient: '  ' },
      { client: client as never, registry },
    );

    expect(result).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Recipient is required.',
    });
    expect(sent).toHaveLength(0);
  });

  describe('target Person context', () => {
    it('validates Person access when a Person is supplied', async () => {
      const { client } = buildFakeClient({ queryResult: { person: null } });
      const { registry, sent } = buildRegistry({
        status: 'SENT',
        providerMessageId: '1',
      });

      const result = await sendCommunicationWorkflowHandler(
        { ...baseParameters, targetPersonId: 'person-1' },
        { client: client as never, registry },
      );

      expect(result).toEqual({
        success: false,
        failureCode: 'PERSON_NOT_ACCESSIBLE',
        error: 'Person not found or not accessible.',
      });
      expect(sent).toHaveLength(0);
    });

    it('validates recipient ownership against the Person', async () => {
      const { client } = buildFakeClient();
      const { registry, sent } = buildRegistry({
        status: 'SENT',
        providerMessageId: '1',
      });

      const result = await sendCommunicationWorkflowHandler(
        {
          ...baseParameters,
          recipient: '09990000000',
          targetPersonId: 'person-1',
        },
        { client: client as never, registry },
      );

      expect(result).toEqual({
        success: false,
        failureCode: 'INVALID_INPUT',
        error: 'Selected phone number does not belong to this person.',
      });
      expect(sent).toHaveLength(0);
    });

    it('links the communication to the Person when valid', async () => {
      const { client, mutations } = buildFakeClient();
      const { registry } = buildRegistry({
        status: 'SENT',
        providerMessageId: '1',
      });

      await sendCommunicationWorkflowHandler(
        { ...baseParameters, targetPersonId: 'person-1' },
        { client: client as never, registry },
      );

      const created = mutations.find(
        (mutation) => mutation.mutationName === 'createCommunication',
      );

      expect(created?.args).toMatchObject({
        data: { targetPersonId: 'person-1' },
      });
    });
  });

  it('reports a normalized FAILED outcome truthfully', async () => {
    const { client } = buildFakeClient();
    const { registry } = buildRegistry({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      status: 'FAILED',
      communicationId: 'communication-1',
      failureCode: 'PROVIDER_FAILED',
      isOutcomeKnown: true,
      error: 'Invalid receptor',
    });
  });

  it('prevents sending when the initial record cannot be created', async () => {
    const { client } = buildFakeClient({ failCreate: true });
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('UNEXPECTED_FAILURE');
    expect(result.isOutcomeKnown).toBe(false);
    // A definite non-send cannot be claimed even here: the status is unknown.
    expect(result.error).toContain('may or may not have been sent');
    expect(result.error).not.toContain('could not be sent');
    // Nothing was sent, and no record survived.
    expect(sent).toHaveLength(0);
  });

  describe('unexpected provider throw', () => {
    it('stays uncertain when the FAILED state was written successfully', async () => {
      const { client, mutations } = buildFakeClient();
      const { registry, sent } = buildRegistry(() => {
        throw new Error('SECRET-API-KEY in transport error');
      });

      const result = await sendCommunicationWorkflowHandler(baseParameters, {
        client: client as never,
        registry,
      });

      // A stored FAILED status does NOT prove external non-delivery.
      expect(result).toEqual({
        success: false,
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error:
          'The message may or may not have been sent. Check the communication history before re-running this step.',
      });
      expect(result.error).not.toContain('could not be sent');
      expect(JSON.stringify(result)).not.toContain('SECRET-API-KEY');
      // Exactly one provider call.
      expect(sent).toHaveLength(1);
      // The FAILED state was recorded.
      const outcomeUpdate = mutations.find(
        (mutation) => mutation.mutationName === 'updateCommunication',
      );

      expect(outcomeUpdate?.args).toMatchObject({ data: { status: 'FAILED' } });
    });

    it('stays uncertain when the FAILED write also fails', async () => {
      const { client } = buildFakeClient({ failOutcomeUpdate: true });
      const { registry, sent } = buildRegistry(() => {
        throw new Error('SECRET-API-KEY in transport error');
      });

      const result = await sendCommunicationWorkflowHandler(baseParameters, {
        client: client as never,
        registry,
      });

      expect(result).toEqual({
        success: false,
        communicationId: 'communication-1',
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error:
          'The send outcome is unknown. Check the communication history before re-running this step.',
      });
      expect(JSON.stringify(result)).not.toContain('SECRET-API-KEY');
      expect(sent).toHaveLength(1);
    });
  });

  it('stays truthful when a SENT outcome cannot be persisted', async () => {
    const { client } = buildFakeClient({ failOutcomeUpdate: true });
    const { registry, sent } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      status: 'SENT',
      communicationId: 'communication-1',
      failureCode: 'OUTCOME_NOT_PERSISTED',
      isOutcomeKnown: true,
      error:
        'The message was sent but its result could not be recorded. Re-running this step would send it again.',
    });
    // The adapter never resends on its own.
    expect(sent).toHaveLength(1);
  });

  it('keeps a double failure unknown and leaks no secrets', async () => {
    const { client } = buildFakeClient({ failOutcomeUpdate: true });
    const { registry, sent } = buildRegistry(() => {
      throw new Error('SECRET-API-KEY in transport error');
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      communicationId: 'communication-1',
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
      error:
        'The send outcome is unknown. Check the communication history before re-running this step.',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET-API-KEY');
    expect(sent).toHaveLength(1);
  });

  it('never returns success for an incomplete operation', async () => {
    const { client } = buildFakeClient({ failOutcomeUpdate: true });
    const { registry } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    expect(result.success).toBe(false);
  });

  it('does not require a workspace member when none is supplied', async () => {
    const { client } = buildFakeClient();
    const { registry } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    const result = await sendCommunicationWorkflowHandler(baseParameters, {
      client: client as never,
      registry,
    });

    // A Workflow can run with no human behind it; no member is fabricated and
    // the send still succeeds.
    expect(result.success).toBe(true);
  });

  it('records the trusted sender when the context provides one', async () => {
    const { client, mutations } = buildFakeClient();
    const { registry } = buildRegistry({
      status: 'SENT',
      providerMessageId: '1',
    });

    await sendCommunicationWorkflowHandler(
      { ...baseParameters, workspaceMemberId: 'member-1' },
      { client: client as never, registry },
    );

    const created = mutations.find(
      (mutation) => mutation.mutationName === 'createCommunication',
    );

    expect(created?.args).toMatchObject({ data: { senderId: 'member-1' } });
  });
});
