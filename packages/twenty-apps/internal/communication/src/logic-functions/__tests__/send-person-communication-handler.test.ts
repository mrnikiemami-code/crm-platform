import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { sendPersonCommunicationHandler } from 'src/logic-functions/handlers/send-person-communication-handler';
import { createFakeMetadataClient } from 'src/templates/__tests__/catalog-fixture';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';

const SAVED_ENV = { ...process.env };

const configureProvider = () => {
  process.env.COMMUNICATION_PROVIDER = 'razpayamak';
};

type QueryResult = {
  person?: {
    id: string;
    phones: unknown;
    name?: { firstName?: string | null; lastName?: string | null } | null;
    jobTitle?: string | null;
    /** An example WORKSPACE CUSTOM scalar field. */
    loyaltyTier?: string | null;
    company?: { name?: string | null } | null;
  } | null;
};

const PERSON_WITH_PHONE: QueryResult = {
  person: {
    id: 'person-1',
    phones: {
      primaryPhoneNumber: '09120000000',
      additionalPhones: [{ number: '09350000000' }],
    },
  },
};

// A person whose authorized template fields are all populated, including a
// workspace CUSTOM scalar field (`loyaltyTier`).
const PERSON_WITH_FIELDS: QueryResult = {
  person: {
    id: 'person-1',
    phones: {
      primaryPhoneNumber: '09120000000',
      additionalPhones: [{ number: '09350000000' }],
    },
    name: { firstName: 'سارا', lastName: 'احمدی' },
    jobTitle: 'مدیر فروش',
    loyaltyTier: 'طلایی',
    company: { name: 'شرکت الف' },
  },
};

// A person whose company and job title are empty (for EMPTY_FIELD coverage).
const PERSON_WITHOUT_COMPANY: QueryResult = {
  person: {
    id: 'person-1',
    phones: {
      primaryPhoneNumber: '09120000000',
      additionalPhones: [{ number: '09350000000' }],
    },
    name: { firstName: 'سارا', lastName: 'احمدی' },
    jobTitle: null,
    company: null,
  },
};

type MutationCall = { mutationName: string; args: Record<string, unknown> };

const buildFakeClient = ({
  queryResult,
  failCreate = false,
  failOutcomeUpdate = false,
}: {
  queryResult: QueryResult;
  failCreate?: boolean;
  failOutcomeUpdate?: boolean;
}) => {
  const mutations: MutationCall[] = [];

  const client = {
    query: async (payload?: Record<string, unknown>) => {
      if (payload !== undefined && typeof payload === 'object') {
        // The authorized-catalog probe reads `people` for discovery and `person`
        // per field; the send path and the phone lookup also read `person`.
        // All are answered from the same fixture. Authorization itself is
        // covered by the dedicated probe suites.
        if ('people' in payload) {
          return {
            people: {
              edges:
                queryResult.person === undefined
                  ? []
                  : [{ node: queryResult.person }],
            },
          };
        }

        if ('person' in payload) {
          return { person: queryResult.person ?? null };
        }
      }

      return queryResult;
    },
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

const buildThrowingRegistry = (
  error: Error,
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

      throw error;
    },
  };

  const registry = new CommunicationProviderRegistry();

  registry.register(provider);

  return { registry, sent };
};

