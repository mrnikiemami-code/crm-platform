import { TITLE_OWNERSHIP_FIELD_NAME } from 'src/constants/universal-identifiers';

// Re-exported so callers reason about "the ownership flag" in one place instead
// of importing a field name from a constants module and a decision function from
// here.
export { TITLE_OWNERSHIP_FIELD_NAME };

// Title ownership: the flag that separates an automatic title from a
// hand-written one.
//
// WHY A STORED FLAG: a hand-written title cannot be told apart from an automatic
// one by looking at the text. Comparing against the value the app would have
// produced is exact only until somebody types that exact wording, and any
// pattern-based guess is wrong for the titles people actually write (the one
// legacy title here is «پیکیری», a typo of «پیگیری»). A stored boolean is the
// only sound answer, so it is part of the data model.
//
// THE DEFAULT MUST BE `false`. Every title that exists today was written by a
// person, because no automatic title logic existed before this app. Defaulting
// new rows to `false` therefore means "treat as hand-written, never overwrite" —
// the conservative direction: a mistake here loses an automatic title (recoverable
// by the backfill) instead of destroying text somebody typed.
export const TITLE_OWNERSHIP_FIELD_LABEL = 'عنوان خودکار است';
export const TITLE_OWNERSHIP_FIELD_DESCRIPTION =
  'وقتی روشن است، عنوان را برنامه می‌سازد و با تغییر نوبت تماس یا نام مشتری به‌روز می‌شود. وقتی خاموش است، عنوان دستی است و هرگز بازنویسی نمی‌شود.';
export const TITLE_OWNERSHIP_DEFAULT = false;

/** The shape the title-sync code depends on, as read from metadata. */
export type TitleOwnershipFieldShape = {
  name?: string | null;
  type?: string | null;
  isNullable?: boolean | null;
};

export type TitleOwnershipFieldProblem =
  | 'WRONG_TYPE'
  | 'NOT_NULLABLE'
  | 'WRONG_NAME';

export const describeTitleOwnershipFieldProblem = (
  objectNameSingular: string,
  problem: TitleOwnershipFieldProblem,
): string => {
  switch (problem) {
    case 'WRONG_TYPE':
      return `${objectNameSingular}.${TITLE_OWNERSHIP_FIELD_NAME} must be BOOLEAN so it can only mean automatic/manual`;
    case 'NOT_NULLABLE':
      return `${objectNameSingular}.${TITLE_OWNERSHIP_FIELD_NAME} must be nullable so pre-existing rows keep their meaning`;
    case 'WRONG_NAME':
      return `${objectNameSingular}.${TITLE_OWNERSHIP_FIELD_NAME} has the wrong name`;
  }
};

/**
 * Verifies an existing field is the one this app owns.
 *
 * A same-named field of another type would make every ownership decision wrong
 * while still looking correct, so the provisioning script stops on it instead of
 * proceeding.
 */
export const findTitleOwnershipFieldProblems = (
  field: TitleOwnershipFieldShape,
): TitleOwnershipFieldProblem[] => {
  const problems: TitleOwnershipFieldProblem[] = [];

  if (field.name !== TITLE_OWNERSHIP_FIELD_NAME) {
    problems.push('WRONG_NAME');
  }

  if (field.type !== 'BOOLEAN') {
    problems.push('WRONG_TYPE');
  }

  if (field.isNullable !== true) {
    problems.push('NOT_NULLABLE');
  }

  return problems;
};

/**
 * Whether the app may replace this record's title.
 *
 * Only an EXPLICIT `true` grants permission. `null` (a row that predates the
 * field) and `false` both mean "not ours", which is the conservative reading and
 * keeps legacy hand-written titles safe without a migration step.
 */
export const isTitleOwnedByApp = (titleIsAuto: boolean | null): boolean =>
  titleIsAuto === true;
