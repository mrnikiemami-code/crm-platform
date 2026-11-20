# CRM-129-QUOTATION-LIST-UX-001 — Professional Quotation List (PROOF)

**Status:** PASS (Dev browser verified on `http://localhost:3002`)  
**Branch:** `feat/crm-129-quotation`  
**Base:** `5ab67884a156095101e7bf171f550a6d95093316`  
**App:** Quotation on `dev-crm129`  
**View:** «همهٔ پیش‌فاکتورها» — `viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`

## 1. Why `quotationNumber` was empty

`quotationNumber` was declared on the object but nothing ever wrote it:

- The field existed only as a storage column; no server path allocated a value.
- The app-side `numbering.ts` knew how to format a number, but formatting needs a
  sequence, and no sequence was claimed anywhere.
- Drafts are created before the document is issued, so even a working allocator
  would have had nothing to write at draft time — the number belongs to issuance.

Consequence: every quotation in the workspace had `quotationNumber = NULL`, and the
list column rendered blank for all 61 active rows.

## 2. Numbering at issuance (server-owned, atomic)

**Rule:** a number is claimed exactly when a quotation becomes `READY_TO_SEND` — the
moment the document is issued — inside the same transaction that flips the status.

- `utils/quotation-numbering.util.ts` — pure half: Jalali fiscal year
  (`Asia/Tehran`), scope key `QUOTATION:<year>`, `QT-<year>-<6 digits>`, Persian
  label, and the draft label «بدون شماره».
- `services/quotation-number.service.ts` — single-statement claim on
  `_quotationSequence`:
  `INSERT ... ON CONFLICT ("scopeKey") DO UPDATE SET "lastIssued" = sequence."lastIssued" + 1 RETURNING "lastIssued", "width"`.
  Read-then-write would let two issuers read the same counter; the conflict clause
  performs the increment under the row lock, so the value handed back is the one
  that won.
- `services/quotation-immutability.service.ts` — on the transition to
  `READY_TO_SEND` with no existing number: allocate, write `quotationNumber`, write
  the Persian `quotationNumberLabel`, and refuse the update if allocation fails
  (no silent numbered-less issuance).
- `query-hooks/quotation-query-hook.module.ts` — registers/exports the service.

**Past rows were not reconstructed.** No number was guessed, derived from row order,
or backfilled. Existing unnumbered rows say «بدون شماره».

## 3. Real customer, not typed text

`customerName` is a read-only projection derived from the record's actual links
(`person` → person name, `company` → company name), computed on save by
`quotation-persist.service.ts` via `domain/quotation/customer-label.ts`. No free-text
customer field is involved, and the column header is «مشتری».

## 4. Money display

- New read-only `totalDisplay`, produced by
  `formatExactAmountWithCurrency(totalExact, currency)` in the shared Money Domain
  formatter (`domain/money/display-format.ts`).
- Adds the unit only; the digits still come from `formatExactDecimalForPeople`.
- No `Number`, `parseFloat`, or re-rounding anywhere on this path — the string is
  formatted digit-by-digit.
- `totalExact` remains the stored, six-decimal calculation reference and is hidden
  from the view, not removed.

## 5. View shape (`views/quotations.view.ts`)

Visible, in order: `name` → `quotationNumberLabel` («شماره سند») → `customerName`
(«مشتری») → `status` («وضعیت») → `totalDisplay` («مبلغ کل»).

Kept in the view but hidden: `quotationNumber`, `customerType`, `totalExact`,
`version`. Hiding a field keeps it sortable, filterable and present in the record —
the optimistic-concurrency token (`version`) is untouched internally.

## 6. Dev browser verification (`http://localhost:3002`)

Path: sidebar **«همهٔ پیش‌فاکتورها»** → `/objects/quotations?viewId=c3a14f2d-…`

Headers rendered: `عنوان` · `شماره سند` · `مشتری` · `وضعیت` · `مبلغ کل`.
`نسخه`, `جمع کل قابل پرداخت (ریال صحیح)` and `شماره پیش‌فاکتور` are absent.

| Row (عنوان) | شماره سند | مشتری | وضعیت | مبلغ کل |
|---|---|---|---|---|
| CRM129-number-race-…-3 | QT-۱۴۰۵-۰۰۰۰۰۳ | فرید رفیعی | آماده ارسال | ۱٬۰۹۰ ریال |
| CRM129-number-race-…-2 | QT-۱۴۰۵-۰۰۰۰۰۵ | فرید رفیعی | آماده ارسال | ۱٬۰۹۰ ریال |
| CRM129-number-race-…-1 | QT-۱۴۰۵-۰۰۰۰۰۴ | فرید رفیعی | آماده ارسال | ۱٬۰۹۰ ریال |
| CRM129-number-race-…-0 | QT-۱۴۰۵-۰۰۰۰۰۲ | فرید رفیعی | ارسال شده | ۱٬۰۹۰ ریال |
| CRM129-list-ux-… | QT-۱۴۰۵-۰۰۰۰۰۱ | فرید رفیعی | آماده ارسال | ۱٬۰۹۰٬۰۰۰ ریال |
| پیش‌فاکتور جدید | بدون شماره | محمد طهماسب | پیش‌نویس | ۲٬۳۰۵٬۳۵۰ ریال |

The last row is the ADDENDUM's exact case: stored `totalExact = 2305350.000000`,
rendered `۲٬۳۰۵٬۳۵۰ ریال`.

Screenshot: [assets/crm-129-quotation-list-2026-11-20.png](./assets/crm-129-quotation-list-2026-11-20.png)

## 7. Database cross-check (read-only)

Active (non-deleted) quotations: **61** — 5 numbered, 56 «بدون شماره».

```
 active | active_numbered | active_unnumbered
--------+-----------------+-------------------
     61 |               5 |                56
```

Integrity checks over active rows (both must be 0):

| Check | Result |
|---|---|
| numbered row missing its Persian label | 0 |
| row missing `customerName` or `totalDisplay` | 0 |

Sequence state — one scope for the Jalali year, no gaps from the concurrency burst:

```
   scopeKey     | lastIssued | width
 QUOTATION:1405 |          5 |     6
```

## 8. Concurrency proof

`scripts/dev-exercise-crm129-numbering-race.cjs` fired 4 parallel transitions to
`READY_TO_SEND` and got 4 distinct consecutive numbers (`…000002` → `…000005`) —
no duplicate, no burned number, no gap.

## 9. Backfill

`scripts/backfill-list-display.ts` filled only the three display projections
(`quotationNumberLabel` = «بدون شماره» for unnumbered rows, `customerName` from the
real link, `totalDisplay` from `totalExact`). It never writes `quotationNumber`.

## 10. Regression

| Suite | Result |
|---|---|
| `packages/twenty-apps/internal/quotation` (vitest) | 26 files, **246 passed** |
| `packages/twenty-server/src/modules/quotation` (jest) | 7 suites, **32 passed** |

New tests: `quotation-numbering.util.spec.ts` (8 — fiscal year, width, padding,
overflow, Persian digits, draft label) and `list-display.test.ts` (6 — draft label,
Persian grouping, unit suffix, missing customer).

## 11. Known limitation (architect decision)

The **workspace-provisioned** view for the object is still the platform-generated
`All پیش‌فاکتورها`, which lists every column (34). It is not the app's view and is not
edited by this app manifest; the app view is reachable from the sidebar and the view
picker. Making the app view the workspace default would need a platform-level
default-view change — deliberately out of scope here.

**Gate: STOP_FOR_ARCHITECT**
