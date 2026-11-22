import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// A guard against the class of defect this task exists to remove: a screen that asks the
// server for everything and filters in the browser. It reads the source, so a new component
// cannot quietly reintroduce it.
const SRC_ROOT = join(process.cwd(), 'src');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : sourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });

const read = (path: string): string => readFileSync(path, 'utf8');

describe('no unbounded read paths', () => {
  const files = sourceFiles(SRC_ROOT);

  it('finds the source it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never asks a connection for more than 500 records in one query', () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const match of read(file).matchAll(/first:\s*(\d[\d_]*)/g)) {
        const value = Number.parseInt(match[1].replaceAll('_', ''), 10);

        if (value > 500) {
          offenders.push(`${relative(SRC_ROOT, file)}: first: ${value}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not filter a full list in the browser', () => {
    // `.slice(0, N)` over a fetched collection is how a list pretends to be paged. Slicing
    // a page the server already bounded is fine, so only the fetch-then-slice pair is
    // flagged: a file that slices must also clamp its page size.
    const offenders: string[] = [];

    for (const file of files) {
      const text = read(file);

      if (text.includes('.slice(0, 100)') || text.includes('.slice(0, 200)')) {
        offenders.push(relative(SRC_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('no longer imports the whole-catalog reader from the accounting services', () => {
    const consumers = [
      'services/accounting-mapping.service.ts',
      'services/accounting-import.service.ts',
      'logic-functions/accounting-import.ts',
    ];
    const offenders = consumers.filter((consumer) =>
      read(join(SRC_ROOT, consumer)).includes('buildAccountingCatalogItemsQuery'),
    );

    expect(offenders).toEqual([]);
  });

  it('the accounting screens page the destination instead of previewing all of it', () => {
    const catalog = read(
      join(SRC_ROOT, 'components/accounting/accounting-catalog-section.tsx'),
    );
    const customers = read(
      join(SRC_ROOT, 'components/accounting/accounting-customer-section.tsx'),
    );

    expect(catalog).toContain('preview-items-page');
    expect(catalog).not.toContain("action: 'preview-items'");
    expect(customers).toContain('preview-parties-page');
    expect(customers).not.toContain("action: 'preview-parties'");
  });
});
