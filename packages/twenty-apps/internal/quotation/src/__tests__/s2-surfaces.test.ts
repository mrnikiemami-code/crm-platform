import { describe, expect, it } from 'vitest';

import catalogItem from 'src/objects/catalog-item.object';
import quotation from 'src/objects/quotation.object';
import quotationLine from 'src/objects/quotation-line.object';
import quotationAppRole from 'src/roles/quotation-app.role';
import catalogItemsView from 'src/views/catalog-items.view';
import quotationsView from 'src/views/quotations.view';

describe('S2 Persian UX surfaces', () => {
  it('labels catalog and quotation objects in Persian', () => {
    expect(catalogItem.config.labelPlural).toBe('کالا و خدمات');
    expect(quotation.config.labelPlural).toBe('پیش‌فاکتورها');
    expect(quotationLine.config.labelSingular).toContain('ردیف');
  });

  it('snapshots line kind as PRODUCT|SERVICE', () => {
    const kindField = quotationLine.config.fields?.find(
      (field) => field.name === 'kind',
    );

    expect(kindField).toBeDefined();
    expect(
      (kindField as { options?: { value: string }[] }).options?.map(
        (option) => option.value,
      ),
    ).toEqual(['PRODUCT', 'SERVICE']);
  });

  it('keeps accounting objects out of the quotation app role', () => {
    const objectIds =
      quotationAppRole.config.objectPermissions?.map(
        (permission) => permission.objectUniversalIdentifier,
      ) ?? [];

    expect(objectIds.some((id) => id.includes('dab886b2'))).toBe(false);
    expect(objectIds.some((id) => id.includes('2f711ff'))).toBe(false);
  });

  it('ships default Persian list views', () => {
    expect(catalogItemsView.errors).toEqual([]);
    expect(quotationsView.errors).toEqual([]);
    expect(catalogItemsView.config.name).toContain('کالا');
    expect(quotationsView.config.name).toContain('پیش‌فاکتور');
  });

  it('ships quotation record page with fields + lifecycle panel', async () => {
    const pageLayout = await import(
      'src/page-layouts/quotation-record.page-layout'
    );
    const lifecycle = await import(
      'src/components/quotation-lifecycle-panel.front-component'
    );

    expect(pageLayout.default.errors).toEqual([]);
    expect(pageLayout.default.config.type).toBe('RECORD_PAGE');
    expect(pageLayout.default.config.tabs?.length).toBe(2);
    expect(lifecycle.default.errors).toEqual([]);
    expect(lifecycle.default.config.name).toBe('quotation-lifecycle-panel');
  });
});
