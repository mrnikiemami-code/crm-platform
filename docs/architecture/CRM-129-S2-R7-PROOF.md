# CRM-129-S2-R7 PROOF — Dev Front UI Acceptance & Recovery

**Base:** `c83d5bd7c1bb633ce6b73ac3b588559dd2e556d9` (S2-R6)  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS** (authenticated browser UAT on `:3001` → API `:3002` via `callQuotationRoute`)

## 1. Source / environment

- Reviewed lifecycle panel, page layout, `QuotationUiController` / `QuotationUiService`, host `callQuotationRoute`, permissions/version/status contracts (S2-R3–R6).
- Dev front started with `npx nx start twenty-front` → `http://localhost:3001` (200); `REACT_APP_SERVER_BASE_URL=http://localhost:3002`.
- Intranet `crm-intranet-server` left running (Up 2d, `:6080`); no worker restart, no Asan/Sepidar, no SMS.

## 2. Proven defects fixed (narrow)

| Defect | Fix |
| --- | --- |
| Front-component unwrap only matched `*.tsx`; quotation entries were `*.ts` → `default` stayed ValidationResult → `FrontComponent error: (intermediate value).default is not a function` | Rename quotation FC entries to `.tsx`; SDK filter also accepts `.ts` |
| Empty `builtComponentChecksum` → client URL `…/{id}/.js` | `getFingerprintedRestUrl` treats `""` as missing (bare id URL) |
| Windows checksum match used backslash path vs POSIX manifest → checksum stayed `""` | `manifestUpdateChecksums` compares `normalizedRootBuiltPath` |
| PDF download via `document.createElement('a')` inside FC worker threw → false “ارتباط با سرور برقرار نشد” | Host `callQuotationRoute` downloads PDF on main thread; worker only confirms |

App bumped **0.1.1 → 0.1.2** and re-applied on `dev-crm129`.

## 3. Browser UAT (authenticated: tim@apple.dev)

Manual path: `http://localhost:3001/object/quotation/{id}` → tab **اقدامات**.

Quotation under test: `1a8bab82-3df6-4377-8e5e-99ba41ba478b` (“پیش‌فاکتور مسیر ذخیره”).

| Step | Result |
| --- | --- |
| Catalog PRODUCT + SERVICE create (Dev GraphQL) | `cda15a73-…` / `edabd988-…` |
| Open saved draft Person quotation | Status پیش‌نویس / v1 |
| Tab **اقدامات** loads lifecycle panel | PASS (after FC unwrap fix) |
| ارسال برای تأیید | PENDING_INTERNAL_APPROVAL v2; toast success |
| تأیید و آماده ارسال | READY_TO_SEND v3; content-lock notice |
| ثبت ارسال به مشتری | SENT v4; record-send only notice |
| دانلود PDF فارسی | Host blob ~10021 B; toast «فایل PDF آمادهٔ دانلود است.»; API `%PDF-1.3` |
| ثبت پذیرش مشتری | CUSTOMER_ACCEPTED v5; `sentAt` + `decidedAt` set in DB |
| Content lock after READY/SENT | Shown on اقدامات; fields remain non-editable for content |

`callQuotationRoute` exercised **in-browser** (not API-only).

## 4. Isolation

- Only Dev `:3001` / `:3002` / quotation app apply.
- Intranet containers untouched (no recreate/restart this round).
- No release-branch change, no live accounting, no SMS, no screenshot loop.

## 5. Residuals (unchanged / open)

- Line-hook parent version bump if line insert fails after claim (R5) — open, not widened.
- pdf.js browser ZWNJ copy limitation — kept PARTIAL; generation preserves ZWNJ.
- `builtComponentChecksum` may still be empty on Windows until SDK dist rebuild ships the checksum path fix; bare-id URL workaround is live in front.

## Manual retest

1. `http://localhost:3001` (API `http://localhost:3002`)
2. Objects → **پیش‌فاکتورها** → open a DRAFT (or create via command menu)
3. Tab **اقدامات** → lifecycle buttons + **دانلود PDF فارسی**
4. Confirm transitions and PDF download toast

## STOP_FOR_ARCHITECT

Next continuation point: **S3 Customer Quotation Portal** (not authorized here).
