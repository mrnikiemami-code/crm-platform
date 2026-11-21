# CRM-129-QUOTATION-UNIFIED-CREATION-003 — Proof

**Date:** 2026-11-21
**Repository:** `mrnikiemami-code/crm-platform`
**Branch:** `feat/crm-129-quotation`
**Expected base / verified HEAD before work:** `82447297c8d52e55f02f67c4978a3f5ed3ddb749` (`feat(quotation): edit drafts in place and drive lifecycle from the record panel`)
**Dev environment:** `http://localhost:3002`, workspace `dev-crm129`, quotation app **0.1.17** (deployed with the SDK CLI from this branch)
**Gate:** `STOP_FOR_ARCHITECT`

**Verdict:** every acceptance path exercised below behaves as required, with one explicitly scored exception: the header/lines save is **still not atomic** (§6). No `DATA_INTEGRITY_PASS` is claimed.

---

## 1. What the task asked and what changed

Quotation creation and editing had two doors: the professional `QuotationDraftForm` (catalog, customer, exact money, lifecycle) and Twenty's generic record form (a blank header row with raw fields). This task closes the generic door for `quotation` only, and makes the professional form the only creation/editing surface.

| Requirement | Implementation |
| --- | --- |
| List → «پیش‌فاکتور جدید» opens the professional form | `create-quotation-from-quotations.command-menu-item.ts` — a `GLOBAL_OBJECT_CONTEXT` command menu item pointing at `QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER` |
| Twenty's generic create never opens for `quotation` | `isUICreatable: false` in `objects/quotation.object.ts`; the platform's create affordance is gated on `canCreateRecordsForObjectMetadataItem`, so only the app command remains |
| Person / Company / other objects unaffected | flag applied to the `quotation` object definition only; DB readback in §7.9 shows `person`, `company`, `task` still `isUICreatable = true` |
| Real customer search with valid ids | `components/customer-picker.tsx` + `logic-functions/search-customers.ts` + `services/customer-picker.service.ts` + `data/customer-queries.ts` |
| No fabricated / empty customer | `verifyCustomerRecord` runs **before the first write** in `services/quotation-persist.service.ts`; domain still refuses missing/mixed customer |
| Pre-selection from Person/Company preserved | `QuotationDraftForm` resolves the preselected id to a readable label through the same search route; both sides never populated at once |
| Edit in place from the record panel | existing `EDIT_QUOTATION_DRAFT_COMMAND` → same form with `quotationId`; header/lines/labels hydrated by `services/quotation-draft-edit.service.ts` |
| Locked documents immutable | `QUOTATION_IMMUTABLE` refusal (Persian) + whole form disabled (`pointerEvents: none`, dimmed, save disabled) |
| Table reflects save without reload | `refreshRecordData` added to the Front Component host API → `apolloCoreClient.refetchQueries({ include: 'active' })` |
| No parallel Money Domain / Send Stack / form | no new money or send code; only the existing form, catalog, persist and lifecycle services were reused |

---

## 2. Entry points, traced in source

### 2.1 The only creation door

`packages/twenty-apps/internal/quotation/src/command-menu-items/create-quotation-from-quotations.command-menu-item.ts`

```ts
export default defineCommandMenuItem({
  universalIdentifier: CREATE_QUOTATION_FROM_QUOTATIONS_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'پیش‌فاکتور جدید',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'quotation' &&
    objectPermissions.canUpdateObjectRecords &&
    !hasAnySoftDeleteFilterOnView,
  frontComponentUniversalIdentifier: QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
```

Why `GLOBAL_OBJECT_CONTEXT`: the list page has no selected record, so a selection-bound command would be unavailable on an empty list. Registration verified in the metadata DB (`core."commandMenuItem"` → 1 row for `d1e2f3a4-b5c6-5780-a123-456789abcdef`).

### 2.2 The generic door is closed by metadata, not by URL

`packages/twenty-apps/internal/quotation/src/objects/quotation.object.ts`

