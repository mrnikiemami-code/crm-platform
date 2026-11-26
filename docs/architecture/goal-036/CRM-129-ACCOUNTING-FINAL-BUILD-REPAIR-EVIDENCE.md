# CRM-129 — Accounting Final Build Repair Evidence

**Date:** 2026-11-26  
**Base:** `00fe123fc902`  
**Branch:** `feat/crm-129-quotation`  
**Mode:** FIX + BUILD + DEPLOY + VERIFY  
**Installed:** `quotation@0.1.71` on Dev (`dev-crm129`)  
**Verdict:** `READY_FOR_ARCHITECT_REVIEW` (connection Nest path + build/typecheck/tests green; Import/Outbound remain `/s` residual)

## 1. Fixes shipped

| # | Requirement | Change |
| --- | --- | --- |
| 1–3 | Browser-safe adapter descriptors; no duplicate data; backend factory preserved | New `adapter-descriptors.ts` (`ADAPTER_DESCRIPTORS` + helpers). `adapter-registry.ts` re-exports descriptors and keeps `createAccountingAdapter` only. UI/nest-response import descriptors, never the factory (avoids `node:crypto` / AsanHttpAdapter in browser). |
| 2 | Purge UI Node deps | Accounting UI/tests import `adapter-descriptors`; no polyfill. |
| 4 | `taxCodeCatalog` readonly | View/shared types accept readonly catalogs. |
| 5 | 16 unhandled Vitest errors | Panel harness re-stubs IMPORT/OUTBOUND `callAppRoute` as Promises after `mockReset`. |
| 6 | Windows `mkdir -p` server build | `packages/twenty-server/scripts/copy-twenty-client-sdk-asset.mjs` + `project.json` replace Unix mkdir/cp. |
| 7 | Other TS | Draft currency state, currencies route payload typing, atomic save rounding fields. |

## 2. Automated gates

```text
cwd: packages/twenty-apps/internal/quotation
npx tsgo --noEmit -p tsconfig.spec.json   → exit 0
npx vitest run                            → 783 PASS / 0 unhandled

twenty-server Windows build (post-copy script) → PASS
twenty apply -r dev-crm129 --force        → quotation@0.1.71 applied
```

## 3. Dev Nest deploy note

Running Dev image `twenty-dev/o117-restore` does not mount host Nest source. After local `twenty-server` build, quotation module dist was copied into `twenty-server-1` and `twenty-worker-1`, then containers restarted. Intranet `:6080` untouched.

```text
docker exec … grep -c supportedAdapters …/quotation-ui.controller.js  → 1
twenty-server-1 health → healthy
```

## 4. Operational matrix (Dev `:3002`)

| Case | Result | Evidence |
| --- | --- | --- |
| Accounting overview loads | PASS | Connection status / Asan-mask default visible; no «پاسخ معتبر نبود» |
| Connection list (Nest) | PASS | UI «اتصال‌ها ۱۹»; `POST /rest/quotation/actions` `accounting-connection-list` → `success:true`, `supportedAdapters:[{asan},{mock}]` |
| Edit connection + Nest tax catalog | PASS | Form shows CRM tax policies; currency IRR-only option |
| Save settings | PASS | «تنظیمات اتصال تغییر کرد؛ آزمایش اتصال دوباره لازم است» |
| Test connection (UI + Nest) | PASS | UI: «آزمایش شبیه‌سازی‌شده موفق بود»; API `accounting-connection-test` on non-default mock → `success:true` |
| Deactivate / reactivate | PASS | Non-default «اتصال آزمایشی 006»; maps preserved (`mapsEqual:true`), `afterActive:true` |
| Six connection actions via Nest (not `/s`) | PASS | list/save/test/set-default/deactivate/reactivate mapped in `quotation-api.ts` → Nest |
| Negatives | PASS | Unknown action → `INVALID_INPUT`; bad save → fail-closed validation message |
| Quotation list regression | PASS | 40 rows incl. sealed revisions / tax007 / number-race |
| Draft form IRR regression | PASS | `UAT-APPLY-030`: document currency IRR-only; tax policy picker present |
| Import / Outbound | RESIDUAL | Still `/s` Functions (`ACCOUNTING_IMPORT_ROUTE` / `ACCOUNTING_OUTBOUND_ROUTE`). Bare probe returns Functions `INVALID_INPUT` (route present) — **not** migrated to Nest; no parallel API invented; live import/outbound writes remain out of scope |

## 5. Forbidden checks

- No Backend/Frontend polyfill for `node:crypto`
- No new parallel connection API
- No security/validation weakening
- Intranet env unchanged
- Descriptor data single-sourced; registry re-exports for backend consumers

## 6. STOP_FOR_ARCHITECT

Goal 023 remains ACTIVE / NOT COMPLETE. Connection shell recovered on Dev with Nest authority + `quotation@0.1.71`. Import/Outbound Functions residual is documented, not claimed complete.
