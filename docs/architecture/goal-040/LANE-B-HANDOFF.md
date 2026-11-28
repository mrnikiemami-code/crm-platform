# Goal 040 Lane B — reference unit catalog + catalog import handoff

Branch: `feat/crm129-g040-reference-catalog`. Lane A must not edit objects listed here until integration.

## Object model (frozen UUIDs)

| Entity | UUID |
|---|---|
| `quotationUnit` object | `08f95dbf-072a-58c3-9dfe-b8daeb3e27b8` |
| Fields `code/name/isActive/accountingCode` | `8be81bc9…` / `929a3199…` / `8084713d…` / `efceadfe…` |
| `catalogItem.unitRecord` | `fdbf5fa7-f54b-543a-a292-65ded00c0ce0` |
| `catalogItem.secondaryName` | `de7b04e4-d580-57ba-a083-a5b1a08624c9` |
| `accountingItemLink` observation fields | `bd212419…` / `39be4f24…` / `e35faa6e…` |
| Relation `catalogItemUnit` / `quotationUnitCatalogItems` | `cfbd0316…` / `0d5b3a2d…` |
| Logic function `quotation-units` | `aeff44f5-ea3d-5d16-a628-de1bbba63867` |

Legacy `catalogItem.unit` TEXT remains for display and historical rows. Authoritative selection is `unitRecordId` (join column).

## Nest REST actions (quotation-ui.controller)

| Action | Purpose |
|---|---|
| `quotation-unit-list` | Read catalog |
| `quotation-unit-save` | Create (`recordId` null) or update |
| `quotation-unit-deactivate` | Soft off; no destroy |

App HTTP: `POST /quotation/units` via logic function `quotation-units` (maps to same Nest actions).

Lock: `quotation-unit-catalog:{workspaceId}` advisory lock; order after tax/currency per charter.

Accounting code lock (Lane B scope): any `catalogItem` with `unitRecordId` pointing at the unit blocks `accountingCode` mutation on that unit row. Quotation **line** snapshot lock and picker wiring remain Lane A.

## Import contract

- `ItemApplySelection.unitRecordId` **required** for `CREATE` rows (`UNIT_MAPPING_REQUIRED` otherwise).
- `applyItemImport` no longer defaults unit text to `عدد`; loads `quotationUnit` by id for legacy `unit` text.
- Link writes `observationJson` + `observationVersion` + `observedAt` from `buildCatalogItemObservationSnapshot`.

## Lane A integration TODO

- Draft save: resolve `unitRecordId` on lines, snapshot `unitCode` / `unitAccountingCode` server-side.
- Lock order in draft transaction: tax → currency → **unit** (use `acquireQuotationUnitCatalogReadLock` where appropriate).
- Quotation line object fields (not touched in Lane B).

## Schema apply

Install/sync quotation app on a workspace to materialize `quotationUnit`, new catalog fields, and link observation columns. No upgrade command in this lane.