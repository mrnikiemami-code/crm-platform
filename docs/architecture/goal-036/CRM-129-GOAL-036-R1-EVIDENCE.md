# CRM-129 Goal 036-R1 — Evidence Ledger

**Branch:** `feat/crm-129-quotation`  
**Goal 023:** ACTIVE / NOT COMPLETE  
**Final gate:** `STOP_FOR_ARCHITECT_AND_USER_UAT`  
**Verdict (session):** filled at end of R1-E after Dev apply

## Commits (product)

| Pack | SHA | Subject |
| --- | --- | --- |
| R1-A | `df67212fbc` | Nest-only tax/currency catalog authority for accounting settings |
| R1-B | `3a3df01098` | inactive / orphan / unverified reference lifecycle |
| R1-C | `159da0119f` | unavailable adapter fail-closed (no mock masquerade) |
| R1-D | _(this pack)_ | verification ledger + focused suite re-run |
| R1-E | _(pending)_ | version bump, Dev apply, browser attestation |

## Automated commands (recorded)

### Full quotation Vitest

```text
cwd: packages/twenty-apps/internal/quotation
cmd: npx vitest run
exit: 0
result: Test Files  63 passed | 1 skipped (64)
        Tests  776 passed | 3 skipped (779)
```

### Focused R1 suites (re-run after R1-C)

```text
cmd: npx vitest run src/components/accounting/__tests__/accounting-catalog-read.test.ts
                 src/components/accounting/__tests__/accounting-mapping-lifecycle.test.ts
                 src/components/accounting/__tests__/accounting-capability-integrity.test.ts
                 src/components/accounting/__tests__/accounting-connections-section.test.tsx
                 src/components/accounting/__tests__/accounting-settings-panel.test.tsx
exit: 0
result: 5 files / 88 tests PASS
```

### Financial regression batch

```text
cmd: npx vitest run src/domain/accounting/__tests__/financial-contract.test.ts
                 src/domain/accounting/__tests__/connection-settings.test.ts
                 src/components/__tests__/accounting-connection-rules.test.ts
exit: 0
result: 3 files / 89 tests PASS
```

## F01–F05 matrix

| ID | Requirement | Automated | Runtime Dev | Status |
| --- | --- | --- | --- | --- |
| F01 | Single Nest catalog authority for Financial + Accounting | PASS (catalog-read + panel mocks assert Nest list only; no `/s` tax/currency routes) | Pending R1-E apply then browser compare of policy/currency rows | OPEN until post-apply |
| F02 | Independent fail/empty/ready; no IRR invent; no new orphan/inactive select | PASS (catalog-read + mapping-lifecycle + form guards) | Pending post-apply negative UI | OPEN until post-apply |
| F03 | inactive ≠ missing; mapping keys preserved | PASS (lifecycle + connections UI) | Pending post-apply reopen/save | OPEN until post-apply |
| F04 | Mock/Asan descriptor/gate equivalence; unknown adapter UNAVAILABLE | PASS (capability-integrity + unknown-adapter UI) | Pending post-apply Mock profile switch without vendor call | OPEN until post-apply |
| F05 | Full ledger: browser, auth, financial, responsive | Vitest PASS; auth scripts exist | See NOT_RUN / PARTIAL below | PARTIAL |

## Authorization / workspace negative controls

| Case | Harness | Result |
| --- | --- | --- |
| Unauthenticated `/rest/quotation/actions` | `POST http://localhost:3002/rest/quotation/actions` without bearer | **403** (fail closed) |
| Workspace A cannot read B mappings | `scripts/dev-verify-crm129-accounting-settings-010.cjs` + tax gate scripts | **NOT_RUN** this session (no dedicated agent token/env re-execution) |
| Read-only role cannot save | same prior script family | **NOT_RUN** this session |
| Locked accounting reference mutate | Package A dialog already shows locked code; R1 did not alter Money/seal | **PRIOR / not re-proved** |

Per task: authorization negatives that were not re-executed are **NOT_RUN** and block a fabricated architect PASS.

## Browser baseline (pre-apply, deployed `quotation@0.1.69`)

| Check | Result |
| --- | --- |
| Dev front `:3002` | HTTP 200; logged-in CRM session available |
| Financial Settings (`پیش‌نیازهای حسابداری`) | Loaded; tax tab shows 3 policies: مالیات بر ارزش افزوده ۹٪, مالیات ۱۰٪ ۰۰۷, مالیات ۹.۴; currencies tab count badge `1` |
| Edit button + locked accounting code dialog | Observed (Package A behavior still present) |
| Accounting Settings Nest authority | **Not yet attested on this build** — R1 product commits not applied; old build still dual-path risk until R1-E |
| Responsive 320..1440 matrix | **NOT_RUN** full matrix this session |
| Synthetic quotation create→preview | **NOT_RUN** this session (no disposable send; deferred to post-apply if time) |
| Real Asan outbound | **OFF / not attempted** |

## Scope containment

- No Money Domain / schema / PDF / historical revision edits
- No `:6080` changes; port observed listening only
- Untracked `packages/twenty-shared/src/ai/**` left untouched
- No force push / rebase / reset

## Rollback

1. Revert R1 product commits (`df67212fbc..` through R1-E) or re-apply previous `quotation@0.1.69` package build  
2. Confirm Financial Settings Nest lists still work  
3. Do not touch sealed quotations or outbound flags

## Post-apply section (R1-E fills)

- Served app version:
- Accounting Settings catalog error/retry observed:
- Financial vs Accounting ID/code match:
- Orphan/inactive preservation after reopen:
- Mock profile switch without vendor call:
- Screenshots:
