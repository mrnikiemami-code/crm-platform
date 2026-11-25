# CRM-129-FINANCIAL-CONTRACT-023

**Companion to:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md)  
**Branch / HEAD at recovery:** `feat/crm-129-quotation` @ `0fe64a9305`  
**Mode:** contract only — no implementation in the defining task  
**Gate:** `STOP_FOR_ARCHITECT`

---

## S0 — Architect recovery (what is true today)

### Workspace surfaces verified in source

| Concern | Path / evidence |
|---|---|
| Tax policy object | `packages/twenty-apps/internal/quotation/src/objects/tax-policy.object.ts` — `name`, `code`, `rateBasisPoints`, `dutyRateBasisPoints`, `isDefault`, `isActive`, `isExempt`. **No CRM accounting-code field.** |
| Tax domain / panel | `domain/money/tax-policy.ts`, `tax-policy-settings-panel.tsx`, server `TaxPolicyAuthorityService` |
| Quotation header money | `quotation.object.ts`: `currencyCode` (default `'IRR'`, not UI-editable), `taxPolicy`, `taxRateBasisPoints`, `dutyRateBasisPoints` — **document-level tax only** |
| Quotation line | `quotation-line.object.ts`: amounts + discounts; `taxExact` is computed money — **no per-line taxPolicy / rates / currency / accounting codes** |
| Draft pricing | `domain/quotation/draft-quotation.ts` — `currencyCode: 'IRR'` fixed; one policy for all lines |
| Draft form UX | `quotation-draft-form.tsx` — single tax `<select>`; default policy auto-applied; no currency picker |
| Revision snapshot | `quotation-revision-snapshot.util.ts` — seals header `currencyCode`, `taxPolicy`, rates (+ optional duty); line amounts only |
| Tax–draft race lock | `quotation-tax-policy-lock.util.ts` — shared/exclusive advisory on `quotation-tax-policy:{workspaceId}` |
| Accounting connection | `accounting-connection.object.ts` + `isDefault` / `isActive` (020/021) |
| Settings money block | `financial-contract.ts` — `baseCurrency`, `currencyMappings`, `conversionRate`, `mockProfile` |
| Settings tax map | `connection-settings.ts` — `taxPolicyMappings: Record<crmPolicyCode, vendorTaxCode>` (+ legacy under `specialCodes`) |
| Item/party links | `accounting-item-link` / `accounting-party-link` — **vendor identity** (`externalItemId` / `externalPartyId`), not CRM ledger codes |
| Catalog item | `catalog-item.object.ts` — no `accountingCode` |
| Person / company | standard objects; no quotation-owned CRM accounting-code field in app objects |
| GraphQL write guards | tax policy, accounting connection, revision — generic GraphQL mutations closed |
| Workspace isolation | workspace-scoped ORM + REST `JwtAuthGuard` / `WorkspaceAuthGuard`; connection resolve filters by workspace |
| Mock / Asan UI | shared shell `AccountingSettingsPanel`; capabilities drive money/tax blocks; Mock profiles vs Asan `SINGLE_CURRENCY` / IRR |
| Design pilots | TAX-016 panel = shipped Design of Record for tax list UX; **017 rev-02 not approved** — not product reference |

### Terminology (mandatory distinction)

| Term | Meaning in this contract | Owner today |
|---|---|---|
| **CRM accounting code** (`accountingCode`) | Ledger / chart code the business records for tax, currency, item, or party | **MISSING** as a first-class field |
| **Policy / currency identity** (`code`) | Stable CRM key snapshotted on documents (e.g. `IR_VAT_9`, `IRR`) | Tax: COMPLETE. Currency: IRR literal only |
| **Vendor destination code** | Code the accounting package understands | `taxPolicyMappings` / `currencyMappings` / item-party links — COMPLETE as mapping |

Goal #8 forbids settings from **re-authoring** CRM tax/currency codes. Vendor mappings may remain, but they must consume CRM identities — never invent parallel CRM codes.

---

## S1 — Gap matrix

Legend: **COMPLETE** / **PARTIAL** / **MISSING** / **CONFLICT** / **BLOCKED**

