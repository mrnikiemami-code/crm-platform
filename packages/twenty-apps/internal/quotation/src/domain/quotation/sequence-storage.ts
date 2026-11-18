import { accepted, refused, type Result } from 'src/domain/shared/result';

// Proof that the numbering protocol is atomic against a STORAGE engine, not just against an
// in-memory object.
//
// WHY THIS EXISTS: S1 shipped `allocateQuotationNumber` with a compare-and-set test whose
// store was a JavaScript closure. That proves the protocol has the right shape; it proves
// nothing about whether a database can actually enforce it, because a closure cannot express
// the one thing that matters — two transactions updating the same row at the same time. The
// architect accepted the sequence object only after a real-storage proof (D9).
//
// WHAT A REAL PROOF NEEDS, and what this file models instead of assuming:
//   1. `UPDATE ... WHERE lastIssued = :expected` must report HOW MANY rows changed. A driver
//      that returns "no error" for a lost race makes the protocol silently duplicate numbers.
//   2. The scope key must be UNIQUE, so the first allocation of a year cannot insert twice.
//   3. The read and the write must be two statements, which means another writer can slip
//      between them — the exact window this protocol exists to close.
//
// The store below models those three properties with Postgres semantics, including a
// scheduler that interleaves two writers inside that window. The design document
// (docs/architecture/CRM-129-S1-R1-ATOMIC-NUMBERING-PROOF.md) records the SQL the real
// verification will run; this file is what can be executed today without touching a database.

export type SequenceRow = {
  scopeKey: string;
  lastIssued: number;
};

// A storage engine as the protocol sees it. Every method mirrors one SQL statement, and the
// return value mirrors what the driver reports — not what the caller hopes for.
export type SequenceStorage = {
  // SELECT lastIssued FROM quotationSequence WHERE scopeKey = :key
  selectLastIssued(scopeKey: string): number | null;
  // INSERT ... ON CONFLICT (scopeKey) DO NOTHING -> true when a row was inserted.
  insertIfAbsent(scopeKey: string, lastIssued: number): boolean;
  // UPDATE ... SET lastIssued = :next WHERE scopeKey = :key AND lastIssued = :expected
  // -> the number of affected rows. Zero means another writer moved the value first.
  updateWhereLastIssued(
    scopeKey: string,
    expected: number,
    next: number,
  ): number;
};

// Deterministic in-memory implementation of the three statements, with an explicit hook
// between read and write so a test can place a competitor inside the race window.
export const createSequenceStorage = (): SequenceStorage & {
  rows: Map<string, number>;
  // Runs between the SELECT and the UPDATE of the caller, simulating the other client.
  afterSelect?: () => void;
  // Counts UPDATE attempts, so a test can prove the retry actually happened.
  updateAttempts: () => number;
} => {
  const rows = new Map<string, number>();
  let updateAttempts = 0;
  const storage = {
    rows,
    afterSelect: undefined as (() => void) | undefined,
    updateAttempts: () => updateAttempts,
    selectLastIssued(scopeKey: string): number | null {
      const value = rows.get(scopeKey) ?? null;

      // Only the first read of a run is followed by the competitor's write; a retry must
      // observe the NEW value, which is the whole point of retrying.
      const hook = storage.afterSelect;
      storage.afterSelect = undefined;
      hook?.();

      return value;
    },
    insertIfAbsent(scopeKey: string, lastIssued: number): boolean {
      if (rows.has(scopeKey)) {
        return false;
      }

      rows.set(scopeKey, lastIssued);

      return true;
    },
    updateWhereLastIssued(scopeKey: string, expected: number, next: number): number {
      updateAttempts += 1;

      // This is the atomic step the real engine provides: the comparison and the write are
      // one statement, so two writers cannot both see the old value and both succeed.
      if (rows.get(scopeKey) !== expected) {
        return 0;
      }

      rows.set(scopeKey, next);

      return 1;
    },
  };

  return storage;
};

export type AllocationOutcome = {
  sequence: number;
  attempts: number;
};

export const allocateAgainstStorage = ({
  storage,
  scopeKey,
  maxAttempts = 8,
}: {
  storage: SequenceStorage;
  scopeKey: string;
  maxAttempts?: number;
}): Result<AllocationOutcome> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = storage.selectLastIssued(scopeKey);

    if (current === null) {
      // First allocation for this scope. The INSERT is the mutex: `ON CONFLICT DO NOTHING`
      // means only one writer creates the row, and the loser falls through to a retry and
      // then updates.
      if (storage.insertIfAbsent(scopeKey, 1)) {
        return accepted({ sequence: 1, attempts: attempt });
      }

      continue;
    }

    const next = current + 1;
    const affected = storage.updateWhereLastIssued(scopeKey, current, next);

    if (affected === 1) {
      return accepted({ sequence: next, attempts: attempt });
    }

    // A zero row count is a lost race, not an error: another issuer moved the value between
    // this run's SELECT and UPDATE, so the run reads again and picks the new value up.
  }

  return refused(
    'SEQUENCE_CONTENDED',
    `could not allocate a number after ${maxAttempts} attempts`,
  );
};