```ts
  // A quotation is never created from Twenty's generic record form: a blank
  // header with no customer and no lines is not a document. Closing the generic
  // create affordance here is what routes every entry point to the professional
  // draft form (the app's own command), while leaving other objects untouched.
  isUICreatable: false,
```

This is the narrowest available switch: it is read by the platform's create-command template and by `canCreateRecordsForObjectMetadataItem`, which gates the record-index create button, the inline "add new" row and the panel creation flow. No Core file was forked and no URL/viewId heuristic was introduced.

### 2.3 The host refresh bridge

`refreshRecordData` was added to the Front Component host API — argument-free, so a component cannot use it to read anything the host would not already fetch:

- `packages/twenty-front/src/modules/front-components/hooks/useFrontComponentExecutionContext.ts` — `apolloCoreClient.refetchQueries({ include: 'active' })`, failures swallowed (the write already succeeded).
- `packages/twenty-front-component-renderer/src/types/FrontComponentHostCommunicationApi.ts`, `.../WorkerFrontComponentHostCommunicationApi.ts`, `host/thread/constants/FrontComponentHostCommunicationApiNoop.ts`, `remote/worker/thread/utils/buildFrontComponentHostCommunicationApiFromThreadImports.ts` and the two story meta files.
- `packages/twenty-sdk/src/sdk/front-component/globals/frontComponentHostCommunicationApi.ts` + `front-component/index.ts` (`RefreshRecordDataFunction`).

Older hosts that do not expose the function are tolerated: `refreshRecordDataFromHost()` returns silently when the bridge is absent.

---

## 3. Customer selection and server-side validation

**UI (`components/customer-picker.tsx`)** — a real searchable listbox:

- 300 ms debounce, request serial guard so a slow reply cannot overwrite a newer query;
- states: `در حال جست‌وجو…`, `موردی یافت نشد`, `برای دیدن گزینه‌ها نام را جست‌وجو کنید`, an error message plus «تلاش دوباره»;
- label = `firstName + lastName` for people (job title/email as secondary line), `name` for companies; a real record with no name renders «شخص بدون نام» / «شرکت بدون نام» rather than being hidden or renamed;
- the panel never invents an id: the id of the chosen row is exactly what the form posts;
- switching «نوع مشتری» clears the search and the previous side, so a stale relation cannot be sent along with the new one.

**Server (`logic-functions/search-customers.ts`, `/quotation/search-customers`, `isAuthRequired: true`)** — reads go through the app role; a lost person/company read permission surfaces as `PERMISSION_DENIED` with a Persian message instead of rows. Preselected/hydrated ids are resolved by `recordId` so the form shows a name, not a bare id.

**Pre-write verification (`services/quotation-persist.service.ts`)**

```ts
  const customerCheck = await verifyCustomerRecord(
    { customerType, recordId: ... },
    dependencies,
  );

  if (!customerCheck.ok) {
    return { kind: 'REJECTED', code: customerCheck.refusal.code, message: customerCheck.refusal.detail };
  }
```

This runs before `buildCreateQuotationMutation`/`buildUpdateQuotationMutation` and before any line write. Refusal codes are `CUSTOMER_NOT_FOUND`, `CUSTOMER_PERSON_REQUIRED`, `CUSTOMER_COMPANY_REQUIRED`, `PERMISSION_DENIED`, `CUSTOMER_LOOKUP_FAILED`, all with Persian detail. Unit test: *"refuses a customer id the workspace cannot resolve, before any write"* asserts zero create-quotation and zero create-line queries.

---

## 4. In-place editing from the record panel

