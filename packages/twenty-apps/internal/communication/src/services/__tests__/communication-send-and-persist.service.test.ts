import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CommunicationPersistence,
  type CommunicationRecordOutcome,
  type QueuedCommunicationRecord,
} from 'src/persistence/communication-persistence.port';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';
import {
  CommunicationOutcomePersistenceError,
  CommunicationSendAndPersistService,
  CommunicationUnexpectedSendFailureError,
} from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';

const FIXED_NOW = new Date('2026-10-04T10:00:00.000Z');

const MESSAGE: OutboundCommunication = {
  channel: 'SMS',
  recipient: '09120000000',
  body: 'سلام',
};

type PersistenceSpy = CommunicationPersistence & {
  created: QueuedCommunicationRecord[];
  outcomes: { communicationId: string; outcome: CommunicationRecordOutcome }[];
  createdId: string;
};

const buildPersistence = ({
  failCreate = false,
  failOutcome = false,
  createdId = 'communication-1',
}: {
  failCreate?: boolean;
  failOutcome?: boolean;
  createdId?: string;
} = {}): PersistenceSpy => {
  const created: QueuedCommunicationRecord[] = [];
  const outcomes: {
    communicationId: string;
    outcome: CommunicationRecordOutcome;
  }[] = [];

  return {
    created,
    outcomes,
    createdId,
    createQueued: async (record) => {
      if (failCreate) {
        throw new Error('createCommunication failed');
      }

      created.push(record);

      return createdId;
    },
    applyOutcome: async ({ communicationId, outcome }) => {
      outcomes.push({ communicationId, outcome });

      if (failOutcome) {
        throw new Error('updateCommunication failed');
      }
    },
  };
};

type ProviderSpy = {
  provider: CommunicationProvider;
  sent: OutboundCommunication[];
};

const buildProvider = (
  id: CommunicationProviderId,
  respond: () => Promise<CommunicationSendResult> | CommunicationSendResult,
): ProviderSpy => {
  const sent: OutboundCommunication[] = [];

  return {
    sent,
    provider: {
      id,
      channel: 'SMS',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send: async (message) => {
        sent.push(message);

        return respond();
      },
    },
  };
};

const buildService = ({
  providers,
  persistence,
}: {
  providers: ProviderSpy[];
  persistence: PersistenceSpy;
}) => {
  const registry = new CommunicationProviderRegistry();

  for (const { provider } of providers) {
    registry.register(provider);
  }

  const sendService = new CommunicationSendService(registry);

  return {
    service: new CommunicationSendAndPersistService(
      sendService,
      persistence,
      () => FIXED_NOW,
    ),
    sendService,
  };
};

