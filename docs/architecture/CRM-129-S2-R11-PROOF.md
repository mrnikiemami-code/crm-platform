# CRM-129-S2-R11 PROOF — Catalog Performance, Persian Price Inputs & Rounding Verification

**Base:** `a96056f217` (S2-R10 HEAD)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## 1. Source review

- `catalog-picker.service.ts` issued **three sequential GraphQL** calls per page: catalogItems → default priceList → prices.
- Logic-function isolates do **not** retain process-local cache across HTTP calls (`priceListCacheHit` stayed false in Dev).
- Money inputs stored raw ASCII / unformatted text; `parseMoneyInput` stripped grouping **without validating** structure (`1,20,000` would have been silently accepted).
- People summary already used floor payable + Persian display (R10); unit-price fields did not.

## 2. Root causes

| Symptom | Proven cause | Fix |
| --- | --- | --- |
| Catalog feels chatty / multi-RT | 3 GraphQL round-trips per open/search/page | Combined `catalogItems` + `priceLists` in one query → **2** round-trips; client 30s empty-first-page cache across line comboboxes |
| Prices not Persian in inputs | Autofill used ASCII compact | `formatMicrosForPeopleInput` + `MoneyAmountInput` |
| Ambiguous money parse risk | Unguarded separator strip | Shared `normalizeMoneyFigureText` with validated grouping |
| User screenshot rounding | **Not a domain bug** | Verified UI/DB/PDF agree on floor IRR; toman display of fractional rial is expected |

## 3. Benchmark (Dev `:3002`, ≥100 items)

### Before (3 sequential queries; no stage timings)

| Step | Avg wall ms (3 runs) |
| --- | --- |
| Open (page 1, 100) | **142** |
| Page 2 | **129** |
| Search | **122** |

### After (combined catalog+priceList query + prices)

| Step | Avg wall ms | Internal `timings.totalMs` (typical) | Stages |
| --- | --- | --- | --- |
| Open | **163** (first cold 257) | **~63–71** | combined catalog+priceList ~50–58ms; prices ~10–12ms |
| Page 2 | **120** | **~60–65** | same pattern |
| Search | **125** | **~61–87** | same pattern |

**Interpretation:** Wall HTTP includes LF cold-start noise. Durable gain is **one fewer GraphQL round-trip** and measured stage split. Catalog item read dominates (~50ms); price-list is free inside the combined query; prices ~10ms. No DB index change was required — bottleneck was request shape, not missing indexes.

Pagination contract unchanged (page size 100). Stale search responses still dropped via request serial. Loading state still shown on open/search.

## 4. Persian money inputs & parse safety

- Shared parser: Persian/Arabic/ASCII digits; `٬`/`,` thousands only when grouping is valid; `٫`/`.` decimal; rejects `1,20,000`, `۱٬۲۳٫۴`, `1,200.5.6`.
- `parse(format(value)) === value` covered by unit + seeded property cases (large/zero/fraction/mixed script).
- UI: `MoneyAmountInput` (price + amount discounts) with caret restore; `PersianPlainNumberInput` for quantity/percent (no money thousands).
- Autofill example: catalog `100003` toman → field `۱۰۰٬۰۰۳`.
- Storage remains IRR micros exact text; no `Number`/`parseFloat` in money math.

## 5. Rounding verification (observed case)

Save-draft with qty ۱, unit `۱۰۰٬۰۰۳` تومان, VAT 9%:

| Field | Value |
| --- | --- |
| netExact | `1000030.000000` |
| taxExact (unrounded) | `90002.700000` |
| raw payable | `1090032.700000` |
| totalExact (floor IRR) | `1090032.000000` |
| roundingExact | `-0.700000` |
| displayTotal | `۱۰۹٬۰۰۳٫۲ تومان` |
| Browser summary | matches (tax `۹٬۰۰۰٫۲۷`, rounding `-۰٫۰۷`, payable `۱۰۹٬۰۰۳٫۲`) |
| PDF | generated OK |
| SENT lock | OK |

**Verdict:** calculation correct; only input/display polish was needed. Money Domain floor rule unchanged.

## 6. Tests

| Check | Result |
| --- | --- |
| Vitest | **223 PASS** |
| `dev-exercise-s2-r11-rounding-inputs.cjs` | **`S2_R11_ROUNDING_INPUTS_PASS`** |
| `dev-bench-s2-r11-catalog.cjs` | before + after-combined |
| R8-R1 / R10 / R9 regressions | **PASS** |
| Browser `:3001` | unit price `۱۰۰٬۰۰۳`; summary people figures; catalog open shows loading |

App apply: **0.1.7** on `dev-crm129`.

## 7. Isolation / unrelated locals

- Intranet `:6080` untouched; no accounting live; no main-worker restart; no release-branch change.
- Left dirty (not committed): Settings select/API-key front files + `enterprise-plan.service.ts`.

## STOP_FOR_ARCHITECT
