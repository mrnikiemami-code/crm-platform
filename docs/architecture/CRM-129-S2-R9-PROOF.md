# CRM-129-S2-R9 PROOF — Professional Quotation Form & Scalable Catalog Picker

**Base:** `d3eeff7a6d` (S2-R8-R1)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## 1. Source review

- Draft form used free-text names and always saved `catalogItemId: null`.
- CatalogItem / Price / PriceList already model active items and default IRR prices; persist already wrote `itemId` when provided.
- Front components cannot import host `twenty-ui` Select; established app pattern is `callAppRoute` → logic function → workspace GraphQL.
- GraphQL already supports cursor `after` / `pageInfo`, `ilike`, and `or` filters.

## 2. Implementation

- `POST /quotation/search-catalog-items`: active-only, page size ≤100, stable `orderBy` name+id, server search on name+sku, prices from default IRR PriceList (validity windows honored; no new pricing invention).
- `CatalogItemCombobox`: 300ms debounce, request serial (stale responses ignored), infinite scroll, loading / empty / error+retry.
- Draft form: catalog picker + autofill snapshot (name/sku/unit/description/price), per-line errors, partial money-domain totals for valid lines, human tax label «مالیات بر ارزش افزوده ۹٪», sticky save/close, RTL side-panel layout.
- Save sends `catalogItemId` + financial snapshot; quotation unit-price edits do not mutate catalog Price.
- App **0.1.5**. Front-build fix: `accepted`/`refused` as function declarations (esbuild `tsx` loader).

## 3. Dev evidence

| Check | Result |
| --- | --- |
| Vitest | **214 PASS** |
| App apply `dev-crm129` | **0.1.5** + `search-catalog-items` |
| `dev-exercise-s2-r9-catalog-picker.cjs` | **`S2_R9_CATALOG_PICKER_PASS`** — seed 105, page1=100, page2=5, no cross-page dupes, save with `itemId`s, PDF, SENT |
| SKU/server search | GraphQL + route find item by sku with attached `unitPriceExact` |
| `dev-exercise-s2-r6-ui-pdf.cjs` | lifecycle + PDF + conflict Persian **PASS** |
| Browser (authenticated `:3001`) | Person → «ایجاد پیش‌فاکتور» opens redesigned form; catalog combobox loads live options with code/unit/price; incomplete line error shown; save disabled until valid |

## 4. User path

1. Person/Company record → **ایجاد پیش‌فاکتور**
2. Open catalog combobox → search / scroll → select item (autofill)
3. Adjust qty / discounts → live summary updates
4. **ذخیره پیش‌نویس** → record keeps `itemId` + price snapshot → PDF / lifecycle unchanged

## 5. Isolation

- Intranet `:6080` untouched. No live Asan/Sepidar. No main-worker restart. No release-branch change.

## Residuals

- Tax registry still only `IR_VAT_9` (temporary).
- Discount→tax order still provisional (plan D5).
- Seed script deep-target naming corrected for future runs so the deep item sorts onto page 2 of the same prefix filter (pagination itself already proven with 100+5).

## STOP_FOR_ARCHITECT
