# CRM-129-TAX-CONFIGURATION-AND-PERSIAN-BOOLEAN-007 — Configurable Tax + Persian Booleans (PROOF)

**Status:** IMPLEMENTED + verified on Dev; **STOP_FOR_ARCHITECT**  
**Branch:** `feat/crm-129-quotation`  
**Commits:** `e2cb35a287c5a83196013dd925ce4aa1c94af4c8` (tax), `e3b64885161e4d5ad99be98435e681eceec0cf77` (booleans)  
**Base:** `daf525013d`  
**Target:** Dev `:3002` (`dev-crm129`) — app «پیش‌فاکتور» **0.1.19** applied, `twenty plan` reports **no changes**  
**Gate:** STOP_FOR_ARCHITECT

## 1. Tax settings page (Part A1)

The settings surface is a standalone page reachable from the sidebar item «مالیات و عوارض»:

- Page: **`http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`**
- Layout: `page-layouts/tax-policy-settings.page-layout.ts` (`STANDALONE_PAGE`, one `VERTICAL_LIST` tab, one `FRONT_COMPONENT` widget stored with `heightBehavior: TAB_VIEWPORT`)
- Navigation: `navigation-menu-items/tax-policy-settings.navigation-menu-item.ts` (icon `IconPercentage`, position 36)
- Panel: `components/tax-policy-settings-panel.tsx`, mounted by `tax-policy-settings.front-component.tsx` / `tax-policy-settings-page.front-component.tsx`

A standalone page + sidebar entry is used because this fork runs with `IS_APPLICATIONS_SETTINGS_ENABLED = false`, so the application settings slot is not reachable.

| Capability | Where |
|---|---|
| Multiple policies with a Persian name | `taxPolicy` object (`objects/tax-policy.object.ts`), field `name` |
| Decimal percentage (0, 9, 10, 10.5) | `parsePercentToBasisPoints` (`domain/money/tax-policy.ts`), stored as integer basis points |
| Default policy | `isDefault` flag + `setDefaultTaxPolicy` (only one default survives a write) |
| Active / inactive | `isActive`; inactive policies are not offered on a new draft but stay readable |
| Tax exemption | `isExempt` with rate `0`; a non-zero rate with exemption is refused (`TAX_POLICY_EXEMPTION_MISMATCH`) |
| No destructive delete | the panel only offers «غیرفعال»; a used policy is never destroyed |
| Edit an existing policy | «ویرایش» → same form, same validation path |
| Admin-only changes | `callerMayChangeSettings` + `mayChangeTaxSettings`; a signed-in non-admin gets `TAX_SETTINGS_FORBIDDEN` |

**No hardcoded rate anywhere.** The rates live in the workspace `taxPolicy` rows. `IR_VAT_9` at `900` basis points is only the *legacy baseline*: it keeps documents sealed before this change readable and seeds a fresh workspace with the 9% rate already in use — it is not applied to new drafts unless an operator chooses or defaults it.

## 2. Draft form integration (Part A2)

`components/quotation-draft-form.tsx` (the existing form, no parallel form) gained a «مالیات و عوارض» section:

- policy select built from **active** policies, default preselected, exempt policies labelled «— معاف»
- live recomputation of taxable net (`displayNet`), tax (`displayTax`) and grand total on every policy change
- exact values only: `domain/money/arithmetic.ts` (`applyBasisPoints`, `divideRoundHalfUp`) — integer micros, no float
- the saved draft carries `taxPolicy` (the policy code) and `taxRateBasisPoints`; reopening restores the selection
- a custom rate cannot be typed on the draft: the select only offers policies an administrator approved

## 3. Calculation integrity and server validation (Part A3)

| Concern | Implementation |
|---|---|
| Pricing source | `domain/quotation/draft-quotation.ts` + `domain/money/line.ts` price each line from the chosen policy's basis points |
| Atomic header + lines | `QuotationDraftPersistenceService.saveDraft` unchanged in shape — single `runInWorkspaceTransaction`, header upsert + line reconcile + version claim |
| Optimistic locking | unchanged `expectedVersion` contract; the tax field rides in the same transaction |
| Server re-derivation | `utils/quotation-draft-totals.util.ts`: when `taxRateBasisPoints` is declared, every line's `taxExact` is recomputed as `roundHalfUp(net × bp / 10000)` and a mismatch is refused (`TAX_AMOUNT_MISMATCH`); a rate above 10000 bp is `TAX_RATE_OUT_OF_RANGE` |
| Request parsing | `utils/parse-quotation-draft-save-request.util.ts` accepts an absent rate (older client) but refuses an unreadable one |
| Form = DB = PDF | live check T7/T8 compares the form totals, the stored row and the PDF digits |

