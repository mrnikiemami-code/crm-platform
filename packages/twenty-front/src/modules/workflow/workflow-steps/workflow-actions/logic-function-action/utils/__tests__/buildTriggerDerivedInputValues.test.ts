import { TRIGGER_STEP_ID, type InputSchema } from 'twenty-shared/workflow';

import {
  buildTriggerDerivedInputValues,
  hasTriggerDerivedProperties,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/buildTriggerDerivedInputValues';

const SCHEMA_WITH_DERIVED: InputSchema = [
  {
    type: 'object',
    properties: {
      templateId: { type: 'record', objectUniversalIdentifier: 'template-uid' },
      sourceObjectNameSingular: {
        type: 'string',
        isHidden: true,
        derivedFromTrigger: 'objectName',
      },
      sourceRecordId: {
        type: 'string',
        isHidden: true,
        derivedFromTrigger: 'recordId',
      },
      fieldName: {
        type: 'string',
        isHidden: true,
        derivedFromTrigger: 'watchedField',
      },
      beforeValue: {
        type: 'unknown',
        isHidden: true,
        derivedFromTrigger: 'beforeValue',
      },
      afterValue: {
        type: 'unknown',
        isHidden: true,
        derivedFromTrigger: 'afterValue',
      },
      eventId: {
        type: 'string',
        isHidden: true,
        derivedFromTrigger: 'eventId',
      },
      workflowId: {
        type: 'string',
        isHidden: true,
        derivedFromTrigger: 'workflowId',
      },
    },
  },
];

const buildUpdatedTrigger = (fields: string[] | null) =>
  ({
    type: 'DATABASE_EVENT',
    settings: {
      eventName: 'person.updated',
      fields,
      outputSchema: {},
    },
  }) as never;

const expectedVariable = (path: string[]) =>
  `{{${TRIGGER_STEP_ID}.${path.join('.')}}}`;

describe('hasTriggerDerivedProperties', () => {
  it('detects properties the platform must supply', () => {
    expect(hasTriggerDerivedProperties(SCHEMA_WITH_DERIVED)).toBe(true);
  });

  it('reports false for a schema with only author-provided fields', () => {
    expect(
      hasTriggerDerivedProperties([
        { type: 'object', properties: { templateId: { type: 'record' } } },
      ]),
    ).toBe(false);
  });
});

describe('buildTriggerDerivedInputValues', () => {
  it('derives every value from an updated trigger with one watched column', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: buildUpdatedTrigger(['stage']),
      workflowId: 'wf-1',
    });

    expect(result.isDerivable).toBe(true);
    expect(result.values).toEqual({
      sourceObjectNameSingular: 'person',
      sourceRecordId: expectedVariable(['recordId']),
      fieldName: 'stage',
      beforeValue: expectedVariable(['properties', 'before', 'stage']),
      afterValue: expectedVariable(['properties', 'after', 'stage']),
      eventId: expectedVariable(['eventId']),
      workflowId: 'wf-1',
    });
  });

  it('never derives from a created trigger', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: {
        type: 'DATABASE_EVENT',
        settings: {
          eventName: 'person.created',
          fields: ['stage'],
          outputSchema: {},
        },
      } as never,
      workflowId: 'wf-1',
    });

    // A create has no previous value, so a field-change send would be wrong.
    expect(result).toEqual({ values: {}, isDerivable: false });
  });

  it('refuses to guess when several columns are watched', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: buildUpdatedTrigger(['stage', 'owner']),
      workflowId: 'wf-1',
    });

    // The before/after pair would be ambiguous, so nothing is written rather
    // than picking one column.
    expect(result).toEqual({ values: {}, isDerivable: false });
  });

  it('refuses when no column is watched', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: buildUpdatedTrigger(null),
      workflowId: 'wf-1',
    });

    expect(result).toEqual({ values: {}, isDerivable: false });
  });

  it('refuses a manual trigger', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: { type: 'MANUAL', settings: {} } as never,
      workflowId: 'wf-1',
    });

    expect(result).toEqual({ values: {}, isDerivable: false });
  });

  it('refuses when there is no trigger yet', () => {
    expect(
      buildTriggerDerivedInputValues({
        inputSchema: SCHEMA_WITH_DERIVED,
        trigger: null,
        workflowId: 'wf-1',
      }),
    ).toEqual({ values: {}, isDerivable: false });
  });

  it('refuses when the workflow id is unknown', () => {
    // `workflowId` is part of the deduplication identity, so an empty value
    // would silently collapse two workflows into one send.
    expect(
      buildTriggerDerivedInputValues({
        inputSchema: SCHEMA_WITH_DERIVED,
        trigger: buildUpdatedTrigger(['stage']),
        workflowId: undefined,
      }),
    ).toEqual({ values: {}, isDerivable: false });
  });

  it('derives nothing for a schema that declares no derivations', () => {
    expect(
      buildTriggerDerivedInputValues({
        inputSchema: [
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
        trigger: buildUpdatedTrigger(['stage']),
        workflowId: 'wf-1',
      }),
    ).toEqual({ values: {}, isDerivable: true });
  });

  it('escapes a column name that needs bracket notation', () => {
    const result = buildTriggerDerivedInputValues({
      inputSchema: SCHEMA_WITH_DERIVED,
      trigger: buildUpdatedTrigger(['a b']),
      workflowId: 'wf-1',
    });

    expect(result.values.afterValue).toBe(
      `{{${TRIGGER_STEP_ID}.properties.after.[a b]}}`,
    );
  });
});
