import { describe, expect, it } from 'vitest';

import {
  resolveStudioLoadState,
  resolveStudioMutationResult,
} from 'src/studio/template-studio-client';

// The client is the ONLY place a server response becomes UI state, so this is
// where "never let an exception reach the browser" is enforced: any failure is
// collapsed to a stable code, and raw text is discarded.

describe('resolveStudioLoadState', () => {
  it('reads templates, fields and the catalog status', () => {
    const state = resolveStudioLoadState({
      ok: true,
      data: {
        success: true,
        templates: [
          { id: 't1', title: 'خوش‌آمد', body: 'سلام @name', targetObject: null },
        ],
        fields: [
          { token: '@person.firstName', label: 'نام', group: 'PERSON' },
          { token: '@company.name', label: 'نام شرکت', group: 'COMPANY' },
        ],
        catalogStatus: 'READY',
      },
    });

    expect(state.kind).toBe('READY');

    if (state.kind === 'READY') {
      expect(state.templates).toHaveLength(1);
      // A null stored target is read as PERSON.
      expect(state.templates[0].targetObject).toBe('PERSON');
      expect(state.fields.map((field) => field.group)).toEqual([
        'PERSON',
        'COMPANY',
      ]);
      expect(state.catalogStatus).toBe('READY');
    }
  });

  it('fails closed on an unknown catalog status', () => {
    const state = resolveStudioLoadState({
      ok: true,
      data: { success: true, templates: [], fields: [], catalogStatus: 'WAT' },
    });

    expect(state.kind === 'READY' && state.catalogStatus).toBe('UNAVAILABLE');
  });

  it('reports ERROR for a failed response, never an empty list', () => {
    expect(
      resolveStudioLoadState({ ok: false, data: null }).kind,
    ).toBe('ERROR');
  });

  it('reports ERROR for a malformed payload', () => {
    expect(
      resolveStudioLoadState({ ok: true, data: { success: true } }).kind,
    ).toBe('ERROR');
    expect(
      resolveStudioLoadState({
        ok: true,
        data: { success: true, templates: [{ nope: true }] },
      }).kind,
    ).toBe('ERROR');
  });
});

describe('resolveStudioMutationResult', () => {
  it('returns the saved template on success', () => {
    const result = resolveStudioMutationResult({
      ok: true,
      data: {
        success: true,
        template: {
          id: 't1',
          title: 'خوش‌آمد',
          body: 'سلام @name',
          targetObject: 'PERSON',
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      template: {
        id: 't1',
        title: 'خوش‌آمد',
        body: 'سلام @name',
        targetObject: 'PERSON',
      },
    });
  });

  it('maps a known failure to its stable code', () => {
    expect(
      resolveStudioMutationResult({
        ok: true,
        data: { success: false, errorCode: 'INVALID_INPUT' },
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
  });

  it('collapses an unknown code to UNEXPECTED', () => {
    expect(
      resolveStudioMutationResult({
        ok: true,
        data: { success: false, errorCode: 'SOMETHING_ELSE' },
      }),
    ).toEqual({ ok: false, code: 'UNEXPECTED' });
  });

  it('never surfaces raw exception text, URLs or SDK detail', () => {
    const result = resolveStudioMutationResult({
      ok: true,
      data: {
        success: false,
        // A server (or an intermediary) that leaked an exception must not get
        // it into the UI: only the stable code is kept.
        errorCode: 'WRITE_FAILED',
        error:
          'PostgresError at https://internal.db:5432 user=secret stack: at foo (bar.js:1)',
        message: 'RequestError: connect ECONNREFUSED 10.0.0.5:443',
      },
    });

    expect(result).toEqual({ ok: false, code: 'WRITE_FAILED' });
    expect(JSON.stringify(result)).not.toContain('PostgresError');
    expect(JSON.stringify(result)).not.toContain('internal.db');
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
