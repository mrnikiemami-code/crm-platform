import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findEligibleTemplateSources } from 'src/templates/data/find-eligible-template-sources';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { resolveSendContext } from 'src/templates/resolve-send-context';
import { resolveTemplateValues } from 'src/templates/resolve-template-values';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { sendTemplateSmsFromWorkflow } from 'src/workflow/send-template-sms.service';
import { WORKFLOW_SMS_SENDING_VARIABLE_NAME } from 'src/workflow/workflow-sms-authorization';

vi.mock('src/templates/data/find-message-templates', () => ({
  findMessageTemplates: vi.fn(),
}));

vi.mock('src/templates/data/find-eligible-template-sources', () => ({
  PERSON_SOURCE_OBJECT_NAME: 'person',
  findEligibleTemplateSources: vi.fn(),
}));

vi.mock('src/templates/build-template-catalog', () => ({
  buildAuthorizedTemplateCatalog: vi.fn(),
}));

vi.mock('src/templates/resolve-send-context', () => ({
  resolveSendContext: vi.fn(),
}));

vi.mock('src/templates/resolve-template-values', () => ({
  resolveTemplateValues: vi.fn(),
}));

vi.mock('src/logic-functions/data/find-person-phone-options', () => ({
  findPersonPhoneOptions: vi.fn(),
}));

// The registry is the seam where the real SMS provider would be reached. The
// fake provider is the "mock SMS" the task requires: no HTTP, no credentials.
const PROVIDER = { send: vi.fn() };

vi.mock('src/providers/register-communication-providers', () => ({
  createCommunicationProviderRegistry: () => ({
    resolve: () => PROVIDER,
  }),
}));

const SAVED_ENV = { ...process.env };

const PERSON_UID = 'person-uid';
const TEMPLATE = {
  id: 'tpl-1',
  title: 'خوش‌آمد',
  body: 'سلام @firstName',
  channel: 'SMS',
  targetObject: 'PERSON',
  sourceObjectUid: '',
  recipientRelationUid: '',
  updatedAt: '',
};

const CATALOG = (() => {
  const variable = {
    token: 'firstName',
    aliases: [] as string[],
    label: 'First name',
    objectName: 'person',
    fieldName: 'firstName',
    kind: 'TEXT',
    group: 'PERSON',
    objectUid: PERSON_UID,
    fieldUid: 'field-uid',
    metadataType: 'TEXT',
    readPath: [],
  };

  return {
    catalog: {
      variables: [variable],
      lookup: new Map([['firstname', variable]]),
    },
  };
})();

type Row = { id: string; status: string };

// Minimal in-memory stand-in for the workspace API. It implements exactly the
// two mutations the real persistence layer issues, and enforces the primary-key
// uniqueness that the deduplication relies on.
const buildClient = ({
  rows,
  failCreate = false,
}: {
  rows: Map<string, Row>;
  failCreate?: boolean;
}) => {
  const mutations: string[] = [];

  return {
    mutations,
    client: {
      query: async (payload: Record<string, unknown>) => {
        if ('communication' in payload) {
          const request = payload.communication as {
            __args: { filter: { id: { eq: string } } };
          };
          const id = request.__args.filter.id.eq;
          const row = rows.get(id);

          return { communication: row === undefined ? null : { ...row } };
        }

        return {};
      },
      mutation: async (payload: Record<string, Record<string, unknown>>) => {
        const [name] = Object.keys(payload);
        const body = payload[name] as { __args: Record<string, any> };
        mutations.push(name);

        if (name === 'createCommunication') {
          const id = body.__args.data.id as string;

          if (failCreate) {
            throw new Error('transport down');
          }

          if (rows.has(id)) {
            throw new Error(
              'duplicate key value violates unique constraint "PK_communication"',
            );
          }

          rows.set(id, { id, status: 'QUEUED' });

          return { createCommunication: { id } };
        }

        if (name === 'updateCommunication') {
          const id = body.__args.id as string;
          const existing = rows.get(id);

          if (existing === undefined) {
            throw new Error('record not found');
          }

          existing.status = body.__args.data.status as string;

          return { updateCommunication: { id } };
        }

        throw new Error(`unexpected mutation ${name}`);
      },
    } as any,
  };
};

const BASE_REQUEST = {
  templateId: 'tpl-1',
  sourceObjectNameSingular: 'person',
  sourceRecordId: 'rec-1',
  fieldName: 'stage',
  beforeValue: 'NEW',
  afterValue: 'WON',
  eventId: 'event-1',
  workflowId: 'wf-1',
};