describe('CommunicationSendAndPersistService', () => {
  let persistence: PersistenceSpy;

  beforeEach(() => {
    persistence = buildPersistence();
  });

  it('creates the record as QUEUED before the provider is called', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '42',
    }));

    const order: string[] = [];

    persistence.createQueued = async (record) => {
      order.push('create');
      persistence.created.push(record);

      return 'communication-1';
    };

    const originalSend = provider.provider.send;
    provider.provider.send = async (message) => {
      order.push('send');

      return originalSend(message);
    };

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' });

    expect(order).toEqual(['create', 'send']);
    expect(persistence.created[0]).toEqual({
      channel: 'SMS',
      providerId: 'razpayamak',
      recipient: '09120000000',
      body: 'سلام',
      queuedAt: FIXED_NOW.toISOString(),
    });
  });

  it('persists the provider id and recipient actually used', async () => {
    const provider = buildProvider('kavenegar', () => ({
      status: 'SENT',
      providerMessageId: 'k-1',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({
      message: { ...MESSAGE, recipient: '09351112233' },
      providerId: 'kavenegar',
      targetPersonId: 'person-1',
      senderId: 'member-1',
    });

    expect(persistence.created[0]).toMatchObject({
      providerId: 'kavenegar',
      recipient: '09351112233',
      targetPersonId: 'person-1',
      senderId: 'member-1',
    });
  });

  it('retains the target person context when supplied', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '1',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({
      message: MESSAGE,
      providerId: 'razpayamak',
      targetPersonId: 'person-42',
    });

    expect(persistence.created[0].targetPersonId).toBe('person-42');
  });

  it('maps a SENT result onto status, sentAt and providerMessageId', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '34439078',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    const outcome = await service.sendAndPersist({
      message: MESSAGE,
      providerId: 'razpayamak',
    });

    expect(outcome).toEqual({
      communicationId: 'communication-1',
      result: { status: 'SENT', providerMessageId: '34439078' },
    });
    expect(persistence.outcomes[0]).toEqual({
      communicationId: 'communication-1',
      outcome: {
        status: 'SENT',
        sentAt: FIXED_NOW.toISOString(),
        providerMessageId: '34439078',
      },
    });
  });

  it('maps a DELIVERED result onto truthful timestamps', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'DELIVERED',
      providerMessageId: '99',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' });

    expect(persistence.outcomes[0].outcome).toEqual({
      status: 'DELIVERED',
      sentAt: FIXED_NOW.toISOString(),
      deliveredAt: FIXED_NOW.toISOString(),
      providerMessageId: '99',
    });
  });

  it('maps a normalized FAILED result onto failureReason without timestamps', async () => {
    const provider = buildProvider('kavenegar', () => ({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({
      message: MESSAGE,
      providerId: 'kavenegar',
    });

    expect(persistence.outcomes[0].outcome).toEqual({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
      providerMessageId: null,
    });
  });

  it('persists only a safe generic reason when the provider throws', async () => {
    const provider = buildProvider('razpayamak', () => {
      throw new Error('socket hang up');
    });

    const { service } = buildService({ providers: [provider], persistence });

    await expect(
      service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' }),
    ).rejects.toThrow('socket hang up');

    expect(persistence.outcomes[0].outcome).toEqual({
      status: 'FAILED',
      failureReason: 'Unexpected send failure.',
      providerMessageId: null,
    });
    // The record must never remain permanently QUEUED.
    expect(persistence.outcomes).toHaveLength(1);
  });

  it('never persists credential-bearing exception text', async () => {
    const provider = buildProvider('razpayamak', () => {
      throw new Error(
        'connect failed for https://api.kavenegar.test/v1/SECRET-API-KEY/sms/send.json body {"password":"SECRET-PASSWORD"}',
      );
    });

    const { service } = buildService({ providers: [provider], persistence });

    await expect(
      service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' }),
    ).rejects.toThrow();

    const persisted = JSON.stringify(persistence.outcomes);

    expect(persisted).not.toContain('SECRET-API-KEY');
    expect(persisted).not.toContain('SECRET-PASSWORD');
    expect(persisted).not.toContain('sms/send.json');
    expect(persistence.outcomes[0].outcome).toEqual({
      status: 'FAILED',
      failureReason: 'Unexpected send failure.',
      providerMessageId: null,
    });
  });

  it('snapshots exactly the subject handed to the provider', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '1',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    const message = { ...MESSAGE, subject: 'موضوع پیام' };

    await service.sendAndPersist({ message, providerId: 'razpayamak' });

    // The provider received the subject...
    expect(provider.sent[0].subject).toBe('موضوع پیام');
    // ...and history snapshots that exact same value.
    expect(persistence.created[0].subject).toBe('موضوع پیام');
    expect(persistence.created[0].subject).toBe(provider.sent[0].subject);
  });

  it('omits the subject from history when the message has none', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '1',
    }));

    const { service } = buildService({ providers: [provider], persistence });

    await service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' });

    expect(persistence.created[0]).not.toHaveProperty('subject');
  });

  it('does not call the provider when the initial record cannot be created', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '1',
    }));

    const failingPersistence = buildPersistence({ failCreate: true });

    const { service } = buildService({
      providers: [provider],
      persistence: failingPersistence,
    });

    await expect(
      service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' }),
    ).rejects.toThrow('createCommunication failed');

    expect(provider.sent).toEqual([]);
  });

  it('does not send twice when the outcome update fails after a successful send', async () => {
    const provider = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: '7',
    }));

    const failingPersistence = buildPersistence({ failOutcome: true });

    const { service } = buildService({
      providers: [provider],
      persistence: failingPersistence,
    });

    await expect(
      service.sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' }),
    ).rejects.toThrow(CommunicationOutcomePersistenceError);

    // Exactly one provider call: the failure is surfaced, never retried.
    expect(provider.sent).toHaveLength(1);
  });

  it('uses truthful outcome-neutral wording for a normalized FAILED result', async () => {
    const provider = buildProvider('kavenegar', () => ({
      status: 'FAILED',
      failureReason: 'Invalid receptor',
    }));

    const failingPersistence = buildPersistence({ failOutcome: true });

    const { service } = buildService({
      providers: [provider],
      persistence: failingPersistence,
    });

    const caught = await service
      .sendAndPersist({ message: MESSAGE, providerId: 'kavenegar' })
      .then(() => undefined)
      .catch((error: unknown) => error as Error);

    expect(caught).toBeInstanceOf(CommunicationOutcomePersistenceError);
    expect(caught?.message).toBe(
      'The send outcome for communication communication-1 could not be persisted.',
    );
    // Must never claim the message was sent when the provider failed.
    expect(caught?.message).not.toContain('was sent');
    expect(provider.sent).toHaveLength(1);
  });

  it('surfaces both failures when the provider throws and the FAILED write also fails', async () => {
    const provider = buildProvider('razpayamak', () => {
      throw new Error('SECRET-API-KEY leaked in transport error');
    });

    const failingPersistence = buildPersistence({ failOutcome: true });

    const { service } = buildService({
      providers: [provider],
      persistence: failingPersistence,
    });

    const caught = await service
      .sendAndPersist({ message: MESSAGE, providerId: 'razpayamak' })
      .then(() => undefined)
      .catch((error: unknown) => error as Error);

    expect(caught).toBeInstanceOf(CommunicationUnexpectedSendFailureError);

    const combined = caught as CommunicationUnexpectedSendFailureError;

    // Both causes are preserved as diagnostics.
    expect(combined.sendCause).toBeInstanceOf(Error);
    expect(combined.persistenceCause).toBeInstanceOf(Error);
    // The persistence failure is not silently swallowed...
    expect(combined.message).toContain('could not be persisted');
    // ...and the persisted/normalized text never leaks the raw exception.
    expect(combined.message).not.toContain('SECRET-API-KEY');
    // Exactly one provider call: no automatic resend.
    expect(provider.sent).toHaveLength(1);
  });

  it('routes RazPayamak and Kavenegar through the same orchestration path', async () => {
    const razpayamak = buildProvider('razpayamak', () => ({
      status: 'SENT',
      providerMessageId: 'r-1',
    }));
    const kavenegar = buildProvider('kavenegar', () => ({
      status: 'SENT',
      providerMessageId: 'k-1',
    }));

    const { service } = buildService({
      providers: [razpayamak, kavenegar],
      persistence,
    });

    await service.sendAndPersist({
      message: MESSAGE,
      providerId: 'razpayamak',
    });
    await service.sendAndPersist({
      message: MESSAGE,
      providerId: 'kavenegar',
    });

    expect(razpayamak.sent).toHaveLength(1);
    expect(kavenegar.sent).toHaveLength(1);
    expect(persistence.created.map((record) => record.providerId)).toEqual([
      'razpayamak',
      'kavenegar',
    ]);
  });

  it('resolves the configured provider when none is supplied explicitly', async () => {
    process.env.COMMUNICATION_PROVIDER = 'razpayamak';

    try {
      const provider = buildProvider('razpayamak', () => ({
        status: 'SENT',
        providerMessageId: 'c-1',
      }));

      const { service } = buildService({ providers: [provider], persistence });

      await service.sendAndPersist({ message: MESSAGE });

      expect(persistence.created[0].providerId).toBe('razpayamak');
    } finally {
      delete process.env.COMMUNICATION_PROVIDER;
    }
  });
});
