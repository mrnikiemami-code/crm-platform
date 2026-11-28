# Goal 040 Round-2 Cursor lane handoff

Date: 2026-11-28  
Branch: `feat/crm129-g040-final-commercial-catalog`  
Base at start: `120c4d8fb6f034ffa1f65f16b39f0af90c3a43be`  
Owner: Cursor (commercial/catalog/U04 + U01/U02/P05 hardening in owned files)

## Tip SHA

_Set after commit push (see git log -1)._

## Scope delivered

### U04 commercial completeness

- New quotation fields: `deliveryTerms`, `documentNotes`, `paymentDueDate`, issuer snapshot (`issuerLegalName` … `issuerPhone`), `visitorName`, `selectedPriceListId`, `selectedPriceListName`, wired `expiresAt` through draft/save/seal/PDF/customer view.
- Quotation line fields: `selectedPriceListId`, `selectedPriceId`, `selectedPriceValidFrom` (immutable at catalog pick).
- Draft form (Persian labels): validity, due date, delivery, notes, visitor, IRR price-list select; catalog search honors selected list; line price metadata on pick.
- Seal (`quotation-revision-snapshot.util.ts`): version-aware optional commercial block on schema v2 only.
- PDF + customer HTML: commercial blocks from seal only (issuer summary without re-exposing national id on customer page beyond legal name line).

### Price selection

- `price-snapshot.ts`: `selectCurrentCatalogPrice` returns `priceId` + `validFrom`.
- `catalog-picker.service.ts` + `search-catalog-items` LF: explicit `priceListId` parameter.

### U01/U02/P05

- `applyItemImportPlan` naming preserved with `applyItemImport` alias; production path remains Nest-only (`apply-items` LF refuses).
- Legacy `applyItemImport` hard-fails without injected executor (existing guard retained).

### Additive shared registration (STRICTLY ADDITIVE)

**`packages/twenty-apps/internal/quotation/src/constants/universal-identifiers.ts`**

| Key | UUID |
|---|---|
| `QUOTATION_FIELDS.deliveryTerms` | `a9f787d9-4715-53e9-ba5f-b8ba1081649b` |
| `QUOTATION_FIELDS.documentNotes` | `07a30d44-2402-5d7f-8334-43b45b39b982` |
| `QUOTATION_FIELDS.paymentDueDate` | `8a65a47c-c37f-5d1e-a540-7e93ef71733e` |
| `QUOTATION_FIELDS.issuerLegalName` | `b6414a96-1338-501c-9e0f-9184cb082dd1` |
| `QUOTATION_FIELDS.issuerNationalId` | `1e1a47a4-2c3e-53ea-9181-fab539157529` |
| `QUOTATION_FIELDS.issuerEconomicCode` | `e31bea10-82ea-5cc1-a28c-8c41a89e0a38` |
| `QUOTATION_FIELDS.issuerAddress` | `875ec2b9-4b97-593d-b019-edf315af525b` |
| `QUOTATION_FIELDS.issuerPhone` | `082331c8-012f-543f-acf8-877cbe9d1374` |
| `QUOTATION_FIELDS.visitorName` | `2c94a410-ff54-5b7f-be76-79a786ba80ba` |
| `QUOTATION_FIELDS.selectedPriceListId` | `adc703ea-d690-5472-aac2-deae632ee023` |
| `QUOTATION_FIELDS.selectedPriceListName` | `fadb8b17-d3a1-5186-9456-51cd62b8b61b` |
| `QUOTATION_LINE_FIELDS.selectedPriceListId` | `ec6422ff-3d9a-52bc-9b41-1217c2a7f423` |
| `QUOTATION_LINE_FIELDS.selectedPriceId` | `3075338d-9c74-5ee6-a605-0a90638017ac` |
| `QUOTATION_LINE_FIELDS.selectedPriceValidFrom` | `c715e710-d591-5e14-821e-3a94a99a3915` |

**`packages/twenty-apps/internal/quotation/src/application.config.ts`** (applicationVariables additions)

| Variable | UUID |
|---|---|
| `QUOTATION_ISSUER_LEGAL_NAME` | `19ae41db-63fd-56f2-8826-4d651665a244` |
| `QUOTATION_ISSUER_NATIONAL_ID` | `f8b91f85-ba98-5641-835f-4d262b9b051b` |
| `QUOTATION_ISSUER_ECONOMIC_CODE` | `440790f9-7a5a-5b91-af12-7736b7b244d4` |
| `QUOTATION_ISSUER_ADDRESS` | `7b1a7a62-3715-5945-b296-8c3e016fb26d` |
| `QUOTATION_ISSUER_PHONE` | `343df0ff-c2c0-56ac-bafb-690000f04543` |

No edits to forbidden architect files (`accounting-outbound*`, `asan-*` adapters, `accounting-operation-dispatch.service.ts`, customer outbound create/update/link).

## Files changed (source)

App: `quotation.object.ts`, `quotation-line.object.ts`, `universal-identifiers.ts`, `application.config.ts`, `draft-quotation.ts`, `revision.ts`, `issuer-defaults.ts`, `customer-view.ts`, `price-snapshot.ts`, `quotation-queries.ts`, `atomic-draft-save-api.ts`, `quotation-save.service.ts`, `quotation-draft-edit.service.ts`, `catalog-picker.service.ts`, `accounting-import.service.ts`, `customer-link.service.ts`, `quotation-draft-form.tsx`, `catalog-item-combobox.tsx`, `save-draft-quotation.ts`, `search-catalog-items.ts`, `render-customer-quotation-html.ts`, tests under `domain/catalog`, `domain/quotation`.

Server: `quotation-draft-save.type.ts`, `parse-quotation-draft-save-request.util.ts`, `quotation-commercial-header.util.ts`, `quotation-draft-persistence.service.ts`, `quotation-revision-snapshot.util.ts`, `quotation-revision.service.ts`, `quotation-pdf.service.ts`, `quotation-pdf-document.ts`, parse util spec.

## Targeted tests

| Command | Exit | Log |
|---|---:|---|
| `npx jest ...parse-quotation-draft-save-request.util.spec.ts` | 1 (BLOCKED: missing `file-type` / node_modules) | `docs/architecture/goal-040/verification-round2-cursor/jest-parse-draft-save.log` |
| `npx vitest run ...price-snapshot.test.ts` | 1 (BLOCKED: missing `vitest/config`) | `docs/architecture/goal-040/verification-round2-cursor/vitest-price-snapshot.log` |

**BLOCKED_NO_FIXTURE (PG concurrent catalog/price writers):** existing disposable pattern in `quotation-accounting-code-lock.pg.spec.ts` — requires `CRM129_DATABASE_URL` or `PGPASSWORD`. Command when DB available:

```bash
npx jest packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-accounting-code-lock.pg.spec.ts --config=packages/twenty-server/jest.config.mjs
```

Typecheck/build: **NOT_RUN** (workspace `yarn`/`node_modules` incomplete in this worktree).

## Architect blockers (remaining)

- Metadata sync / migration apply for new quotation + quotationLine fields (workspace schema).
- Workspace application variables for issuer defaults must be set per deployment.
- Integrated architect merge + P01–P15 phase 3 not run from this lane.
- U03 customer outbound authority (architect lane).
- PG concurrency evidence pending live DB fixture.

## What was NOT done

- No version bump, no Dev deploy, no schema apply, no merge.
- No edits to accounting outbound, Asan adapters, connection security, customer outbound paths.
- Full `nx test` / `tsgo` suite not executed (dependency/tooling blocked locally).