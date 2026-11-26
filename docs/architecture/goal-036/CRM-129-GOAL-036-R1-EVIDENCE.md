# CRM-129 Goal 036-R1 — Evidence Ledger

**Branch:** `feat/crm-129-quotation`  
**Goal 023:** ACTIVE / NOT COMPLETE  
**Final gate:** `STOP_FOR_ARCHITECT_AND_USER_UAT`  
**Session verdict:** `BLOCKED_WITH_PRECISE_EVIDENCE` (not READY_FOR_ARCHITECT_REVIEW)

R1 product packs A–C are implemented, tested, committed, and the accounting-settings front component was applied as `quotation@0.1.70`. Full F01/F05 Dev acceptance is blocked because the Accounting Settings **connection list** still depends on `/s` `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` and fails open on Dev (`تنظیمات حسابداری خوانده نشد` / `ارتباط با سرور برقرار نشد`), so the mapping form that would consume Nest catalogs cannot be opened for side-by-side attestation.

## Commits (product)

| Pack | SHA | Subject |
| --- | --- | --- |
| R1-A | `df67212fbc` | Nest-only tax/currency catalog authority for accounting settings |
| R1-B | `3a3df01098` | inactive / orphan / unverified reference lifecycle |
| R1-C | `159da0119f` | unavailable adapter fail-closed (no mock masquerade) |
| R1-D | `636a037fb2` | verification ledger with honest NOT_RUN gates |
| R1-E | _(this pack)_ | `quotation@0.1.70` apply + blocked Dev attestation |

## Automated commands (recorded)

### Full quotation Vitest

```text
cwd: packages/twenty-apps/internal/quotation
cmd: npx vitest run
exit: 0
result: Test Files  63 passed | 1 skipped (64)
        Tests  776 passed | 3 skipped (779)
```

### Focused R1 suites

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

## Dev apply

```text
cmd: node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force
cwd: packages/twenty-apps/internal/quotation
exit: 0
plan: frontComponent "accounting-settings-page" updated in-place
      builtComponentChecksum 4d10b059… → 583fba20…
app version bumped: quotation@0.1.69 → quotation@0.1.70
:6080: listening, untouched by this apply
```

## F01–F05 matrix

| ID | Requirement | Automated | Runtime Dev | Status |
| --- | --- | --- | --- | --- |
| F01 | Single Nest catalog authority for Financial + Accounting | PASS (Nest list wrappers + independent parse/merge; panel asserts no `/s` tax/currency routes) | Financial Nest catalogs load (`IR_VAT_9`, `TAX_1000`, `TAX_1050`; currencies badge 1). Accounting Settings shell cannot open mapping UI because connection **list** `/s` fails — Nest catalog path therefore **not observable** on Dev form | **BLOCKED** (shell) |
| F02 | Independent fail/empty/ready; no IRR invent; no new orphan/inactive select | PASS | NOT attested on live Accounting form | **PARTIAL** |
| F03 | inactive ≠ missing; mapping keys preserved | PASS | NOT attested on live reopen/save | **PARTIAL** |
| F04 | Mock/Asan descriptor/gate; unknown adapter UNAVAILABLE | PASS | NOT attested on live form (shell down) | **PARTIAL** |
| F05 | Full ledger: browser, auth, financial, responsive | Vitest PASS; unauth Nest POST = 403 | Auth scripts / responsive 320–1440 / synthetic quotation journey **NOT_RUN**; Accounting browser blocked | **BLOCKED** |

## Authorization / workspace negative controls

| Case | Harness | Result |
| --- | --- | --- |
| Unauthenticated `/rest/quotation/actions` | `POST http://localhost:3002/rest/quotation/actions` without bearer | **403** |
| Workspace A ≠ B mappings / read-only save | `dev-verify-crm129-accounting-settings-010.cjs` family | **NOT_RUN** this session |
| Locked accounting reference mutate | Package A locked-code dialog still visible on Financial Settings | **PRIOR observed**, not a new R1 proof |

## Browser evidence (post-apply)

| Check | Result | Artifact |
| --- | --- | --- |
| Financial Settings Nest tax catalog | PASS — 3 active policies with codes `IR_VAT_9`, `TAX_1000`, `TAX_1050` | `r1-financial-settings-nest-catalog.png` |
| Financial Settings currencies tab | PASS — count badge `1` | same session |
| Accounting Settings page load | **FAIL** — `تنظیمات حسابداری خوانده نشد` / `ارتباط با سرور برقرار نشد`; Retry does not recover | `r1-accounting-settings-connection-list-fail.png` |
| Accounting Nest catalog parity vs Financial | **NOT_RUN** — form unreachable behind connection-list failure | — |
| Mock profile switch / Asan UI without vendor call | **NOT_RUN** | — |
| Responsive 320..1440 | **NOT_RUN** | — |
| Synthetic quotation draft→preview | **NOT_RUN** | — |
| Real Asan outbound | **OFF / not attempted** | — |

## Precise blocker

**What works:** R1-A/B/C source repairs; 776 Vitest; Financial Settings Nest catalog authority; unauthenticated Nest actions refuse with 403; `quotation@0.1.70` accounting-settings front component applied.

**What blocks READY:** Accounting Settings still loads its connection panel via `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` (`/s` Functions path). On this Dev host that call fails, so operators never reach the connection form that now owns Nest catalog reads. This is outside the catalog-authority repair surface but prevents the mandatory F01 Dev dual-UI attestation and F05 browser matrix.

**Not claimed:** WS5/WS6 architect-accepted; Goal 023 complete; fabricated PASS.

## Scope containment

- No Money Domain / schema / PDF / historical revision edits
- No `:6080` mutation; port observed listening only
- Untracked `packages/twenty-shared/src/ai/**` left untouched
- No force push / rebase / reset

## Rollback

1. Re-apply previous `quotation@0.1.69` build, or revert R1 product commits through this pack  
2. Confirm Financial Settings Nest lists still work  
3. Do not touch sealed quotations or outbound flags
