# CRM-129 — Accounting Architect Patch Verification

**Date:** 2026-11-26  
**Expected commit:** `6d3e7a44b45af0a7ad31ac7af09814883676e870`  
**Local HEAD after FF:** `6d3e7a44b45af0a7ad31ac7af09814883676e870` (**MATCH**)  
**Target version:** `quotation@0.1.71` (in `package.json`; **NOT installed on Dev**)  
**Verdict:** `FAIL — ROOT_CAUSE_WITH_EVIDENCE`

## Git

- Branch: `feat/crm-129-quotation`
- Local dirty tree: only untracked `packages/twenty-shared/src/ai/**` (left untouched)
- Action: `git fetch origin` + `git merge --ff-only origin/feat/crm-129-quotation`
- No force push / hard reset / local deletion

## Root cause (blocks build, apply, and runtime)

**File:** `packages/twenty-apps/internal/quotation/src/components/accounting/accounting-settings-panel.tsx`  
**Introduced by:** `3e146b523f` (`fix(crm129): migrate six accounting connection UI actions to Nest…`)  
**Defect:** six call sites pass a leading empty argument — invalid JS/TS syntax:

```text
callAccountingConnectionNestAction(, {
```

| Line | Intended action |
| --- | --- |
| 181 | list |
| 454 | save |
| 561 | test |
| 686 | set-default |
| 725 | deactivate |
| 777 | reactivate |

**Observed tooling:**

```text
npx tsgo --noEmit -p tsconfig.spec.json
→ TS1135 Argument expression expected (6×)

npx vitest run …/accounting-settings-panel.test.tsx
→ PARSE_ERROR Unexpected token at accounting-settings-panel.tsx:181:65
```

**Correct shape (architect fix only):** single-arg call matching `callAccountingConnectionNestAction(body)`:

```ts
callAccountingConnectionNestAction({
  action: 'list',
});
```

No local source repair was applied (per verification task: no arbitrary source fix).

## Builds

| Component | Result |
| --- | --- |
| Quotation app typecheck | **FAIL** (syntax above) |
| Quotation frontComponent build/apply | **NOT ATTEMPTED** — would ship unparsable panel |
| Backend (`twenty-server`) full build | **NOT COMPLETED** — blocked gate; related unit suite ran |
| Frontend (`twenty-front`) full build | **NOT RUN** — quotation panel syntax already FAIL |

Installed Dev app remains previous apply (`quotation@0.1.70` accounting-settings front component). `:3002` HTTP 200. Intranet / operational data not mutated.

## Automated tests

| Suite | Command | Result |
| --- | --- | --- |
| Nest DTO boundary | `npx vitest run src/components/accounting/__tests__/accounting-nest-response.test.ts` (cwd quotation) | **7 PASS** |
| Accounting settings panel | same package vitest | **FAIL** (parse of panel) |
| AccountingConnectionAuthorityService | `npx jest …/accounting-connection-authority.service.spec.ts` | **22 PASS** |
| Full `nx run twenty-server:test` | broad suite | **FAIL** overall (unrelated path-separator failures in logic-function util; not used as accounting gate) |

## Runtime / browser / API

| Check | Result |
| --- | --- |
| Open Accounting Settings / list connections | **NOT_RUN** — new code not installable |
| Create/edit/test/save mappings/deactivate | **NOT_RUN** |
| Supported adapters from Nest | **NOT_RUN** on Dev (server code present in tree; panel cannot call) |
| Six actions independent of `/s` | Source intent YES (`callAccountingConnectionNestAction` → `/rest/quotation/actions`); **runtime unproven** due to syntax |
| Import/Export `/s` residual | Still `callAppRoute(ACCOUNTING_IMPORT_ROUTE)` / `ACCOUNTING_OUTBOUND_ROUTE` in panel — **out of R2 six-action scope**; Dev historically broken for `/s` |
| Quotation create/edit status flow | **NOT_RUN** this session (no apply) |
| Negative auth / service disconnect | Unauth Nest POST previously 403; **not re-exercised** after this FF |

## OpenSpec

```text
openspec list --json → root: null, code: no_openspec_root
openspec store list --json → stores: []
```

No project OpenSpec root/store available; contract check used R2 task + `CRM-129-GOAL-036-R2-DIRECT-REPAIR-STATUS.md` and source/controller allowlist instead. Did **not** run `openspec init`.

## Duration

- Start: `2026-11-26T21:43:34+03:30`
- End: `2026-11-26T21:46:07+03:30` (core gate); authority jest + report shortly after  
- Approx wall: ~5–8 minutes to definitive FAIL

## Evidence paths

- This report: `docs/architecture/goal-036/CRM-129-ACCOUNTING-ARCHITECT-PATCH-VERIFICATION.md`
- Broken panel: `packages/twenty-apps/internal/quotation/src/components/accounting/accounting-settings-panel.tsx` lines **181, 454, 561, 686, 725, 777**
- Wrapper: `packages/twenty-apps/internal/quotation/src/components/quotation-api.ts` (`callAccountingConnectionNestAction`)
- Status doc: `docs/architecture/goal-036/CRM-129-GOAL-036-R2-DIRECT-REPAIR-STATUS.md`
