# STOP_FOR_ARCHITECT — Goal 023 WS2 (snapshot + C4 lock)

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Base verified:** `d1c29b183e`  
**WS1 + R1:** `ARCHITECT_ACCEPTED` (source)  
**Dev Schema / App Apply:** **not performed** (separate approval required)

---

## What shipped (source only)

| Item | Detail |
|---|---|
| Snapshot fields | `taxAccountingCode` `d7e0c705-…`, `currencyAccountingCode` `ae36b898-…` (preflight-frozen); `taxPolicyRecordId` `ef1f25ce-…`, `quotationCurrencyRecordId` `e2ac4f5f-…` (v5) |
| Draft save | Resolve codes from taxPolicy / quotationCurrency under **Tax → Currency** shared advisory locks; persist snapshots + reference ids |
| Lock | C4 Option A: mutate `accountingCode` refused (`ACCOUNTING_CODE_IN_USE`) after non-empty snapshot for that **record id** |
| Client / GraphQL | Draft parse refuses snapshot keys; `quotation.updateOne` refuses/strips them |
| Money / PDF / status | Untouched |
| Draft form | No accounting-code fields added |
| App version | `0.1.54` (ready for future apply; not installed) |

---

## Pre-apply collision / rollback note

- UUIDs: tax/currency accountingCode match WS1 preflight; record-id UUIDs are deterministic v5 under application namespace.
- Additive nullable/`''` TEXT columns only — rollback = revert app version + drop fields via uninstall/reinstall path (no Dev apply this turn).
- Currency catalog may be absent until WS1 apply; draft save leaves empty currency snapshot (warn) rather than failing.

---

## Tests (real evidence)

| Suite | Result |
|---|---|
| `quotation-draft-persistence.service.spec.ts` | PASS (incl. Tax→Currency lock order + snapshot columns + client refuse) |
| `tax-policy-authority.service.spec.ts` | PASS (incl. `ACCOUNTING_CODE_IN_USE`) |
| `quotation-currency-authority.service.spec.ts` | PASS (incl. `ACCOUNTING_CODE_IN_USE`) |
| `quotation-accounting-snapshot.util.spec.ts` | PASS |
| `quotation-accounting-code-lock.pg.spec.ts` | **3 PASS against local PostgreSQL** (Tax→Currency order; exclusive blocked while shared held via `pg_try_advisory_xact_lock`; usage-by-reference-id SQL) |

---

## WS3 plan (after this STOP is accepted + Money Domain grant)

**Do not implement until architect opens WS3 with Money Domain permission.**

1. Schema: line `taxPolicy` + frozen rate fields + line tax accountingCode snapshot (new UUIDs in WS3 preflight).
2. Money: extend `finalizeLinesWithDocumentDiscount` for **per-line** rates after document-discount allocation.
3. UI: per-line `<select>` on **existing cards** in `quotation-draft-form.tsx`; header select = default for new lines only; **no** accounting-code inputs (C3).
4. Persistence/PDF/API/revision follow line snapshots; legacy header-only reopen per Contract C7.
5. Outbound multi-tax blocked unless adapter proves support.
6. Acceptance: two lines / two policies; money invariants; sealed revision immutable; focused money + persistence + app tests.

---

## Architect actions

1. Accept WS2 `TECHNICALLY_VERIFIED` → `ARCHITECT_ACCEPTED` (or amend).
2. Separate grant for Dev Apply (WS1 schema + WS2 columns, app `0.1.54`).
3. Open WS3 only with **explicit Money Domain permission**.

**STOP_FOR_ARCHITECT** — Goal 023 ACTIVE / NOT COMPLETE.
