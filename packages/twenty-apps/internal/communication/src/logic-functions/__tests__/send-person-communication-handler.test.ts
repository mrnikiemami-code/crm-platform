import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { sendPersonCommunicationHandler } from 'src/logic-functions/handlers/send-person-communication-handler';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';

const SAVED_ENV = { ...process.env };

const configureProvider = () => {
  process.env.COMMUNICATION_PROVIDER = 'razpayamak';
};

type QueryResult = {
  person?: { edges?: { node: { id: string; phones: unknown } }[] };
};

const PERSON_WITH_PHONE: QueryResult = {
  person: {
    edges: [
      {
        node: {
          id: 'person-1',
          phones: {
            primaryPhoneNumber: '09120000000',
            additionalPhones: [{ number: '09350000000' }],
          },
        },
      },
    ],
  },
};

type MutationCall = { mutationName: string; args: Record<string, unknown> };

const buildFakeClient = ({
  queryResult,
  failCreate = false,
}: {
  queryResult: QueryResult;
  failCreate?: boolean;
}) => {
  const mutations: MutationCall[] = [];

  const client = {
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

      return { updateCommunication: { id: 'communication-1' } };
    },
  };

  return { client, mutations };
};

const buildRegistryWithStubProvider = (
  result: CommunicationSendResult,
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

      return result;
    },
  };

  const registry = new CommunicationProviderRegistry();

  registry.register(provider);

  return { registry, sent };
};

describe('findPersonPhoneOptions', () => {
  it('returns null when the person is not accessible', async () => {
    const { client } = buildFakeClient({ queryResult: { person: { edges: [] } } });

    expect(
      await findPersonPhoneOptions({ client: client as never, personId: 'p' }),
    ).toBeNull();
  });

  it('maps the phones composite into selectable options', async () => {
    const { client } = buildFakeClient({ queryResult: PERSON_WITH_PHONE });

    expect(
      await findPersonPhoneOptions({ client: client as never, personId: 'p' }),
    ).toEqual([
      { id: 'primary', value: '09120000000', isPrimary: true },
      { id: 'additional-0', value: '09350000000', isPrimary: false },
    ]);
  });

  it('returns an empty list when the person has no phone number', async () => {
    const { client } = buildFakeClient({
      queryResult: { person: { edges: [{ node: { id: 'p', phones: null } }] } },
    });

    expect(
      await findPersonPhoneOptions({ client: client as never, personId: 'p' }),
    ).toEqual([]);
  });
});

describe('sendPersonCommunicationHandler', () => {
  beforeEach(configureProvider);

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  const validParameters = {
    personId: 'person-1',
    channel: 'SMS' as const,
    recipient: '09120000000',
    body: 'hello',
  };

  it('rejects an unsupported channel', async () => {
    expect(
      await sendPersonCommunicationHandler({
        ...validParameters,
        channel: 'TELEGRAM' as never,
      }),
    ).toEqual({ success: false, error: 'Unsupported channel "TELEGRAM".' });
  });

  it('rejects an empty body', async () => {
    expect(
      await sendPersonCommunicationHandler({
        ...validParameters,
        body: '   ',
      }),
    ).toEqual({ success: false, error: 'Message body is required.' });
  });

  it('rejects an empty recipient', async () => {
    expect(
      await sendPersonCommunicationHandler({
        ...validParameters,
        recipient: '  ',
      }),
    ).toEqual({ success: false, error: 'Recipient is required.' });
  });

  it('rejects an inaccessible person', async () => {
    const { client } = buildFakeClient({ queryResult: { person: { edges: [] } } });

    expect(
      await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
      }),
    ).toEqual({ success: false, error: 'Person not found or not accessible.' });
  });

  it('rejects a person with no phone number', async () => {
    const { client } = buildFakeClient({
      queryResult: { person: { edges: [{ node: { id: 'p', phones: null } }] } },
    });

    expect(
      await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
      }),
    ).toEqual({ success: false, error: 'This person has no phone number.' });
  });

  it('rejects a recipient that does not belong to the person', async () => {
    const { client } = buildFakeClient({ queryResult: PERSON_WITH_PHONE });

    expect(
      await sendPersonCommunicationHandler(
        { ...validParameters, recipient: '09990000000' },
        { client: client as never },
      ),
    ).toEqual({
      success: false,
      error: 'Selected phone number does not belong to this person.',
    });
  });

  it('sends through the durable path and snapshots the trusted sender', async () => {
    const { client, mutations } = buildFakeClient({
      queryResult: PERSON_WITH_PHONE,
    });
    const { registry, sent } = buildRegistryWithStubProvider({
      status: 'SENT',
      providerMessageId: '42',
    });

    const result = await sendPersonCommunicationHandler(
      { ...validParameters, workspaceMemberId: 'member-1' },
      { client: client as never, registry },
    );

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
        providerId: 'razpayamak',
        recipient: '09120000000',
        status: 'QUEUED',
        targetPersonId: 'person-1',
        senderId: 'member-1',
      },
    });
  });

  it('never presents SENT as DELIVERED', async () => {
    const { client } = buildFakeClient({ queryResult: PERSON_WITH_PHONE });
    const { registry } = buildRegistryWithStubProvider({
      status: 'SENT',
      providerMessageId: '42',
    });

    const result = await sendPersonCommunicationHandler(validParameters, {
      client: client as never,
      registry,
    });

    expect(result.status).toBe('SENT');
    expect(result.message).toBe('Message sent.');
  });

  it('reports a normalized FAILED outcome truthfully', async () => {
    const { client } = buildFakeClient({ queryResult: PERSON_WITH_PHONE });
    const { registry } = buildRegistryWithStubProvider({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
    });

    const result = await sendPersonCommunicationHandler(validParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      status: 'FAILED',
      communicationId: 'communication-1',
      error: 'Invalid receptor',
    });
  });

  it('fails safely when the initial record cannot be created', async () => {
    const { client } = buildFakeClient({
      queryResult: PERSON_WITH_PHONE,
      failCreate: true,
    });
    const { registry, sent } = buildRegistryWithStubProvider({
      status: 'SENT',
      providerMessageId: '42',
    });

    const result = await sendPersonCommunicationHandler(validParameters, {
      client: client as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      error: 'The message could not be sent.',
    });
    // A message that cannot be recorded must never be sent.
    expect(sent).toHaveLength(0);
  });

  it('surfaces a missing provider configuration as a safe failure', async () => {
    delete process.env.COMMUNICATION_PROVIDER;

    const { client } = buildFakeClient({ queryResult: PERSON_WITH_PHONE });

    const result = await sendPersonCommunicationHandler(validParameters, {
      client: client as never,
    });

    expect(result).toEqual({
      success: false,
      error: 'The message could not be sent.',
    });
  });
});
