import { describe, expect, it } from 'vitest';

import {
  doesBodyEditDetach,
  NO_TEMPLATE_ID,
  resolveTemplateChoice,
  templateOptionLabel,
  type TemplateOption,
} from 'src/components/template-selection';

const templateA: TemplateOption = {
  id: 't-a',
  title: 'خوش‌آمد',
  body: 'سلام @name عزیز',
  channel: 'SMS',
};

const templateB: TemplateOption = {
  id: 't-b',
  title: 'یادآوری',
  body: 'یادآوری: @company.name',
  channel: 'SMS',
};

const templates = [templateA, templateB];

describe('resolveTemplateChoice', () => {
  it('inserts the chosen template body', () => {
    expect(
      resolveTemplateChoice({
        templateId: 't-a',
        templates,
        attachedBody: null,
      }),
    ).toEqual({ kind: 'INSERT', body: 'سلام @name عزیز' });
  });

  it('inserts a DIFFERENT template over the previous one', () => {
    expect(
      resolveTemplateChoice({
        templateId: 't-b',
        templates,
        attachedBody: templateA.body,
      }),
    ).toEqual({ kind: 'INSERT', body: 'یادآوری: @company.name' });
  });

  it('clears the body when «بدون الگو» follows an attached template', () => {
    expect(
      resolveTemplateChoice({
        templateId: NO_TEMPLATE_ID,
        templates,
        attachedBody: templateA.body,
      }),
    ).toEqual({ kind: 'CLEAR' });
  });

  it('does nothing when «بدون الگو» is chosen with no attached template', () => {
    expect(
      resolveTemplateChoice({
        templateId: NO_TEMPLATE_ID,
        templates,
        attachedBody: null,
      }),
    ).toEqual({ kind: 'NONE' });
  });

  it('does nothing for an unknown template id (never guesses a body)', () => {
    expect(
      resolveTemplateChoice({
        templateId: 'missing',
        templates,
        attachedBody: null,
      }),
    ).toEqual({ kind: 'NONE' });
  });
});

describe('doesBodyEditDetach', () => {
  it('detaches when an attached template body is edited', () => {
    expect(
      doesBodyEditDetach({ attachedBody: templateA.body, body: 'متن جدید' }),
    ).toBe(true);
  });

  it('does NOT detach when there is no attached template', () => {
    expect(doesBodyEditDetach({ attachedBody: null, body: 'هر متنی' })).toBe(
      false,
    );
  });

  it('does NOT detach when the body is left exactly as inserted', () => {
    expect(
      doesBodyEditDetach({
        attachedBody: templateA.body,
        body: templateA.body,
      }),
    ).toBe(false);
  });
});

describe('templateOptionLabel', () => {
  it('uses the title when present', () => {
    expect(templateOptionLabel(templateA)).toBe('خوش‌آمد');
  });

  it('falls back to the id when the title is blank', () => {
    expect(templateOptionLabel({ ...templateA, title: '   ' })).toBe('t-a');
  });
});
