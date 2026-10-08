import { describe, expect, it, vi } from 'vitest';

import {
  previewTemplate,
  readPhoneOverrides,
} from 'src/templates/preview-template.service';

// Every recipient value the preview uses comes from the workspace-scoped read.
// A Person id that belongs to another workspace is simply not returned by the
// client, so the preview must treat it as NOT_ACCESSIBLE and must NOT invent a
// name or a number for it. This is the workspace-separation witness: there is
// no second data source and no cross-workspace fallback.
const buildWorkspaceClient = (
  nodes: {
    id: string;
    name?: { firstName?: string | null } | null;
    phones?: { primaryPhoneNumber?: string | null } | null;
  }[],
) => ({
  query: vi.fn(async (_payload: unknown) => ({
    people: { edges: nodes.map((node) => ({ node })) },
  })),
});

describe('previewTemplate workspace separation', () => {
  it('never resolves a foreign-workspace person id and reports it as not accessible', async () => {
    // The client returns only this workspace's person; `foreign` is absent.
    const client = buildWorkspaceClient([
      {
        id: 'mine',
        name: { firstName: 'سارا' },
        phones: { primaryPhoneNumber: '09120000001' },
      },
    ]);

    const result = await previewTemplate({
      client,
      body: 'سلام @name',
      personIds: ['mine', 'foreign'],
      phoneOverrides: {},
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const foreign = result.previews.find((p) => p.personId === 'foreign');

      expect(foreign?.phone).toBeNull();
      expect(foreign?.isReadyToSend).toBe(false);
      // The foreign token is left unresolved rather than filled from anywhere.
      expect(foreign?.previewText).toBe('سلام @name');
      expect(result.readyCount).toBe(1);
    }
  });

  it('scopes the read to the requested ids (no broad, cross-workspace query)', async () => {
    const client = buildWorkspaceClient([]);

    await previewTemplate({
      client,
      body: 'x',
      personIds: ['mine'],
      phoneOverrides: {},
    });

    const payload = client.query.mock.calls[0]?.[0] as unknown as {
      people: { __args: { filter: { id: { in: string[] } } } };
    };

    expect(payload.people.__args.filter.id.in).toEqual(['mine']);
  });
});

describe('readPhoneOverrides (absent key vs explicit invalid choice)', () => {
  it('keeps an explicitly empty string so it can be reported, not dropped', () => {
    expect(readPhoneOverrides({ p1: '' })).toEqual({ p1: '' });
  });

  it('keeps an invalid-typed value so it can be reported, not dropped', () => {
    expect(readPhoneOverrides({ p1: 12345 })).toEqual({ p1: 12345 });
  });

  it('does not invent a key the caller never sent', () => {
    expect(readPhoneOverrides({ p1: '09120000001' })).toEqual({
      p1: '09120000001',
    });
    expect(Object.prototype.hasOwnProperty.call(readPhoneOverrides({}), 'p1')).toBe(
      false,
    );
  });

  it('returns an empty map for a non-object input', () => {
    expect(readPhoneOverrides(null)).toEqual({});
    expect(readPhoneOverrides('x')).toEqual({});
    expect(readPhoneOverrides([])).toEqual({});
  });
});
