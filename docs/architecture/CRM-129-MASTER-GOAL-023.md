# CRM-129-MASTER-GOAL-023 — Financial contract & professional UX

**Mode:** ARCHITECT RECOVERY + GOAL DEFINITION + IMPLEMENTATION PLANNING  
**Branch / HEAD at definition:** `feat/crm-129-quotation` @ `0fe64a9305`  
**Gate:** `STOP_FOR_ARCHITECT`  
**This task changes docs only** — no product code, schema, deploy, outbound, worker, or `:6080`.

**Companions (normative):**

| Document | Role |
|---|---|
| [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md) | Domain contracts, gap statuses, lock & snapshot rules |
| [`CRM-129-EXECUTION-PLAN-023.md`](./CRM-129-EXECUTION-PLAN-023.md) | Design program + phased workstream packs |

**Recovery pointer:** `docs/architecture/CRM-ARCHITECT-RECOVERY.md` CURRENT → this Goal.

---

## Master goal

Deliver one coherent quotation + accounting-settings system in which:

- every accounting code has a single authoritative owner,
- tax and currency policy on a quotation is recorded and snapshotted correctly,
- reference codes lock after first use on a saved draft,
- each line can carry its own tax policy,
- phase 1 is single-currency (document currency on every line),
- phase 2 multi-currency is designed into the domain but not user-activated,
- item and party accounting codes live on their reference records,
- accounting settings do not re-author tax/currency codes,
- Mock and Asan share UI structure and real adapter capabilities,
- Persian operators can complete the whole workflow without a technical guide — **technical PASS alone is not success**.

---

## Success criteria (definition of done for the Goal)

| # | Criterion | Phase that closes it |
|---|---|---|
| 1 | One authoritative owner per accounting code | WS1 |
| 2 | Tax & currency policy correctly recorded and snapshotted on quotations | WS2–WS3 |
| 3 | Reference code locked after first use on a saved draft | WS2 |
| 4 | Independent tax policy per line | WS3 |
| 5 | Phase 1 single-currency; every line has the document currency | WS4 |
| 6 | Phase 2 multi-currency designed, not activated | WS4 (schema/contract only) |
| 7 | Accounting code fields on items, persons, companies | WS1 |
| 8 | Accounting settings do not redefine tax/currency codes | WS5 |
| 9 | Mock and Asan share UI shell + real adapter capabilities | WS6 |
| 10 | Professional, understandable Persian UX (user Design approval) | WS7 + user gates |

---

## Hard user contracts (do not dilute)

1. Each tax/duty **policy** has at most one CRM accounting code.
2. Each **currency** has an optional CRM accounting code.
3. Empty codes are allowed; once set, recording that code onto the quotation field is mandatory on save.
4. Codes on a quotation are not operator-editable.
5. From the first saved draft that carries a given reference code, editing that code on the reference is forbidden (server-enforced).
6. Default tax policy applies without re-selection.
7. Default currency applies without re-selection.
8. Tax is independently selectable per line.
9. Currency in phase 1 is selected at document level only.
10. Per-currency totals belong to phase 2.
11. Accounting settings are not the place to redefine tax/currency codes.
12. Item and customer accounting codes are stored on those reference records.

---

## Preserved contracts (not deleted by this Goal)

Existing CRM-129 contracts remain in force unless a later architect pack **explicitly** amends them with evidence:

| Area | Authority |
|---|---|
| Money arithmetic / micros / IRR storage | Money domain + TAX-008; no rewrite without STOP |
| Document discount + Hamilton allocation | S2-R8/R10 |
| Tax policy authority, default lock, GraphQL write-guards | TAX-008 / TAX-016 |
| Sealed revision immutability | revision snapshot util + write-guard |
| Workspace default accounting destination | DEFAULT-020 |
| Soft retire / history vs new work | RETIRE-021 / R1 |
| Outbound flags default off; no LIVE_VERIFIED claim | ACCOUNTING-019 roadmap P0-3 |
| Secrets off connection records | ACCOUNTING audit |
| Rejected or unapproved design pilots | not Design of Record (017 rev-02 still awaiting user) |

---

## Mandatory read for every later CRM-129 task

At the start of **every** subsequent CRM-129 implementation or design task:

1. Read this Goal.
2. State in one sentence how the change advances a numbered success criterion (or why it is out of Goal scope).
3. Cite the Financial Contract clause that governs the change.
4. Do not mark a pack COMPLETE without the pack’s acceptance evidence and required gate.

---

## Explicit non-goals of *this* planning task

- No product / schema / data change.
- No deploy, no Outbound enablement, no Asan live call.
- No Superdesign run; no promotion of prior designs without user approval.
- No worker / `:6080` change.

---

## Gate

**`STOP_FOR_ARCHITECT`** — Goal, Financial Contract, and Execution Plan are ready for architect ratification. Coding starts only after pack-level architect approval in the Execution Plan.
