# CRM-129-S2-R10 PROOF — Professional Quotation Workspace & Money Display

**Base:** `ae65e83c29` (S2-R9 UAT decision checkpoint)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## 1. Source review (before change)

- Draft form: secondary «افزودن ردیف», single row card tone, technical qty label, sticky save only.
- Money display used `formatMicrosExact` → people saw six trailing zeros.
- Payable used `roundMicrosToWholeRial` half-up; R8-R1 already had independent `roundingExact`.
- Full-page: Twenty `STANDALONE_PAGE` / page layouts exist, but FC sandbox has no host record picker for Person/Company; create command is side-panel scoped. **No Core rewrite authorized.**

## 2. Full page

**Status: `DEFERRED`**

**Reason:** A usable full create/edit page needs a customer record picker inside the FC host. Current Twenty FC APIs expose selected record context from the command that opened the panel, not a reusable full-page person/company picker without Core/front changes. Side panel remains the professional create path; shared domain (`buildDraftQuotationPlan` / save-draft / totals) is unchanged for a future page.

## 3. Implementation

### Form UX
- Primary blue «افزودن ردیف» (`#2563eb`, hover `#1d4ed8`, disabled via opacity on save).
- Alternating line cards `#f7f8fa` / `#eef3fb`.
- Clearer labels (تعداد / قیمت واحد / عنوان کالا); removed technical «تا ۶ رقم اعشار» and catalog noise.
- Sticky footer keeps خلاصه مالی + ذخیره visible with many rows.
- RTL / Persian retained; no parallel design system.

### People money display
- New `display-format.ts` → `formatExactDecimalForPeople` (Persian digits, `\u066c` thousands, `\u066b` decimal, trim zeros).
- `formatMoneyForDisplay` optional `formatPeople`; draft plan uses it for all UI amounts.
- Storage remains `formatMicrosExact` (six fraction digits, ASCII).
- PDF util uses the same Persian decimal separator for fractions.

### Payable floor (commercial)
- `roundMicrosToWholeRial`: floor toward −∞ to whole IRR micros (bigint only).
- Applied only at final payable; tax untouched; `roundingExact = payable − (net + tax)`; `total = net + tax + rounding`.
- Negative floor defined explicitly (toward −∞); credit-note scope not expanded.

## 4. Tests / Dev evidence

| Check | Result |
| --- | --- |
| Vitest quotation app | **217 PASS** |
| Jest `twenty-server` quotation | **13 PASS** |
| App apply `dev-crm129` | **0.1.6** (draft FC + domain files) |
| `dev-exercise-s2-r10-floor-display.cjs` | **`S2_R10_FLOOR_DISPLAY_PASS`** — floor-above-.5 `1.900000→1.000000` / `roundingExact=-0.900000`; save-draft `displayTotal=۳۴۰٬۴۸۹٫۸ تومان` (no six zeros); PDF; SENT |
| Regression `dev-exercise-s2-r8-r1-finance.cjs` | **`S2_R8_R1_FINANCE_PASS`** |
| Regression `dev-exercise-s2-r9-catalog-picker.cjs` | **`S2_R9_CATALOG_PICKER_PASS`** |
| Regression `dev-exercise-s2-r6-ui-pdf.cjs` | **`S2_R6_UI_PDF_PASS`** (retry after rate-limit) |
| Browser `:3001` (authenticated, limited) | Person → ایجاد پیش‌فاکتور: primary add button; row BGs `#f7f8fa`/`#eef3fb`; summary `۱۰۰٬۰۰۳ تومان` / tax `۹٬۰۰۰٫۲۷ تومان` / payable `۱۰۹٬۰۰۳٫۲ تومان` / rounding `-۰٫۰۷ تومان` |

## 5. Isolation / unrelated locals

- Intranet `:6080` untouched (`crm-intranet-server` stayed Up; no deploy).
- No live Asan/Sepidar; no SMS; no main-worker restart; only Dev `twenty-server-1` restarted after PDF util docker-cp.
- Unrelated dirty locals **left uncommitted**:
  - `SettingsDataModelFieldSelectForm.tsx`
  - `SettingsObjectFieldEdit.test.tsx`
  - `SettingsDevelopersApiKeyDetail.tsx`
  - `enterprise-plan.service.ts`

## Residuals

- Full-page create/edit **DEFERRED** (FC customer picker / Core).
- Tax registry still only `IR_VAT_9`; discount→tax order still provisional (plan D5).
- pdf.js ZWNJ copy PARTIAL (historical).

## STOP_FOR_ARCHITECT
