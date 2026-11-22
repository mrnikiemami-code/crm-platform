import { describe, expect, it } from 'vitest';

import {
  ACCOUNTING_PAGE_SIZE_DEFAULT,
  ACCOUNTING_PAGE_SIZE_MAX,
  clampPageSize,
  decodeSnapshotCursor,
  encodeSnapshotCursor,
  filterRowsByNeedle,
  pageRows,
  readPageRequest,
} from 'src/domain/accounting/pagination';

describe('accounting pagination contract', () => {
  describe('the page ceiling', () => {
    it('clamps an oversized request instead of honouring it', () => {
      expect(clampPageSize(1_000_000)).toBe(ACCOUNTING_PAGE_SIZE_MAX);
      expect(clampPageSize(500)).toBe(ACCOUNTING_PAGE_SIZE_MAX);
    });

    it('falls back to the default for a missing or nonsensical size', () => {
      expect(clampPageSize(undefined)).toBe(ACCOUNTING_PAGE_SIZE_DEFAULT);
      expect(clampPageSize(0)).toBe(ACCOUNTING_PAGE_SIZE_DEFAULT);
      expect(clampPageSize(-5)).toBe(ACCOUNTING_PAGE_SIZE_DEFAULT);
      expect(clampPageSize('abc')).toBe(ACCOUNTING_PAGE_SIZE_DEFAULT);
    });

    it('accepts a numeric string, because a form body is text', () => {
      expect(clampPageSize('40')).toBe(40);
    });
  });

  describe('cursors', () => {
    it('round-trips a position inside a named snapshot', () => {
      const cursor = encodeSnapshotCursor('snap-1', 25);

      expect(decodeSnapshotCursor(cursor)).toEqual({
        snapshotId: 'snap-1',
        offset: 25,
      });
    });

    it('treats a missing cursor as the start of the snapshot', () => {
      expect(decodeSnapshotCursor(null)).toEqual({
        snapshotId: '',
        offset: 0,
      });
    });

    it('rejects a cursor it cannot parse rather than guessing a position', () => {
      expect(decodeSnapshotCursor('not-base64-json')).toBeNull();
      expect(decodeSnapshotCursor('')).toEqual({ snapshotId: '', offset: 0 });
    });
  });

  describe('paging a materialised set', () => {
    const rows = Array.from({ length: 250 }, (_, index) => index);

    it('returns at most one page and reports that more remain', () => {
      const page = pageRows({
        rows,
        snapshotId: 'snap-1',
        request: { cursor: null, pageSize: 25, search: '' },
      });

      expect(page.rows).toHaveLength(25);
      expect(page.rows[0]).toBe(0);
      expect(page.hasNextPage).toBe(true);
      expect(page.nextCursor).not.toBeNull();
      expect(page.totalKnown).toBe(250);
    });

    it('continues from the cursor without repeating or skipping a row', () => {
      const first = pageRows({
        rows,
        snapshotId: 'snap-1',
        request: { cursor: null, pageSize: 25, search: '' },
      });
      const second = pageRows({
        rows,
        snapshotId: 'snap-1',
        request: { cursor: first.nextCursor, pageSize: 25, search: '' },
      });

      expect(second.rows[0]).toBe(25);
      expect(second.rows).toHaveLength(25);
    });

    it('stops with a null cursor on the last page', () => {
      const lastOffset = 240;
      const page = pageRows({
        rows,
        snapshotId: 'snap-1',
        request: {
          cursor: encodeSnapshotCursor('snap-1', lastOffset),
          pageSize: 25,
          search: '',
        },
      });

      expect(page.rows).toHaveLength(10);
      expect(page.hasNextPage).toBe(false);
      expect(page.nextCursor).toBeNull();
    });

    // This is the property that makes a stale screen safe: after the destination is re-read
    // the old cursor must not be reinterpreted, or page 2 would show rows from page 9.
    it('restarts when the cursor belongs to a different snapshot', () => {
      const stale = encodeSnapshotCursor('snap-old', 200);
      const page = pageRows({
        rows,
        snapshotId: 'snap-new',
        request: { cursor: stale, pageSize: 25, search: '' },
      });

      expect(page.rows[0]).toBe(0);
    });

    it('clamps an offset past the end instead of returning undefined rows', () => {
      const page = pageRows({
        rows,
        snapshotId: 'snap-1',
        request: {
          cursor: encodeSnapshotCursor('snap-1', 10_000),
          pageSize: 25,
          search: '',
        },
      });

      expect(page.rows).toEqual([]);
      expect(page.hasNextPage).toBe(false);
    });
  });

  describe('bounded search over a snapshot', () => {
    it('matches any of the named fields, case-insensitively', () => {
      const rows = [
        { code: '100', name: 'لوله پلیکا' },
        { code: '200', name: 'شیر فلکه' },
      ];

      expect(
        filterRowsByNeedle({
          rows,
          needle: 'شیر',
          fields: (row) => [row.code, row.name],
        }),
      ).toHaveLength(1);
      expect(
        filterRowsByNeedle({
          rows,
          needle: '  100 ',
          fields: (row) => [row.code, row.name],
        }),
      ).toHaveLength(1);
    });

    it('returns everything for an empty needle', () => {
      const rows = [{ code: '1' }, { code: '2' }];

      expect(
        filterRowsByNeedle({ rows, needle: '', fields: (row) => [row.code] }),
      ).toHaveLength(2);
    });
  });

  describe('reading a page request from a body', () => {
    it('normalises search and cursor and applies the ceiling', () => {
      expect(
        readPageRequest({
          search: '  لوله  ',
          cursor: ' abc ',
          pageSize: 99_999,
        }),
      ).toEqual({ search: 'لوله', cursor: 'abc', pageSize: 100 });
    });

    it('ignores a blank cursor', () => {
      expect(readPageRequest({ cursor: '   ' }).cursor).toBeNull();
    });
  });
});