- `quotation-draft-edit.service.ts` now reads `person { id name { firstName lastName } }` / `company { id name }` (`quotation-queries.ts`) and returns `customerLabel`, so reopening a draft shows the customer instead of an empty picker.
- Saving with `quotationId` updates the same id: header update **and** line updates reuse existing line ids, stale lines are soft-deleted last, then the authoritative version is read back (`buildQuotationByIdQuery`) and returned to the panel. No `create` path is reachable when `quotationId` is present.
- `expectedVersion` is optional; when present and different from the stored version the save is refused with `VERSION_CONFLICT` and «این پیش‌فاکتور پس از باز شدن شما تغییر کرده است؛ صفحه را تازه کنید و دوباره تلاش کنید».
- Non-DRAFT documents: `canEditQuotationLines(status)` gate returns `QUOTATION_IMMUTABLE` with «پس از ارسال، ویرایش مستقیم مجاز نیست؛ باید نسخهٔ جدید ساخته شود» before any mutation.
- The form hides nothing on lock: it disables everything. Fresh CDP readback on the locked document:

```json
{"sections":[
  {"title":"مشخصات","pointerEvents":"none","opacity":"0.6"},
  {"title":"ردیف‌های کالا و خدمت","pointerEvents":"none","opacity":"0.6"},
  {"title":"تخفیف کل سند","pointerEvents":"none","opacity":"0.6"},
  {"title":"خلاصه مالی","pointerEvents":"auto","opacity":"1"}],
 "saveDisabled":true}
```

(The financial summary is intentionally readable but contains no inputs.)

---

## 5. List and navigation sync

`refreshRecordDataFromHost()` is awaited right after a successful save, before the success snackbar and before the panel closes/switches mode. The table behind the panel therefore shows the new name/customer/status/amount/document number without a manual reload.

Fresh observation after the rebuild (§7.1): the list header count read `· ۹۵` before opening the form, `· ۹۵` with the form open, `· ۹۵` after Escape — i.e. opening and cancelling the form writes nothing. Rows created earlier in this task are all present in the same list with their customer, status and formatted amount (see the row excerpts in §7).

---

## 6. Integrity assessment — **NOT atomic** (explicit)

**Claim:** `DATA_INTEGRITY_PASS` is **not** claimed.

`persistDraftQuotation` performs, in order, over separate GraphQL round-trips:

1. read the quotation (edit) and check status / `expectedVersion`;
2. `updateQuotation` (or `createQuotation`) — header incl. totals;
3. read existing line ids;
4. one mutation per line (update by id, or create);
5. one delete mutation per removed line;
6. read the quotation back for the new version.

There is no transaction across these calls: the Twenty GraphQL API has no multi-mutation transaction, and the app route cannot open one. Consequences, stated plainly:

- If a line write fails after the header write, the header carries new totals while lines are partly old/partly new until the operator saves again. The document is left **inconsistent but recoverable and visibly DRAFT**; it is never marked sent and never receives a document number, because numbering is claimed only by the issuance action.
- If a stale-line delete fails, the document may temporarily keep an extra line while the totals already exclude it.
- Failure of the final readback only reports a stale version number to the panel; the next save is then refused as `VERSION_CONFLICT` rather than silently overwriting.

Mitigations that *are* in place (they reduce the window, they do not close it): full domain validation and the customer round-trip happen **before** the first write; status is never writable through this path; lines are written in document order and stale deletions run last; every write is permission-checked by the API and refusals map to Persian messages; a partially written document stays `DRAFT`, so no send/number/PDF path can consume it as final.

Closing the gap needs a server-side transactional endpoint (a single backend write unit). That is a backend change beyond this UI-unification task and is not attempted here.

---

## 7. Real browser verification on `http://localhost:3002`

All steps below were executed in the live app (Cursor browser, real DOM events and real DB writes read back over `psql` against `twenty-db-1`). Workspace schema: `workspace_aemygqnvl0yhlv0fg3qwjt525`; tables are `_quotation`, `_quotationLine`.

### 7.1 List → «پیش‌فاکتور جدید» → professional form, no blank row

