# Goal 040 Round-3 Cursor lane handoff

Date: 2026-11-28  
Branch: `feat/crm129-g040-r3-commercial-catalog`  
Base: `9089c8c1faa168a2723f6261a73fbcb5f163feeb`  
Worktree: `D:\CrmSource\twenty-g040-round3-cursor`  
Owner: Cursor (`CRM-129-G040-R3-COMMERCIAL-CATALOG-CLOSURE`)

## Tip SHA

`6060b7108a0a7da51cabcf47ed36e8e1e91e3ced`

## Scope delivered (review-and-close, not rebuild)

### U01 — unit compatibility / locks / secondary unit

- `vendor-unit-equivalence.ts`: exact primary-unit match (name / accounting code / id); import UI refuses mismatched CRM unit when vendor primary unit was observed
- `secondary-unit-ratio.ts`: secondary UoM converts only with verified positive integer `unitCount`; fractional/missing ratios refuse (no invented conversion)
- Real PG: `quotation-unit-lock.pg.spec.ts` proves tax → currency → **unit** shared order and exclusive blocked while shared held

### U02 — price tiers / stock / serial / groups

- Isolated helpers (no Asan adapter edits):
  - `vendor-price-tier-mapping.ts` — positional SalesPrice10 → CRM PriceList only with **explicit** bindings; zero ≠ missing
  - `vendor-stock-observation.ts` — read-only stock-by-verified-store + serial observation; store identity never guessed
- Catalog UI (`accounting-catalog-section.tsx` + mapping parse): shows tier/stock/serial/secondary observation; serial labeled as not recorded on proforma
- Default IRR SellPrice apply path unchanged; multi-tier writes require connection-owned list bindings (seam below)

### U04 — issuer / commercial / provenance / PDF / customer view

- Nest `commercialColumnsFromDraftHeader` now merges issuer env defaults (`quotation-issuer-defaults.util.ts`) so atomic REST save matches LF authority
- `proforma-commercial-wire.ts`: VisitorID / StorageID / Serial explicitly unsupported for proforma (no fabricated vendor IDs)
- Customer HTML commercial parity Vitest (RTL + due date / delivery / issuer / price list / notes)
- Existing seal→PDF / `assertPriceProvenance` retained; no silent repricing added

### P05 — real PostgreSQL atomic rollback / concurrency

- `accounting-item-apply.pg.spec.ts`: disposable tables; item+price+link commit; full batch ROLLBACK; concurrent writers serialized on same `accounting-item-source` advisory key
- Mock Jest apply suite still PASS

## Files touched (Cursor-owned)

- Domain helpers + tests under `packages/twenty-apps/internal/quotation/src/domain/{unit,catalog,quotation}/`
- `accounting-catalog-section.tsx`, `accounting-mapping-types.ts`
- `render-customer-quotation-html-commercial.test.ts`
- Nest: `quotation-issuer-defaults.util.ts`, `quotation-commercial-header.util.ts`, `quotation-unit-lock.pg.spec.ts`, `accounting-item-apply.pg.spec.ts`, issuer defaults Jest
- Evidence: `docs/architecture/goal-040/verification-round3-cursor/`

**Not modified (A-owned):** Asan adapters/transport/wire, `adapter-contract.ts`, accounting-outbound / party-outbound, operation-dispatch, connection-authority, controller/module registration, `universal-identifiers.ts`, `application.config.ts`.

## Targeted verification

| Suite | Exit | Result |
|---|---:|---|
| Vitest (8 files: unit/tier/stock/proforma/issuer/price/customer HTML) | 0 | 18 passed |
| Jest (issuer defaults + revision snapshot + item-apply mock + tax/currency PG + unit PG + item apply PG) | 0 | 29 passed |

Logs: `docs/architecture/goal-040/verification-round3-cursor/vitest-round3.log`, `jest-round3.log`

Commands:

```bash
npx vitest run --root packages/twenty-apps/internal/quotation src/domain/unit/__tests__/vendor-unit-equivalence.test.ts src/domain/unit/__tests__/secondary-unit-ratio.test.ts src/domain/catalog/__tests__/vendor-price-tier-mapping.test.ts src/domain/catalog/__tests__/vendor-stock-observation.test.ts src/domain/quotation/__tests__/proforma-commercial-wire.test.ts src/domain/quotation/__tests__/issuer-defaults.test.ts src/domain/catalog/__tests__/price-snapshot.test.ts src/utils/__tests__/render-customer-quotation-html-commercial.test.ts
npx jest packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-issuer-defaults.util.spec.ts packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-unit-lock.pg.spec.ts packages/twenty-server/src/modules/quotation/services/__tests__/accounting-item-apply.pg.spec.ts packages/twenty-server/src/modules/quotation/services/__tests__/accounting-item-apply.service.spec.ts packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-accounting-code-lock.pg.spec.ts packages/twenty-server/src/modules/quotation/utils/__tests__/quotation-revision-snapshot.util.spec.ts --config=packages/twenty-server/jest.config.mjs
```

### Typecheck

`npx tsgo -p packages/twenty-server/tsconfig.json --noEmit` **NOT_PASS** on baseline A-owned `accounting-connection-authority.service.ts` (TS1109 at line 471). Cursor did not edit that file. Full monorepo `nx` build/typecheck not claimed PASS.

## Shared seams for architect (do not invent in this lane)

1. **Connection-owned price-group / tier → CRM PriceList map** — B helper `mapVendorPriceTiersToPriceLists` is ready; durable bindings + apply multi-list writes belong with connection authority / settings (A).
2. **Verified store list for stock labels** — B `observeStockByVerifiedStores` needs A-owned `listStores` / approved store identity wiring into import UI.
3. **Issuer application variables** — Nest now reads `QUOTATION_ISSUER_*` from env; deployment must configure the already-registered app variables.
4. **VisitorID / StorageID / Serial on outbound Factor** — intentionally unsupported for proforma; any future mapping needs confirmed guide semantics + A outbound ownership.
5. **Pre-existing TS1109** in `accounting-connection-authority.service.ts` blocks clean server typecheck on this baseline.

## Remaining / NOT this lane

- Architect finance-security lane (U03 / F06 / F07 / restricted U05 reads)
- Metadata sync, Dev deploy, version bump, merge, integrated P01–P15
- Live Asan / G1 / G2
- Full Nest ORM integration test of `AccountingItemApplyService.apply` against workspace schema (PG suite proves transaction/lock semantics with disposable fixtures)

## What was NOT done

- No screenshots, Dev/intranet deploy, live Asan, version bump, merge, force-push
- No architect-owned adapter/outbound/dispatch/connection/security edits
