# CRM-129-QUOTATION-RECORD-UX-002 — Record Panel Edit, Lifecycle, Sharing (PROOF)

**Status:** PASS (Dev browser verified on `http://localhost:3002`)  
**Branch:** `feat/crm-129-quotation`  
**Base:** `8e91f7904cb30554b2d45519b23b175b59b6d7a7`  
**App:** Quotation **0.1.15** on `dev-crm129`  
**View:** «همهٔ پیش‌فاکتورها» — `viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`

## 1. Draft form loads the real document and saves in place

The record panel used to open an empty create form. It now reads the clicked record
back into the form.

- `src/services/quotation-draft-edit.service.ts` — reads quotation + lines through
  `buildQuotationDraftEditQuery`, converts stored exacts into the *same* text shapes
  the create form uses (`quantityText`, `unitPriceText`, discount kind + inputs) and
  exposes `contentEditable` from `canEditQuotationLines(status)`.
- `src/domain/quotation/draft-quotation.ts` — the form state can be seeded from an
  existing draft instead of `emptyDraft()`; `quotationId` + `version` travel with it.
- `src/components/quotation-draft-form.tsx` — edit mode renders the loaded document,
  keeps the record id, and submits `expectedVersion` so the server can reject stale
  writes.
- `src/logic-functions/save-draft-quotation.ts` — an edit with `quotationId` updates
  that record (bump `version`), it never creates a second quotation.

**Dev evidence** (draft `40f8213a-5a58-4c33-98d4-5d31c2b64557`, `S3-R2-other-1795146485040`):

| Step | Before | After (reload) |
|---|---|---|
| Quantity | ۱ | ۳ |
| Unit price | ۹۰۰ تومان | ۱٬۷۵۰ تومان |
| Line discount | بدون تخفیف | ۵٪ = ۲۶۲٫۵ تومان |
| Document discount | بدون تخفیف | ۱۲٪ = ۵۹۸٫۵ تومان |
| Gross / net / VAT | ۹۰۰ / ۹۰۰ / ۸۱ | ۵٬۲۵۰ / ۴٬۳۸۹ / ۳۹۵٫۰۱ |
| Payable | ۹۸۱ تومان | ۴٬۷۸۴ تومان (= ۴۷٬۸۴۰ ریال) |
| `version` | ۳ | ۴ |
| `id` | `40f8213a-…` | `40f8213a-…` (same record, no duplicate) |

`node scripts/dev-verify-crm129-draft-edit.cjs 40f8213a-…` confirms server-side:
`quantityExact 3`, `unitPriceExact 17500`, `grossExact 52500`,
`documentDiscountKind RATE`, `documentDiscountInputExact 12`,
`documentDiscountExact 5985`, `netExact 43890`, `taxExact 3950.1`,
`roundingExact -0.1`, `totalExact 47840`, `totalCount 75` (unchanged). UI math equals
server math to the rial.

## 2. Protected fields are closed in the public UI, protection stays on the server

- `objects/quotation.object.ts` / `objects/quotation-line.object.ts` mark computed and
  system-owned fields `isUIEditable: false` (`quotationNumber`,
  `quotationNumberLabel`, `grossExact`, `lineDiscountExact`,
  `documentDiscountExact`, `documentDiscountInputExact`, `netExact`, `taxExact`,
  `roundingExact`, `totalExact`, `discountKind`, `discountInputExact`, `sortOrder`,
  `version`…). No server guard was weakened for this.
- Server immutability is unchanged and re-proven from the Dev browser session's own
  record (now `READY_TO_SEND`, version 6):

```
POST /s/quotation/save-draft  → 200
{"success":false,"code":"QUOTATION_IMMUTABLE",
 "message":"پس از ارسال، ویرایش مستقیم مجاز نیست؛ باید نسخهٔ جدید ساخته شود"}
```

- `scripts/dev-verify-crm129-locked-guard.cjs` (new) asserts, for a locked record:
  - GraphQL content write with the current version → `FORBIDDEN`,
    `userFriendlyMessage: «محتوای این پیش‌فاکتور قفل است. برای تغییر، نسخهٔ جدید صادر کنید.»`
  - `transition` back to `DRAFT` → `success:false`, `TRANSITION_NOT_ALLOWED`,
    «این تغییر وضعیت مجاز نیست.»
  - name/version/total/status unchanged afterwards → `CRM129_LOCKED_GUARD_PASS`.
