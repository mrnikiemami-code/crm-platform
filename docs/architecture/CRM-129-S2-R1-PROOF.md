# CRM-129-S2-R1 PROOF — experimental Dev install + real persistence

**Start:** `1c98287caa`  
**Remote:** `dev-crm129` → `http://localhost:3002` only  
**Intranet `:6080`:** not used for install or writes

## Isolation (before install)

| Check | Result |
| --- | --- |
| Target API | `http://localhost:3002` |
| Dev DB | Docker `twenty-db-1` / `postgres://…@db:5432/default` / DB name `default` |
| Intranet DB | `crm-intranet-postgres` / DB `crm_intranet` (separate container) |
| Install remote | `dev-crm129` (explicit `-r`); intranet remotes `o118-intra` / `o119-intra` unused |

## Installed & executed on Dev

- Quotation app registered + synced (`twenty dev -o -f -r dev-crm129`) — `✓ Synced پیش‌فاکتور (10 files)`
- Objects live: `catalogItem`, `quotation`, `quotationLine`, … (Persian labels)
- GraphQL exercised: create/update/search catalog; quotation for person + company; mixed PRODUCT+SERVICE lines; reopen draft; totals `20710000` IRR for sample lines
- HTTP routes (platform `/s` + app token env):
  - `POST /quotation/save-catalog-item` → `persisted: true` (`itemId` created)
  - `POST /quotation/save-draft` → `persisted: true` (`quotationId` created, 2 lines)
  - Re-save of SENT quotation → `QUOTATION_IMMUTABLE` (route/domain gate)

## Source-ready (not fully E2E in UI this slice)

- Front forms call the same routes (`callAppRoute`); browser sandbox token path not separately browser-clicked (no screenshots / loops per constraints)
- Raw GraphQL still allows updating a SENT quotation name; immutability is enforced on **app save routes**, not as a DB trigger
- Accounting / Asan outbound remains off; no live Asan
- Revision seal / numbering allocator not exercised end-to-end beyond domain unit tests

## Platform fix needed for Windows apply

- `twenty-sdk` file uploader sent `\` paths; server rejects backslashes. Local fix: normalize to POSIX in `file-uploader.ts`

## Tests

- Quotation app vitest: **189 passed**
- Dev exercise scripts: `scripts/dev-exercise-flows.cjs`, `scripts/dev-exercise-routes.cjs` → `EXERCISE_PASS` / `ROUTES_PERSIST_PASS`

## Remaining

- UI click-path / RTL manual smoke still recommended (MANUAL_UI_CHECK)
- Optional: harden SENT immutability at platform/permissions layer
- Do not install on intranet until architect approval
