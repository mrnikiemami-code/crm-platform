# CRM-129 — Architect Patch Verification R1

**Date:** 2026-11-26  
**Expected HEAD:** `00fe123fc9029a59bfdd581fc9faa35fcc9a2962`  
**Local HEAD:** `00fe123fc9029a59bfdd581fc9faa35fcc9a2962` (**MATCH**, FF from `6d3e7a44b4`)  
**Target version:** `quotation@0.1.71`  
**Installed on Dev:** **NOT installed** (apply blocked) — Dev still serves prior `quotation@0.1.70` front component  
**Verdict:** `FAIL — ROOT_CAUSE_WITH_EVIDENCE`

Syntax empty-arg defect is **fixed**. New blockers prevent Dev install and operational proof.

## 1. Git

- `git fetch origin` + `git merge --ff-only origin/feat/crm-129-quotation`
- Untracked left untouched: prior verification md + `twenty-shared/src/ai/**`
- No force push / hard reset / source edits

Six Nest calls now parse cleanly:

```text
181/454/561/686/725/777: callAccountingConnectionNestAction({
```

## 2. Quotation parse / typecheck

```text
cwd: packages/twenty-apps/internal/quotation
cmd: npx tsgo --noEmit -p tsconfig.spec.json
exit: 1
```

| File | Error | Notes |
| --- | --- | --- |
| `accounting-nest-response.ts:18` | `readonly TaxCodeContract[]` ↛ mutable `TaxCodeContractView[]` | **R2 new** (`48a22c00b7` / nest-response) |
| `quotation-draft-form.tsx:660,721,1331` | `string` ↛ `SetStateAction<"IRR">` | Pre-existing Goal 036/WS7-B era |
| `quotation-currencies.ts:48` | `request` missing on `LogicFunctionEvent` | Pre-existing |
| `quotation-save.service.ts:146` | `roundingRuleCode` not on `AtomicSaveHeaderPayload` | Pre-existing Goal 032 |

## 3. Automated tests

### Quotation Vitest (full)

```text
cmd: npx vitest run
exit: 1
result: Test Files 64 passed | 1 skipped (65)
        Tests 783 passed | 3 skipped (786)
        Errors 16 unhandled
```

Unhandled rejection root cause (test harness, not syntax):

- **File:** `accounting-settings-panel.test.tsx` `beforeEach` → `callAppRoute.mockReset()` without re-`mockImplementation`
- **Consumer:** `accounting-settings-panel.tsx:327` `callAppRoute(ACCOUNTING_IMPORT_ROUTE,…).catch(…)`
- After R2, `installRoutes()` only stubs Nest connection actions; `callAppRoute` returns `undefined` → `.catch` throws `Cannot read properties of undefined (reading 'catch')`
- Appears once per panel mount across ~8 panel tests (16 errors ≈ 2 import calls × mounts)

Focused accounting suites: **95 assertions PASS** with same unhandled import noise when panel tests included.

### Nest authority Jest

```text
cmd: npx jest …/accounting-connection-authority.service.spec.ts
exit: 0
result: 22 PASS
```

## 4. Builds

| Target | Result | Evidence |
| --- | --- | --- |
| `twenty-shared` | **PASS** | `nx build twenty-shared --skip-nx-cache` exit 0 |
| `twenty-front` | **PASS** | `nx build twenty-front --skip-nx-cache` exit 0 (~1m38s vite) |
| `twenty-server` | **FAIL (env)** | SWC compiled 9410 files; post-step `mkdir -p` / `cp` Unix recipe fails on Windows (`The syntax of the command is incorrect.`) — **not** an architect Nest logic defect |
| Quotation app bundle (`twenty apply` / `dev:build`) | **FAIL (source graph)** | see §5 |

## 5. Dev apply `quotation@0.1.71` — blocked

```text
cmd: node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force
exit: 1
error: src/domain/accounting/adapters/asan/asan-http-adapter.ts:1:27
       ERROR: Could not resolve "node:crypto"
```

### Root cause (architect source import graph)

Front panel now imports Nest DTO helper which pulls server adapter factory into the browser bundle:

1. `accounting-settings-panel.tsx` → `accounting-nest-response.ts` (`parseAccountingNestPanel`)
2. `accounting-nest-response.ts:7` → `ADAPTER_DESCRIPTORS` from `adapter-registry.ts`
3. `adapter-registry.ts:9-12` → `AsanHttpAdapter` from `asan-http-adapter.ts`
4. `asan-http-adapter.ts:1` → `import { createHash } from 'node:crypto'`

**Effect:** `twenty` application file build cannot resolve Node builtins for the frontComponent package graph → **0.1.71 cannot be installed**. Dev remains on `0.1.70`.

Suggested architect direction (do **not** applied here): keep presentation descriptors free of `asan-http-adapter` / `node:crypto` imports on the front path (split registry presentation from factory), or otherwise keep Nest presentation verification off the Node adapter module.

## 6. Operational / runtime matrix (previous task — none deleted)

| Check | Result |
| --- | --- |
| Open Accounting Settings | **NOT_RUN** — 0.1.71 not installed; 0.1.70 still has `/s` connection-list failure |
| List connections | **NOT_RUN** on 0.1.71 |
| Create / edit connection | **NOT_RUN** |
| Test connection | **NOT_RUN** |
| Open mapping form | **NOT_RUN** |
| Save / restore mappings | **NOT_RUN** |
| Delete test connection | **NOT_RUN** |
| Created connection id correctness | **NOT_RUN** (unit authority has `affectedRecordId` coverage only) |
| Allowed adapters from backend | **NOT_RUN** on Dev UI |
| Verified / unverified status display | **NOT_RUN** |
| Six actions independent of `/s` | Source YES after syntax fix; **runtime unproven** |
| No unexpected JS / HTTP / backend errors on ops | **NOT_RUN** |
| Quotation create/edit/status flow | **NOT_RUN** |
| Negative auth / disconnect | Unauth Nest POST → **403** (smoke only) |
| Import/Export `/s` residual | Still `callAppRoute(ACCOUNTING_IMPORT_ROUTE|OUTBOUND)` — out of six-action scope; panel tests prove import still invoked |

## 7. OpenSpec

Still `openspec list` → `root: null`. Contract checked against R2 docs + source allowlist only.

## Duration

- Start: ~2026-11-26T21:49 local  
- End: after front build + failed apply (~25–35 min wall including `twenty-front` build)

## Evidence paths

- This report: `docs/architecture/goal-036/CRM-129-ARCHITECT-PATCH-VERIFICATION-R1.md`
- Prior FAIL (syntax): `docs/architecture/goal-036/CRM-129-ACCOUNTING-ARCHITECT-PATCH-VERIFICATION.md`
- Broken import chain files:  
  - `…/accounting-nest-response.ts`  
  - `…/adapter-registry.ts`  
  - `…/asan-http-adapter.ts`  
- Panel test harness gap: `…/__tests__/accounting-settings-panel.test.tsx`  
- Typecheck: `tsconfig.spec.json` via `tsgo`
