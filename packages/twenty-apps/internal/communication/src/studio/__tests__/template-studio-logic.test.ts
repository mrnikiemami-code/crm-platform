import { describe, expect, it } from 'vitest';

import {
  EMPTY_STUDIO_DRAFT,
  filterStudioFields,
  groupStudioFields,
  insertTokenAtSelection,
  isStudioDraftDirty,
  toStudioDraft,
  validateStudioDraft,
  type StudioDraft,
  type StudioField,
} from 'src/studio/template-studio-logic';

const fields: StudioField[] = [
  { token: '@person.firstName', label: 'نام', group: 'PERSON' },
  { token: '@person.jobTitle', label: 'عنوان شغلی', group: 'PERSON' },
  { token: '@company.name', label: 'نام شرکت', group: 'COMPANY' },
];

const draft = (overrides: Partial<StudioDraft> = {}): StudioDraft => ({
  ...EMPTY_STUDIO_DRAFT,
  ...overrides,
});

describe('insertTokenAtSelection', () => {
  it('inserts the canonical token at the caret', () => {
    const result = insertTokenAtSelection({
      body: 'سلام  خوبی؟',
      selectionStart: 5,
      selectionEnd: 5,
      token: '@person.firstName',
    });

    // The TOKEN is stored, never a translated label.
    expect(result.body).toBe('سلام @person.firstName خوبی؟');
    expect(result.caret).toBe(5 + '@person.firstName'.length);
  });

  it('replaces the current selection', () => {
    const result = insertTokenAtSelection({
      body: 'سلام XXX خوبی؟',
      selectionStart: 5,
      selectionEnd: 8,
      token: '@person.firstName',
    });

    expect(result.body).toBe('سلام @person.firstName خوبی؟');
  });

  it('appends when there is no selection information', () => {
    const result = insertTokenAtSelection({
      body: 'متن',
      selectionStart: null,
      selectionEnd: null,
      token: '@company.name',
    });

    expect(result.body).toBe('متن@company.name');
    expect(result.caret).toBe('متن@company.name'.length);
  });

  it('clamps a stale selection instead of corrupting the body', () => {
    const result = insertTokenAtSelection({
      body: 'کوتاه',
      selectionStart: 999,
      selectionEnd: 1200,
      token: '@company.name',
    });

    expect(result.body).toBe('کوتاه@company.name');
  });

  it('preserves existing newlines exactly', () => {
    const result = insertTokenAtSelection({
      body: 'خط اول\nخط دوم',
      // Index 6 is the newline itself, so the token lands at the end of line 1.
      selectionStart: 6,
      selectionEnd: 6,
      token: ' @person.fullName',
    });

    expect(result.body).toBe('خط اول @person.fullName\nخط دوم');
    expect(result.body.split('\n')).toHaveLength(2);
  });
});

describe('isStudioDraftDirty', () => {
  it('is clean for a fresh, untouched draft', () => {
    expect(isStudioDraftDirty(EMPTY_STUDIO_DRAFT, null)).toBe(false);
  });

  it('is dirty once any field changes on a new draft', () => {
    expect(isStudioDraftDirty(draft({ title: 'x' }), null)).toBe(true);
    expect(isStudioDraftDirty(draft({ body: 'x' }), null)).toBe(true);
  });

  it('is clean again when an edit is reverted', () => {
    const saved = draft({ id: 't1', title: 'خوش‌آمد', body: 'سلام @name' });
    const edited = { ...saved, body: 'سلام @name!' };

    expect(isStudioDraftDirty(edited, saved)).toBe(true);
    expect(isStudioDraftDirty({ ...saved }, saved)).toBe(false);
  });

  it('treats a newline-only edit as a real change', () => {
    const saved = draft({ id: 't1', title: 'a', body: 'خط' });

    expect(isStudioDraftDirty({ ...saved, body: 'خط\n' }, saved)).toBe(true);
  });
});

describe('validateStudioDraft', () => {
  it('requires a title and a non-blank body', () => {
    expect(validateStudioDraft(draft())).toEqual([
      'TITLE_REQUIRED',
      'BODY_REQUIRED',
    ]);
    expect(validateStudioDraft(draft({ title: 'x', body: '   ' }))).toEqual([
      'BODY_REQUIRED',
    ]);
    expect(validateStudioDraft(draft({ title: 'x', body: 'متن' }))).toEqual([]);
  });
});

describe('filterStudioFields', () => {
  it('finds by Persian label', () => {
    expect(filterStudioFields(fields, 'نام').map((f) => f.token)).toEqual([
      '@person.firstName',
      '@company.name',
    ]);
  });

  it('finds by technical token', () => {
    expect(filterStudioFields(fields, 'jobtitle').map((f) => f.token)).toEqual([
      '@person.jobTitle',
    ]);
    expect(filterStudioFields(fields, '@company').map((f) => f.token)).toEqual([
      '@company.name',
    ]);
  });

  it('returns everything for an empty query', () => {
    expect(filterStudioFields(fields, '   ')).toHaveLength(3);
  });

  it('returns nothing for a non-matching query', () => {
    expect(filterStudioFields(fields, 'zzz')).toHaveLength(0);
  });
});

describe('groupStudioFields', () => {
  it('groups Person and Company separately, in order, hiding empty groups', () => {
    const grouped = groupStudioFields(fields);

    expect(grouped.map((g) => g.group)).toEqual(['PERSON', 'COMPANY']);
    expect(grouped[0].fields.map((f) => f.token)).toEqual([
      '@person.firstName',
      '@person.jobTitle',
    ]);
    expect(grouped[1].fields.map((f) => f.token)).toEqual(['@company.name']);
  });

  it('omits a group with no visible fields', () => {
    const grouped = groupStudioFields(
      fields.filter((field) => field.group === 'COMPANY'),
    );

    expect(grouped.map((g) => g.group)).toEqual(['COMPANY']);
  });
});

describe('toStudioDraft', () => {
  it('defaults a missing target to PERSON without writing anything back', () => {
    const result = toStudioDraft({
      id: 't1',
      title: 'خوش‌آمد',
      body: 'سلام @name',
      targetObject: 'PERSON',
    });

    expect(result.targetObject).toBe('PERSON');
    expect(result.body).toBe('سلام @name');
  });
});
