# CRM-129-S2-R8-R1 PROOF — Financial Allocation & Rounding Correctness

**Base:** `7084993d02` (S2-R8)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS**

## 1. Proven defects (from R8)

1. **Allocation:** remainder dump onto the last line could exceed that line’s net (capacity violation) and was order-fragile for tiny nets.
2. **Rounding:** whole-rial payable delta was absorbed into last-line `taxMicros`, so stored tax was no longer policy-pure.

## 2. Fixes (no money-domain rewrite)

### Document discount allocation
- Capacity-safe largest-remainder (Hamilton): floor shares, then +1 micros by fractional part desc / stable index asc.
- Invariants always held: `sum(shares) === discount`, `0 ≤ share_i ≤ net_i`, zero-net → 0, deterministic for a given line order.

### Rounding contract
- Tax from policy stays untouched on every line.
- `roundingMicros = payable − (net + tax)` stored as independent `roundingExact`.
- `totalExact = net + tax + rounding` (always whole IRR).
- UI shows «تعدیل گردکردن» when non-zero; PDF subtotals read stored `roundingExact`; persist writes the field.

## 3. Tests / Dev

| Check | Result |
| --- | --- |
| Vitest quotation app | **208 PASS** |
| Jest `twenty-server` quotation | **13 PASS** |
| Dev `dev-exercise-s2-r8-finance.cjs` | **`S2_R8_FINANCE_PASS`** (incl. `roundingExact`) |
| Dev `dev-exercise-s2-r8-r1-finance.cjs` | **`S2_R8_R1_FINANCE_PASS`** — negative rounding, pure tax 0, reread, PDF, SENT lock |
| Regression `dev-exercise-s2-r6-ui-pdf.cjs` | **`S2_R6_UI_PDF_PASS`** |
| App apply | Quotation **0.1.4** on `dev-crm129` (`roundingExact` field added) |

## 4. Isolation

- Intranet `:6080` untouched (running, no deploy).
- No live accounting; no SMS; no main-worker restart.
- Dev `twenty-server-1` was down after host churn → started; PDF JS docker-cp + one Dev-server restart only.

## Residuals (unchanged / noted)

- Tax policy registry still **only `IR_VAT_9`** until commercial/accounting approval.
- Provisional tax/discount order still awaits finance/legal sign-off (plan D5).
- Line-hook parent version after failed line insert (open since R5).
- pdf.js ZWNJ copy PARTIAL.

## STOP_FOR_ARCHITECT
