# Goal 040 Lane B — reference unit catalog + catalog import handoff

Date: 2026-11-28  
Branch: `feat/crm129-g040-reference-catalog`  
Baseline: `f230721d1a0146748475c68e73d61572d7b5df6d`  
Lane tip: `c1461597f79078ecc9065c50cc88204787f9463e` (implementation `dbbc27e732` + handoff/evidence)  
Owner: Cursor (Lane B). Architect owns Lane A finance + integration merge.  
No merge into `feat/crm-129-quotation` by this lane. No version bump. No Dev deploy.

## Scope delivered (U01 + U02 inbound)

- Workspace `quotationUnit` catalog with Nest authority (list/save/deactivate), advisory lock, GraphQL write-guard grid
- Native settings tab «واحدهای اندازه‌گیری» on existing tax/currency settings shell
- `catalogItem.unitRecord` MANY_TO_ONE + legacy TEXT `unit` retained; `secondaryName`
- `accountingItemLink` observation persistence (`observationJson` / `observationVersion` / `observedAt`)
- Item import requires explicit `unitRecordId` (no default `عدد`); writes observation snapshot on link
- Targeted automated tests (server Jest + app Vitest)

## Object model (frozen UUIDs)

| Entity / field | UUID |
|---|---|
| `quotationUnit` object | `08f95dbf-072a-58c3-9dfe-b8daeb3e27b8` |
| `quotationUnit.code` | `8be81bc9-6ef6-5475-ba59-4f284f80a4df` |
| `quotationUnit.name` | `929a3199-73f0-569b-92a5-707742288aea` |
| `quotationUnit.isActive` | `8084713d-5e20-5846-b136-0cdb557431d0` |
| `quotationUnit.accountingCode` | `efceadfe-e2fa-505d-a263-95530baae29e` |
| `catalogItem.unitRecord` | `fdbf5fa7-f54b-543a-a292-65ded00c0ce0` |
| `catalogItem.secondaryName` | `de7b04e4-d580-57ba-a083-a5b1a08624c9` |
| `accountingItemLink.observationJson` | `bd212419-2595-57c0-bd7f-e81d51d2b25b` |
| `accountingItemLink.observationVersion` | `39be4f24-0392-546d-8ce0-f99b6539a20b` |
| `accountingItemLink.observedAt` | `e35faa6e-4eb4-5ba7-9b74-b623ff45b627` |
| Relation `catalogItemUnit` | `cfbd0316-7d6e-5169-8e1c-323b0ba18674` |
| Relation `quotationUnitCatalogItems` | `0d5b3a2d-fdac-58d9-9861-c11eea3e9116` |
| Logic function `quotation-units` | `aeff44f5-ea3d-5d16-a628-de1bbba63867` |

Legacy `catalogItem.unit` TEXT (`449dc01c-cebc-5569-a9ea-9911dd29cfbb`) remains for display/history. Authoritative selection is join column `unitRecordId`.

Proposed sealed/line snapshot names for Lane A (not written on quotation-line in this lane): `unitRecordId`, `unitCode`, `unit` (display), `unitAccountingCode`.

## Nest REST actions (`POST /rest/quotation/actions`)

| Action | Purpose |
|---|---|
| `quotation-unit-list` | Read catalog |
| `quotation-unit-save` | Create (`recordId` null) or update |
| `quotation-unit-deactivate` | Soft off; no physical destroy |

App LF route: `POST /quotation/units` (`logic-functions/quotation-units.ts`) maps to the same Nest actions.

Locks:

- Catalog mutation: `quotation-unit-catalog:{workspaceId}` via `acquireQuotationUnitCatalogExclusiveLock` / `…ReadLock`
- Accounting-code lock (Lane B scope): nonempty `accountingCode` mutation refused when any `catalogItem.unitRecordId` references the unit (`isUnitAccountingCodeLocked`)
- Quotation **line** first-use / durable seal lock and draft transaction wiring remain Lane A

## Import / observation contract

- `ItemApplySelection.unitRecordId` **required** for CREATE (`UNIT_MAPPING_REQUIRED` otherwise)
- `applyItemImport` loads `quotationUnit` by id for legacy `unit` text; never invents `عدد`
- Link writes `observationJson` + `observationVersion` + `observedAt` from `buildCatalogItemObservationSnapshot` (`domain/accounting/item-observation.ts`)
- Observation schema version `"1"`; preserves vendor unit id/name, secondary unit, and `RemoteCatalogObservation` payload when present
- Apply path remains per-row GraphQL (existing LF architecture); conflict rows refuse without reassignment; full PG multi-row atomicity for import remains an integration concern if Nest transaction authority is later extended

## Key source paths

| Area | Path |
|---|---|
| Object | `packages/twenty-apps/internal/quotation/src/objects/quotation-unit.object.ts` |
| Authority | `packages/twenty-server/src/modules/quotation/services/quotation-unit-authority.service.ts` |
| Lock | `…/utils/quotation-unit-lock.util.ts` |
| Settings UI | `…/components/quotation-unit-settings-section.tsx` |
| Import | `…/services/accounting-import.service.ts`, `…/domain/accounting/import-plan.ts` |

Lane B did **not** modify: `quotation.object.ts`, `quotation-line.object.ts`, `quotation-revision.object.ts`, draft persistence/form/parser, PDF, accounting-outbound, `asan-factor.ts`, `asan-money-unit.ts`, app version.

## Targeted test evidence

| Suite | Result | Log |
|---|---|---|
| Nest Jest unit authority + write-guard | 15 passed | `docs/architecture/goal-040/verification-lane-b-server.log` |
| App Vitest unit + import-plan + applyItemImport | 34 passed | `docs/architecture/goal-040/verification-lane-b-app.log` |

Commands:

```bash
npx jest packages/twenty-server/src/modules/quotation/services/__tests__/quotation-unit-authority.service.spec.ts packages/twenty-server/src/modules/quotation/query-hooks/__tests__/quotation-unit-write-guard.spec.ts --config=packages/twenty-server/jest.config.mjs
npx vitest run --root packages/twenty-apps/internal/quotation src/domain/unit/__tests__/quotation-unit.test.ts src/domain/accounting/__tests__/import-plan.test.ts src/services/__tests__/accounting-import.service.test.ts
```

## Schema / apply implications

Install/sync quotation app on a workspace to materialize `quotationUnit`, new catalog fields, and link observation columns. No upgrade command and no Dev apply in this lane.

## Unresolved dependencies (Lane A / integration)

1. Draft save: resolve `unitRecordId` on lines; server snapshot `unitCode` / `unit` / `unitAccountingCode`
2. Draft transaction lock order: tax → currency → **unit** (`acquireQuotationUnitCatalogReadLock`)
3. Quotation line / revision object fields + picker/form integration (A-owned files)
4. Historical line preservation / first-use lock proof on sealed quotations (A)
5. Optional Nest transactional multi-row item/price/link apply for P05 concurrency
6. Party outbound, customer-specific price lists, live Asan G1/G2 — out of Lane B

## STOP

**STOP_FOR_ARCHITECT** — Lane B source + targeted tests + handoff complete on assigned branch. Integration merge and phase 3 acceptance are architect-owned.
