# Goal 040 Phase 1 closure handoff

Date: 2026-11-28  
Branch push target: `feat/crm-129-quotation`  
Worktree branch: `feat/crm129-g040-phase1-closure`  
Baseline ancestor: `795d732f8c0a27b374d0e1dc9d403ff983a5b13d`  
Assignment tip at start: `5f90a6f2b98915c436ed5f6f719a20883e6ed3a6`

## Tip SHA

`19fdaa87b9f12abf405ce9191f1d5419c7de5082`

## Candidate

| Item | Value |
|---|---|
| Quotation app | `0.1.92` |
| Image | `twenty-dev/crm129:c8a2992b7c4de3378a76b7031a4d0eb3bad1b10e` |
| Image digest | `sha256:155a4b4fae4798c4a131de666cecdb6f0c42caa90c5687f6d120226a3363eb38` |
| Dev compose | existing `twenty` project on `:3002` (Intranet `:6080` untouched) |
| Metadata apply | `dev-crm129` apply `--force` then idempotent “No changes” |

## Verdict

**PHASE1_NOT_CLOSED**

Build/deploy/unit evidence advanced the candidate, but mandatory Phase 1 exit vectors still have FAIL/NOT_RUN items below. Per task rule, any offline P0 FAIL/NOT_RUN/BLOCKED means NOT_CLOSED.

## What was done

1. Isolated worktree from assignment tip (includes baseline).
2. Fixed verified compile/test defects: query-hook resolver generics, bigint ES2018 literals, controller constructor arity, unit settings toolbar JSX, relation manifest ends, party-outbound matcher, sync-operation `kind` non-null SELECT default.
3. Built `twenty-shared`; server `tsgo` PASS; quotation `tsgo` PASS.
4. Vitest quotation **871 PASS** (+3 skipped); host-ops UI Vitest **59 PASS**.
5. Jest P0 slice **129 PASS** (revision/seal, item-apply mock+disposable PG, unit/tax/currency locks, dispatch, connection authority/write-guard, party outbound, UI controller).
6. TLS fixture **PASS_SCOPED**; PG connection-lock harness **PASS**.
7. Immutable Dev image built and deployed; server healthy; app apply + idempotent sync PASS; PDF generate returns `%PDF-` magic (`pdf-check.log`).

## Gate ledger (Phase 1 / applicable P01–P07 + partial P12/P14)

| Gate | Status | Evidence |
|---|---|---|
| Integrated Host/Nest/Quotation build | **PASS** | `build-twenty-shared.log`, `image-build.log`, `tsgo-server-after-fix` (via `tsgo-server.log` after fixes), `tsgo-quotation.log` |
| Quotation typecheck/Vitest | **PASS** | `vitest-quotation-full.log` (871) |
| Host-ops unit (modal/menu) | **PASS** | `vitest-host-ops-ui.log` (59) — not authenticated Dev Playwright |
| Dev image + compose switch | **PASS** | `deploy-*.log`, healthy `twenty-server-1` |
| Metadata apply + idempotent | **PASS** | `apply-0.1.92-force.log`, `apply-idempotent.log` |
| P01 scale / Nest↔app seal unit | **PASS** (unit) | Jest revision snapshot/service + Vitest revision/asan-mapping |
| P02 discounts/tax/rounding unit | **PASS** (unit) | Vitest money/document suites inside full run |
| P03 sealed identity + customer HTML unit | **PASS** (unit) | revision/customer HTML tests |
| P03/P12 historical PDF embedded font on Dev | **NOT_RUN** | `pdf-check.log` proves `%PDF-` only; no FontFile/BaseFont container attestation |
| P04 links/lines beyond 100 | **NOT_RUN** | no >100 fixture executed |
| P05 disposable PG item+price+link + unit locks | **PASS** | `jest-phase1-p0.log` PG specs |
| P05 workspace ORM Nest apply + concurrent writers | **NOT_RUN** | disposable tables ≠ workspace ORM service proof |
| P06 claim/idempotency/retire (unit) | **PASS** (unit) | Vitest outbound + Jest dispatch/party |
| P06 real PG/HTTP claim–retire races | **NOT_RUN** | |
| P07 TLS scoped / write-guards / default OFF (unit+fixture) | **PASS_SCOPED** | `tls-fixture.log`, connection write-guard Jest |
| P07 credential rotation / public-IP pin | **BLOCKED_EXTERNAL** | admin / no isolated public namespace |
| UI regression Playwright (menus/confirm/transfer persist) | **NOT_RUN** | Dev welcome showed signup for `tim@apple.dev`; authenticated accounting DOM not completed |
| HTTP revision-seal exercise | **FAIL** | `revision-seal-http.log` — `UNIT_MAPPING_REQUIRED` (script lacks catalog unit selection) |
| Live Asan / G1 / G2 | **NOT_AUTHORIZED** | unchanged |
| Intranet `:6080` | **UNTOUCHED** | |

## Remaining blockers (architect / next)

1. Authenticated Playwright/DOM on Dev for accounting three-dot/outside/Escape, modal confirm/cancel with persisted mock CRM effects, document readiness.
2. Workspace-ORM P05 apply rollback/concurrency through Nest HTTP.
3. P04 completeness >100 links/lines.
4. P12 embedded Vazirmatn attestation on Dev-generated PDF bytes.
5. Update seal/HTTP fixtures for mandatory `unitRecordId`.
6. External: credential rotation, G1/G2.

## Remaining Phase 2 (not closed here)

Tier→PriceList durable bindings, verified stores/stock UX wiring, issuer workspace configuration proof, residual commercial/customer workflows.

## Evidence directory

`docs/architecture/goal-040/verification-phase1-closure/`

## What was NOT done

- No real Asan traffic, no Intranet changes, no screenshots, no hotpatch, no fake PASS, no weakened security tests.
- Local untracked verification scripts under older `D:\CrmSource\twenty` were preserved (not deleted).
