import { describe, expect, it } from 'vitest';

import {
  allocateAgainstStorage,
  createSequenceStorage,
  type SequenceStorage,
} from 'src/domain/quotation/sequence-storage';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const SCOPE = 'QUOTATION:1403';

describe('storage-backed allocation', () => {
  it('starts a scope at one with a single insert', () => {
    const storage = createSequenceStorage();
    const outcome = unwrap(
      allocateAgainstStorage({ storage, scopeKey: SCOPE }),
    );

    expect(outcome).toEqual({ sequence: 1, attempts: 1, serializationFailures: 0 });
    expect(storage.rows.get(SCOPE)).toBe(1);
  });

  it('increments from the stored value', () => {
    const storage = createSequenceStorage();
    storage.rows.set(SCOPE, 41);

    expect(unwrap(allocateAgainstStorage({ storage, scopeKey: SCOPE })).sequence).toBe(
      42,
    );
    expect(storage.rows.get(SCOPE)).toBe(42);
  });

  it('loses the race when a competitor writes between SELECT and UPDATE, then retries', () => {
    // This is the window the protocol exists to close, reproduced explicitly: without the
    // zero-rowcount check the second writer would hand out 11 twice.
    const storage = createSequenceStorage();
    storage.rows.set(SCOPE, 10);
    storage.afterSelect = () => {
      storage.rows.set(SCOPE, 11);
    };

    const outcome = unwrap(
      allocateAgainstStorage({ storage, scopeKey: SCOPE }),
    );

    expect(outcome.sequence).toBe(12);
    expect(outcome.attempts).toBe(2);
    // The first UPDATE was refused by the engine, the second one won.
    expect(storage.updateAttempts()).toBe(2);
  });

  it('treats a zero rowcount as a lost race rather than a failure', () => {
    const storage = createSequenceStorage();
    storage.rows.set(SCOPE, 5);

    const losingUpdate: SequenceStorage = {
      ...storage,
      updateWhereLastIssued: () => 0,
    };
    const result = allocateAgainstStorage({
      storage: losingUpdate,
      scopeKey: SCOPE,
      maxAttempts: 3,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.refusal.code).toBe('SEQUENCE_CONTENDED');
  });

  it('loses the insert race on a fresh scope and still allocates exactly once', () => {
    // Two clients both see no row. Only one INSERT wins; the loser must fall through to an
    // UPDATE, not insert again — otherwise the scope gets two rows and therefore two
    // independent counters.
    const storage = createSequenceStorage();
    let competitorInserted = false;

    const racing: SequenceStorage = {
      selectLastIssued: (scopeKey) => {
        if (!competitorInserted) {
          competitorInserted = true;
          // The competitor creates the row first.
          storage.rows.set(scopeKey, 1);
        }

        return storage.selectLastIssued(scopeKey);
      },
      insertIfAbsent: storage.insertIfAbsent,
      updateWhereLastIssued: storage.updateWhereLastIssued,
    };

    const outcome = unwrap(
      allocateAgainstStorage({ storage: racing, scopeKey: SCOPE }),
    );

    expect(outcome.sequence).toBe(2);
    expect(storage.rows.size).toBe(1);
  });

  it('never issues the same number twice across interleaved writers', () => {
    // A deterministic interleaving: each call to the shared engine lets one competitor slip
    // in. Every winner must still get a unique number, which is the property a duplicate
    // would break.
    const storage = createSequenceStorage();
    let pendingIntruder: (() => void) | null = null;

    const engine: SequenceStorage = {
      selectLastIssued(scopeKey) {
        const value = storage.selectLastIssued(scopeKey);

        if (pendingIntruder !== null) {
          const run = pendingIntruder;
          pendingIntruder = null;
          run();
        }

        return value;
      },
      insertIfAbsent: storage.insertIfAbsent,
      updateWhereLastIssued: storage.updateWhereLastIssued,
    };

    const issued: number[] = [];

    for (let index = 0; index < 20; index += 1) {
      // Every other allocation gets an intruder that grabs the next number first.
      if (index % 2 === 1) {
        pendingIntruder = () => {
          const current = storage.rows.get(SCOPE) ?? 0;
          storage.rows.set(SCOPE, current + 1);
          issued.push(current + 1);
        };
      }

      const outcome = allocateAgainstStorage({
        storage: engine,
        scopeKey: SCOPE,
        maxAttempts: 12,
      });

      if (outcome.ok) {
        issued.push(outcome.value.sequence);
      }
    }

    // The database's uniqueness, modelled here by the rowcount check, is what guarantees this.
    expect(new Set(issued).size).toBe(issued.length);
  });

  it('keeps fiscal years independent', () => {
    const storage = createSequenceStorage();

    unwrap(allocateAgainstStorage({ storage, scopeKey: 'QUOTATION:1403' }));
    unwrap(allocateAgainstStorage({ storage, scopeKey: 'QUOTATION:1404' }));

    expect(storage.rows.get('QUOTATION:1403')).toBe(1);
    expect(storage.rows.get('QUOTATION:1404')).toBe(1);
  });

  it('treats a serialisation failure as a lost race and re-reads', () => {
    // MEASURED against a real Postgres: under REPEATABLE READ the losing writer does not get a zero
    // row count, it gets SQLSTATE 40001. A protocol that only handled the zero would fail here.
    const storage = createSequenceStorage();

    storage.rows.set(SCOPE, 7);

    let thrown = false;
    const repeatableRead: SequenceStorage = {
      ...storage,
      updateWhereLastIssued: (scopeKey, expected, next) => {
        if (!thrown) {
          thrown = true;
          // Simulate the other transaction committing first.
          storage.rows.set(scopeKey, expected + 1);

          const error = new Error('could not serialize access due to concurrent update');
          (error as { code?: string }).code = '40001';
          throw error;
        }

        return storage.updateWhereLastIssued(scopeKey, expected, next);
      },
    };

    const outcome = unwrap(
      allocateAgainstStorage({ storage: repeatableRead, scopeKey: SCOPE }),
    );

    expect(outcome.sequence).toBe(9);
    expect(outcome.attempts).toBe(2);
    expect(outcome.serializationFailures).toBe(1);
  });

  it('does not swallow an error that is not a lost race', () => {
    const storage = createSequenceStorage();
    const broken: SequenceStorage = {
      ...storage,
      selectLastIssued: () => {
        throw new Error('connection reset');
      },
    };

    expect(() =>
      allocateAgainstStorage({ storage: broken, scopeKey: SCOPE }),
    ).toThrow('connection reset');
  });
});