**Discount order unchanged:** tax is still applied to the net after line and document discounts, exactly as before this task.

## 4. Issued documents stay immutable (Part A4)

- `QuotationRevisionSnapshot` now carries `taxRateBasisPoints` next to `taxPolicy`; `quotation-revision.service.ts` selects the column and `quotation-revision-snapshot.util.ts` seals only a readable rate (an absent legacy rate stays `null`, never inventing a percentage).
- The canonical hash fixture was updated in both the server spec and the app spec, so the writer and reader still agree byte-for-byte.
- Sealed revisions remain unmodifiable: the existing immutability refusals (`QUOTATION_IMMUTABLE`, sealed-revision API guard) are untouched.
- Live proof (T11–T13): a document issued at 9% keeps `rate=900`, `tax=9,000.000000` and an identical snapshot hash after the default policy is changed to 12%.
- No migration rewrote any document; past `IR_VAT_9` rows read with their stored rate or with `null` when they predate the column.

## 5. Accounting export contract (Part A5)

- `adapter-contract.ts` holds `taxPolicyMappings: Record<string, string>` — CRM policy code → vendor tax code. It is a mapping, not an identity, because the CRM's policies and the vendor's fiscal codes are decided by different people.
- `domain/accounting/outbound-plan.ts` reads the policy **sealed on the document** and blocks `TAX_POLICY_NOT_MAPPED` when a taxed document has no mapping; an exempt (zero-tax) document needs none.
- Violations covered by tests: no mapping, mapping for a different code, mapping present → the mapped code is used, exempt → no mapping needed.
- No real Asan/Sepidar call is made; the mock adapter remains the only successful path.

## 6. Persian booleans (Part B)

- `packages/twenty-front/src/modules/object-record/record-field/ui/form-types/components/FormBooleanFieldInput.tsx`: the two hardcoded labels `'True'` / `'False'` now use `` t`True` `` / `` t`False` `` from `useLingui()`.
- `packages/twenty-front/src/locales/fa-IR.po`: `msgid "True" → "بله"`, `msgid "False" → "خیر"`; regenerated `locales/generated/fa-IR.ts` (`c+xCSz` → `بله`, `ocUvR+` → `خیر`).
- The same msgids already drive `BooleanDisplay` (table cells), `ObjectFilterDropdownBooleanSelect` (filters), the data-model boolean options and the chart settings, so one catalog entry now covers form, table and filter.
- Stored values are unchanged: the component still emits `'true'` / `'false'`; the API and database keep real booleans, and an English workspace still reads True/False.
- RTL, keyboard use and the selected state are untouched — only the label text moved into the translation layer.

**Live browser check on `:3002`:** on «کالا و خدمات» → «فیلتر» → field «فعال» → operator «است», the value dropdown renders **«بله» / «خیر»** (previously English). The table column renders icons, not text, and is unaffected.

## 7. Test evidence

```
npx vitest run --root packages/twenty-apps/internal/quotation
  Test Files  39 passed (39)
       Tests  424 passed (424)

npx jest --config=packages/twenty-server/jest.config.mjs packages/twenty-server/src/modules/quotation
  Test Suites: 15 passed, 15 total
       Tests: 99 passed, 99 total        # 3 new in quotation-pdf-display.util.spec.ts

npx tsgo -p packages/twenty-apps/internal/quotation/tsconfig.json --noEmit   # clean
npx twenty plan -r dev-crm129                                                # "No changes"
```

Live Dev verification, `scripts/dev-verify-crm129-tax-007.cjs` — **17/17 PASS** (real workspace, API key over `:3002`):

