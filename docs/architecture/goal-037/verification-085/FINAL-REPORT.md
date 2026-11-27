# CRM-129-ACCOUNTING-NATIVE-TABLE-085 — FINAL REPORT

**Verdict: PASS with documented Dev-mock dataset bound**

**Candidate:** quotation@0.1.85 @ `92af3fd63e9d621965f5350d08d0946f5c826039`  
**Mode:** BUILD + DEPLOY DEV + OPERATIONAL VERIFICATION ONLY (no product source / hot patches / permission bypass)  
**Evidence:** `docs/architecture/goal-037/verification-085/`

---

## 1. Build & Deploy (PASS)

| Gate | Result |
|---|---|
| TypeCheck (quotation) | PASS |
| Vitest (quotation) | **787 passed** / 3 skipped |
| Jest (quotation Nest) | **368 passed** / 4 skipped |
| Focused page-50 Vitest | **3/3 PASS** (`vitest-page50.log`) |
| Build twenty-shared / ui / sdk / front-component-renderer / twenty-front / quotation | PASS |
| Clean image | `twenty-dev/crm129:92af3fd…` digest `sha256:d3c4338f…` (`APP_VERSION=1.0.0`) |
| Dev deploy server+worker | healthy on :3002 |
| Apply 0.1.85 on `dev-crm129` | PASS — settings FC + import LF updated; idempotent reapply `No changes` |
| Intranet `:6080` | untouched |

**Dev-only overlay:** `docker-compose.logic-function-api.yml` sets `LOGIC_FUNCTION_API_URL=http://127.0.0.1:3000` so in-container LFs can reach Nest while browser `SERVER_URL` stays `:3002`. Not a product change.

## 2. Native Table Verification (PASS — not HTML fallback)

Browser DOM on accounting settings (`glorious-aqua-whale`), evidence `native-dom-evidence.json`:

| List | `html <table>` | Host `role=table` | Sticky | Numbered pager UI |
|---|---|---|---|---|
| Customers | **0** | ≥1 | yes | yes (۱–۲۵ از ۱۰۰) |
| Products | **0** | ≥1 | yes | yes |
| Connections | **0** | ≥1 | yes | yes |
| Documents | **0** | ≥1 | yes | yes |

Host table is a `DIV[role=table]` with `rowgroup` / `columnheader` / `row` / `cell` — Twenty primitives via `nativeSettingsTableResolvers`. Marker CSS classes are consumed by the resolver (expected).

## 3. Pagination (PASS synthetic ≥1300/10000; Dev mock bounded)

### Synthetic / production code path (required page-50 jump)

Architect gate (1,300+) and ASK (≥2,500) covered by existing Vitest against production `loadItemMappingPage` / `readSnapshotPage`:

- 1,300 rows, pageSize 25, pageNumber 50 → first ids `2225` / `3225` (rows 1226–1250); **one** destination full read
- 10,000 rows, pageSize 100, pageNumber 50 → chunk read `[9]` only (no intermediate pages)
- Stale snapshot / invalid filtered page → reset to page 1; last-page clamp

Evidence: `vitest-page50.log`, `pagination-synthetic-evidence.json`

### Dev operational API (mock PARTY_UAT = 100 parties / ~33 items)

`pagination-api.json` after LF URL overlay:

| Check | Observed |
|---|---|
| pageSize 25/50/100 | rowCount 25/50/100, totalKnown 100 |
| Search `UAT-000001` | totalKnown 1 |
| Empty search | totalKnown 0 |
| Stale snapshotId | resets to pageNumber 1 |
| Requested page 50 on 100-row set | server clamps to last page (page 4 / leftover) — cannot fabricate page 50 without ≥1,225 remote rows |

**Bound (not a product defect):** Dev mock profiles do not ship a 2,500-row remote catalog/party set. Enlarging the mock dataset would be a product source change (forbidden here). Large-jump semantics are proven on the real pagination/snapshot path via Vitest with 1,300–10,000 rows.

## 4. UI Verification (PASS scoped)

| Check | Result |
|---|---|
| Persian digits + RTL | PASS (`dir=rtl`, digits ۰-۹ in pager/range) |
| Sticky header | PASS |
| 360px | no HTML table fallback; overflow-x available |
| Numbered pager controls | اولین / قبلی / بعدی / آخرین / ۲۵·۵۰·۱۰۰ / برو به صفحه present |
| Transfer All / row ops affordances | visible on Customers (`انتقال همه`, per-row نگاشت) |
| Screenshots | not used for PASS (DOM/CDP evidence only) |

Keyboard entry of Persian digits and exhaustive bulk-transfer execution were not fully automated end-to-end in this pass; controls and native host wiring are evidenced. No live accounting writes.

## 5. Regression vs 0.1.84 (PASS scoped)

- Install/upgrade path intact (apply + idempotent)
- Mock transport remains disabled (`transportApproved: false`)
- Connection save / preview / outbound list paths respond after LF URL overlay
- Permissions model unchanged (no bypass)
- Financial integrity not altered by this UI/pagination release

## Constraints honored

- No product source changes; no hot patches; no permission bypass  
- No Intranet changes; no live accounting writes; no screenshots as acceptance  
- Secrets not committed  

## STOP_FOR_ARCHITECT

Native Twenty settings tables are live in Dev for Customers/Products/Documents/Connections (zero HTML `<table>` fallback). Direct page-50 snapshot jumps are proven on the production pagination path with ≥1,300 (and 10,000) synthetic rows. Dev mock data remains ≤100 parties / ~33 items, so operational page-50 on Dev clamps rather than serving rows 1226–1250 until an architect-approved large mock/profile dataset exists. Goal 037 disposition remains with architect.
