import { describe, expect, it } from 'vitest';

import { interpolateTemplate } from 'src/templates/interpolate-template';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

const sara: TemplateRecipientData = {
  firstName: 'سارا',
  lastName: 'احمدی',
  fullName: 'سارا احمدی',
  companyName: 'شرکت الف',
};

const reza: TemplateRecipientData = {
  firstName: 'رضا',
  lastName: 'کریمی',
  fullName: 'رضا کریمی',
  companyName: 'شرکت ب',
};

describe('interpolateTemplate', () => {
  it('resolves @name to the first name and @company to the company name', () => {
    const result = interpolateTemplate({
      body: 'سلام @name عزیز از @company',
      recipient: sara,
    });

    expect(result.text).toBe('سلام سارا عزیز از شرکت الف');
    expect(result.hasUnresolvedVariables).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('maps @firstName and @companyName aliases to the same values', () => {
    const result = interpolateTemplate({
      body: '@firstName / @companyName',
      recipient: reza,
    });

    expect(result.text).toBe('رضا / شرکت ب');
    expect(result.hasUnresolvedVariables).toBe(false);
  });

  it('resolves @lastName and @fullName', () => {
    const result = interpolateTemplate({
      body: '@fullName (@lastName)',
      recipient: sara,
    });

    expect(result.text).toBe('سارا احمدی (احمدی)');
  });

  it('produces different text for two people from the SAME template', () => {
    const template = 'سلام @name، پیشنهاد ویژه برای @company آماده است.';

    const saraResult = interpolateTemplate({ body: template, recipient: sara });
    const rezaResult = interpolateTemplate({ body: template, recipient: reza });

    expect(saraResult.text).toBe(
      'سلام سارا، پیشنهاد ویژه برای شرکت الف آماده است.',
    );
    expect(rezaResult.text).toBe(
      'سلام رضا، پیشنهاد ویژه برای شرکت ب آماده است.',
    );
    expect(saraResult.text).not.toBe(rezaResult.text);
  });

  it('reports an EMPTY_FIELD for a variable whose field is empty and keeps it visible', () => {
    const result = interpolateTemplate({
      body: 'سلام @name از @company',
      recipient: { firstName: 'سارا', lastName: null, fullName: null, companyName: null },
    });

    expect(result.hasUnresolvedVariables).toBe(true);
    expect(result.text).toBe('سلام سارا از @company');
    expect(result.issues).toEqual([
      { token: '@company', kind: 'EMPTY_FIELD' },
    ]);
  });

  it('reports an UNKNOWN_VARIABLE for a token not in the catalog and keeps it visible', () => {
    const result = interpolateTemplate({
      body: 'سلام @name @ssn',
      recipient: sara,
    });

    expect(result.hasUnresolvedVariables).toBe(true);
    expect(result.text).toBe('سلام سارا @ssn');
    expect(result.issues).toEqual([
      { token: '@ssn', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('reports each unresolved token once even when repeated', () => {
    const result = interpolateTemplate({
      body: '@name @name @ghost @ghost',
      recipient: sara,
    });

    expect(result.issues).toEqual([
      { token: '@ghost', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('never evaluates an expression, a path or an injection', () => {
    const body = '@name + process.env.SECRET @name.foo @{1+1} @name()';
    const result = interpolateTemplate({ body, recipient: sara });

    // Only the bare `@name` identifier is a placeholder; a trailing `.foo` or
    // `()` is NOT resolved (no traversal, no call), and `@{1+1}` is literal.
    expect(result.text).toBe(
      'سارا + process.env.SECRET سارا.foo @{1+1} سارا()',
    );
    expect(result.hasUnresolvedVariables).toBe(false);
  });

  it('leaves a body with no placeholders untouched', () => {
    const result = interpolateTemplate({
      body: 'یک پیام ساده بدون متغیر',
      recipient: sara,
    });

    expect(result.text).toBe('یک پیام ساده بدون متغیر');
    expect(result.hasUnresolvedVariables).toBe(false);
  });
});