const primeHappyPath = () => {
  vi.mocked(findMessageTemplates).mockResolvedValue([TEMPLATE as any]);
  vi.mocked(findEligibleTemplateSources).mockResolvedValue([
    {
      objectUid: PERSON_UID,
      objectName: 'person',
      objectNamePlural: 'people',
      labelSingular: 'Person',
      labelPlural: 'People',
      labelFieldName: 'name',
      labelFieldType: 'FULL_NAME',
      relations: [],
    },
  ]);
  vi.mocked(resolveSendContext).mockResolvedValue({
    outcome: 'RESOLVED',
    objectName: 'person',
    objectUid: PERSON_UID,
    relationUid: '',
    relationName: '',
    sourceRecordId: 'rec-1',
    recipientPersonId: 'person-1',
    sourceRecord: null,
  } as any);
  vi.mocked(findPersonPhoneOptions).mockResolvedValue([
    { value: '09120000000', label: 'primary' },
  ] as any);
  vi.mocked(buildAuthorizedTemplateCatalog).mockResolvedValue({
    catalog: CATALOG.catalog,
  } as any);
  vi.mocked(resolveTemplateValues).mockResolvedValue({
    values: new Map([['firstName', 'علی']]),
    isAccessible: true,
    isSourceAccessible: true,
  } as any);
};

