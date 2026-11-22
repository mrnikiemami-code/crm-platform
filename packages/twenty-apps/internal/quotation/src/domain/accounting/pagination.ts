// The paging contract shared by every long accounting list: the destination catalog, the
// destination customers, the CRM catalog and the CRM customers.
//
// WHY A SHARED CONTRACT: the four lists live in different places (a vendor adapter, a
// snapshot in this process, a GraphQL connection) but a person sees them as one screen.
// Each one needs the same three answers — "what is on this page", "is there more", "do we
// know the total" — and the same hard ceiling, or the smallest one becomes the speed limit
// of the screen and the absence of a ceiling becomes an outage at 100k rows.
//
// The ceiling is enforced HERE, not at the call site, because a call site is exactly where
// it gets forgotten: a page size of 1_000_000 typed into a query string must not become a
// full table read.

export const ACCOUNTING_PAGE_SIZE_DEFAULT = 25;

// One screenful at most. A caller asking for more is clamped rather than refused: a stale
// client sending 500 should still see rows, just not 500 of them.
export const ACCOUNTING_PAGE_SIZE_MAX = 100;

export type PagedRows<TRow> = {
  rows: TRow[];
  // Opaque to the client. A cursor is only meaningful for the source that issued it.
  nextCursor: string | null;
  hasNextPage: boolean;
  // `null` means "this source cannot say". A guessed total is worse than an honest
  // unknown: it turns into "صفحه ۱ از ۴۰" on a list that has 40 000 rows.
  totalKnown: number | null;
};

export type PageRequest = {
  cursor: string | null;
  pageSize: number;
  search: string;
};

export const clampPageSize = (value: unknown): number => {
  const numeric =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.floor(value)
      : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return ACCOUNTING_PAGE_SIZE_DEFAULT;
  }

  return Math.min(numeric, ACCOUNTING_PAGE_SIZE_MAX);
};

export const readPageRequest = (
  body: Record<string, unknown>,
): PageRequest => ({
  cursor:
    typeof body.cursor === 'string' && body.cursor.trim() !== ''
      ? body.cursor.trim()
      : null,
  pageSize: clampPageSize(body.pageSize),
  search: typeof body.search === 'string' ? body.search.trim() : '',
});

// A cursor names a position inside one immutable snapshot. Encoding the snapshot id into it
// is what makes a stale cursor SAFE: after the destination is re-read, an old cursor would
// otherwise point at a row that has moved, silently skipping or repeating records. Instead
// the position is rejected and the person starts from the first page of the new snapshot.
const CURSOR_SEPARATOR = '~';

export const encodeSnapshotCursor = (
  snapshotId: string,
  offset: number,
): string =>
  Buffer.from(`${snapshotId}${CURSOR_SEPARATOR}${offset}`, 'utf8').toString(
    'base64url',
  );

export type SnapshotPosition = { snapshotId: string; offset: number };

export const decodeSnapshotCursor = (
  cursor: string | null,
): SnapshotPosition | null => {
  if (cursor === null || cursor === '') {
    return { snapshotId: '', offset: 0 };
  }

  let decoded: string;

  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);

  if (separatorIndex <= 0) {
    return null;
  }

  const snapshotId = decoded.slice(0, separatorIndex);
  const offset = Number.parseInt(decoded.slice(separatorIndex + 1), 10);

  if (
    snapshotId === '' ||
    !Number.isFinite(offset) ||
    offset < 0 ||
    String(offset) !== decoded.slice(separatorIndex + 1)
  ) {
    return null;
  }

  return { snapshotId, offset };
};

// A cursor issued by a destination that pages itself. It is opaque to the CRM: only the
// adapter that issued it may interpret it, and the CRM never builds one by hand. The helpers
// below exist for adapters and tests that need a concrete, deterministic token — the mock
// adapter uses an encoded offset so the `REMOTE_PAGED` path can be exercised with no vendor.
const REMOTE_CURSOR_PREFIX = 'o:';

export const encodeRemoteOffsetCursor = (offset: number): string =>
  Buffer.from(`${REMOTE_CURSOR_PREFIX}${offset}`, 'utf8').toString('base64url');

export const decodeRemoteOffsetCursor = (
  cursor: string | null,
): number | null => {
  if (cursor === null || cursor === '') {
    return 0;
  }

  let decoded: string;

  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  if (!decoded.startsWith(REMOTE_CURSOR_PREFIX)) {
    return null;
  }

  const offsetText = decoded.slice(REMOTE_CURSOR_PREFIX.length);
  const offset = Number.parseInt(offsetText, 10);

  return Number.isFinite(offset) && offset >= 0 && String(offset) === offsetText
    ? offset
    : null;
};

// The vendor side cannot page. This is the shape that says so out loud instead of letting
// the first 100 rows look like the whole catalog.
export type SnapshotTruncation =
  | { kind: 'NONE'; declaredTotal: number | null }
  | { kind: 'BOUNDED'; taken: number; limit: number; declaredTotal: number | null };

export type SnapshotMeta = {
  snapshotId: string;
  createdAtMs: number;
  truncation: SnapshotTruncation;
  // Whether the destination itself can page. `NONE` is a vendor limitation reported to the
  // user, not an error: Asan documents no cursor for AllProducts/AllCustomers.
  vendorPagination: 'CURSOR' | 'NONE';
  // Which read strategy produced these rows. Reported so a screen can explain what it is
  // showing without knowing which vendor answered.
  readStrategy: 'REMOTE_PAGED' | 'REMOTE_UNPAGED';
  // `INCOMPLETE` means the rows shown are a bounded prefix of the destination, so every
  // count derived from them — linked, unlinked, duplicates — describes that prefix only.
  syncStatus: 'COMPLETE' | 'INCOMPLETE';
  incompleteReason: 'SNAPSHOT_LIMIT_REACHED' | null;
};

// One page of a materialised row set. Used by the snapshot-backed lists after the plan has
// been computed once; the caller never re-plans per keystroke.
export const pageRows = <TRow>({
  rows,
  snapshotId,
  request,
}: {
  rows: TRow[];
  snapshotId: string;
  request: PageRequest;
}): PagedRows<TRow> => {
  const position = decodeSnapshotCursor(request.cursor);

  // A cursor from another snapshot (or garbage) restarts the list rather than guessing.
  // Guessing here is what produces "row 5 of page 3" pointing at a different record.
  const offset =
    position === null || position.snapshotId !== snapshotId
      ? 0
      : position.offset;

  const safeOffset = Math.min(Math.max(offset, 0), rows.length);
  const end = Math.min(safeOffset + request.pageSize, rows.length);
  const page = rows.slice(safeOffset, end);
  const hasNextPage = end < rows.length;

  return {
    rows: page,
    nextCursor: hasNextPage
      ? encodeSnapshotCursor(snapshotId, end)
      : null,
    hasNextPage,
    totalKnown: rows.length,
  };
};

// Search over a materialised set. Deliberately simple and bounded: it runs over a snapshot
// that already has a hard ceiling, so it can never be the unbounded scan it would be over
// a live table.
export const filterRowsByNeedle = <TRow>({
  rows,
  needle,
  fields,
}: {
  rows: TRow[];
  needle: string;
  fields: (row: TRow) => string[];
}): TRow[] => {
  const normalized = needle.trim().toLowerCase();

  if (normalized === '') {
    return rows;
  }

  return rows.filter((row) =>
    fields(row).some((field) => field.toLowerCase().includes(normalized)),
  );
};
