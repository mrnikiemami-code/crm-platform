import { describe, expect, it, vi } from 'vitest';

import {
  listBulkRecipients,
  normalizePersonIds,
} from 'src/bulk/list-bulk-recipients.service';
import { previewTemplate } from 'src/templates/preview-template.service';

type FakeNode = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  company?: { name?: string | null } | null;
  phones?: {
    primaryPhoneNumber?: string | null;
    additionalPhones?: { number?: string | null }[] | null;
  } | null;
};

// A fake workspace API client that records the exact query it was given, so a
// test can prove the read is scoped to the requested ids (the server applies
// the caller's permissions on top of that filter).
const buildFakeClient = (nodes: FakeNode[]) => {
  const queries: unknown[] = [];

  const client = {
    query: vi.fn(async (payload: unknown) => {
      queries.push(payload);

      return { people: { edges: nodes.map((node) => ({ node })) } };
    }),
  };

  return { client, queries };
};

describe('normalizePersonIds', () => {
  it('rejects a non-array input', () => {
    expect(normalizePersonIds('p1')).toBeNull();
    expect(normalizePersonIds(null)).toBeNull();
  });

  it('trims, drops empties and PRESERVES duplicates for the report', () => {
    // Duplicates are intentionally kept: the resolver reports them. Removing
    // them here would silently erase the duplicate report.
    expect(normalizePersonIds([' p1 ', 'p1', '', 'p2', 42])).toEqual([
      'p1',
      'p1',
      'p2',
    ]);
  });
});

describe('listBulkRecipients', () => {
  it('returns all requested recipients resolved from authorized records', async () => {
    const { client, queries } = buildFakeClient([
      { id: 'p1', name: { firstName: 'سارا' }, phones: { primaryPhoneNumber: '09120000001' } },
      { id: 'p2', name: { firstName: 'رضا' }, phones: { primaryPhoneNumber: '09120000002' } },
    ]);

    const result = await listBulkRecipients({ client, personIds: ['p1', 'p2'] });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.recipients.map((r) => r.personId)).toEqual(['p1', 'p2']);
      expect(result.sendableCount).toBe(2);
    }

    // The read is scoped to the requested ids — never a broad query.
    const payload = queries[0] as {
      people: { __args: { filter: { id: { in: string[] } } } };
    };

    expect(payload.people.__args.filter.id.in).toEqual(['p1', 'p2']);
  });

  it('reports a requested id the read did not return as NOT_ACCESSIBLE', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await listBulkRecipients({
      client,
      personIds: ['p1', 'foreign'],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const foreign = result.recipients.find((r) => r.personId === 'foreign');

      expect(foreign?.status).toBe('NOT_ACCESSIBLE');
      expect(result.unsendableCount).toBe(1);
    }
  });

  it('refuses an empty selection', async () => {
    const { client } = buildFakeClient([]);
    const result = await listBulkRecipients({ client, personIds: [] });

    expect(result).toEqual({ success: false, error: '`personIds` is required.' });
  });

  it('reports duplicates from the raw selection instead of pre-removing them', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await listBulkRecipients({
      client,
      personIds: ['p1', 'p1', 'p1'],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.duplicatePersonIds).toEqual(['p1']);
      expect(result.recipients.map((r) => r.personId)).toEqual(['p1']);
    }
  });
});

