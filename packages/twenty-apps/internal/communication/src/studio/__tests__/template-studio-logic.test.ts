import { describe, expect, it } from 'vitest';

import {
  EMPTY_STUDIO_DRAFT,
  doesFieldActivationInsert,
  filterStudioFields,
  filterStudioPeople,
  findAuthorizedFieldByToken,
  groupStudioFields,
  insertTokenAtSelection,
  isFieldActivationKey,
  isStudioDraftDirty,
  readDroppedToken,
  readTextareaSelection,
  resolveInsertSelection,
  resolvePreviewBlockReason,
  STUDIO_FIELD_ACTIVATION,
  STUDIO_FIELD_DRAG_MIME,
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
      updatedAt: '2026-10-14T06:00:00.000Z',
    });

    expect(result.targetObject).toBe('PERSON');
    expect(result.body).toBe('سلام @name');
  });
});

// --- W18-B ------------------------------------------------------------------

describe('doesFieldActivationInsert', () => {
  it('inserts only for a double-click or an explicit keyboard activation', () => {
    expect(doesFieldActivationInsert(STUDIO_FIELD_ACTIVATION.CLICK)).toBe(false);
    expect(
      doesFieldActivationInsert(STUDIO_FIELD_ACTIVATION.DOUBLE_CLICK),
    ).toBe(true);
    expect(doesFieldActivationInsert(STUDIO_FIELD_ACTIVATION.KEYBOARD)).toBe(
      true,
    );
  });
});

describe('isFieldActivationKey', () => {
  it('accepts Enter and Space only', () => {
    expect(isFieldActivationKey('Enter')).toBe(true);
    expect(isFieldActivationKey(' ')).toBe(true);
    expect(isFieldActivationKey('Spacebar')).toBe(true);
    expect(isFieldActivationKey('a')).toBe(false);
    expect(isFieldActivationKey('Tab')).toBe(false);
  });
});

describe('resolveInsertSelection', () => {
  it('prefers the LIVE selection whenever the textarea reports one', () => {
    expect(
      resolveInsertSelection({
        bodyLength: 10,
        liveSelection: { start: 2, end: 2 },
        rememberedSelection: { start: 7, end: 7 },
        isTextareaFocused: true,
      }),
    ).toEqual({ start: 2, end: 2 });
  });

  it('prefers the REMEMBERED selection once the textarea lost focus', () => {
    // A blur resets selectionStart to the end of the value, so the live range
    // must be ignored in favour of the caret captured while it was valid.
    expect(
      resolveInsertSelection({
        bodyLength: 10,
        liveSelection: { start: 10, end: 10 },
        rememberedSelection: { start: 2, end: 2 },
        isTextareaFocused: false,
      }),
    ).toEqual({ start: 2, end: 2 });
  });

  it('falls back to the end of the body with nothing remembered', () => {
    expect(
      resolveInsertSelection({
        bodyLength: 12,
        liveSelection: null,
        rememberedSelection: null,
        isTextareaFocused: false,
      }),
    ).toEqual({ start: 12, end: 12 });
  });

  it('clamps a remembered selection that is now past the end of an edited body', () => {
    expect(
      resolveInsertSelection({
        bodyLength: 3,
        liveSelection: null,
        rememberedSelection: { start: 40, end: 50 },
        isTextareaFocused: false,
      }),
    ).toEqual({ start: 3, end: 3 });
  });
});

describe('findAuthorizedFieldByToken', () => {
  it('resolves only a token that is in the authorized catalog', () => {
    expect(findAuthorizedFieldByToken(fields, '@person.firstName')?.token).toBe(
      '@person.firstName',
    );
    expect(findAuthorizedFieldByToken(fields, '@person.notAuthorized')).toBeNull();
    expect(findAuthorizedFieldByToken(fields, 'نام')).toBeNull();
    expect(findAuthorizedFieldByToken(fields, null)).toBeNull();
    expect(findAuthorizedFieldByToken(fields, '')).toBeNull();
  });
});

describe('readDroppedToken', () => {
  it('prefers the typed MIME, then falls back to plain text', () => {
    const typed = {
      getData: (format: string) =>
        format === STUDIO_FIELD_DRAG_MIME ? '@person.firstName' : 'ignored',
    };
    const plain = {
      getData: (format: string) =>
        format === 'text/plain' ? '@company.name' : '',
    };

    expect(readDroppedToken(typed)).toBe('@person.firstName');
    expect(readDroppedToken(plain)).toBe('@company.name');
  });
});

describe('resolvePreviewBlockReason', () => {
  it('blocks on an unavailable catalog first', () => {
    expect(
      resolvePreviewBlockReason({
        personId: 'p1',
        body: 'x',
        isCatalogAvailable: false,
      }),
    ).toBe('CATALOG_UNAVAILABLE');
  });

  it('blocks without a selected person', () => {
    expect(
      resolvePreviewBlockReason({
        personId: null,
        body: 'x',
        isCatalogAvailable: true,
      }),
    ).toBe('NO_PERSON');
  });

  it('blocks with an empty or whitespace-only body', () => {
    expect(
      resolvePreviewBlockReason({
        personId: 'p1',
        body: '   ',
        isCatalogAvailable: true,
      }),
    ).toBe('EMPTY_BODY');
  });

  it('allows a preview only when every gate passes', () => {
    expect(
      resolvePreviewBlockReason({
        personId: 'p1',
        body: 'سلام',
        isCatalogAvailable: true,
      }),
    ).toBeNull();
  });
});

describe('filterStudioPeople', () => {
  const people = [
    { id: 'p1', displayName: 'سارا احمدی' },
    { id: 'p2', displayName: 'Reza Karimi' },
  ];

  it('matches by display name and by id', () => {
    expect(filterStudioPeople(people, 'سارا').map((p) => p.id)).toEqual(['p1']);
    expect(filterStudioPeople(people, 'reza').map((p) => p.id)).toEqual(['p2']);
    expect(filterStudioPeople(people, 'p2').map((p) => p.id)).toEqual(['p2']);
  });

  it('returns everyone for an empty query and nobody for a miss', () => {
    expect(filterStudioPeople(people, '')).toHaveLength(2);
    expect(filterStudioPeople(people, 'zzz')).toHaveLength(0);
  });
});

describe('readTextareaSelection', () => {
  it('returns null when the element cannot report a selection', () => {
    expect(readTextareaSelection(null)).toBeNull();
    expect(
      readTextareaSelection({ selectionStart: null, selectionEnd: null }),
    ).toBeNull();
  });

  it('captures a usable selection', () => {
    expect(
      readTextareaSelection({ selectionStart: 3, selectionEnd: 5 }),
    ).toEqual({ start: 3, end: 5 });
  });
});
