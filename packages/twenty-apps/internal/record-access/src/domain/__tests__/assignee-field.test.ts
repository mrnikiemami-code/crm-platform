import { describe, expect, it } from 'vitest';

import {
  describeAssigneeFieldProblem,
  findAssigneeFieldProblems,
  type AssigneeFieldShape,
} from 'src/domain/assignee-field';

const GOOD: AssigneeFieldShape = {
  name: 'assignee',
  type: 'RELATION',
  isNullable: true,
  settings: {
    relationType: 'MANY_TO_ONE',
    joinColumnName: 'assigneeId',
    onDelete: 'SET_NULL',
  },
  relation: { targetObjectMetadata: { nameSingular: 'workspaceMember' } },
};

describe('findAssigneeFieldProblems', () => {
  it('accepts the shape every trigger and rule depends on', () => {
    expect(findAssigneeFieldProblems(GOOD)).toEqual([]);
  });

  it('rejects a same-named field that is not a relation', () => {
    expect(findAssigneeFieldProblems({ ...GOOD, type: 'TEXT' })).toContain(
      'NOT_A_RELATION',
    );
  });

  it('rejects a relation to another object', () => {
    expect(
      findAssigneeFieldProblems({
        ...GOOD,
        relation: { targetObjectMetadata: { nameSingular: 'person' } },
      }),
    ).toContain('WRONG_TARGET');
  });

  it('rejects a one-to-many relation, which would put the owner on the member', () => {
    expect(
      findAssigneeFieldProblems({
        ...GOOD,
        settings: { ...GOOD.settings, relationType: 'ONE_TO_MANY' },
      }),
    ).toContain('WRONG_DIRECTION');
  });

  it('rejects a different join column, which the trigger does not write', () => {
    expect(
      findAssigneeFieldProblems({
        ...GOOD,
        settings: { ...GOOD.settings, joinColumnName: 'ownerId' },
      }),
    ).toContain('WRONG_JOIN_COLUMN');
  });

  it('rejects a non-nullable field, which blocks records without an owner', () => {
    expect(
      findAssigneeFieldProblems({ ...GOOD, isNullable: false }),
    ).toContain('NOT_NULLABLE');
  });

  it('reports every problem at once instead of only the first', () => {
    const broken: AssigneeFieldShape = {
      ...GOOD,
      type: 'TEXT',
      isNullable: false,
      settings: { relationType: 'ONE_TO_MANY', joinColumnName: 'ownerId' },
      relation: null,
    };

    expect(findAssigneeFieldProblems(broken).sort()).toEqual(
      [
        'NOT_A_RELATION',
        'WRONG_TARGET',
        'WRONG_DIRECTION',
        'WRONG_JOIN_COLUMN',
        'NOT_NULLABLE',
      ].sort(),
    );
  });
});

describe('describeAssigneeFieldProblem', () => {
  it('names the object and field so the operator knows where to look', () => {
    expect(
      describeAssigneeFieldProblem('eventRegistration', 'WRONG_TARGET'),
    ).toContain('eventRegistration.assignee');
  });
});