| Capability | Status | Reality (evidence) | Goal pressure |
|---|---|---|---|
| Single owner for tax CRM accounting code | **MISSING** | Policy has `code` (identity) only; no ledger `accountingCode` | SC1, SC8 |
| Single owner for currency CRM accounting code | **MISSING** | No currency catalog object; IRR hardcoded | SC1, SC5 |
| Item / person / company accounting codes | **MISSING** | Only vendor links exist | SC7 |
| Document tax policy + rate snapshot | **COMPLETE** | Header fields + revision snapshot + TAX-008 authority | Keep |
| Default tax policy without re-pick | **COMPLETE** | `isDefault` + draft form auto-apply | Keep (SC6) |
| Per-line independent tax policy | **MISSING** | One header policy drives every line’s tax arithmetic | SC4 — **major domain change** |
| Document currency selection + default | **PARTIAL** | Field exists; always IRR; no catalog/default UX | SC5, SC7-currency |
| All lines share document currency (phase 1) | **PARTIAL** | True by construction (no line currency) but not modeled as inheritance | SC5 |
| Phase 2 multi-currency totals design | **MISSING** | Explicit refusal of FX in money/currency module comments | SC6 |
| Codes immutable on quotation | **PARTIAL** | Header tax/currency not UI-editable; no CRM accounting-code fields yet | SC3–4 |
| Lock reference code after first draft use | **PARTIAL** | Policy **rate**/mutation vs draft race locked; **code string** editability / accounting-code lock **not** defined | SC3 |
| Settings must not redefine tax/currency codes | **CONFLICT** | Free-text `taxPolicyMappingsText` / currency mapping editors look like code definition; mappings are vendor-side but UX conflates ownership | SC8 |
| Snapshot of CRM accounting codes on quotation | **MISSING** | Snapshot has policy identity + rates, not ledger codes | SC2 |
| Mock & Asan shared UI + real capabilities | **PARTIAL** | Shared shell; capability-gated fields; some advanced text areas are operator-hostile | SC9–10 |
| Professional Persian end-to-end UX | **PARTIAL** / **BLOCKED** on design gate | Tax panel 016 strong; accounting + draft currency/line-tax UX not designed under Goal 023 | SC10 |
| GraphQL / permission / isolation | **COMPLETE** for existing objects | Must extend to any new fields/actions | Preserve |
| Soft-retired connection history | **COMPLETE** (021-R1) | Orthogonal; preserve | — |
| Hard retire-vs-inflight send lock | **BLOCKED** (architect open from R1) | Not in Goal 023 scope unless outbound pack reopens | — |
| Legacy sealed documents | **CONFLICT risk** | Moving tax to lines changes meaning of header-only snapshots | Compatibility clause required |

### Document-level tax vs line-level tax (explicit)

Today: after document-discount allocation, **one** `taxRateBasisPoints` / `dutyRateBasisPoints` is applied to every line (`document-totals.ts` + `draft-quotation.ts`).

Goal: each line selects its own policy; rates and CRM accounting codes for that policy are snapshotted **per line**. Header may retain a **default policy for new lines** and aggregate display fields, but must not silently override line choices on reopen.

### Adapter mappings vs reference codes (explicit)

`taxPolicyMappings` answering “CRM policy `IR_VAT_9` → Asan code `64`” remains a **connection concern**. It is not the CRM accounting code of the policy. After Goal packs:

- CRM `taxPolicy.accountingCode` is authored only on the tax policy record.
- Connection UI maps **existing** policy identities to vendor codes (picker), never invents a second CRM code catalog.
- Same rule for currency: CRM currency record owns optional `accountingCode`; connection only maps vendor currency identity when capabilities require it.

---

## S2 — Domain field contracts

### Shared rules for every CRM `accountingCode`

