import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import studioPageLayout from 'src/page-layouts/sms-template-studio.page-layout';
import studioNavItem from 'src/navigation-menu-items/sms-template-studio.navigation-menu-item';

// Locks the W19-B1 requirement that NO English product heading remains visible in
// the Persian studio. The page layout and its widget titles are workspace-visible
// manifest copy the platform does not translate, so they must already be Persian;
// the component's own strings go through the app catalog, which must map them.
const PERSIAN_PAGE_TITLE = 'مدیریت الگوهای پیامک';

const layoutConfig = studioPageLayout.config as unknown as {
  name: string;
  tabs?: { title: string; widgets?: { title: string }[] }[];
};

const navConfig = studioNavItem.config as unknown as { name?: string };

const catalog = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'locales', 'fa-IR.json'), 'utf8'),
) as Record<string, string | Record<string, string>>;

describe('studio Persian naming (W19-B1)', () => {
  it('names the standalone page layout «مدیریت الگوهای پیامک»', () => {
    expect(layoutConfig.name).toBe(PERSIAN_PAGE_TITLE);
  });

  it('titles the studio tab and widget in Persian', () => {
    const tab = layoutConfig.tabs?.[0];

    expect(tab?.title).toBe('الگوها');
    expect(tab?.widgets?.[0].title).toBe(PERSIAN_PAGE_TITLE);
  });

  it('never contains the English product name in any manifest title', () => {
    const titles = [
      layoutConfig.name,
      ...(layoutConfig.tabs ?? []).flatMap((tab) => [
        tab.title,
        ...(tab.widgets ?? []).map((widget) => widget.title),
      ]),
    ];

    for (const title of titles) {
      expect(title).not.toContain('SMS Template Studio');
      expect(title).not.toMatch(/[A-Za-z]/);
    }
  });

  it('keeps the sidebar entry Persian as well', () => {
    expect(navConfig.name).toBe('الگوهای پیامک');
  });

  it('translates the studio heading source string to the Persian page title', () => {
    expect(catalog['SMS template management']).toBe(PERSIAN_PAGE_TITLE);
  });

  it('translates every other studio chrome string it relies on', () => {
    for (const key of [
      'SMS templates',
      'Create new template',
      'Edit template',
      'Delete template',
      'Loading people…',
      'No matching person.',
      'Sample person',
      'Search people',
      'Clear',
    ]) {
      const translation = catalog[key];

      expect(
        typeof translation === 'string' && translation.length > 0,
        key,
      ).toBe(true);
    }
  });
});