- **URL:** `http://localhost:3002/objects/quotations?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`
- **Click path:** page header button `aria-label="پیش‌فاکتور جدید"` (the registered `GLOBAL_OBJECT_CONTEXT` command) → side panel opens.
- **Observed:** panel contains «مشتری / انتخاب مشتری», «ردیف‌های کالا و خدمت», catalog combobox and the financial summary; **no generic Twenty fields**, no `ثبت رکورد`/create-record form anywhere.
- **No blank header row:** `select count(*) … where "deletedAt" is null` returned **95** before the click, **95** with the form open, **95** after `Escape`. The list header stayed `· ۹۵`.
- **Result:** PASS.

### 7.2 List create with real customer, catalog line, 10% line discount

- **Click path:** «پیش‌فاکتور جدید» → «انتخاب مشتری» → typed `فرید` → picked «فرید رفیعی» → catalog combobox → item → quantity `1`, unit price `12000` (exact IRR micros), line discount `10%` → «ذخیره».
- **UI result:** success snackbar, panel behaviour unchanged, list row appeared as `UNI003-BROWSER-1795200100 | بدون شماره | فرید رفیعی | پیش‌نویس | ۱۱٬۷۷۲ ریال`.
- **DB readback** (`_quotation` joined to `_quotationLine`):

```
id                                   | quotationNumber | status | grossExact   | lineDiscountExact | netExact     | taxExact    | totalExact   | version | personId
b08cc49c-7b10-485d-afa7-b8f42793a75a |                 | DRAFT  | 12000.000000 | 1200.000000       | 10800.000000 | 972.000000  | 11772.000000 | 2       | 0045b1c8-9197-439a-94d2-c6891d19fc5d

quotationId                          | lines | line
b08cc49c-…                           | 1     | 1.000000 × 12000.000000, discountKind=RATE, discountInputExact=10.000000
```

Exactly one quotation, exactly one line, valid `personId`. Money: 12,000 − 10% = 10,800 + 9% VAT 972 = **11,772** IRR, computed by the existing Money Domain, not by the browser.

- **Result:** PASS.

### 7.3 Create from Person — preselected customer

- **URL:** `http://localhost:3002/object/person/0045b1c8-9197-439a-94d2-c6891d19fc5d`
- **Click path:** record «اقدامات» → creation command for quotation → form opens with the customer already set to «فرید رفیعی» (label resolved from the real relation, not from the id), catalog line, save.
- **Created:** `3ac47bbf-fabe-492b-83a1-14e70905e8c3`, `personId = 0045b1c8-9197-439a-94d2-c6891d19fc5d`, `companyId = null`, 1 line, `version = 2`.
- **Result:** PASS.

### 7.4 Create from Company — preselected customer

- **URL:** `http://localhost:3002/object/company/ef8afc3e-a4e7-46e6-89a0-4dd1b9f00db8`
- **Click path:** same as 7.3.
- **DB readback:** `d66aba78-3bae-4dc6-8f43-966816991ff5` → `companyId = ef8afc3e-a4e7-46e6-89a0-4dd1b9f00db8`, `personId = null`, `grossExact = 10000.000000`, `taxExact = 900.000000`, `totalExact = 10900.000000`, `version = 2`, 1 line `1 × 10000.000000`.
- **Result:** PASS (list row shows «شرکت آزمایشی S2R1» and ۱۰٬۹۰۰ ریال).

### 7.5 Edit the draft in place from the record panel

- **URL:** `http://localhost:3002/object/quotation/3ac47bbf-fabe-492b-83a1-14e70905e8c3`
- **Click path:** table row → record panel → tab «اقدامات» → «ویرایش پیش‌نویس» → `QuotationDraftForm` opens with the real `quotationId`, hydrated header, customer, line and version → quantity `3`, unit price `1100` Toman (`11000` exact), save.
- **DB readback after save and reload:**

```
id                                   | quotationNumber | status        | grossExact   | taxExact    | totalExact   | version | customerName
3ac47bbf-fabe-492b-83a1-14e70905e8c3 | QT-1405-000030  | READY_TO_SEND | 33000.000000 | 2970.000000 | 35970.000000 | 6       | فرید رفیعی

line: 3.000000 × 11000.000000 (1 row)
```