| # | Check | Result |
|---|---|---|
| T1 | baseline `IR_VAT_9` exists and is the single default | `policies=4 default=IR_VAT_9 rate=900` |
| T2 | create a 10% default policy | `code=TAX_1000 rate=1000` |
| T3 | Persian decimal `۱۰٫۵` stored as 1050 bp | `code=TAX_1050` |
| T4 | zero-rate exempt policy accepted | `TAX_0 rate=0 exempt=true` |
| T5 | invalid rate / contradictory exemption refused, nothing written | `policies=4→4` |
| T6 | save a draft priced by the 10% policy | `quotation=e6abf100…` |
| T7 | form and stored header agree | `net=2,600,000 tax=260,000 total=2,860,000` |
| T8 | reopen, switch to 10.5%, recalculate | `tax=273,000 total=2,873,000` |
| T9 | stale `expectedVersion` refused | `QUOTATION_VERSION_CONFLICT` |
| T10 | inactive and unknown policies refused | `TAX_POLICY_INACTIVE`, `TAX_POLICY_UNKNOWN` |
| T11 | issued 9% document keeps its own rate/amounts | `rate=900 tax=9,000.000000` |
| T12 | sealed snapshot records the rate | `snapshotBytes=652` |
| T13 | changing the default does not touch the issued document | `policyRate=1200 issuedRate=900 hashStable=true` |
| T14 | a new draft picks up the edited 12% | `tax=12,000 total=112,000` |
| T15 | an invalid line rolls the save back | `LINE_NAME_MISSING version=1 totals kept` |
| T16 | PDF renders for a taxed quotation | `bytes=11766` |
| T17 | default restored to the baseline 9% | `default=IR_VAT_9` |

Regression scripts still pass on the same environment: `dev-exercise-crm129-revision-seal.cjs` **14/14**, `dev-exercise-accounting-006.cjs` **15/15**.

The generated PDF subtotal row now reads «مالیات (۹٪)» / «مالیات (۱۰٫۵٪)»; `formatBasisPointsAsPersianPercent` is unit-tested (whole, one- and two-digit fractions, refusal of a non-basis-point value).

## 8. Files changed

Application (`packages/twenty-apps/internal/quotation/src`): `objects/tax-policy.object.ts`, `page-layouts/tax-policy-settings.page-layout.ts`, `navigation-menu-items/tax-policy-settings.navigation-menu-item.ts`, `components/tax-policy-settings-panel.tsx`, `tax-policy-settings.front-component.tsx`, `tax-policy-settings-page.front-component.tsx`, `logic-functions/tax-policies.ts`, `services/tax-policy.service.ts`, `data/tax-policy-queries.ts`, `data/caller-identity-queries.ts`, `domain/tax-settings/*`, `domain/money/tax-policy.ts`, `domain/quotation/*`, `domain/accounting/*`, `components/quotation-draft-form.tsx`, `components/quotation-api.ts`, `data/atomic-draft-save-api.ts`, `data/record-api.ts`, `logic-functions/save-draft-quotation.ts`, `objects/quotation.object.ts`, `roles/quotation-app.role.ts`, `services/*`, `constants/universal-identifiers.ts` (+ `scripts/dev-verify-crm129-tax-007.cjs`).

Server (`packages/twenty-server/src/modules/quotation`): `services/quotation-draft-persistence.service.ts`, `services/quotation-pdf.service.ts`, `services/quotation-revision.service.ts`, `pdf/quotation-pdf-document.ts`, `types/quotation-draft-save.type.ts`, `utils/parse-quotation-draft-save-request.util.ts`, `utils/quotation-draft-totals.util.ts`, `utils/quotation-pdf-display.util.ts`, `utils/quotation-revision-snapshot.util.ts`, `utils/__tests__/quotation-revision-snapshot.util.spec.ts`, `utils/__tests__/quotation-pdf-display.util.spec.ts`.

Front: `modules/object-record/record-field/ui/form-types/components/FormBooleanFieldInput.tsx`, `locales/fa-IR.po`, `locales/generated/fa-IR.ts`.

## 9. Remaining issues / gates

- **Admin check trusts a person-less token.** A route call that carries no `Authorization` header is treated as the trusted platform path, and an API-key token is accepted after `FORBIDDEN`/`AUTH_REQUIRED` from `currentUser`. The route itself requires auth, but a stricter "only a person with a settings flag" rule would need a platform change.
- **Settings page entry is app-owned.** It lives at `/page/3eb639f7-…` in the sidebar, not under Settings → Applications, because the applications settings surface is disabled in this fork.
- **Rate label in an old sealed PDF.** Documents issued before this task have no stored rate, so their PDF keeps the bare «مالیات» label while showing the original amount.
- **Live accounting write remains unscoped.** Only the mapping gate is implemented; no Asan/Sepidar traffic, per the task boundary.
- **Not committed:** three unrelated formatter-only changes in `twenty-front` settings files that were already in the working tree are left uncommitted on purpose.
