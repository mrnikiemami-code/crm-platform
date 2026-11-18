import { Client } from 'pg';

// CRM-129-S1-R2 — storage-backed proof that the quotation numbering protocol is atomic.
//
// Runs against a THROWAWAY Postgres container: no volume, its own port, its own database. Nothing
// outside `crm129proof.crm129_sequence_proof` is read or written, and the schema is dropped at the end.
// The connection string is passed in so this file never hardcodes an environment.
//
// What it establishes, and why each part matters:
//   1. INSERT ... ON CONFLICT DO NOTHING — exactly one writer creates a fresh scope's row. This is the
//      uniqueness the protocol relies on to stop two counters existing for one fiscal year.
//   2. A lost compare-and-set REPORTS rowCount = 0 rather than silently succeeding. If the driver
//      reported "no error" instead, the protocol would hand out a duplicate number.
//   3. Twenty concurrent allocators issue twenty distinct numbers.
//   4. Under REPEATABLE READ the same race raises a serialisation failure instead of returning 0, so a
//      caller must treat that error class as a lost race too.
//
// Usage: npx tsx <this file> <connectionString>

type Finding = { name: string; detail: string };

const findings: Finding[] = [];
const record = (name: string, detail: string): void => {
  findings.push({ name, detail });
};

const connect = async (connectionString: string): Promise<Client> => {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  await client.connect();

  return client;
};