- **Same id, no duplicate:** `select count(*)` for this quotation is 1 and the line count is 1 before and after. No new quotation row was created.
- **Version:** header + one line update moved the stored version `2 → 4`; the panel then reported the authoritative read-back version, so the next save (lifecycle in 7.6) was not refused as stale.
- **Exact totals:** 33,000 + 9% (2,970) = 35,970 IRR → list renders «۳۵٬۹۷۰ ریال».
- **Result:** PASS.

### 7.6 Lifecycle, unique number, locked editing, PDF, seven channels

- **Click path:** record panel → «اقدامات» → «ارسال برای تأیید داخلی» → «آماده ارسال».
- **DB readback:** `status READY_TO_SEND`, `version 6`, `quotationNumber QT-1405-000030`, `customerName فرید رفیعی`, `totalDisplay ۳۵٬۹۷۰ ریال`. `_quotationSequence` row: `name=QUOTATION 1405, scopeKey=QUOTATION:1405, lastIssued=30, width=6` — so 000030 is the single, next-unused number; no duplicate.
- **Locked editing:** reopening «ویرایش پیش‌نویس» shows the document but every content section is `pointerEvents: none` / `opacity: 0.6` and «ذخیره تغییرات» is `disabled` (§4 JSON). A direct attempt against the persist path was refused:

```
code    = QUOTATION_IMMUTABLE
message = «پس از ارسال، ویرایش مستقیم مجاز نیست؛ باید نسخهٔ جدید ساخته شود»
mutation count after refusal = 0, row unchanged (status/version/total identical)
```

- **PDF / sharing:** «دانلود PDF فارسی» is present and enabled on the locked document (the PDF rendering path itself was verified in `CRM-129-QUOTATION-RECORD-UX-002`); the actions tab listed the seven sharing channels. No share record exists in `_quotationShare` for this document (`count = 0`) because nothing was actually sent — the UI is present, the send providers were not invoked. Bale remains `LIVE_UNVERIFIED` from the previous task; nothing here changes that.
- **Result:** PASS for lifecycle/lock/number/PDF UI; **not claimed** for live outbound sharing (no provider call was made, by design).

### 7.7 Stale version / invalid customer / permission refusals

- **Invalid customer:** probe against `/quotation/save-draft` with a fabricated customer id → `CUSTOMER_NOT_FOUND`, Persian message, **no** quotation and **no** line written (also covered by the unit test in §8).
- **Stale version:** save with an outdated `expectedVersion` → `VERSION_CONFLICT` and «این پیش‌فاکتور پس از باز شدن شما تغییر کرده است؛ صفحه را تازه کنید و دوباره تلاش کنید»; the stored row is unchanged.
- **Permission:** role probes from the previous task remain valid — a role without quotation write gets `PERMISSION_DENIED` («دسترسی لازم برای ذخیره پیش‌فاکتور وجود ندارد») and the customer search route answers «دسترسی لازم برای خواندن اشخاص/شرکت‌ها وجود ندارد» instead of leaking rows.
- **Result:** PASS for the tested refusals; no partial unauthorized write observed.

### 7.8 Native create regression (Person, Company, Task)

- **URLs:** `http://localhost:3002/objects/people`, `.../objects/companies`, `.../objects/tasks`
- **Observed:** each still exposes the standard Twenty create affordance and opens the native record form; records created there render normally. `quotation` is the only object whose create button is gone.
- **Result:** PASS.

### 7.9 Metadata readback (why the regression is impossible to miss)

```
 nameSingular | isUICreatable | isUIEditable | isActive
 company      | t             | t            | t
 person       | t             | t            | t
 quotation    | f             | t            | t
 task         | t             | t            | t
```

### 7.10 RTL drawer resize

- Desktop 1280 px: dragging the RTL drawer edge outward widened the panel 180 → 320 px; dragging it back narrowed it to 220 px, mirrored correctly (`resolvePanelWidthDelta` unit-tested for both directions and zoom).
- **Result:** PASS.