describe('findPersonPhoneOptions', () => {
  it('returns null when the person is not accessible', async () => {
    const { client } = buildFakeClient({ queryResult: { person: null } });

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
      queryResult: { person: { id: 'p', phones: null } },
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
    ).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Unsupported channel "TELEGRAM".',
    });
  });

  it('rejects an empty body', async () => {
    expect(
      await sendPersonCommunicationHandler({
        ...validParameters,
        body: '   ',
      }),
    ).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Message body is required.',
    });
  });

  it('rejects an empty recipient', async () => {
    expect(
      await sendPersonCommunicationHandler({
        ...validParameters,
        recipient: '  ',
      }),
    ).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'Recipient is required.',
    });
  });

  it('rejects an inaccessible person', async () => {
    const { client } = buildFakeClient({ queryResult: { person: null } });

    expect(
      await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
        metadataClient: createFakeMetadataClient() as never,
      }),
    ).toEqual({
      success: false,
      failureCode: 'PERSON_NOT_ACCESSIBLE',
      error: 'Person not found or not accessible.',
    });
  });

  it('rejects a person with no phone number', async () => {
    const { client } = buildFakeClient({
      queryResult: { person: { id: 'p', phones: null } },
    });

    expect(
      await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
        metadataClient: createFakeMetadataClient() as never,
      }),
    ).toEqual({
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'This person has no phone number.',
    });
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
      failureCode: 'INVALID_INPUT',
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
      { client: client as never, registry, metadataClient: createFakeMetadataClient() as never },
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
      metadataClient: createFakeMetadataClient() as never,
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
      metadataClient: createFakeMetadataClient() as never,
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
      metadataClient: createFakeMetadataClient() as never,
      registry,
    });

    expect(result).toEqual({
      success: false,
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
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
      metadataClient: createFakeMetadataClient() as never,
    });

    expect(result).toEqual({
      success: false,
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
      error: 'The message could not be sent.',
    });
  });

  describe('outcome persistence failures', () => {
    it('reports a known SENT outcome instead of claiming the message was not sent', async () => {
      const { client } = buildFakeClient({
        queryResult: PERSON_WITH_PHONE,
        failOutcomeUpdate: true,
      });
      const { registry, sent } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      const result = await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
        metadataClient: createFakeMetadataClient() as never,
        registry,
      });

      expect(result).toEqual({
        success: false,
        status: 'SENT',
        communicationId: 'communication-1',
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: true,
        error:
          'The message was sent but its result could not be recorded. Do not retry automatically.',
      });
      // The provider is never called a second time.
      expect(sent).toHaveLength(1);
    });

    it('distinguishes a FAILED provider outcome from a history-write failure', async () => {
      const { client } = buildFakeClient({
        queryResult: PERSON_WITH_PHONE,
        failOutcomeUpdate: true,
      });
      const { registry, sent } = buildRegistryWithStubProvider({
        status: 'FAILED',
        failureReason: 'Invalid receptor',
      });

      const result = await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
        metadataClient: createFakeMetadataClient() as never,
        registry,
      });

      expect(result).toEqual({
        success: false,
        status: 'FAILED',
        communicationId: 'communication-1',
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: true,
        error:
          'The provider rejected the message and the failure could not be recorded. Do not retry automatically.',
      });
      expect(sent).toHaveLength(1);
    });

    it('reports an unknown outcome when the send throws and the FAILED write also fails', async () => {
      const { client } = buildFakeClient({
        queryResult: PERSON_WITH_PHONE,
        failOutcomeUpdate: true,
      });
      const { registry, sent } = buildThrowingRegistry(
        new Error('SECRET-API-KEY leaked in transport error'),
      );

      const result = await sendPersonCommunicationHandler(validParameters, {
        client: client as never,
        metadataClient: createFakeMetadataClient() as never,
        registry,
      });

      expect(result).toEqual({
        success: false,
        communicationId: 'communication-1',
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error:
          'The message could not be sent and its state could not be recorded. Do not retry automatically.',
      });
      // No secret or raw cause ever reaches the caller.
      expect(JSON.stringify(result)).not.toContain('SECRET-API-KEY');
      // Exactly one provider call: no automatic resend.
      expect(sent).toHaveLength(1);
    });
  });

  // W17 §C/§B: server-authoritative template variable resolution --------------

  describe('template variable resolution (W17)', () => {
    it('resolves the namespaced and legacy tokens against authorized Person data', async () => {
      const { client, mutations } = buildFakeClient({
        queryResult: PERSON_WITH_FIELDS,
      });
      const { registry } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      const result = await sendPersonCommunicationHandler(
        {
          ...validParameters,
          body: 'سلام @name (@company.name) — @person.jobTitle',
        },
        { client: client as never, registry, metadataClient: createFakeMetadataClient() as never },
      );

      expect(result.success).toBe(true);

      const created = mutations.find(
        (mutation) => mutation.mutationName === 'createCommunication',
      );

      // The persisted body is the RESOLVED text, never a literal token.
      expect(created?.args).toMatchObject({
        data: { body: 'سلام سارا (شرکت الف) — مدیر فروش' },
      });
    });

    it('resolves a workspace CUSTOM field token from real record data', async () => {
      const { client, mutations } = buildFakeClient({
        queryResult: PERSON_WITH_FIELDS,
      });
      const { registry } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      const result = await sendPersonCommunicationHandler(
        { ...validParameters, body: 'سطح باشگاه: @person.loyaltyTier' },
        {
          client: client as never,
          registry,
          metadataClient: createFakeMetadataClient() as never,
        },
      );

      expect(result.success).toBe(true);

      const created = mutations.find(
        (mutation) => mutation.mutationName === 'createCommunication',
      );

      expect(created?.args).toMatchObject({
        data: { body: 'سطح باشگاه: طلایی' },
      });
    });

    it('never sends a literal token when a variable is unknown', async () => {
      const { client, mutations } = buildFakeClient({
        queryResult: PERSON_WITH_FIELDS,
      });
      const { registry, sent } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      const result = await sendPersonCommunicationHandler(
        { ...validParameters, body: 'سلام @name @ssn' },
        { client: client as never, registry, metadataClient: createFakeMetadataClient() as never },
      );

      expect(result).toEqual({
        success: false,
        failureCode: 'TEMPLATE_VARIABLE_UNRESOLVED',
        isOutcomeKnown: true,
        error:
          'The message contains a variable that could not be resolved for this recipient.',
        unresolvedVariables: ['@ssn'],
      });
      // The send is blocked BEFORE any provider call or record write.
      expect(sent).toHaveLength(0);
      expect(mutations).toHaveLength(0);
    });

    it('blocks the send when an authorized field is empty (EMPTY_FIELD)', async () => {
      const { client } = buildFakeClient({
        queryResult: PERSON_WITHOUT_COMPANY,
      });
      const { registry, sent } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      const result = await sendPersonCommunicationHandler(
        { ...validParameters, body: 'از @company.name' },
        { client: client as never, registry, metadataClient: createFakeMetadataClient() as never },
      );

      expect(result).toEqual({
        success: false,
        failureCode: 'TEMPLATE_VARIABLE_UNRESOLVED',
        isOutcomeKnown: true,
        error:
          'The message contains a variable that could not be resolved for this recipient.',
        unresolvedVariables: ['@company.name'],
      });
      expect(sent).toHaveLength(0);
    });

    it('leaves a plain body with no tokens untouched', async () => {
      const { client, mutations } = buildFakeClient({
        queryResult: PERSON_WITH_FIELDS,
      });
      const { registry } = buildRegistryWithStubProvider({
        status: 'SENT',
        providerMessageId: '42',
      });

      await sendPersonCommunicationHandler(
        { ...validParameters, body: 'یک پیام ساده' },
        { client: client as never, registry, metadataClient: createFakeMetadataClient() as never },
      );

      const created = mutations.find(
        (mutation) => mutation.mutationName === 'createCommunication',
      );

      expect(created?.args).toMatchObject({
        data: { body: 'یک پیام ساده' },
      });
    });
  });
});
