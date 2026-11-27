# CRM-129-ACCOUNTING-PARTY-RECOVERY-084 — FINAL REPORT

**Verdict: PASS (installability + operational matrix on fresh workspace)**

**Candidate:** quotation@0.1.84 @ `36941c4aea0b53185d4d3f5d804cd7027aadcb88`  
**Mode:** BUILD + DEPLOY + OPERATIONAL VERIFICATION ONLY (no product source / permission bypass / schema patches / destructive reset)  
**Evidence:** `docs/architecture/goal-037/verification-084/`

---

## Automated gates (PASS)

| Suite | Result | Log |
|---|---|---|
| Manifest / unique-TEXT identity Vitest | **31/31 PASS** | `vitest-manifest-identity.log` |
| FlatIndex + column-definition Jest | **19/19 PASS** | `jest-index-column.log` |
| Focused actor/identity/apply Jest | **12/12 PASS** | `jest-focused.log` |
| Full Vitest (quotation) | **784 passed** / 3 skipped | `vitest.log` |
| Full Jest (quotation Nest) | **368 passed** / 4 skipped (1 suite skipped) | `jest-quotation.log` |

Skipped counts match pre-existing suites; no new skips introduced.

## Deploy (PASS)

| Check | Result |
|---|---|
| Clean image | `twenty-dev/crm129:36941c4aea0b53185d4d3f5d804cd7027aadcb88` digest `sha256:12fcb684deef778669a7b39381389d243830e1cec64170eabd46cea3edcc7b15` |
| server/worker | identical image |
| Intranet | untouched (`crm-intranet-*` unchanged) |
| Multi-workspace | verification-only compose overlay (`docker-compose.multiworkspace.yml`) |

## Existing Dev workspace upgrade (PASS)

| Step | Result |
|---|---|
| Apply 0.1.84 on `glorious-aqua-whale` / `afc7afb6-…` | PASS — `tokenHash`/`scopeKey` `defaultValue` `''` → `null` (`apply-existing.log`) |
| Idempotent re-apply | PASS — `No changes` (`apply-existing-idempotent.log`) |
| Metadata fields | PASS — TEXT, unique, non-null, `defaultValue: null`, original universal IDs (`metadata-fields-existing.json`) |
| PostgreSQL DDL | PASS — `is_nullable=NO`, `column_default=null`, UNIQUE indexes present (`pg-constraints-existing.json`) |

## Fresh isolated workspace install (PASS)

| Step | Result |
|---|---|
| Create user `party083.mwyesfva@local.test` | PASS |
| Workspace | `d0fdd306-57d6-4dba-8454-6088b5b6bf45` / subdomain `p083mwyesfva` |
| Activate + Admin/Member roles | PASS |
| Temporary registration transfer → fresh WS | PASS (`transfer-registration.json`) |
| First apply 0.1.84 | PASS — Synced (no INDEX_FIELD_INVALID_DEFAULT_VALUE) (`apply-fresh.log`) |
| Idempotent re-apply | PASS — `No changes` (`apply-fresh-idempotent.log`) |
| Metadata fields | PASS (`metadata-fields-fresh.json`, `allPass: true`) |
| PostgreSQL DDL | PASS (`pg-constraints-fresh.json`) |
| Registration restored to original owner | PASS — `ownerWorkspaceId=afc7afb6-…` (`transfer-registration-back.json`) |

## Quotation numbering + customer-link lifecycle (PASS)

Evidence: `numbering-and-links.json`, `customer-view-reprobe.json`

| Check | Result |
|---|---|
| Concurrent READY_TO_SEND allocation | `QT-1405-000001` / `QT-1405-000002` distinct, non-blank |
| Sequential third number | `QT-1405-000003`; sequence `scopeKey=QUOTATION:1405`, `lastIssued=3` |
| Draft mint blocked | `CUSTOMER_LINK_STATUS_FORBIDDEN` |
| Mint + stored SHA-256 | hash matches; raw token not persisted |
| Public read (workspace Host) | HTTP 200 + payable copy |
| Revoke | HTTP 410 + لغو copy |
| Expiry (forced past `expiresAt`) | HTTP 410 + منقضی copy |
| Anonymous mint | 403 unauthorized |
| PG null insert refusal | `null-refused-ok` (rolled back) |
| PG duplicate unique refusal | `dup-refused-ok` (rolled back); leftover test rows = 0 |

Note: Windows `*.localhost` DNS is non-loopback; public probes use `127.0.0.1` with `Host: p083mwyesfva.localhost:3002` (harness only).

## 100-customer synchronization matrix on fresh WS (PASS)

Evidence: `party-uat.json`, `party-uat-run.log`  
Harness: `packages/twenty-apps/internal/quotation/scripts/dev-verify-084-party-uat.cjs`  
(`apply-parties` requires user auth context — API keys correctly forbidden by Nest dispatch.)

| Gate | Result |
|---|---|
| Seed 30 persons + 20 companies | 30/20, 0 seed errors |
| Preview | 50 `LINK_SUGGESTED` / 50 `NEEDS_CRM_RECORD` |
| Four ops (P/C update + P/C create) | all success; 0 refused |
| Apply1 | 95 createdLinks + 47 createdParties; 5 `ALREADY_SUCCEEDED` from prior four-ops/concurrent; **mappingsAfterApply1 = 100** |
| People/companies delta | +30 / +20 |
| Apply2 (repeat) | 0 new creates; refusals only `ALREADY_SUCCEEDED` |
| Preview after | **100 `IN_SYNC`** |
| Concurrent create | one wins (`createdParties:1`); loser `ACCOUNTING_PARTY_PLAN_STALE` |
| Stale plan | Nest re-prepares; `updatedLinks:1` success |
| Tombstone / deleted CRM | apply refuses `CRM_CUSTOMER_DELETED` |
| Browser plan inject | caller plan discarded; no forged create |
| Outbound execute (fake id) | `FORBIDDEN` via record-visibility gate (no live write) |
| Catalog + exportable quotations regression | success |
| Rollback collision | not force-injected (unsafe DB surgery refused); per-row rollback covered by Jest |

## Constraints honored

- No product source changes; no permission bypass; no manual schema patches; no destructive reset
- No Intranet changes; no live accounting writes (`transportApproved: false`, mock `PARTY_UAT`)
- Session credentials / JWTs redacted in evidence (`fresh-workspace.json`)
- Registration ownership restored to original Dev workspace

## STOP_FOR_ARCHITECT

Installability root cause from 083 is closed on 0.1.84: unique required TEXT keys ship with `defaultValue: null`, fresh sync succeeds, PostgreSQL retains NOT NULL + UNIQUE, and the full 100-customer operational matrix plus numbering/customer-link/concurrency/security/regression probes passed on an isolated fresh Dev workspace. Goal 037 / remaining debt disposition remains with architect.