describe('previewTemplate', () => {
  it('builds a DIFFERENT text for two people from the same template', async () => {
    const { client } = buildFakeClient([
      {
        id: 'p1',
        name: { firstName: 'سارا', lastName: 'احمدی' },
        company: { name: 'شرکت الف' },
        phones: { primaryPhoneNumber: '09120000001' },
      },
      {
        id: 'p2',
        name: { firstName: 'رضا', lastName: 'کریمی' },
        company: { name: 'شرکت ب' },
        phones: { primaryPhoneNumber: '09120000002' },
      },
    ]);

    const result = await previewTemplate({
      client,
      body: 'سلام @name از @company',
      personIds: ['p1', 'p2'],
      phoneOverrides: {},
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const byPerson = new Map(
        result.previews.map((preview) => [preview.personId, preview]),
      );

      expect(byPerson.get('p1')?.previewText).toBe('سلام سارا از شرکت الف');
      expect(byPerson.get('p2')?.previewText).toBe('سلام رضا از شرکت ب');
      expect(result.hasUnresolvedVariables).toBe(false);
      expect(result.readyCount).toBe(2);
    }
  });

  it('marks a recipient with an empty field as not ready and keeps the token visible', async () => {
    const { client } = buildFakeClient([
      {
        id: 'p1',
        name: { firstName: 'سارا' },
        company: null,
        phones: { primaryPhoneNumber: '09120000001' },
      },
    ]);

    const result = await previewTemplate({
      client,
      body: 'سلام @name از @company',
      personIds: ['p1'],
      phoneOverrides: {},
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const preview = result.previews[0];

      expect(preview.hasUnresolvedVariables).toBe(true);
      expect(preview.isReadyToSend).toBe(false);
      expect(preview.previewText).toBe('سلام سارا از @company');
      expect(preview.issues).toEqual([
        { token: '@company', kind: 'EMPTY_FIELD' },
      ]);
      expect(result.readyCount).toBe(0);
    }
  });

  it('invalidates a phone override that does not belong to the person (no fallback, not ready)', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1'],
      phoneOverrides: { p1: '09999999999' },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.invalidOverrides).toEqual([
        { personId: 'p1', reason: 'NOT_OWNED_BY_PERSON' },
      ]);
      // No destination: neither the bogus number nor the primary is used.
      expect(result.previews[0].phone).toBeNull();
      expect(result.previews[0].isReadyToSend).toBe(false);
      expect(result.readyCount).toBe(0);
    }
  });

  it('accepts an override that IS one of the person numbers', async () => {
    const { client } = buildFakeClient([
      {
        id: 'p1',
        phones: {
          primaryPhoneNumber: '09120000001',
          additionalPhones: [{ number: '09350000001' }],
        },
      },
    ]);

    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1'],
      phoneOverrides: { p1: '09350000001' },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.invalidOverrides).toEqual([]);
      expect(result.previews[0].phone).toBe('09350000001');
      expect(result.previews[0].isReadyToSend).toBe(true);
    }
  });

  it('treats an explicit EMPTY override as invalid and never falls back to the primary', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1'],
      phoneOverrides: { p1: '' },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.invalidOverrides).toEqual([
        { personId: 'p1', reason: 'EMPTY_SELECTION' },
      ]);
      expect(result.previews[0].phone).toBeNull();
      expect(result.previews[0].isReadyToSend).toBe(false);
      expect(result.readyCount).toBe(0);
    }
  });

  it('treats an INVALID-TYPE override as invalid and never falls back to the primary', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1'],
      phoneOverrides: { p1: 12345 },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.invalidOverrides).toEqual([
        { personId: 'p1', reason: 'INVALID_TYPE' },
      ]);
      expect(result.previews[0].phone).toBeNull();
      expect(result.previews[0].isReadyToSend).toBe(false);
      expect(result.readyCount).toBe(0);
    }
  });

  it('keeps the primary for an ABSENT key while invalidating another recipient', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
      { id: 'p2', phones: { primaryPhoneNumber: '09120000002' } },
    ]);

    // p1 has no key (keeps its primary); p2 has an invalid override.
    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1', 'p2'],
      phoneOverrides: { p2: '09999999999' },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const byPerson = new Map(
        result.previews.map((preview) => [preview.personId, preview]),
      );

      expect(byPerson.get('p1')?.phone).toBe('09120000001');
      expect(byPerson.get('p1')?.isReadyToSend).toBe(true);
      expect(byPerson.get('p2')?.phone).toBeNull();
      expect(byPerson.get('p2')?.isReadyToSend).toBe(false);
      expect(result.readyCount).toBe(1);
    }
  });

  it('leaves a VALID recipient ready when another recipient is invalid', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
      {
        id: 'p2',
        phones: {
          primaryPhoneNumber: '09120000002',
          additionalPhones: [{ number: '09350000002' }],
        },
      },
    ]);

    const result = await previewTemplate({
      client,
      body: 'یک پیام ساده',
      personIds: ['p1', 'p2'],
      phoneOverrides: { p1: '09999999999', p2: '09350000002' },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const byPerson = new Map(
        result.previews.map((preview) => [preview.personId, preview]),
      );

      expect(byPerson.get('p1')?.phone).toBeNull();
      expect(byPerson.get('p1')?.isReadyToSend).toBe(false);
      // The valid recipient's chosen number is applied and unchanged.
      expect(byPerson.get('p2')?.phone).toBe('09350000002');
      expect(byPerson.get('p2')?.isReadyToSend).toBe(true);
      expect(result.readyCount).toBe(1);
    }
  });

  it('never marks an empty or whitespace-only body ready', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    for (const body of ['', '   ', '\n\t ']) {
      const result = await previewTemplate({
        client,
        body,
        personIds: ['p1'],
        phoneOverrides: {},
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.isBodyEmpty).toBe(true);
        expect(result.readyCount).toBe(0);
        expect(result.previews[0].isReadyToSend).toBe(false);
      }
    }
  });

  it('recomputes the shared-number warning from the numbers used AFTER overrides', async () => {
    const { client } = buildFakeClient([
      {
        id: 'p1',
        phones: {
          primaryPhoneNumber: '09120000001',
          // A second number that is ALSO p2's primary, so switching p1 to it
          // creates a shared number that the server must report.
          additionalPhones: [{ number: '09120000002' }],
        },
      },
      { id: 'p2', phones: { primaryPhoneNumber: '09120000002' } },
    ]);

    // Without an override the two people use different numbers.
    const before = await previewTemplate({
      client,
      body: '@name',
      personIds: ['p1', 'p2'],
      phoneOverrides: {},
    });

    expect(before.success).toBe(true);

    if (before.success) {
      expect(before.sharedPhoneWarnings).toEqual([]);
    }

    // Overriding p1 to p2's number CREATES a shared number, which the server
    // must report because it recomputes after applying overrides.
    const after = await previewTemplate({
      client,
      body: '@name',
      personIds: ['p1', 'p2'],
      phoneOverrides: { p1: '09120000002' },
    });

    expect(after.success).toBe(true);

    if (after.success) {
      expect(after.sharedPhoneWarnings).toEqual([
        { phone: '09120000002', personIds: ['p1', 'p2'] },
      ]);
    }
  });

  it('reports duplicates the caller sent instead of silently collapsing them first', async () => {
    const { client } = buildFakeClient([
      { id: 'p1', phones: { primaryPhoneNumber: '09120000001' } },
    ]);

    const result = await previewTemplate({
      client,
      body: '@name',
      personIds: ['p1', 'p1', 'p1'],
      phoneOverrides: {},
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.duplicatePersonIds).toEqual(['p1']);
    }
  });

  it('applies the 200 cap to the preview route', async () => {
    const { client } = buildFakeClient([]);
    const tooMany = Array.from({ length: 201 }, (_, index) => `p${index}`);

    const result = await previewTemplate({
      client,
      body: '@name',
      personIds: tooMany,
      phoneOverrides: {},
    });

    expect(result).toEqual({
      success: false,
      error: 'Select at most 200 people at once.',
    });
  });
});