describe('sendTemplateSmsFromWorkflow', () => {
  let rows: Map<string, Row>;

  beforeEach(() => {
    process.env = { ...SAVED_ENV };
    process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = 'enabled';
    process.env.COMMUNICATION_PROVIDER = 'kavenegar';

    rows = new Map();
    PROVIDER.send.mockReset();
    PROVIDER.send.mockResolvedValue({
      status: 'SENT',
      providerMessageId: 'pm-1',
    });

    vi.mocked(findMessageTemplates).mockReset();
    vi.mocked(findEligibleTemplateSources).mockReset();
    vi.mocked(resolveSendContext).mockReset();
    vi.mocked(findPersonPhoneOptions).mockReset();
    vi.mocked(buildAuthorizedTemplateCatalog).mockReset();
    vi.mocked(resolveTemplateValues).mockReset();
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('sends once for a real change whose condition holds', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, {
      client,
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe('SENT');
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);

    // The recipient comes from the record, never from the request.
    expect(PROVIDER.send.mock.calls[0][0]).toMatchObject({
      channel: 'SMS',
      recipient: '09120000000',
      body: 'سلام علی',
    });

    expect([...rows.values()][0].status).toBe('SENT');
  });

  it('sends nothing when the same change is replayed', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    const first = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });
    const second = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(first.outcome).toBe('SENT');
    expect(second.success).toBe(true);
    expect(second.outcome).toBe('ALREADY_SENT');
    expect(second.communicationId).toBe(first.communicationId);
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on an unchanged save', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    // An unchanged save produces no trigger at all, so the step keeps the same
    // before/after identity: the second attempt is a duplicate, not a new send.
    await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, beforeValue: 'WON', afterValue: 'WON' },
      { client },
    );
    await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, beforeValue: 'WON', afterValue: 'WON' },
      { client },
    );

    expect(PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it('treats a different change of the same column as a new send', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });
    await sendTemplateSmsFromWorkflow(
      {
        ...BASE_REQUEST,
        beforeValue: 'WON',
        afterValue: 'LOST',
        eventId: 'event-2',
      },
      { client },
    );

    expect(PROVIDER.send).toHaveBeenCalledTimes(2);
  });

  it('sends again when the same column returns to a previous value', async () => {
    // A→B→A: three real changes. The value-based key could not tell the third
    // from the first; the event identity can.
    primeHappyPath();
    const { client } = buildClient({ rows });

    const first = await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, beforeValue: 'NEW', afterValue: 'WON', eventId: 'e1' },
      { client },
    );
    const second = await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, beforeValue: 'WON', afterValue: 'NEW', eventId: 'e2' },
      { client },
    );
    const third = await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, beforeValue: 'NEW', afterValue: 'WON', eventId: 'e3' },
      { client },
    );

    expect(first.outcome).toBe('SENT');
    expect(second.outcome).toBe('SENT');
    expect(third.outcome).toBe('SENT');
    expect(PROVIDER.send).toHaveBeenCalledTimes(3);
    expect(rows.size).toBe(3);
  });

  it('sends only once when two attempts run concurrently', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    const [first, second] = await Promise.all([
      sendTemplateSmsFromWorkflow(BASE_REQUEST, { client }),
      sendTemplateSmsFromWorkflow(BASE_REQUEST, { client }),
    ]);

    // The primary key is the mutex: only one attempt can create the row and
    // send. The loser fails closed, never silently succeeding.
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);

    const outcomes = [first.outcome, second.outcome].sort();

    expect(outcomes).toEqual(['SENT', 'UNKNOWN']);
    expect(rows.size).toBe(1);
  });

  it('refuses when the system switch is not configured', async () => {
    primeHappyPath();
    delete process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME];
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({
      success: false,
      outcome: 'REFUSED',
      failureCode: 'NOT_CONFIGURED',
    });
    // Refused before reading anything or sending.
    expect(findMessageTemplates).not.toHaveBeenCalled();
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('refuses once the system switch is revoked', async () => {
    primeHappyPath();
    process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = 'disabled';
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({ failureCode: 'DISABLED' });
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('runs with no user or member identity at all', async () => {
    // An unattended run: the executor supplies no delegated user token, and
    // there is no member behind it. Sending must still work.
    delete process.env.TWENTY_APP_ACCESS_TOKEN;
    delete process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN;
    primeHappyPath();
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result.success).toBe(true);
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it('refuses a template that no longer exists', async () => {
    primeHappyPath();
    vi.mocked(findMessageTemplates).mockResolvedValue([]);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({
      failureCode: 'TEMPLATE_NOT_FOUND',
      outcome: 'REFUSED',
    });
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('refuses a template written for another object', async () => {
    primeHappyPath();
    vi.mocked(findMessageTemplates).mockResolvedValue([
      { ...TEMPLATE, sourceObjectUid: 'other-object-uid' } as any,
    ]);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({ failureCode: 'TEMPLATE_SOURCE_MISMATCH' });
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('refuses a non-SMS template', async () => {
    primeHappyPath();
    vi.mocked(findMessageTemplates).mockResolvedValue([
      { ...TEMPLATE, channel: 'EMAIL' } as any,
    ]);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({
      failureCode: 'TEMPLATE_UNSUPPORTED_CHANNEL',
    });
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('refuses when the recipient has no phone number', async () => {
    primeHappyPath();
    vi.mocked(findPersonPhoneOptions).mockResolvedValue([]);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({ failureCode: 'RECIPIENT_NO_PHONE' });
    expect(PROVIDER.send).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it('refuses when the record has no Person attached', async () => {
    primeHappyPath();
    vi.mocked(resolveSendContext).mockResolvedValue({
      outcome: 'RELATION_EMPTY',
    } as any);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({ failureCode: 'RELATION_EMPTY' });
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });

  it('refuses to send a body with unresolved variables', async () => {
    primeHappyPath();
    vi.mocked(resolveTemplateValues).mockResolvedValue({
      values: new Map([['firstName', null]]),
      isAccessible: true,
      isSourceAccessible: true,
    } as any);
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({
      failureCode: 'TEMPLATE_UNRESOLVED_VARIABLES',
    });
    expect(PROVIDER.send).not.toHaveBeenCalled();
    // No record either: an unsendable body must not consume the event identity.
    expect(rows.size).toBe(0);
  });

  it('records a definite provider failure without pretending success', async () => {
    primeHappyPath();
    PROVIDER.send.mockResolvedValue({
      status: 'FAILED',
      failureReason: 'invalid recipient',
      providerMessageId: null,
    });
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(result).toMatchObject({
      success: false,
      outcome: 'FAILED',
      failureCode: 'PROVIDER_FAILED',
      isOutcomeKnown: true,
    });
    expect([...rows.values()][0].status).toBe('FAILED');
  });

  it('does not re-attempt a change whose provider outcome is unknown', async () => {
    primeHappyPath();
    PROVIDER.send.mockResolvedValue({
      status: 'UNKNOWN',
      failureReason: 'timeout',
      providerMessageId: null,
    });
    const { client } = buildClient({ rows });

    const first = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });
    const second = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(first).toMatchObject({
      success: false,
      outcome: 'UNKNOWN',
      isOutcomeKnown: false,
    });
    expect(second).toMatchObject({
      outcome: 'UNKNOWN',
      failureCode: 'OUTCOME_UNKNOWN',
    });
    // The provider was called exactly once; the replay never reached it.
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it('survives a provider transport failure without duplicating on replay', async () => {
    primeHappyPath();
    PROVIDER.send.mockRejectedValue(new Error('ECONNRESET'));
    const { client } = buildClient({ rows });

    const first = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });
    const second = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    expect(first.success).toBe(false);
    expect(first.isOutcomeKnown).toBe(false);
    expect(second.success).toBe(false);
    expect(PROVIDER.send).toHaveBeenCalledTimes(1);
  });

  it('refuses to send when the attempt cannot be recorded', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows, failCreate: true });

    const result = await sendTemplateSmsFromWorkflow(BASE_REQUEST, { client });

    // Persist-before-send: an unrecordable attempt must never reach the provider.
    expect(PROVIDER.send).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('rejects an incomplete request before reading anything', async () => {
    primeHappyPath();
    const { client } = buildClient({ rows });

    const result = await sendTemplateSmsFromWorkflow(
      { ...BASE_REQUEST, sourceRecordId: '' },
      { client },
    );

    expect(result).toMatchObject({ failureCode: 'INVALID_INPUT' });
    expect(findMessageTemplates).not.toHaveBeenCalled();
    expect(PROVIDER.send).not.toHaveBeenCalled();
  });
});