| Aspect | Contract |
|---|---|
| **Owner** | The reference entity (tax policy, currency, catalog item, person, company) |
| **Storage** | Nullable text on that entity; empty = unset |
| **Validation** | Trimmed; max length bounded (propose 64); charset architect-locked in WS1 (digits/Latin/Persian rules); never float |
| **Change policy** | Editable while **unused**; after first successful draft save that **persisted** this code onto a quotation (header or line snapshot fields), further edits → `ACCOUNTING_CODE_IN_USE` (or typed sibling). Deactivate reference still allowed where existing rules apply |
| **Default** | Empty |
| **Snapshot** | When set at save time, copy onto the quotation/line immutable field; when empty, quotation field stays empty |
| **Quotation editability** | Snapshot fields never operator-editable; server refuses client-supplied overrides that disagree with resolved reference at save (except legacy reopen of already-stored snapshot — see compatibility) |
| **Permissions** | Same authority as editing the owning settings/record today (`canUpdateAllSettings` for tax/currency settings; item/party per existing record permissions) |
| **API / PDF / accounting** | API exposes snapshot fields read-only on documents; PDF may print them when product design requires; outbound continues to use **vendor** mappings, and may additionally send CRM codes only if an adapter capability declares it |
| **Tests** | Unit: parse/validate; authority: lock on first use; concurrency: draft save vs code mutation; isolation: foreign workspace refused |

### F1 — `taxPolicy.accountingCode`

| | |
|---|---|
| Owner | `taxPolicy` row |
| Storage | New field on tax policy object |
| Validation | Shared accountingCode rules; at most one code per policy (field cardinality) |
| Change | Locked after first draft use of **that code value** *or* of that policy while code non-empty — **architect choice in WS1**: lock by `(workspace, code string)` vs lock by policy id. Recommend **lock by policy id once any non-empty code was snapshotted**, so renaming code is impossible after use; empty→set still allowed until first snapshot of non-empty |
| Default | Empty |
| Snapshot | `quotationLine.taxAccountingCode` (and optional header rollup for single-policy docs) |
| Legacy | Existing policies: empty code; documents without snapshot field: null |
| Effect | Settings panel gains one ledger-code column; mapping UI stops treating vendor map as the ledger code |

### F2 — Currency catalog + `currency.accountingCode`

| | |
|---|---|
| Owner | New workspace `quotationCurrency` (name TBD in WS4) **or** constrained seed table — **not** connection settings |
| Storage | `code` (ISO-like, e.g. IRR), `name`, `isDefault`, `isActive`, optional `accountingCode` |
| Phase 1 | Exactly one selectable document currency; default auto-applied; UI may only expose active currencies; product may ship IRR-only rows initially |
| Change / lock | Same first-use lock as tax accounting codes |
| Snapshot | `quotation.currencyCode` (exists) + `quotation.currencyAccountingCode` (new); every line stores `currencyCode` equal to header in phase 1 |
| Legacy | All existing docs IRR; empty currency accounting code |
| Phase 2 hook | Line may later diverge; totals keyed by currency; **no cross-currency sum without FX contract object** (absent in phase 1–2 activation) |

### F3 — Item / person / company `accountingCode`

| | |
|---|---|
| Owner | `catalogItem`; standard `person` / `company` (app field extension or documented standard field — WS1 decides with platform constraints) |
| Snapshot | Copied onto line / header customer snapshot at draft save when set |
| Mapping | `accountingItemLink` / `accountingPartyLink` remain vendor identity; they must not become the CRM ledger code |

### F4 — Line tax policy fields

| Field | Role |
|---|---|
| `taxPolicy` | Policy identity code at line |
| `taxRateBasisPoints` / `dutyRateBasisPoints` | Frozen rates for that line |
| `taxAccountingCode` | Snapshot of policy CRM accounting code at save |

| Aspect | Contract |
|---|---|
| Default for new line | Workspace default policy (SC6) unless operator overrides |
| Arithmetic | Tax/duty computed **per line** from that line’s rates after that line’s discounts + document-discount share |
| Header | May store “document default policy” for UX; sealed revision must include **line** tax identities; header aggregates remain sum of lines |
| Validation | Same TAX-008 authority per distinct policy appearing on the draft, under the existing tax-policy advisory lock |
| PDF / API | Show per-line policy label/rate; aggregates by policy optional in design |
| Outbound | If lines map to multiple vendor tax codes, adapter capability must declare multi-tax support or preview refuses with a clear Persian code — **architect decision before WS3 coding** |

### F5 — Document currency (phase 1)

