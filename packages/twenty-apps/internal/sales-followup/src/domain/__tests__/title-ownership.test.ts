import { describe, expect, it } from 'vitest';

import {
  describeTitleOwnershipFieldProblem,
  findTitleOwnershipFieldProblems,
  isTitleOwnedByApp,
  TITLE_OWNERSHIP_DEFAULT,
  TITLE_OWNERSHIP_FIELD_NAME,
} from 'src/domain/title-ownership';

describe('title ownership field', () => {
  it('defaults to manual, so nothing existing is treated as ours', () => {
    // The conservative direction: a mistake loses an automatic title (recoverable
    // by the backfill) instead of destroying text a person typed.
    expect(TITLE_OWNERSHIP_DEFAULT).toBe(false);
    expect(TITLE_OWNERSHIP_FIELD_NAME).toBe('titleIsAuto');
  });

  it('accepts the declared shape', () => {
    expect(
      findTitleOwnershipFieldProblems({
        name: 'titleIsAuto',
        type: 'BOOLEAN',
        isNullable: true,
      }),
    ).toEqual([]);
  });

  it('rejects a same-named field of another type', () => {
    expect(
      findTitleOwnershipFieldProblems({
        name: 'titleIsAuto',
        type: 'TEXT',
        isNullable: true,
      }),
    ).toEqual(['WRONG_TYPE']);
  });

  it('rejects a non-nullable field, which would rewrite legacy rows', () => {
    expect(
      findTitleOwnershipFieldProblems({
        name: 'titleIsAuto',
        type: 'BOOLEAN',
        isNullable: false,
      }),
    ).toEqual(['NOT_NULLABLE']);
  });

  it('explains a problem with the object it was found on', () => {
    expect(
      describeTitleOwnershipFieldProblem('salesInteraction', 'WRONG_TYPE'),
    ).toContain('salesInteraction.titleIsAuto');
  });
});

describe('isTitleOwnedByApp', () => {
  it('grants ownership only for an explicit true', () => {
    expect(isTitleOwnedByApp(true)).toBe(true);
  });

  it('treats a legacy null as NOT ours', () => {
    expect(isTitleOwnedByApp(null)).toBe(false);
  });

  it('treats an explicit false as NOT ours', () => {
    expect(isTitleOwnedByApp(false)).toBe(false);
  });
});
