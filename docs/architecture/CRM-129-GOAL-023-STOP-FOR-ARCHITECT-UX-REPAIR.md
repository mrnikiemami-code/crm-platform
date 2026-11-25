# STOP_FOR_ARCHITECT — Goal 023 targeted UX repair / Pack B financial path

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**HEAD (local = remote):** `0ac6d22153` (Pack A UX repair; already pushed)  
**Companion:** [`CRM-129-GOAL-023-PROGRESS.md`](./CRM-129-GOAL-023-PROGRESS.md), [`CRM-ARCHITECT-RECOVERY.md`](./CRM-ARCHITECT-RECOVERY.md), [`CRM-129-GOAL-023-WS1-PREFLIGHT.md`](./CRM-129-GOAL-023-WS1-PREFLIGHT.md)

**Checkpoint time:** 2026-11-25 — no Deploy, no Schema Apply, no new product capability in this stop.

---

## Git checkpoint

| Check | Result |
|---|---|
| Branch | `feat/crm-129-quotation` ↔ `origin/feat/crm-129-quotation` |
| Dirty product/docs | **clean** (Pack A already committed) |
| Unrelated untracked | `packages/twenty-shared/src/ai/**` build artifacts only — **not** committed |
| Deploy / schema apply | **none** this checkpoint |

---

## Evidence — Pack A tests (re-run this checkpoint)

```
npx vitest run --root packages/twenty-apps/internal/quotation \
  src/components/accounting/__tests__/accounting-connections-section.test.tsx
→ Test Files 1 passed | Tests 43 passed
```

Includes ownership-hint + fa-IR health-check assertions; no English `(Mock)` on connection form.

---

## WS1-R1 — actual status (source + tests)

| Claim | Status |
|---|---|
| Pack status on Progress | `TECHNICALLY_VERIFIED` — **not** `ARCHITECT_ACCEPTED` |
| Dev Schema / App Apply | **not done** (app still `0.1.53`) |
| Source | [`quotation-currency-authority.service.ts`](../../packages/twenty-server/src/modules/quotation/services/quotation-currency-authority.service.ts): bootstrap inserts/repairs IRR even if catalog non-empty; `saveCurrency` / `setDefaultCurrency` refuse non-IRR (`QUOTATION_CURRENCY_DEFAULT_MUST_BE_IRR`); `enforceSingleActiveDefault` never auto-promotes non-IRR |
| Advisory locks / contracts | Preserved (currency exclusive lock util unchanged in role) |
| Jest (re-run this checkpoint) | `quotation-currency-authority.service.spec.ts` — **8 PASS** |
| Ship commit | `b57ff52246` (pushed earlier) |

**Architect action on WS1:** mark `ARCHITECT_ACCEPTED` (or amend) **before** Dev Apply and before opening WS2.

---

## What Pack A did / did not do

**Did (same product chrome):** Persian honesty, connection ownership hint, RTL SKU / policy-code fallback, `fa-IR` health timestamps; cancelled WS7-A as product Design of Record.

**Did not:** per-line tax, catalog document currency, Money Domain, schema, Deploy, prototypes, Goal COMPLETE.

---

## Pack B — required after architect open (priority order)

### WS2 — Snapshot accounting codes + first-use lock (C4 Option A)

**Deps:** WS1 `ARCHITECT_ACCEPTED` + lock-family confirm from preflight.

**Exact change inventory**

| Area | Work |
|---|---|
| Schema | Add nullable snapshot columns reserved in preflight: `quotation.taxAccountingCode`, `quotation.currencyAccountingCode` (UUIDs already frozen). Persist on draft save from resolved references. |
| Persistence | [`quotation-draft-persistence.service.ts`](../../packages/twenty-server/src/modules/quotation/services/quotation-draft-persistence.service.ts), parse-draft util, revision snapshot util: server resolves codes; **refuse client overrides**. |
| Lock | On first successful save that snapshots a **non-empty** tax/currency `accountingCode`, lock that **reference id** against further `accountingCode` mutation (`ACCOUNTING_CODE_IN_USE`). Empty→set still allowed until first non-empty snapshot. |
| Concurrency | Draft save takes tax/currency **read** locks; catalog mutations keep exclusive; preserve TAX-008 rate-lock ordering. Deterministic race harness (TAX-016 pattern). |
| Authority | Tax + currency authority refuse mutate when locked; item/person/company codes **remain unlocked** (C4). |
| UI | Draft: **no** tax/currency accounting-code inputs (C3). Settings may show lock badge when locked. |
| Out | No Money Domain rewrite; no per-line tax; no item/party lock. |