- In the browser, the locked record's «فیلدها» tab renders the calculated fields as
  text (1 `file` input only, no content inputs) and the «ویرایش پیش‌نویس» button is
  gone.

## 3. «اقدامات» tab is a real lifecycle surface

`src/components/quotation-lifecycle-panel.tsx` is registered in the record page
layout as the «اقدامات» tab and works on the opened record, not on a copied form.

Dev run on `40f8213a-…`:

| Step | Panel state | Table row |
|---|---|---|
| opened | «وضعیت: پیش‌نویس — نسخه 4» + ویرایش پیش‌نویس / ارسال برای تأیید / لغو / دانلود PDF فارسی | پیش‌نویس · بدون شماره |
| «ارسال برای تأیید» | «در انتظار تأیید — نسخه 5» + بازگرداندن برای اصلاح / تأیید و آماده ارسال | پیش‌نویس → **در انتظار تأیید** (no reload) |
| «تأیید و آماده ارسال» | «آماده ارسال — شماره QT-1405-000019 — نسخه 6»، متن قفل‌شدن محتوا، ۷ کانال ارسال | **QT-۱۴۰۵-۰۰۰۰۱۹ · آماده ارسال · ۴۷٬۸۴۰ ریال** (no reload) |

Allowed actions are derived from status and role; there is no direct status cell edit
(`status` is not UI-editable and the server refuses status writes without the lifecycle
action — see R4).

Sharing/PDF from the same tab:

- «دانلود PDF فارسی» → toast «فایل PDF آمادهٔ دانلود است.» and a real PDF payload
  (`POST /rest/quotation/actions` → `pdfBase64`; the S2-R6 script wrote 11,626 bytes).
- Seven channels are listed: بله · واتساپ · تلگرام · اینستاگرام · ایتا · روبیکا · سروش.
- Manual channel run (واتساپ) → customer-view link minted
  (`/s/quotation/customer-view?token=…`) and the Persian copy
  «اتصال خودکار این کانال فعال نیست. متن و لینک برای اشتراک‌گذاری دستی آماده شد؛ ارسال موفق ثبت نشد.»
- Bale stays provider-only: without a numeric `chat_id` the server refuses
  (`INVALID_INPUT`, Persian); with credentials absent the contract script reports
  `PROVIDER_FAILED` and **no** `communicationId`, i.e. a send is only recorded on a
  real successful API answer (`S3_R4_BALE_CONTRACT_PASS`, `LIVE_UNVERIFIED`).

## 4. RTL resize regression (general fix, not quotation-specific)

`resolvePanelWidthDelta` + `useResizablePanel` read the handle's computed `direction`
instead of assuming LTR.

Live measurements on `:3002` (RTL app, `--side-panel-width`):

| Direction | Drag | Before → After | Expectation |
|---|---|---|---|
| RTL | +80 px (right) | 400 px → **480 px** | widens |
| RTL | −80 px (left) | 480 px → **400 px** | narrows |
| LTR (mirrored layout) | +80 px (right) | 400 px → **320 px** (min) | narrows |
| LTR (mirrored layout) | −80 px (left) | 320 px → **400 px** | widens |

Unit tests in `resizable-panel/utils/__tests__/resolvePanelWidthDelta.test.ts` cover the
same four cases plus browser zoom.

## 5. Persian-only operator copy, and no raw route in the panel header

- `src/domain/quotation/ui-message.ts` strips machine-code prefixes
  (`INVALID_INPUT: …`) before any message reaches a toast; covered by
  `ui-message.test.ts`.
- `quotation-query-validation.exception.ts` (server) now derives
  `userFriendlyMessage` from the quotation code, so the Apollo client shows Persian
  copy while logs keep the English detail. Covered by
  `quotation-query-validation.exception.spec.ts`.
- `useRecordShowPageName` + `SidePanelPageTitleSyncEffect` in
  `RecordShowPageHeader.tsx` / `RecordShowPageTitle.tsx` sync the panel header to the
  record label: the panel top bar shows `S3-R2-other-1795146485040`, not
  `/object/quotation/40f8213a-…`.
- Observed toasts in Dev: «تغییرات پیش‌نویس ذخیره شد», «ارسال برای تأیید انجام شد.»,
  «تأیید و آماده ارسال انجام شد.», «فایل PDF آمادهٔ دانلود است.» — no English stack
  traces, no raw codes.

