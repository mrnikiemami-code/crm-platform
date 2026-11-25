# STOP_FOR_ARCHITECT — Goal 023 targeted UX repair / Pack B financial path

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Companion:** [`CRM-129-GOAL-023-PROGRESS.md`](./CRM-129-GOAL-023-PROGRESS.md), [`CRM-ARCHITECT-RECOVERY.md`](./CRM-ARCHITECT-RECOVERY.md)

---

## What failed / what is blocked

Operator asked for document default currency + independent per-line tax on the **existing** quotation draft (not a redesign). Audit shows:

| Capability | Product today | Blocker |
|---|---|---|
| Document currency from catalog | Display unit تومان/ریال only; `currencyCode: 'IRR'` literal in [`draft-quotation.ts`](../../packages/twenty-apps/internal/quotation/src/domain/quotation/draft-quotation.ts) | **WS4** + WS1 accept |
| Per-line tax policy | Document-level select only; money applies one header rate to all lines | **WS3** + Money Domain + **WS2** dep |
| Snapshot / lock of codes | Not enforced | **WS2** after WS1 `ARCHITECT_ACCEPTED` |

Shipping fake per-line selects without money/schema would violate financial honesty. Money Domain change without grant is forbidden.

---

## Evidence (code)

- Draft: [`quotation-draft-form.tsx`](../../packages/twenty-apps/internal/quotation/src/components/quotation-draft-form.tsx) — card lines, single tax `<select>`, no accounting-code fields (C3 OK).
- Line object: no `taxPolicy` field on quotation lines.
- Settings: five sections + shared [`ConnectionEditForm`](../../packages/twenty-apps/internal/quotation/src/components/accounting/accounting-connection-form.tsx) for Mock/Asan (already unified).
- WS7-A HTML: **cancelled as product path** (archival only).

---

## Pack A shipped (safe; no Money Domain)

Persian honesty, RTL SKU/policy-code fallback, connection ownership hint, `fa-IR` health-check timestamps. See Progress CP-UX-REPAIR-A.

---

## Recommended architect rulings

1. **WS1 (+ R1)** → `ARCHITECT_ACCEPTED` (or amend) before Dev Apply / WS2.
2. Open **WS2** — snapshot CRM codes + C4 lock by reference id (no Money rewrite).
3. Open **WS3** with **explicit Money Domain permission**:
   - Per-line policy + frozen rates on line; header select = default for **new** lines only.
   - Extend finalize/totals for per-line rates; keep legacy header tax fields (C7).
   - UI: add per-line `<select>` on **existing cards** (no WS7-A table redesign).
   - C3: no tax/currency accounting-code fields on draft.
4. Open **WS4** — catalog-backed document `currencyCode`; phase-1 IRR-only refuse; keep تومان/ریال as display scale.
5. Then WS5/WS6 remainder; **`STOP_FOR_USER_UAT`** on real Dev product only.

**Rollback:** revert pack commits; no Deploy; isolate Money Domain to WS3 commits.

---

## Out of scope until granted

- Money Domain edits
- Schema/migrations for line tax / currency snapshot
- Deploy / `:6080` / outbound / Dev Apply
- New design prototypes
- Declaring Goal 023 COMPLETE
