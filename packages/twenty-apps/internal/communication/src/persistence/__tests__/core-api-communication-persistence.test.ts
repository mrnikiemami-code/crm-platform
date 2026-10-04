import { describe, expect, it } from 'vitest';

import {
  CoreApiCommunicationPersistence,
  buildOutcomeFields,
} from 'src/persistence/core-api-communication-persistence';

type MutationCall = {
  mutationName: string;
  args: Record<string, unknown>;
};

const buildClient = (respond?: (call: MutationCall) => unknown) => {
  const calls: MutationCall[] = [];

  const client = {
    mutation: async (payload: Record<string, Record<string, unknown>>) => {
      const [mutationName] = Object.keys(payload);
      const body = payload[mutationName] as { __args: Record<string, unknown> };

      const call: MutationCall = { mutationName, args: body.__args };

      calls.push(call);

      return respond?.(call) ?? {};
    },
  };

  return { client, calls };
};

describe('buildOutcomeFields', () => {
  it('omits sentAt and deliveredAt for a failure', () => {
    expect(
      buildOutcomeFields({
        status: 'FAILED',
        failureReason: 'Invalid receptor',
        providerMessageId: null,
      }),
    ).toEqual({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
      providerMessageId: null,
    });
  });

  it('writes both timestamps only for a delivered outcome', () => {
    expect(
      buildOutcomeFields({
        status: 'DELIVERED',
        sentAt: '2026-10-04T10:00:00.000Z',
        deliveredAt: '2026-10-04T10:01:00.000Z',
        providerMessageId: '9',
      }),
    ).toEqual({
      status: 'DELIVERED',
      sentAt: '2026-10-04T10:00:00.000Z',
      deliveredAt: '2026-10-04T10:01:00.000Z',
      providerMessageId: '9',
      failureReason: null,
    });
  });
});

describe('CoreApiCommunicationPersistence', () => {
  it('creates the communication record with the send-time snapshot', async () => {
    const { client, calls } = buildClient(() => ({
      createCommunication: { id: 'communication-1' },
    }));

    const persistence = new CoreApiCommunicationPersistence(
      client as never,
      () => 'generated-id',
    );

    const id = await persistence.createQueued({
      channel: 'SMS',
      providerId: 'razpayamak',
      recipient: '09120000000',
      body: 'hello',
      targetPersonId: 'person-1',
      queuedAt: '2026-10-04T10:00:00.000Z',
    });

    expect(id).toBe('communication-1');
    expect(calls[0].mutationName).toBe('createCommunication');
    expect(calls[0].args).toEqual({
      data: {
        id: 'generated-id',
        channel: 'SMS',
        providerId: 'razpayamak',
        recipient: '09120000000',
        body: 'hello',
        status: 'QUEUED',
        direction: 'OUTBOUND',
        queuedAt: '2026-10-04T10:00:00.000Z',
        targetPersonId: 'person-1',
      },
    });
  });

  it('omits optional context when it is not supplied', async () => {
    const { client, calls } = buildClient(() => ({
      createCommunication: { id: 'communication-2' },
    }));

    const persistence = new CoreApiCommunicationPersistence(
      client as never,
      () => 'generated-id',
    );

    await persistence.createQueued({
      channel: 'SMS',
      providerId: 'kavenegar',
      recipient: '09120000000',
      body: 'hello',
      queuedAt: '2026-10-04T10:00:00.000Z',
    });

    const data = calls[0].args.data as Record<string, unknown>;

    expect(data).not.toHaveProperty('targetPersonId');
    expect(data).not.toHaveProperty('senderId');
    expect(data).not.toHaveProperty('subject');
  });

  it('fails explicitly when the create mutation returns no id', async () => {
    const { client } = buildClient(() => ({}));

    const persistence = new CoreApiCommunicationPersistence(
      client as never,
      () => 'generated-id',
    );

    await expect(
      persistence.createQueued({
        channel: 'SMS',
        providerId: 'razpayamak',
        recipient: '09120000000',
        body: 'hello',
        queuedAt: '2026-10-04T10:00:00.000Z',
      }),
    ).rejects.toThrow(
      'createCommunication mutation did not return a communication id',
    );
  });

  it('updates the record with the outcome fields', async () => {
    const { client, calls } = buildClient();

    const persistence = new CoreApiCommunicationPersistence(
      client as never,
      () => 'generated-id',
    );

    await persistence.applyOutcome({
      communicationId: 'communication-1',
      outcome: {
        status: 'SENT',
        sentAt: '2026-10-04T10:00:00.000Z',
        providerMessageId: '42',
      },
    });

    expect(calls[0].mutationName).toBe('updateCommunication');
    expect(calls[0].args).toEqual({
      id: 'communication-1',
      data: {
        status: 'SENT',
        sentAt: '2026-10-04T10:00:00.000Z',
        providerMessageId: '42',
        failureReason: null,
      },
    });
  });

  it('never writes credential-bearing fields onto the record', async () => {
    const { client, calls } = buildClient(() => ({
      createCommunication: { id: 'communication-3' },
    }));

    const persistence = new CoreApiCommunicationPersistence(
      client as never,
      () => 'generated-id',
    );

    await persistence.createQueued({
      channel: 'SMS',
      providerId: 'razpayamak',
      recipient: '09120000000',
      body: 'hello',
      queuedAt: '2026-10-04T10:00:00.000Z',
    });

    const serialized = JSON.stringify(calls);

    for (const forbidden of ['apiKey', 'password', 'token', 'endpoint']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
