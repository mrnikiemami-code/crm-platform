import { describe, expect, it, vi } from 'vitest';

import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import {
  findTemplateVariable,
  listTemplateVariables,
} from 'src/templates/template-variable-catalog';

// A fake workspace API client. Every read the app performs for templates goes
// through this client, so a template can only ever come from the current
// workspace — there is no second, global or cross-workspace source.
const buildFakeClient = (
  nodes: {
    id: string;
    title?: string | null;
    body?: string | null;
    channel?: string | null;
  }[],
) => {
  const queries: unknown[] = [];

  const client = {
    query: vi.fn(async (payload: unknown) => {
      queries.push(payload);

      return { messageTemplates: { edges: nodes.map((node) => ({ node })) } };
    }),
  };

  return { client, queries };
};

describe('findMessageTemplates (native workspace path)', () => {
  it('reads templates through the workspace client and maps them', async () => {
    const { client, queries } = buildFakeClient([
      { id: 't1', title: 'خوش‌آمد', body: 'سلام @name', channel: 'SMS' },
      { id: 't2', title: 'یادآوری', body: 'یادآوری برای @company', channel: 'SMS' },
    ]);

    const templates = await findMessageTemplates({ client });

    expect(templates).toEqual([
      { id: 't1', title: 'خوش‌آمد', body: 'سلام @name', channel: 'SMS' },
      { id: 't2', title: 'یادآوری', body: 'یادآوری برای @company', channel: 'SMS' },
    ]);

    // The read targets the workspace-scoped `messageTemplates` connection only.
    expect(queries).toHaveLength(1);
    expect(Object.keys(queries[0] as Record<string, unknown>)).toEqual([
      'messageTemplates',
    ]);
  });

  it('returns an empty list when the workspace has no templates', async () => {
    const { client } = buildFakeClient([]);

    await expect(findMessageTemplates({ client })).resolves.toEqual([]);
  });

  it('never stores a recipient value on the template shape', async () => {
    const { client } = buildFakeClient([
      { id: 't1', title: 'x', body: 'سلام @name', channel: 'SMS' },
    ]);

    const [template] = await findMessageTemplates({ client });

    // The template carries only its own text — no phone, no person id.
    expect(Object.keys(template)).toEqual(['id', 'title', 'body', 'channel']);
  });
});

describe('listTemplateVariables', () => {
  it('exposes only tokens and labels, never a recipient value', () => {
    const variables = listTemplateVariables();

    expect(variables.map((variable) => variable.token)).toEqual([
      '@person.firstName',
      '@person.lastName',
      '@person.fullName',
      '@person.jobTitle',
      '@company.name',
    ]);

    for (const variable of variables) {
      expect(Object.keys(variable)).toEqual(['token', 'label']);
    }
  });

  it('resolves every legacy alias to the same value as its namespaced token', () => {
    // The six pre-W17 aliases must keep working for already-saved templates.
    const aliases: [string, string][] = [
      ['@name', '@person.firstName'],
      ['@firstName', '@person.firstName'],
      ['@lastName', '@person.lastName'],
      ['@fullName', '@person.fullName'],
      ['@company', '@company.name'],
      ['@companyName', '@company.name'],
    ];

    for (const [alias, canonical] of aliases) {
      expect(findTemplateVariable(alias.slice(1))?.token).toBe(
        canonical.slice(1),
      );
    }
  });

  it('returns null for anything outside the allow-list', () => {
    expect(findTemplateVariable('ssn')).toBeNull();
    expect(findTemplateVariable('person.secret')).toBeNull();
  });
});