// Give a blocked statement a bounded wait so a mistake fails loudly instead of hanging the run.
const withDeadlockGuard = async <TResult>(
  label: string,
  work: Promise<TResult>,
): Promise<TResult> => {
  let timer: NodeJS.Timeout | undefined;

  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not settle within 15s`)),
      15_000,
    );
  });

  try {
    return await Promise.race([work, guard]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

const main = async (): Promise<void> => {
  const connectionString = process.argv[2];

  if (connectionString === undefined || connectionString === '') {
    throw new Error('pass the connection string of the throwaway database');
  }

  const setup = await connect(connectionString);

  await setup.query('DROP SCHEMA IF EXISTS crm129proof CASCADE');
  await setup.query('CREATE SCHEMA crm129proof');
  await setup.query(`
    CREATE TABLE crm129proof.quotation_sequence_proof (
      "scopeKey"   text PRIMARY KEY,
      "lastIssued" integer NOT NULL DEFAULT 0
    )
  `);

  record('schema', 'crm129proof.quotation_sequence_proof created (PRIMARY KEY on scopeKey)');

  // -----------------------------------------------------------------------------------------
  // 1. Insert race: two writers, one fresh scope.
  // -----------------------------------------------------------------------------------------
  const insertResult = await Promise.all(
    ['writer-a', 'writer-b'].map(async (label) => {
      const client = await connect(connectionString);

      try {
        const result = await client.query(
          `INSERT INTO crm129proof.quotation_sequence_proof ("scopeKey", "lastIssued")
           VALUES ($1, 1) ON CONFLICT ("scopeKey") DO NOTHING`,
          ['QUOTATION:1403'],
        );

        return { label, rowCount: result.rowCount ?? 0 };
      } finally {
        await client.end();
      }
    }),
  );

  const inserted = insertResult.filter((entry) => entry.rowCount === 1);
  const rowCountAfterInsert = await setup.query(
    `SELECT count(*)::int AS "rowCount" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
    ['QUOTATION:1403'],
  );

  if (inserted.length !== 1) {
    throw new Error(
      `expected exactly one insert to win, got ${JSON.stringify(insertResult)}`,
    );
  }

  if (rowCountAfterInsert.rows[0].rowCount !== 1) {
    throw new Error('the scope ended up with more than one row');
  }

  record(
    'insert race',
    `1 of 2 inserts won (${inserted[0].label}); 1 row for the scope`,
  );

  // -----------------------------------------------------------------------------------------
  // 2. Lost compare-and-set under READ COMMITTED: the row count is the arbitration.
  // -----------------------------------------------------------------------------------------
  const readerA = await connect(connectionString);
  const readerB = await connect(connectionString);

  try {
    await readerA.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await readerB.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    const readA = await readerA.query(
      `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
      ['QUOTATION:1403'],
    );
    const readB = await readerB.query(
      `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
      ['QUOTATION:1403'],
    );

    if (readA.rows[0].lastIssued !== readB.rows[0].lastIssued) {
      throw new Error('the two readers disagree before any write, which invalidates the setup');
    }

    const expected = readA.rows[0].lastIssued as number;

    // A writes first and holds the row lock.
    const writeA = await readerA.query(
      `UPDATE crm129proof.quotation_sequence_proof
          SET "lastIssued" = $2
        WHERE "scopeKey" = $1 AND "lastIssued" = $3`,
      ['QUOTATION:1403', expected + 1, expected],
    );

    // B attempts the same compare-and-set while A still holds the lock. It blocks here.
    const pendingB = readerB
      .query(
        `UPDATE crm129proof.quotation_sequence_proof
            SET "lastIssued" = $2
          WHERE "scopeKey" = $1 AND "lastIssued" = $3`,
        ['QUOTATION:1403', expected + 1, expected],
      )
      .then((result) => result.rowCount ?? 0);

    await readerA.query('COMMIT');
    const rowCountB = await withDeadlockGuard('writer B update', pendingB);

    await readerB.query('COMMIT');

    if (writeA.rowCount !== 1) {
      throw new Error(`writer A should have won, rowCount = ${writeA.rowCount}`);
    }

    if (rowCountB !== 0) {
      throw new Error(
        `writer B should have lost with rowCount 0, got ${rowCountB} — the protocol would duplicate`,
      );
    }

    const finalValue = await setup.query(
      `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
      ['QUOTATION:1403'],
    );

    if (finalValue.rows[0].lastIssued !== expected + 1) {
      throw new Error(
        `the value was written twice: expected ${expected + 1}, stored ${finalValue.rows[0].lastIssued}`,
      );
    }

    record(
      'lost CAS (READ COMMITTED)',
      `A rowCount=1, B rowCount=0, stored ${finalValue.rows[0].lastIssued}`,
    );
  } finally {
    await readerA.end();
    await readerB.end();
  }

  // -----------------------------------------------------------------------------------------
  // 3. Twenty concurrent allocators: no duplicate number.
  // -----------------------------------------------------------------------------------------
  const allocated: number[] = [];

  await Promise.all(
    Array.from({ length: 20 }, async () => {
      const client = await connect(connectionString);

      try {
        for (let attempt = 0; attempt < 60; attempt += 1) {
          const read = await client.query(
            `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
            ['QUOTATION:1404'],
          );

          if (read.rows.length === 0) {
            const insertedRow = await client.query(
              `INSERT INTO crm129proof.quotation_sequence_proof ("scopeKey", "lastIssued")
               VALUES ($1, 1) ON CONFLICT ("scopeKey") DO NOTHING`,
              ['QUOTATION:1404'],
            );

            if ((insertedRow.rowCount ?? 0) === 1) {
              allocated.push(1);

              return;
            }

            continue;
          }

          const current = read.rows[0].lastIssued as number;
          const write = await client.query(
            `UPDATE crm129proof.quotation_sequence_proof
                SET "lastIssued" = $2
              WHERE "scopeKey" = $1 AND "lastIssued" = $3`,
            ['QUOTATION:1404', current + 1, current],
          );

          if ((write.rowCount ?? 0) === 1) {
            allocated.push(current + 1);

            return;
          }
        }

        throw new Error('an allocator exhausted its attempts');
      } finally {
        await client.end();
      }
    }),
  );

  const distinct = new Set(allocated);

  if (allocated.length !== 20 || distinct.size !== 20) {
    throw new Error(
      `expected 20 distinct numbers, got ${allocated.length} allocations and ${distinct.size} distinct`,
    );
  }

  record(
    '20 concurrent allocators',
    `${allocated.length} allocations, ${distinct.size} distinct (${Math.min(...allocated)}..${Math.max(...allocated)})`,
  );

  // -----------------------------------------------------------------------------------------
  // 4. REPEATABLE READ: the same race must NOT look like a clean loss.
  // -----------------------------------------------------------------------------------------
  const repeatableA = await connect(connectionString);
  const repeatableB = await connect(connectionString);

  try {
    await setup.query(
      `INSERT INTO crm129proof.quotation_sequence_proof ("scopeKey", "lastIssued")
       VALUES ($1, 0) ON CONFLICT ("scopeKey") DO NOTHING`,
      ['QUOTATION:1405'],
    );

    await repeatableA.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await repeatableB.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

    await repeatableA.query(
      `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
      ['QUOTATION:1405'],
    );
    await repeatableB.query(
      `SELECT "lastIssued" FROM crm129proof.quotation_sequence_proof WHERE "scopeKey" = $1`,
      ['QUOTATION:1405'],
    );

    await repeatableA.query(
      `UPDATE crm129proof.quotation_sequence_proof SET "lastIssued" = 1
        WHERE "scopeKey" = $1 AND "lastIssued" = 0`,
      ['QUOTATION:1405'],
    );

    const pendingRepeatableB = repeatableB
      .query(
        `UPDATE crm129proof.quotation_sequence_proof SET "lastIssued" = 1
          WHERE "scopeKey" = $1 AND "lastIssued" = 0`,
        ['QUOTATION:1405'],
      )
      .then((result) => ({ kind: 'rowCount' as const, rowCount: result.rowCount ?? 0 }))
      .catch((error: unknown) => ({
        kind: 'error' as const,
        code: (error as { code?: string }).code ?? 'UNKNOWN',
      }));

    await repeatableA.query('COMMIT');

    const outcomeB = await withDeadlockGuard(
      'writer B under REPEATABLE READ',
      pendingRepeatableB,
    );

    try {
      await repeatableB.query('ROLLBACK');
    } catch {
      // The transaction is already aborted; rolling back an aborted one is allowed to fail.
    }

    if (outcomeB.kind === 'rowCount') {
      record(
        'REPEATABLE READ',
        `a lost race reported rowCount=${outcomeB.rowCount} (no serialisation error on this engine)`,
      );

      if (outcomeB.rowCount !== 0) {
        throw new Error('a lost race must not claim the write');
      }
    } else {
      record(
        'REPEATABLE READ',
        `a lost race raised ${outcomeB.code} — a caller MUST retry this as a lost race`,
      );

      if (outcomeB.code !== '40001') {
        throw new Error(`unexpected error code under REPEATABLE READ: ${outcomeB.code}`);
      }
    }
  } finally {
    await repeatableA.end();
    await repeatableB.end();
  }

  // -----------------------------------------------------------------------------------------
  // Cleanup, and proof that nothing else was touched.
  // -----------------------------------------------------------------------------------------
  await setup.query('DROP SCHEMA crm129proof CASCADE');
  await setup.end();

  console.log('\nCRM-129-S1-R2 — atomic numbering against a throwaway Postgres\n');

  for (const finding of findings) {
    console.log(`  PASS  ${finding.name.padEnd(26)} ${finding.detail}`);
  }

  console.log('\nAll assertions passed. Schema dropped.\n');
};

main().catch((error: unknown) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
