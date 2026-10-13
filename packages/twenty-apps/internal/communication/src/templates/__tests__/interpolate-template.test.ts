import { describe, expect, it } from 'vitest';

import { interpolateTemplate } from 'src/templates/interpolate-template';
import { buildTemplateCatalogFromMetadata } from 'src/templates/build-template-catalog';
import { type TemplateValueMap } from 'src/templates/template-variable-catalog';
import {
  templateMetadataObjects,
  unrestrictedPermissions,
} from 'src/templates/__tests__/catalog-fixture';

const catalog = buildTemplateCatalogFromMetadata({
  objects: templateMetadataObjects,
  permissions: unrestrictedPermissions,
});

// Values keyed by CANONICAL token, exactly as `resolve-template-values` builds
// them from an authorized record read.
const valuesOf = (entries: Record<string, string | null>): TemplateValueMap =>
  new Map(Object.entries(entries));

const sara = valuesOf({
  'person.firstName': 'سارا',
  'person.lastName': 'احمدی',
  'person.fullName': 'سارا احمدی',
  'person.jobTitle': 'مدیر فروش',
  'person.loyaltyTier': 'طلایی',
  'company.name': 'شرکت الف',
});

const reza = valuesOf({
  'person.firstName': 'رضا',
  'person.lastName': 'کریمی',
  'person.fullName': 'رضا کریمی',
  'person.jobTitle': null,
  'person.loyaltyTier': null,
  'company.name': 'شرکت ب',
});

describe('interpolateTemplate', () => {
  it('resolves @name to the first name and @company to the company name', () => {
    const result = interpolateTemplate({
      body: 'سلام @name عزیز از @company',
      values: sara,
      catalog,
    });

    expect(result.text).toBe('سلام سارا عزیز از شرکت الف');
    expect(result.hasUnresolvedVariables).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('maps @firstName and @companyName aliases to the same values', () => {
    const result = interpolateTemplate({
      body: '@firstName / @companyName',
      values: reza,
      catalog,
    });

    expect(result.text).toBe('رضا / شرکت ب');
    expect(result.hasUnresolvedVariables).toBe(false);
  });

  it('resolves @lastName and @fullName', () => {
    const result = interpolateTemplate({
      body: '@fullName (@lastName)',
      values: sara,
      catalog,
    });

    expect(result.text).toBe('سارا احمدی (احمدی)');
  });

  it('resolves the namespaced @person.* and @company.* tokens', () => {
    const result = interpolateTemplate({
      body: '@person.fullName — @person.jobTitle در @company.name',
      values: sara,
      catalog,
    });

    expect(result.text).toBe('سارا احمدی — مدیر فروش در شرکت الف');
    expect(result.hasUnresolvedVariables).toBe(false);
  });

  it('resolves a workspace CUSTOM field token', () => {
    const result = interpolateTemplate({
      body: 'سطح: @person.loyaltyTier',
      values: sara,
      catalog,
    });

    expect(result.text).toBe('سطح: طلایی');
    expect(result.hasUnresolvedVariables).toBe(false);
  });

  it('resolves a legacy alias and a namespaced token to the SAME value', () => {
    const legacy = interpolateTemplate({ body: '@company', values: sara, catalog });
    const namespaced = interpolateTemplate({
      body: '@company.name',
      values: sara,
      catalog,
    });

    expect(legacy.text).toBe(namespaced.text);
    expect(legacy.text).toBe('شرکت الف');
  });

  it('produces different text for two people from the SAME template', () => {
    const template = 'سلام @name، پیشنهاد ویژه برای @company آماده است.';

    const saraResult = interpolateTemplate({ body: template, values: sara, catalog });
    const rezaResult = interpolateTemplate({ body: template, values: reza, catalog });

    expect(saraResult.text).toBe(
      'سلام سارا، پیشنهاد ویژه برای شرکت الف آماده است.',
    );
    expect(rezaResult.text).toBe(
      'سلام رضا، پیشنهاد ویژه برای شرکت ب آماده است.',
    );
    expect(saraResult.text).not.toBe(rezaResult.text);
  });

  it('reports an EMPTY_FIELD for a variable whose value is empty and keeps it visible', () => {
    const result = interpolateTemplate({
      body: 'سمت: @person.jobTitle',
      values: reza,
      catalog,
    });

    expect(result.hasUnresolvedVariables).toBe(true);
    expect(result.text).toBe('سمت: @person.jobTitle');
    expect(result.issues).toEqual([
      { token: '@person.jobTitle', kind: 'EMPTY_FIELD' },
    ]);
  });

  it('reports an EMPTY_FIELD when the value is missing entirely', () => {
    const result = interpolateTemplate({
      body: 'از @company.name',
      values: new Map(),
      catalog,
    });

    expect(result.hasUnresolvedVariables).toBe(true);
    expect(result.issues).toEqual([
      { token: '@company.name', kind: 'EMPTY_FIELD' },
    ]);
  });

  it('reports an UNKNOWN_VARIABLE for a token not in the catalog and keeps it visible', () => {
    const result = interpolateTemplate({
      body: 'سلام @name @ssn',
      values: sara,
      catalog,
    });

    expect(result.hasUnresolvedVariables).toBe(true);
    expect(result.text).toBe('سلام سارا @ssn');
    expect(result.issues).toEqual([
      { token: '@ssn', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('reports a token that a PERMISSION removed as unknown, not resolved', () => {
    // The catalogue from a workspace where jobTitle is not readable.
    const restricted = buildTemplateCatalogFromMetadata({
      objects: templateMetadataObjects,
      permissions: {
        ...unrestrictedPermissions,
        unreadableFieldMetadataIds: ['33333333-3333-4333-8333-333333333333'],
      },
    });

    const result = interpolateTemplate({
      body: '@person.jobTitle',
      values: sara,
      catalog: restricted,
    });

    expect(result.issues).toEqual([
      { token: '@person.jobTitle', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('reports each unresolved token once even when repeated', () => {
    const result = interpolateTemplate({
      body: '@name @name @ghost @ghost',
      values: sara,
      catalog,
    });

    expect(result.issues).toEqual([
      { token: '@ghost', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('never evaluates an expression, a path, a call or an injection', () => {
    const body = '@name + process.env.SECRET @name.foo @{1+1} @name() @..x';
    const result = interpolateTemplate({ body, values: sara, catalog });

    // Only catalog tokens resolve. A dotted token is ONE namespaced token, so
    // `@name.foo` is an UNKNOWN variable — never `@name` followed by a property
    // traversal. `@{1+1}` is literal, `@name()` resolves `@name` and leaves the
    // parentheses, and `@..x` is not a token at all.
    expect(result.text).toBe(
      'سارا + process.env.SECRET @name.foo @{1+1} سارا() @..x',
    );
    expect(result.issues).toEqual([
      { token: '@name.foo', kind: 'UNKNOWN_VARIABLE' },
    ]);
  });

  it('leaves a body with no placeholders untouched', () => {
    const result = interpolateTemplate({
      body: 'یک پیام ساده بدون متغیر',
      values: sara,
      catalog,
    });

    expect(result.text).toBe('یک پیام ساده بدون متغیر');
    expect(result.hasUnresolvedVariables).toBe(false);
  });
});
