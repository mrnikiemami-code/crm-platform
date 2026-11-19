# CRM-129-S2-R5 PROOF — transaction integrity + Dev UAT readiness

**Base:** `7c504dab17`  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS** (integrity fix + live proofs); UI readiness **PARTIAL** (draft/catalog surfaces exist; lifecycle/PDF UI incomplete)

## 1. Source path (before change)

`GraphQL updateOne → processArgs(pre-hooks) → executeInWorkspaceContext(write)`

- Pre-hooks run **outside** the GraphQL write transaction (`common-base-query-runner.service.ts`).
- S2-R4 claim was a separate `UPDATE … WHERE id/version/status` that could commit **before** the main GraphQL SET.

## 2. Controlled Dev proof of residual (pre-fix)

Script `dev-exercise-s2-r5-claim-fail-repro.cjs` threw after claim:

- Before: `DRAFT` / version `1` / name `S2R5-claim-fail`
- After failed mutation: `PENDING_INTERNAL_APPROVAL` / version `2` / name unchanged  
→ **`CLAIM_THEN_FAIL_CONFIRMED`**

## 3. Fix

`QuotationImmutabilityService.assertQuotationUpdateAllowed` now applies domain patch + version (+ status) in **one** `runInWorkspaceTransaction` conditional `UPDATE` (`WHERE id AND version AND status`). Actor composites (`updatedBy`) stay on the GraphQL writer.

GraphQL follow-up write remains idempotent. Line parent claim still version-only (documented residual if line insert fails after parent bump).

## 4. Post-fix Dev proof

`dev-exercise-s2-r5-integrity.cjs` → `S2_R5_INTEGRITY_PASS`

- Throw after atomic apply: name+status+version all persisted together
- Concurrent same-version writers: single winner

Regression: `S2_R3_LIVE_PASS`, `S2_R4_CONCURRENCY_PASS`, jest 11, vitest 189.

## 5. Dev UI acceptance map (`http://localhost:3001` / API `http://localhost:3002`)

App install: Quotation (`پیش‌فاکتور`) on Dev from S2-R1.

| # | Capability | UI path | Status |
| --- | --- | --- | --- |
| 1 | Create product/service | Command menu → **کالای جدید** (global) → catalog form; or Objects → **کالا و خدمات** | **READY** (form + save route) |
| 2 | Quotation for person/company | Person/Company record → command **ایجاد پیش‌فاکتور** → draft side panel | **READY** |
| 3 | Multi product/service lines | Same draft form (add lines, kind PRODUCT/SERVICE) | **READY** |
| 4 | Final amount display | Draft form local totals (domain plan) | **READY** |
| 5 | Save + reopen | Save in draft form; list **پیش‌فاکتورها** / record open | **READY** for draft save; reopen uses standard object record UI |
| 6 | Transition to SENT | No dedicated lifecycle UI buttons | **NOT_IMPLEMENTED** (API/GraphQL only today) |
| 7 | Block edit after send | Server hooks enforce; no UI affordance to attempt beyond record fields | **SERVER_READY** / UI **PARTIAL** |
| 8 | Persian PDF | No front-component/command for PDF export in app surfaces | **NOT_IMPLEMENTED** (domain/spike PDF exists; not wired to Dev UI) |

## 6. Cleanup

- Soft-deleted Dev experiment `_quotation` / `_quotationLine` rows matching S2R3/S2R4/S2R5 test name prefixes
- Seed `person` count unchanged (194)
- Removed local untracked `packages/twenty-apps/internal/quotation/.yarn/` and `yarn.lock`
- Intranet `:6080` untouched

## Residual

- Line create after parent version claim can still bump parent if insert fails (hook/write split for lines)
- Lifecycle to SENT and PDF require future UI work before full manual UAT of those steps
