# CRM-129-S1-R1 — Storage-backed atomic quotation numbering: proof design

Date: 2026-11-18
Status: **PROTOCOL MODELLED AND TESTED / REAL-DATABASE PROOF DESIGNED, NOT RUN**
Scope: no database was written, no app installed, no service restarted. This document and the
model in `src/domain/quotation/sequence-storage.ts` are what can be executed without a database.

## 1. Why the S1 test was not enough

Architect decision D9 accepts an app-owned `quotationSequence` object **only after a real
storage atomicity proof**. S1 shipped `allocateQuotationNumber` with a store whose
`compareAndSetLastIssued` was a JavaScript closure. That proves the protocol has the right
**shape**; it proves nothing about storage, because a closure cannot express the one property
that matters:

> Two database clients can both read `lastIssued = 41` and both attempt to write 42.

A closure serialises those calls implicitly. A database does not.

## 2. The three properties a real proof must establish

| # | Property | Why it decides the design | How it can be observed |
| --- | --- | --- | --- |
| A | `UPDATE ... WHERE lastIssued = :expected` reports the number of affected rows | If the driver reports "no error" instead of `0` for a lost race, the protocol happily issues a duplicate number | The `rowCount`/`affected` value of one statement |
| B | The scope key is `UNIQUE` | Without it, a fresh fiscal year can be inserted twice and the scope ends up with two independent counters | Attempting a second `INSERT` for the same key must fail |
| C | Read and write are two statements, so another writer can interleave | This is the window the protocol exists to close; if the window were absent the protocol would be unnecessary | A deliberately interleaved second client between the two statements |

## 3. What is already proven (executed today)

`src/domain/quotation/sequence-storage.ts` implements the protocol against a `SequenceStorage`
whose methods mirror the three SQL statements one-for-one, including returning **the affected
row count** rather than a boolean. Tests in
`src/domain/quotation/__tests__/sequence-storage.test.ts`:

```
npx vitest run --root packages/twenty-apps/internal/quotation
  → 10 test files, 169 tests, all passing
```

| Test | Property it pins |
| --- | --- |
| starts a scope at one with a single insert | A |
| loses the race between SELECT and UPDATE, then retries | A, C — the competitor writes `11` inside the window; the caller must come back with `12`, and the test asserts the UPDATE ran twice |
| treats a zero rowcount as a lost race rather than a failure | A — an always-zero engine must exhaust attempts, not loop |
| loses the insert race on a fresh scope and still allocates exactly once | B — after losing the INSERT the caller must UPDATE, not insert again; the store must still hold one row |
| never issues the same number twice across interleaved writers | A + B under 20 interleaved allocations, half of them with an intruder inside the window |
| keeps fiscal years independent | B — the key, not a global counter |

**What this does not prove:** that Postgres returns `0` where the model does. That is exactly
what the next section verifies.

## 4. The real-database proof procedure (designed, NOT run)

Requires separate approval because it writes to a database. It is designed to be **temporary and
self-cleaning**: it creates a table in a scratch schema, runs the contention, and drops it.

### 4.1 Objects

```sql
CREATE SCHEMA IF NOT EXISTS crm129_proof;

CREATE TABLE crm129_proof.quotation_sequence (
  "scopeKey"   text PRIMARY KEY,
  "lastIssued" integer NOT NULL DEFAULT 0
);
```

`PRIMARY KEY` on `scopeKey` is property **B**. Nothing else is created; no existing table is
touched, and the schema is dropped at the end.

### 4.2 The two statements the protocol issues

```sql
-- read
SELECT "lastIssued" FROM crm129_proof.quotation_sequence WHERE "scopeKey" = $1;

-- compare-and-set; the affected row count IS the arbitration
UPDATE crm129_proof.quotation_sequence
   SET "lastIssued" = $2
 WHERE "scopeKey" = $1
   AND "lastIssued" = $3;
```

The caller inspects `rowCount`: `1` means this client won, `0` means another client moved the
value first and the client must re-read.

### 4.3 Contention experiment

Two independent connections, no explicit lock:

