# CRM-129-S2-R8 PROOF — Financial Rules & Discounts

**Base:** `f4d1b7228d` (S2-R7)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## 1. Source review (before change)

Existing bigint micros domain already had:

- Quantity scale 6 decimals; unit price as IRR micros; line % / fixed discount; tax-on-net; document = sum of rounded lines.
- Gaps: no document-level discount/allocation; tax rate typed freely (UI hardcoded ۹); payable not forced to whole IRR; header stored only `totalExact`; UI lacked fixed line discount + breakdown; PDF ignored stored subtotals.

## 2. Contract (explicit; extends provisional S1)

1. Line: `gross → line discount → net`
2. Document discount on `sum(line nets)`, allocated **half-up by net weight**, remainder on last line (auditable, exact sum)
3. Tax on `(net − document share)` from **resolved tax policy** (registry: `IR_VAT_9` = 900 bp only; unknown policies refused — no invented rates)
4. Payable = sum(line totals) **rounded half-up to whole IRR**; rounding delta absorbed into last line tax so columns still add up

No Float in money math. Toman remains display/input only; storage is IRR micros text.

## 3. Implementation

- Domain: `tax-policy.ts`, `document-discount.ts`, `finalizeLinesWithDocumentDiscount`, `roundMicrosToWholeRial`
- Draft/save/persist/UI: line discount NONE|RATE|AMOUNT; document discount same; breakdown displays; schema fields for gross/line/document/net/tax + discount input metadata; line `grossExact` + `documentDiscountExact`
- PDF: reads **stored** header breakdown into subtotals (no independent recalculation)
- App `0.1.3` applied on `dev-crm129`; Dev server PDF JS docker-cp’d + `twenty-server-1` restart only

## 4. Tests

| Suite | Result |
| --- | --- |
| Vitest quotation app | **199 PASS** (incl. new document-discount / payable / draft cases) |
| Dev `dev-exercise-s2-r8-finance.cjs` | **`S2_R8_FINANCE_PASS`** — stored whole-rial payable `882900.000000`, gross/line/doc/tax fields, PDF `%PDF` |
| Regression `dev-exercise-s2-r6-ui-pdf.cjs` | lifecycle DRAFT→…→CUSTOMER_ACCEPTED + PDF + conflict Persian **PASS** |

## 5. Isolation

- Intranet `:6080` untouched; no accounting live; no SMS; no main-worker restart; no release-branch change.

## Residuals

- Line-hook parent version after failed line insert (open since R5)
- pdf.js ZWNJ copy PARTIAL
- Tax policy registry contains only `IR_VAT_9` until commercial/accounting approval of more policies
- Provisional tax/discount order still awaits finance/legal sign-off for live fiscal invoices (plan D5)

## Manual UI path

`http://localhost:3001` → create quotation command → form shows line + document discounts and breakdown → save → record fields + PDF subtotals reflect stored amounts.

## STOP_FOR_ARCHITECT