**Financial risk:** High TOCTOU if lock after write; wrong lock key breaks concurrent drafts; must not reprice sealed revisions.

**Acceptance tests**

1. Draft save with empty tax/currency codes → OK; references still editable.
2. Draft save with non-empty tax (and/or currency) code → snapshot persisted; subsequent reference code edit → `ACCOUNTING_CODE_IN_USE`.
3. Client-supplied snapshot override → refused; server value wins.
4. Concurrent: mutation vs draft save → deterministic refuse/queue; Jest/integration PASS.
5. Sealed revision unchanged; item/party codes still editable.
6. Progress → `TECHNICALLY_VERIFIED`; architect accept before WS3.

---

### WS3 — Per-line tax/duty policy on **existing** draft cards (C1, C7)

**Deps:** WS2 `ARCHITECT_ACCEPTED` + **explicit Money Domain permission**.

**Exact change inventory**

| Area | Work |
|---|---|
| Schema | Line fields: `taxPolicy`, frozen `taxRateBasisPoints` / `dutyRateBasisPoints`, snapshotted line tax `accountingCode` (new UUIDs in WS3 preflight — not invent in WS1). Keep header tax fields for legacy (C7). |
| Money Domain | Extend [`document-totals.ts`](../../packages/twenty-apps/internal/quotation/src/domain/money/document-totals.ts) `finalizeLinesWithDocumentDiscount` (and callers in [`draft-quotation.ts`](../../packages/twenty-apps/internal/quotation/src/domain/quotation/draft-quotation.ts)) to apply **per-line** rates after discount allocation. |
| Draft UI | [`quotation-draft-form.tsx`](../../packages/twenty-apps/internal/quotation/src/components/quotation-draft-form.tsx): add per-line policy `<select>` on **existing cards**; header select = default for **new** lines only; auto-apply workspace default; **no** accounting-code fields (C3). |
| Persistence / reopen | Save & hydrate line policies + frozen rates; legacy header-only docs reopen rule per Contract. |
| PDF / API / revision | Follow line snapshots; sealed immutable. |
| Outbound | Multi-policy send **blocked** unless adapter proves multi-tax (C7). |
| Out | No card→table redesign; no WS7-A chrome; no Deploy without gate. |

**Financial risk:** **Very high** — wrong allocation of document discount across mixed rates; silent reprice; PDF/API drift; adapter multi-tax honesty.

**Acceptance tests**

1. Two lines, two policies → independent tax/duty amounts; money unit tests PASS.
2. New line inherits current header/default policy; operator can override one line.
3. Document discount + mixed line rates: invariants (payable = sum lines, non-negative, rounding rules) hold.
4. Reopen legacy header-only quotation: defined Contract behavior; no silent amount change.
5. Snapshot seals line policies/codes; rate change in settings does not alter sealed revision.
6. Outbound multi-tax without adapter proof → blocked with clear Persian message.
7. Architect `DATA_INTEGRITY` gate PASS.

---

### WS4 (next after WS3 — brief)

Document `currencyCode` from `quotationCurrency` catalog; phase-1 **IRR-only** refuse; lines inherit header; reserve `totalsByCurrency` / flag `MULTI_CURRENCY_DOCUMENTS=false`; keep تومان/ریال as **display scale**. Snapshot currency code via WS2 columns. No mixed-currency UI.

---

## Recommended architect rulings (unchanged sequence)

1. WS1 (+ R1) → `ARCHITECT_ACCEPTED` (or amend).
2. Open WS2 (no Money Domain).
3. Open WS3 **with Money Domain permission**.
4. Open WS4 (IRR-only + multi-currency hooks off).
5. Then WS5/WS6; `STOP_FOR_USER_UAT` on **real Dev product** only.

**Rollback:** revert pack commits; no Deploy; isolate Money Domain to WS3.

---

## Out of scope until granted

- Money Domain edits  
- Schema Apply / Dev Apply / Deploy / `:6080` / outbound  
- New prototypes or redesign  
- Declaring Goal 023 COMPLETE  

---

## STOP

**`STOP_FOR_ARCHITECT`** — awaiting rulings above.  
**`STOP_FOR_USER_UAT`** — deferred until Pack B on real Dev.  
**Goal 023 = ACTIVE / NOT COMPLETE.**