| | |
|---|---|
| Selection | Document-level only |
| Inheritance | On save, every line persists `currencyCode = header.currencyCode` |
| Money storage | Phase 1 remains IRR-micros canonical **until** an architect pack explicitly widens storage; selecting a non-IRR currency in phase 1 is either refused or requires a prior money-domain STOP — **default proposal: phase 1 UI only offers currencies the money domain already stores (IRR), catalog still exists for codes/defaults/accountingCode** |
| FX | Forbidden |

### F6 — Code lock concurrency

| | |
|---|---|
| Problem | Operator A saves first draft using policy P’s accounting code while operator B edits P’s code |
| Guarantee | Server-side only. Extend tax-policy lock family **or** introduce `quotation-accounting-code:{workspaceId}` acquired: shared on draft save (before reading codes), exclusive on reference code mutation |
| Cutoff | Same pattern as TAX-008: code cannot change between draft’s code read and commit |
| UI | Disabled field + Persian reason when locked; server remains authority |

### F7 — Accounting settings remapping (SC8)

| Allowed | Forbidden |
|---|---|
| Map CRM policy `code` → vendor tax code (picker from workspace policies) | Free-form invention of CRM tax identities inside connection settings |
| Map CRM currency `code` → vendor currency value when capabilities need it | Storing CRM `accountingCode` only on the connection |
| Special **item** codes for discount/tax/duty rows (Asan) as vendor mechanics | Duplicating policy rates inside connection financial settings |

Migration: existing `taxPolicyMappings` keys already are CRM policy codes — keep; change UX/copy so ownership is obvious; reject saves that introduce orphan keys without a policy row.

---

## S3 — Extensibility for phase 2 multi-currency

### Designed now, inactive for users

1. Line `currencyCode` exists after WS4; phase 1 writer always copies header.
2. Totals API shape reserves `totalsByCurrency: Record<currencyCode, TotalsExact>` — phase 1 emits a single key.
3. Feature flag / capability `MULTI_CURRENCY_DOCUMENTS=false` hides line currency controls and mixed-currency entry.
4. No FX rate entity in phase 1; introducing FX is a separate architect Goal.
5. **Invariant:** never sum amounts across different `currencyCode` values into one payable without an explicit conversion contract.

### Phase 2 activation prerequisites (not scheduled here)

- Money domain acceptance of non-IRR storage **or** explicit conversion-at-boundary contract.
- Design approval for mixed-currency quotation UX.
- Adapter capabilities for multi-currency destinations.
- Migration + PDF + outbound packs.

---

## Compatibility with prior data

| Case | Behavior |
|---|---|
| Legacy quotation (header tax only) | Readable forever; reopen in edit copies header policy onto each line **once** as migration-on-read for drafts only; sealed revisions untouched |
| Empty accounting codes | Valid; snapshot fields null/empty |
| Existing vendor mappings | Kept; validated against policy catalog |
| IRR-only history | Remains IRR; currency accounting code empty |
| TAX-008 rate lock semantics | Preserved; accounting-code lock is additive |

---

## Security & isolation (non-negotiable)

- All new mutations through existing REST quotation actions + authority services; GraphQL generic writes stay guarded.
- Workspace filters on every read/write; no cross-tenant code lock keys.
- No secrets in docs, tests, or UI.
- Outbound flags remain default off until a dedicated go-live pack.

---

## Open architect decisions (must close before the named pack codes)

| ID | Decision | Blocks |
|---|---|---|
| D-023-1 | Lock granularity: policy/currency/item id vs code string | WS2 |
| D-023-2 | Phase 1: IRR-only selectable vs early multi-ISO with still-IRR storage | WS4 |
| D-023-3 | Outbound when lines have multiple tax policies | WS3 |
| D-023-4 | Person/company field vehicle (app extension vs standard object field) | WS1 |
| D-023-5 | Whether header keeps denormalized tax fields after line-tax ships | WS3 |
| D-023-6 | Shared lock key reuse vs new accounting-code lock family | WS2 |

---

## Gate

**`STOP_FOR_ARCHITECT`** — ratify or amend this contract before Execution Plan packs that touch schema or money.
