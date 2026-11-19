# CRM-129-S3-R4-HF1 — Quotation Form Crash Fix (PROOF)

**Status:** PASS (Dev browser verified)  
**Branch:** `feat/crm-129-quotation`  
**Base:** `a4e29f9a78fcbcf6019b2174c2b8d77a1fbe17a6`  
**GitHub SHA:** `55eed5d8bc`  
**App:** Quotation **0.1.13** on `dev-crm129`

## Root cause

Front-component remote `<input>` polyfill lacks `selectionStart` / `setSelectionRange`. Money inputs called `setSelectionRange` unconditionally → `setSelectionRange is not a function` → draft form crash.

## Fix

- `front-component-input-caret.ts`: guarded `readInputCaretIndex` / `restoreInputCaret` (typeof + try/catch).
- Wired into `money-amount-input.tsx` and `persian-plain-number-input.tsx`.
- Nav: `quotations.navigation-menu-item.ts` → CRM sidebar «همهٔ پیش‌فاکتورها».
- `record-api.ts`: prefer `TWENTY_APP_APPLICATION_ACCESS_TOKEN` for GraphQL so catalog/quotation routes use the app role.

## Dev browser verify (2026-11-20)

| Step | Result |
|------|--------|
| Open form | PASS — Persons → person → «ایجاد پیش‌فاکتور» opens without crash |
| Persian price | PASS — typed `۱۵۰۰۰۰` / `۸۵۰۰۰`; caret format `۱۵۰٬۰۰۰` / `۸۵٬۰۰۰`; no `setSelectionRange` error |
| Save 2 lines + 10% doc discount | PASS — draft `2dd13611-d7cb-414b-8ebf-03f3b0c9dc84` |
| Math | UI تومان: gross 235٬000 / disc 23٬500 / VAT 19٬035 / total 230٬535 ↔ DB IRR ×10 |
| List nav | PASS — sidebar «همهٔ پیش‌فاکتورها · پیش‌فاکتورها» → `/objects/quotations?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff` |
| Reload | PASS — saved row first in list; record panel opens |

## Manual click path

1. Dev front: `http://localhost:3021`
2. افراد → open a person → **ایجاد پیش‌فاکتور**
3. Pick 2 catalog lines, Persian unit prices, document discount درصدی
4. **ذخیره پیش‌نویس**
5. Sidebar → **همهٔ پیش‌فاکتورها · پیش‌فاکتورها**

## Regression

`npx vitest run` in quotation app: **240 passed**.