1. Both `SELECT` → both see `0` for a fresh key.
2. **Client A** runs the `UPDATE` with `expected = 0, next = 1`, without committing.
3. **Client B** runs the same `UPDATE`. Under `READ COMMITTED` it blocks on A's row lock.
4. A commits. B's `UPDATE` re-evaluates its `WHERE` against the committed row, finds
   `lastIssued = 1 ≠ 0`, and reports **`rowCount = 0`**.
5. Assert: `A.rowCount = 1`, `B.rowCount = 0`, and the stored value is exactly `1`.

This is the single observation that turns the model into a proof: it shows the database itself
rejects the second writer, which is the arbitration the protocol relies on. It also shows the
behaviour under the isolation level actually configured, instead of an assumed one.

### 4.4 Duplicate-number experiment

N = 20 concurrent clients, each looping `SELECT` → `UPDATE` until `rowCount = 1`, recording the
number it won. Assertions:

- exactly 20 distinct numbers were issued (`COUNT(DISTINCT) = 20`),
- the numbers are `1..20` with gaps allowed but no duplicates,
- total `UPDATE` attempts ≥ 20 (contention actually happened; if it equals 20 the experiment
  proved nothing and must be rerun with more clients).

### 4.5 Insert-race experiment

Two clients on a **fresh** key, both attempting:

```sql
INSERT INTO crm129_proof.quotation_sequence ("scopeKey", "lastIssued")
VALUES ($1, 1) ON CONFLICT ("scopeKey") DO NOTHING;
```

Assert exactly one client gets an inserted row and the other gets none, and that the total row
count for the key is `1`. This is property **B** against the real engine.

### 4.6 Isolation-level check

Repeat §4.3 under each isolation level the deployment actually uses. Under `REPEATABLE READ` a
concurrent `UPDATE` raises a serialisation failure instead of returning `0`, so the caller must
**also** treat that error as a lost race and retry. The protocol model currently assumes the
`0` path only; this is a real gap for that isolation level and is recorded as open decision D-A.

### 4.7 Acceptance criteria

| # | Assertion | Pass condition |
| --- | --- | --- |
| S1 | N=20 contention experiment | 20 distinct numbers, no duplicates, attempts > 20 |
| S2 | Insert race | exactly one insert wins, one row for the key |
| S3 | Lost-race signal | `rowCount = 0` observed and the client retried rather than failing |
| S4 | Isolation levels | behaviour matches §4.6 for every level in use, or that level is refused |
| S5 | Cleanup | `DROP SCHEMA crm129_proof CASCADE` leaves no residue |
| S6 | No collateral | the run touches no table outside `crm129_proof` |

### 4.8 What must NOT be concluded from the model

- That Postgres returns `0` — only §4.3 establishes that.
- That an app-owned sequence is therefore approved. D9 still needs the architect's acceptance of
  S1–S6 running on a real database.
- That the numbering is gapless. The policy is deliberately `GAPS_ALLOWED_DUPLICATES_FORBIDDEN`:
  a gapless sequence needs a lock held across the whole issuing transaction, which an app cannot
  require of the platform. A gap is an auditor's question; a duplicate is a legal problem.

## 5. Open decisions

| # | Decision | Why it cannot be settled here |
| --- | --- | --- |
| D-A | How to handle serialisation failures under `REPEATABLE READ` | The protocol must treat that error class as a lost race. Needs the deployment's actual isolation level, which is a platform setting. |
| D-B | Where the counter lives | An app-owned object is one option; a platform sequence would be another. The platform exposes no sequence primitive, so the app-owned table is the only option today — but it should be re-checked before S2. |
| D-C | Gap policy sign-off | Whether an auditor accepts gaps in the quotation series is a finance decision. |

## 6. Execution plan when approved

1. `CREATE SCHEMA crm129_proof` + table (§4.1) on the **Dev** database only, never intranet.
2. Run §4.3 with two explicit connections and capture both row counts.
3. Run §4.4 and §4.5.
4. Run §4.6 for the configured isolation level.
5. `DROP SCHEMA crm129_proof CASCADE`.
6. Record the captured outputs as the D9 evidence.

Nothing in this plan is executed by CRM-129-S1-R1.
