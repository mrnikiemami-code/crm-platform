import { ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL } from '@/workflow/workflow-steps/workflow-actions/constants/ActionLabelMessages';
import { getLocalizedWorkflowStepName } from '@/workflow/workflow-steps/workflow-actions/utils/getLocalizedWorkflowStepName';
import { i18n } from '@lingui/core';

const CREATE_RECORD_DESCRIPTOR = ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL[
  'Create Record'
] as { id: string };

describe('getLocalizedWorkflowStepName', () => {
  afterEach(() => {
    i18n.load('en', {});
    i18n.activate('en');
  });

  it('never translates a custom title the manager typed', () => {
    expect(getLocalizedWorkflowStepName('تأخیر سفارشی مدیر')).toBe(
      'تأخیر سفارشی مدیر',
    );
    expect(getLocalizedWorkflowStepName('My own step')).toBe('My own step');
  });

  it('returns an empty string for a missing name', () => {
    expect(getLocalizedWorkflowStepName(undefined)).toBe('');
    expect(getLocalizedWorkflowStepName('')).toBe('');
  });

  it('resolves a technical action label through the active catalog', () => {
    i18n.load('fa-IR', { [CREATE_RECORD_DESCRIPTOR.id]: 'ایجاد رکورد' });
    i18n.activate('fa-IR');

    expect(getLocalizedWorkflowStepName('Create Record')).toBe('ایجاد رکورد');
  });

  it('falls back to the technical label when the locale has no translation', () => {
    i18n.load('en', {});
    i18n.activate('en');

    expect(getLocalizedWorkflowStepName('Create Record')).toBe('Create Record');
  });

  it('covers every selectable action label with a descriptor', () => {
    expect(
      Object.keys(ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL).length,
    ).toBeGreaterThanOrEqual(18);
  });
});
