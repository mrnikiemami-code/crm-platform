# Goal 040 Round-2 Cursor lane handoff

Date: 2026-11-28  
Branch: `feat/crm129-g040-final-commercial-catalog`  
Base: `120c4d8fb6f034ffa1f65f16b39f0af90c3a43be`  
Owner: Cursor (U04 commercial/catalog + owned U01/U02/P05 hardening)

## Tip SHA

`1fc6745191b5c50e614813ec9688cc2622fc29ab`

## Scope delivered

### U04 commercial completeness

- Quotation fields: `expiresAt` wired end-to-end; `paymentDueDate`, `deliveryTerms`, `documentNotes`, issuer snapshot (`issuerLegalName` … `issuerPhone`), `visitorName`, `selectedPriceListId`, `selectedPriceListName`
- Line fields: `selectedPriceListId`, `selectedPriceId`, `selectedPriceValidFrom` (immutable at catalog pick)
- Draft form (Persian): validity, due date, delivery, notes, visitor, IRR price-list select; catalog search uses selected list
- Persistence: `commercialColumnsFromDraftHeader` merged into `buildHeaderColumns` (create + update)
- Seal (`quotation-revision-snapshot.util.ts`): version-aware commercial block on schema v2
- PDF + customer HTML: commercial blocks from **seal only**

### Price selection

- `selectCurrentCatalogPrice` returns `priceId` + `validFrom`
- Catalog picker / `search-catalog-items` accept explicit `priceListId`

### U01/U02/P05 (owned)

- Production `apply-items` remains Nest transactional path
- Legacy GraphQL apply hard-fails without Nest executor
- PG accounting-code lock suite executed with disposable Dev DB credential (env-only)

### Additive shared registration

**`universal-identifiers.ts`**

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

**`application.config.ts`** issuer applicationVariables (`QUOTATION_ISSUER_*`) — see commit diff.

No edits to forbidden architect files (outbound, Asan adapters, operation-dispatch, connection authority, customer outbound).

## Targeted tests (re-verified)

| Suite | Exit | Result |
|---|---:|---|
| Jest: parse draft-save + draft-persistence | 0 | 41 passed |
| Jest: revision service + snapshot util + parse + PG locks | 0 | 43 passed |
| Vitest: price-snapshot + issuer-defaults | 0 | 5 passed |

Logs: `docs/architecture/goal-040/verification-round2-cursor/`

Commands:

```bash
npx jest packages/twenty-server/src/modules/quotation/utils/__tests__/parse-quotation-draft-save-request.util.spec.ts packages/twenty-server/src/modules/quotation/services/__tests__/quotation-draft-persistence.service.spec.ts packages/twenty-server/src/modules/quotation/services/__tests__/quotation-revision.service.spec.ts packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-revision-snapshot.util.spec.ts packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-accounting-code-lock.pg.spec.ts --config=packages/twenty-server/jest.config.mjs
npx vitest run --root packages/twenty-apps/internal/quotation src/domain/catalog/__tests__/price-snapshot.test.ts src/domain/quotation/__tests__/issuer-defaults.test.ts
```

## Remaining architect / external

- Workspace metadata sync for new quotation / quotationLine columns
- Configure issuer application variables per deployment
- Architect lane merge + U03 customer outbound + integrated P01–P15 phase 3
- Full monorepo `nx` typecheck/build not claimed as PASS from this lane (worktree uses linked `node_modules` from Dev checkout)

## What was NOT done

- No version bump, Dev deploy, schema apply, merge, screenshots, live Asan
- No architect-owned outbound/adapter/connection/security edits