## 6. Test runs (this round)

| Suite | Result |
|---|---|
| quotation app vitest (`npx vitest run`) | 28 files / **258 tests PASS** |
| server quotation jest (`exceptions/__tests__`) | **4 tests PASS** |
| front jest (`resizable-panel`, `RecordShowPageHeader.surface`, `useFrontComponentExecutionContext`) | **65 tests PASS** |
| `tsgo --noEmit` twenty-front | clean |
| `tsgo --noEmit` quotation app (`tsconfig.spec.json`) | clean |
| `tsgo --noEmit` twenty-server | 2 **pre-existing** errors in untouched files (`quotation-communication-outbound.service.ts:135` `'PORT'`, `test/spikes/quotation-pdf/quotation-pdf-document.ts:125`); `git status` shows both files unmodified by this task |

## 7. Regression scripts (R2–R4) on Dev

| Script | Marker | Note |
|---|---|---|
| `dev-verify-crm129-draft-edit.cjs` | in-place update, version 4, total 47,840 | new |
| `dev-verify-crm129-locked-guard.cjs` | `CRM129_LOCKED_GUARD_PASS` | new |
| `dev-exercise-s2-r8-finance.cjs` | `S2_R8_FINANCE_PASS` (1,000,000 − 100,000 − 90,000 + 9% = 882,900) | R2 finance |
| `dev-exercise-s2-r6-ui-pdf.cjs` | `S2_R6_UI_PDF_PASS` (PENDING → READY → SENT → ACCEPTED, 11,626-byte PDF, Persian stale-version copy) | R3 lifecycle/PDF |
| `dev-exercise-s3-r3-share.cjs` | `S3_R3_SHARE_PASS` | updated: BALE now refuses without `chat_id`; RUBIKA keeps `MANUAL_SHARE` |
| `dev-exercise-s3-r4-bale.cjs` | `S3_R4_BALE_CONTRACT_PASS` | no fake send |
| `dev-exercise-s2-r4-version-bypass.cjs` | `QUOTATION_VERSION_REQUIRED` / `QUOTATION_VERSION_CONFLICT` | R4 concurrency |
| `dev-exercise-s2-r4-roles.cjs` | `S2_R4_ROLE_PASS` (limited role cannot approve/send/cancel/accept) | R4 security |
| `dev-exercise-crm129-numbering-race.cjs` | 4 racers → `QT-1405-000025…28`, all distinct | numbering |

`dev-exercise-s3-r3-share.cjs` needed one correction: it still assumed Bale was a
manual channel. Bale is provider-only since S3-R4, so the assertion now expects a
Persian refusal without `chat_id` and uses RUBIKA for the second manual channel.

## 8. Manual click path (architect)

1. `http://localhost:3002` → sidebar «همهٔ پیش‌فاکتورها».
2. Click a draft title (e.g. `S3-R2-other-1795146485040` before the run) → panel opens.
3. Tab «اقدامات» → «ویرایش پیش‌نویس» → change quantity/price/discounts → «ذخیره تغییرات».
4. Re-open the same row: values, «مبلغ کل» and «نسخه» reflect the save; the record id is unchanged.
5. «ارسال برای تأیید» → «تأیید و آماده ارسال»: status and `QT-…` number appear in the table without reload.
6. «دانلود PDF فارسی» / a channel button → «ارسال پیش‌فاکتور».
7. Drag the panel handle right, then left (RTL). For LTR, switch the UI language once and repeat.

## 9. Not verified / limits

- Bale live send not exercised (`LIVE_UNVERIFIED`; `CRM129_BALE_BOT_TOKEN` /
  `CRM129_BALE_CHAT_ID` absent). Contract + failure path only.
- WhatsApp/Telegram/Instagram/Eita/Rubika/Soroush are manual-share channels by design;
  no provider API is claimed for them.
- Panel header numerals show `نسخه 4` in Latin digits inside the lifecycle panel
  (field grid shows ۴). Cosmetic, untouched here.
- Server `tsgo` errors listed in §6 are pre-existing on the branch, not introduced by
  this task and not fixed here.
- Browser resize was exercised with real DOM mouse events on the live handle (no
  Playwright input injection available in this environment); geometry and CSS variable
  were read before/after each drag.
