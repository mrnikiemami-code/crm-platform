import { describe, expect, it, vi } from 'vitest';
import { createMessageTemplateWithSource } from 'src/templates/data/mutate-message-templates';
const input = {
  id: '187c3b8c-4a53-4de3-80be-9a683d044a75',
  title: 'عنوان',
  body: 'متن\n@source.name',
  sourceObjectUid: 'object-uid',
  recipientRelationUid: 'relation-uid',
};
const stored = { ...input, updatedAt: 'now', targetObject: 'PERSON' };
const connection = (node: unknown) => ({
  messageTemplates: { edges: node ? [{ node }] : [] },
});
describe('native template create retry', () => {
  it('returns the prior identical creation without another mutation', async () => {
    const client = {
      query: vi.fn().mockResolvedValue(connection(stored)),
      mutation: vi.fn(),
    };
    expect(
      await createMessageTemplateWithSource({ client, ...input }),
    ).toMatchObject(stored);
    expect(client.mutation).not.toHaveBeenCalled();
  });
  it('recovers an ambiguous successful write using the same UUID', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(connection(null))
        .mockResolvedValueOnce(connection(stored)),
      mutation: vi.fn().mockRejectedValue(new Error('response lost')),
    };
    expect(
      await createMessageTemplateWithSource({ client, ...input }),
    ).toMatchObject(stored);
    expect(client.mutation).toHaveBeenCalledTimes(1);
  });
  it('never overwrites a record with the same id but different data', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValue(connection({ ...stored, body: 'other text' })),
      mutation: vi.fn(),
    };
    await expect(
      createMessageTemplateWithSource({ client, ...input }),
    ).rejects.toThrow();
    expect(client.mutation).not.toHaveBeenCalled();
  });
  it('does not turn a permission failure into an empty table or attempt a write', async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new Error('forbidden')),
      mutation: vi.fn(),
    };
    await expect(
      createMessageTemplateWithSource({ client, ...input }),
    ).rejects.toThrow('forbidden');
    expect(client.mutation).not.toHaveBeenCalled();
  });
});
