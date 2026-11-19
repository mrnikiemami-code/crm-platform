# CRM-129-S2-R4 PROOF — atomic concurrency + real role security

**Base:** `8161b40019`  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## Root cause (proven before code change)

1. Pre-query hooks run in `CommonBaseQueryRunnerService.processArgs` **before** `executeQueryAndEnrichResults`, outside a shared write transaction with the ORM update.
2. S2-R3 version check was read-then-decide (`findOne` + compare) while `WorkspaceRepository` updates with `WHERE id = ?` only.
3. Live burst on Dev: up to **10 concurrent** same-version updates all succeeded (`RACE_CONFIRMED_BOTH_SUCCEEDED`).

## Fix (ORM-native, no parallel lock system)

In `QuotationImmutabilityService`, after permission/immutability evaluation:

- Claim with `repository.createQueryBuilder().where({ id, version, status }).update().set({ version: next[, status] }).returning(...).execute()`.
- Zero `generatedMaps` → `QUOTATION_VERSION_CONFLICT` / lines frozen.
- Line mutations claim the parent the same way under mutable statuses (`In(DRAFT, PENDING_INTERNAL_APPROVAL)`).
- Unreadable stored version fails closed; missing/invalid patch version still rejected.
- GraphQL auto `updatedBy` remains ignored as a system stamp (S2-R3).

## Live Dev evidence (isolated `:3002` / `twenty_default` / DB `default`)

| Suite | Result |
| --- | --- |
| `dev-exercise-s2-r4-race-check.cjs` | `RACE_FIXED` (6/6 single winner) |
| `dev-exercise-s2-r4.cjs` | `S2_R4_CONCURRENCY_PASS` (race, version bypass, status/line race, SENT block, seed person preserved) |
| `dev-exercise-s2-r3.cjs` | `S2_R3_LIVE_PASS` regression |
| `dev-exercise-s2-r4-roles.cjs` | `S2_R4_ROLE_PASS` |

### Role security (real Twenty roles)

- Created limited role via metadata `createOneRole` + `upsertObjectPermissions` on `quotation` / `quotationLine` (`canUpdateAllObjectRecords=false`, object update true).
- Bound via `core.roleTarget` on Dev API key `crm-129-s2-r1`, flushed Redis role caches, restarted **only** `twenty-server-1`.
- Limited: draft edit + submit **allowed**; approve / send / cancel / customer decision **PERMISSION_MISSING**.
- Admin path still approve/send/accept.
- API key role restored to **Admin** after suite.

## Isolation

- Dev: `twenty-server-1` / `twenty_default` / host `:3002`
- Intranet: `crm-intranet-server` / `crm-intranet-net` / `:6080` untouched (`RestartCount=0`, started 2026-11-16)

## Unit tests

- Server quotation jest: 11 pass
- Quotation app vitest: 189 pass

## Residual

- Soft-delete cleanup only covers mutable quotations; SENT/ACCEPTED experiment rows remain named `S2R4-*` (immutable by design).
- Minting a separate API key requires a user access token (`RequireAccessTokenGuard`); role proof used real `roleTarget` + cache flush instead.
