// Shape checks for the assignee fields this app depends on.
//
// An existing field with the right NAME but the wrong shape would make the role
// reference something that is not a relation to a workspace member, and the
// row-level rule would silently never match — a security feature that looks
// installed and enforces nothing. So the shape is verified, not assumed, and the
// checks are pure so they can be asserted without a workspace.

export const ASSIGNEE_FIELD_NAME = 'assignee';
export const ASSIGNEE_JOIN_COLUMN_NAME = 'assigneeId';
export const WORKSPACE_MEMBER_OBJECT_NAME = 'workspaceMember';

export type AssigneeFieldShape = {
  name: string;
  type: string;
  isNullable: boolean | null;
  settings: {
    relationType?: string | null;
    joinColumnName?: string | null;
    onDelete?: string | null;
  } | null;
  relation: { targetObjectMetadata: { nameSingular: string } | null } | null;
};

export type AssigneeFieldProblem =
  /** The field is not a relation at all. */
  | 'NOT_A_RELATION'
  /** The relation points at something other than a workspace member. */
  | 'WRONG_TARGET'
  /** It is a one-to-many: the value would live on the member, not on the record. */
  | 'WRONG_DIRECTION'
  /** The join column has another name, so the trigger would write the wrong column. */
  | 'WRONG_JOIN_COLUMN'
  /** The value cannot be empty, which breaks every record that has no owner yet. */
  | 'NOT_NULLABLE';

/**
 * Returns every problem the field has, not just the first: a field that is both
 * the wrong target and the wrong direction should say so in one run.
 */
export const findAssigneeFieldProblems = (
  field: AssigneeFieldShape,
): AssigneeFieldProblem[] => {
  const problems: AssigneeFieldProblem[] = [];

  if (field.type !== 'RELATION') {
    problems.push('NOT_A_RELATION');
  }

  const targetName = field.relation?.targetObjectMetadata?.nameSingular ?? null;

  if (targetName !== WORKSPACE_MEMBER_OBJECT_NAME) {
    problems.push('WRONG_TARGET');
  }

  if (field.settings?.relationType !== 'MANY_TO_ONE') {
    problems.push('WRONG_DIRECTION');
  }

  if (field.settings?.joinColumnName !== ASSIGNEE_JOIN_COLUMN_NAME) {
    problems.push('WRONG_JOIN_COLUMN');
  }

  if (field.isNullable !== true) {
    problems.push('NOT_NULLABLE');
  }

  return problems;
};

export const describeAssigneeFieldProblem = (
  objectNameSingular: string,
  problem: AssigneeFieldProblem,
): string => {
  const prefix = `${objectNameSingular}.${ASSIGNEE_FIELD_NAME}`;

  switch (problem) {
    case 'NOT_A_RELATION':
      return `${prefix} exists but is not a RELATION`;
    case 'WRONG_TARGET':
      return `${prefix} does not point at ${WORKSPACE_MEMBER_OBJECT_NAME}`;
    case 'WRONG_DIRECTION':
      return `${prefix} is not MANY_TO_ONE, so the owner would live on the member instead of the record`;
    case 'WRONG_JOIN_COLUMN':
      return `${prefix} join column is not ${ASSIGNEE_JOIN_COLUMN_NAME}`;
    case 'NOT_NULLABLE':
      return `${prefix} is not nullable, so records without an owner cannot be written`;
    default:
      return `${prefix} has an unknown problem`;
  }
};