---

## 8. Automated tests run

| Command | Result |
| --- | --- |
| `npx vitest run` in `packages/twenty-apps/internal/quotation` | **29 files / 269 tests passed** (includes new `customer-picker.service.test.ts` and the pre-write refusal test) |
| `npx jest packages/twenty-front-component-renderer/.../buildFrontComponentHostCommunicationApiFromThreadImports.test.ts` | 2 passed (every host member, incl. `refreshRecordData`, is mapped) |
| `NODE_ENV=test npx jest packages/twenty-front/.../useFrontComponentExecutionContext.test.tsx` | 60 passed (incl. `refreshRecordData` refetches active queries; does not reject when refetch fails) |
| `npx tsgo -p tsconfig.json --noEmit` — twenty-front, twenty-sdk, twenty-front-component-renderer, quotation app | clean |
| Dev API script `scripts/dev-verify-crm129-unified-creation.cjs` | PASS: customer search, preselection hydration, fabricated-customer rejection, create-from-list, in-place edit, stale-version conflict, company quotation |
| Dev probe `scripts/tmp-uni003-locked.cjs` | PASS: `READY_TO_SEND` refuses draft mutation with `QUOTATION_IMMUTABLE`, row unchanged |

Note: running the twenty-front hook test without `NODE_ENV=test` fails with `React.act is not a function` because React resolves its production build; that is a test-runner environment issue, not a change in this branch.

---

## 9. Known limitations and open decisions

1. **Save is not atomic** (§6). A transactional server endpoint is required before any `DATA_INTEGRITY_PASS`.
2. **Sharing is UI-only here.** Seven channels render and PDF works, but no share row was created and no provider was called in this task; Bale remains `LIVE_UNVERIFIED`.
3. **Numbering unchanged.** `quotationNumber` stays empty in `DRAFT`; the number is claimed at `READY_TO_SEND` by the existing atomic sequence. `version` is not a document number.
4. **Customer label is cosmetic when resolution fails.** If the label lookup errors, the form shows «در حال خواندن نام مشتری…» and the save still validates the id server-side; the id is never invented.
5. **Old hosts.** Without `refreshRecordData`, the save succeeds but the table may stay stale until a manual reload (graceful degradation by design).
6. **Unrelated local files stay dirty and uncommitted** (settings formatting, prior `.tmp-*` probes) — preserved, not deleted.

---

## 10. Bans compliance

No `:6080`, no release branch, no production DB, no main worker restart, no extra port, no force push, no unrelated-file deletion, no direct DB status bypass, no parallel form, no duplicate finance logic, no new send provider. All writes went through the app's own routes and the GraphQL API; `psql` was used read-only.

## 11. Files changed (implementation)

App:
`src/objects/quotation.object.ts`, `src/command-menu-items/create-quotation-from-quotations.command-menu-item.ts`, `src/components/quotation-draft-form.tsx`, `src/components/customer-picker.tsx`, `src/components/quotation-api.ts`, `src/constants/universal-identifiers.ts`, `src/data/customer-queries.ts`, `src/data/quotation-queries.ts`, `src/logic-functions/search-customers.ts`, `src/services/customer-picker.service.ts`, `src/services/quotation-persist.service.ts`, `src/services/quotation-draft-edit.service.ts`, `src/services/__tests__/customer-picker.service.test.ts`, `src/services/__tests__/quotation-persist.service.test.ts`, `package.json` (0.1.17), plus the verification scripts under `scripts/`.

Core (minimal, generic):
`twenty-front/src/modules/front-components/hooks/useFrontComponentExecutionContext.ts` (+ test), `twenty-front-component-renderer` host API types/noop/thread mapping (+ test, stories), `twenty-sdk` front-component globals/index.

Docs: this file and `docs/architecture/CRM-ARCHITECT-RECOVERY.md`.
