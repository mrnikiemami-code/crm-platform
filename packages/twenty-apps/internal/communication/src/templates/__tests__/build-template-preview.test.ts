import { describe, expect, it } from 'vitest';

import { type BulkRecipient } from 'src/bulk/resolve-bulk-recipients';
import { buildTemplateCatalogFromMetadata } from 'src/templates/build-template-catalog';
import { buildTemplatePreview } from 'src/templates/build-template-preview';
import { type TemplateValueMap } from 'src/templates/template-variable-catalog';
import {
  templateMetadataObjects,
  unrestrictedPermissions,
  PERSON_CATALOG_SOURCE,
} from 'src/templates/__tests__/catalog-fixture';

const catalog = buildTemplateCatalogFromMetadata({
  objects: templateMetadataObjects,
  permissions: unrestrictedPermissions,
  source: PERSON_CATALOG_SOURCE,
});

const recipient = (personId: string, selectedPhone: string | null): BulkRecipient => ({
  personId,
  displayName: personId,
  status: selectedPhone === null ? 'NO_PHONE' : 'SENDABLE',
  phones: [],
  selectedPhone,
});

const values = (
  entries: Record<string, string | null>,
): TemplateValueMap => new Map(Object.entries(entries));

const data: Map<string, TemplateValueMap> = new Map([
  [
    'p1',
    values({
      'person.firstName': 'سارا',
      'person.lastName': 'احمدی',
      'person.fullName': 'سارا احمدی',
      'person.jobTitle': 'مدیر فروش',
      'person.loyaltyTier': 'طلایی',
      'company.name': 'شرکت الف',
    }),
  ],
]);

describe('buildTemplatePreview empty-body rule', () => {
  it('never marks a recipient ready when the body is empty', () => {
    const preview = buildTemplatePreview({
      body: '',
      recipients: [recipient('p1', '09120000001')],
      valuesByPersonId: data,
      catalog,
    });

    expect(preview.isBodyEmpty).toBe(true);
    expect(preview.readyCount).toBe(0);
    expect(preview.previews[0].isReadyToSend).toBe(false);
  });

  it('never marks a recipient ready when the body is whitespace only', () => {
    for (const body of ['   ', '\n\t ', '  \n  ']) {
      const preview = buildTemplatePreview({
        body,
        recipients: [recipient('p1', '09120000001')],
        valuesByPersonId: data,
        catalog,
      });

      expect(preview.isBodyEmpty).toBe(true);
      expect(preview.readyCount).toBe(0);
      expect(preview.previews[0].isReadyToSend).toBe(false);
    }
  });

  it('marks a recipient with a real body and a phone as ready', () => {
    const preview = buildTemplatePreview({
      body: 'سلام @name',
      recipients: [recipient('p1', '09120000001')],
      valuesByPersonId: data,
      catalog,
    });

    expect(preview.isBodyEmpty).toBe(false);
    expect(preview.readyCount).toBe(1);
    expect(preview.previews[0].isReadyToSend).toBe(true);
    expect(preview.previews[0].previewText).toBe('سلام سارا');
  });

  it('resolves a custom field in the preview text', () => {
    const preview = buildTemplatePreview({
      body: 'سطح @person.loyaltyTier',
      recipients: [recipient('p1', '09120000001')],
      valuesByPersonId: data,
      catalog,
    });

    expect(preview.previews[0].previewText).toBe('سطح طلایی');
    expect(preview.previews[0].isReadyToSend).toBe(true);
  });

  it('is not ready without a phone even when the body is real', () => {
    const preview = buildTemplatePreview({
      body: 'سلام @name',
      recipients: [recipient('p1', null)],
      valuesByPersonId: data,
      catalog,
    });

    expect(preview.readyCount).toBe(0);
    expect(preview.previews[0].isReadyToSend).toBe(false);
  });

  it('is not ready when a variable has no resolved value', () => {
    const preview = buildTemplatePreview({
      body: 'سمت @person.jobTitle',
      recipients: [recipient('p1', '09120000001')],
      valuesByPersonId: new Map([['p1', values({ 'person.jobTitle': null })]]),
      catalog,
    });

    expect(preview.hasUnresolvedVariables).toBe(true);
    expect(preview.readyCount).toBe(0);
    expect(preview.previews[0].issues).toEqual([
      { token: '@person.jobTitle', kind: 'EMPTY_FIELD' },
    ]);
  });
});
