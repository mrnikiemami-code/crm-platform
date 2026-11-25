# CRM-129-GOAL-023 — WS1 schema & lock preflight

**Mode:** TECHNICAL AUDIT + SCHEMA PLAN — **no implementation until architect opens WS1**  
**Goal:** SC1 + SC7 foundations (reference `accountingCode` owners + currency catalog)  
**Contracts:** C1, C2 (catalog seed), C5, C4 (lock design only — **implemented in WS2**)  
**Branch / base:** `feat/crm-129-quotation` @ `cdb890b3f5`  
**Gate:** `STOP_FOR_ARCHITECT`

---

## 1. WS1 in / out of scope

### In (WS1)

| Change | Owner object | Notes |
|---|---|---|
| `accountingCode` TEXT nullable | `taxPolicy` | Optional; one code for tax+duty (C1) |
| New object `quotationCurrency` | workspace catalog | `code`, `name`, `isDefault`, `isActive`, `accountingCode` |
| Seed IRR default row | bootstrap action (idempotent) | Mirror tax-policy bootstrap pattern |
| `accountingCode` on `catalogItem` | app object field | Not vendor link id (C5) |
| `accountingCode` on `person` / `company` | `defineField` on `STANDARD_OBJECT` | Same pattern as `person-quotations.field.ts` |
| Tax panel + minimal currency settings UI | functional | Edit codes; empty allowed; **no** quotation draft change |
| Authority + GraphQL write-guards | server | Currency mutations via REST quotation actions; guards for new object |
| Unit / authority tests | app + server | Isolation, validation, bootstrap idempotency |

### Out (later packs)

| Concern | Pack |
|---|---|
| Snapshot codes onto quotation / lines | WS2 |
| First-use lock enforcement + concurrency DB test | WS2 |
| Per-line tax | WS3 |
| Document currency picker / IRR refuse on save | WS4 (catalog exists in WS1) |
| Strip CRM code authoring from connection settings | WS5 |
| Design of Record | WS7 |
| Lock item/person/company codes | **Not in Goal** until separate contract (C4) |

---

## 2. Proposed universal identifiers (UUID v5)

Namespace = quotation app `APPLICATION_UNIVERSAL_IDENTIFIER`  
`v5(<path>, ns)` generated 2026-11-25 for this preflight — **freeze on architect accept; never regenerate**.

| Path | UUID |
|---|---|
| `taxPolicy.accountingCode` | `9de3f65b-9b9e-5756-819a-d900de12c04a` |
| `quotationCurrency` (object) | `905a687c-fa42-5b47-87d0-e46e0fe15b07` |
| `quotationCurrency.code` | `8512c1f2-391f-5bfb-beb9-3a009d1739b0` |
| `quotationCurrency.name` | `4ec6e6b6-b43e-5151-8502-eb86c4a517fb` |
| `quotationCurrency.isDefault` | `00329b00-d27c-5ab1-b116-23373ac39817` |
| `quotationCurrency.isActive` | `dc76b7f7-944b-5860-ab2d-221aec22a268` |
| `quotationCurrency.accountingCode` | `46b1a49d-2088-500e-927c-f07eac565185` |
| `catalogItem.accountingCode` | `09915dea-e499-5c01-9ebd-efa2a7fb639a` |
| `person.accountingCode` | `32280b01-034c-5850-852f-70ea15cb13f0` |
| `company.accountingCode` | `741b9dfc-2eda-5aa5-ae92-908ffae0ed6b` |

Reserved for **WS2** (do not create in WS1 apply unless architect prefers early additive nullable columns):

| Path | UUID |
|---|---|
| `quotation.currencyAccountingCode` | `ae36b898-9b40-52a1-a175-785c825864ce` |
| `quotation.taxAccountingCode` | `d7e0c705-c763-5e3b-a502-06cb44dc86c0` |

Line-level tax/currency snapshot field UUIDs: generate in WS3/WS4 preflight, not here.

---

## 3. Schema shape

### 3.1 `taxPolicy.accountingCode`

```
type: TEXT
nullable: true (or empty-string default '' matching sibling text fields)
isUIEditable: false  // panel/REST only, like rate fields
label: «کد حسابداری»
description: optional ledger code for this tax/duty policy; empty allowed
```

Legacy rows: empty. No backfill.

### 3.2 `quotationCurrency`

| Field | Type | Notes |
|---|---|---|
| `code` | TEXT unique-ish per workspace | `IRR` seed; `isUIEditable: false` after create (like tax policy code) |
| `name` | TEXT | e.g. «ریال ایران» |
| `isDefault` | BOOLEAN | Exactly one non-deleted default (advisory lock on mutate) |
| `isActive` | BOOLEAN | Inactive not offered for new docs (WS4) |
| `accountingCode` | TEXT optional | C2 |

**UI creatable/editable:** false on generic forms; settings panel + REST authority only.

**Bootstrap:** if zero rows → insert IRR default; else no-op (tax-policy bootstrap twin).

**Phase 1:** catalog may later hold other ISO rows for display/accountingCode, but **operational amounts stay IRR** (C2 / WS4 refuse).

### 3.3 `catalogItem.accountingCode`

TEXT optional on existing object; Persian label; not used for matching (`accountingItemLink` remains identity).

### 3.4 `person` / `company` via `defineField`

```ts
defineField({
  universalIdentifier: PERSON_ACCOUNTING_CODE_FIELD, // 32280b01-…
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountingCode',
  label: 'کد حسابداری',
  …
});
```

Same for company (`741b9dfc-…`).

**Risk:** standard-object field apply / permission maps — quotation app role may need explicit field permission if platform requires it (check `quotation-app.role.ts` on implement).

**Ambiguity for architect:** confirm `name: 'accountingCode'` is acceptable on standard objects (no collision with existing custom fields in Dev). Pre-implement Dev metadata check recommended before apply.

---

## 4. Authority, permissions, isolation

| Surface | Proposal |
|---|---|
| Tax `accountingCode` save | Existing `TaxPolicyAuthorityService` + settings permission |
| Currency CRUD / set-default / bootstrap | New `QuotationCurrencyAuthorityService` (or sibling) behind `POST /rest/quotation/actions` |
| Item/person/company code | Normal record update permissions for those objects; no new “lock” in WS1 |
| GraphQL | Write-guard on `quotationCurrency` (all generic mutations forbidden); tax/connection guards unchanged |
| Isolation | Workspace ORM context only; advisory locks keyed by `workspaceId` |

---

## 5. Lock preflight (design for WS2 — confirm now)

### 5.1 What locks (C4)

| Reference | Locks `accountingCode` after first successful quotation save that references it? |
|---|---|
| `taxPolicy` id | **Yes** |
| `quotationCurrency` id | **Yes** |
| catalog item / person / company | **No** (C4) |

Lock is by **entity id**, not by comparing code text. Empty code on a locked entity: still locked against setting a new code? **Proposal:** once the reference id has been used on any saved quotation (even with empty accountingCode at that time), subsequent **changes** to `accountingCode` are refused if a non-empty code was ever snapshotted **or** if any snapshot stored the reference id with intent to freeze the ledger code field — **stricter reading of C4:** “از نخستین ذخیره موفق پیش‌فاکتور … کد مالیات یا ارز استفاده‌شده قفل می‌شود” ⇒ the **used** code value’s reference is locked. Clarification asked below.

### 5.2 Architect clarification required (destructive if wrong)

**Q-LOCK-1:** If a draft saves with policy P while `P.accountingCode` is empty, does that lock P so a later settings edit cannot set a code?  
- **Option A (recommended):** Lock only when a **non-empty** `accountingCode` was resolved and persisted on the quotation at save time. Empty→set still allowed until first non-empty snapshot.  
- **Option B:** Any save referencing P locks P’s accountingCode field forever (including empty→set).

C3 says empty snapshot is allowed when unset; C4 says used code locks. **Option A** matches both.

### 5.3 Lock ordering with TAX-008

Proposed acquisition order inside draft transaction (first statements, before row locks):

1. `pg_advisory_xact_lock_shared(hashtext('quotation-tax-policy:' || workspaceId))` — existing TAX-008  
2. `pg_advisory_xact_lock_shared(hashtext('quotation-currency-catalog:' || workspaceId))` — new  

Policy / currency **mutations** that touch `accountingCode` take the matching **exclusive** lock, then check usage by **reference id** against quotation snapshot columns (WS2 adds `taxPolicyId`/`currencyId` or reuse stored policy `code` + join — **prefer storing reference ids in snapshot for lock queries**).

**Q-LOCK-2 (ex-D-023-6):** Approve dual lock keys as above? Alternative: one umbrella `quotation-financial-refs:{workspaceId}` — simpler but coarser concurrency.

### 5.4 Usage detection (WS2)

Prefer columns:

- quotation / line: `taxPolicy` code today → add nullable `taxPolicyRecordId` **or** resolve code→id under lock (race-prone if code rename — but policy `code` is already immutable after create).  
- **Recommendation:** usage query by immutable policy `code` **and** currency `code` is acceptable **for lookup**, but lock refusal key remains **row id** once resolved inside the exclusive transaction. Do not unlock if operator renames display name.

Item/party: no usage lock in this Goal.

---

## 6. Data migration / compatibility

| Data | Plan |
|---|---|
| Existing tax policies | `accountingCode` empty |
| Existing quotations | Unchanged in WS1 |
| Existing mappings | Untouched (WS5/C6) |
| Currency | Bootstrap IRR; no delete of future rows without authority rules |
| Person/company/catalog | Null/empty codes |

No physical deletes. No outbound. No worker / `:6080`.

---

## 7. Test plan (WS1 acceptance)

1. Tax policy save with empty / non-empty accountingCode; GraphQL mutate refused.  
2. Currency bootstrap twice → one IRR default.  
3. Concurrent set-default currency → one default (advisory lock).  
4. Catalog item + person + company field round-trip in workspace A; workspace B cannot see A’s rows.  
5. Quotation draft save behavior **byte-identical** for money fields (no WS1 regression) — focused draft/tax tests.  
6. App role can update new standard fields as intended (or document permission gap).

WS2 concurrency harness is **not** required to close WS1.

---

## 8. File touch list (expected)

```
packages/twenty-apps/internal/quotation/src/objects/tax-policy.object.ts
packages/twenty-apps/internal/quotation/src/objects/quotation-currency.object.ts  (new)
packages/twenty-apps/internal/quotation/src/objects/catalog-item.object.ts
packages/twenty-apps/internal/quotation/src/fields/person-accounting-code.field.ts  (new)
packages/twenty-apps/internal/quotation/src/fields/company-accounting-code.field.ts  (new)
packages/twenty-apps/internal/quotation/src/constants/universal-identifiers.ts
packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx
packages/twenty-apps/internal/quotation/src/services/tax-policy.service.ts
+ currency panel/service/logic-function (new, minimal)
packages/twenty-server/src/modules/quotation/services/tax-policy-authority.service.ts
+ quotation-currency-authority.service.ts (new)
+ write-guard + query-hooks for quotationCurrency
+ controller actions
tests (vitest/jest)
package.json version bump on apply
```

Unrelated dirty `twenty-shared` build artifacts must **not** be staged.

---

## 9. Decision checklist for architect

| ID | Ask | Default if approved as-is |
|---|---|---|
| **WS1-OPEN** | Authorize WS1 implementation per this preflight? | — |
| **Q-LOCK-1** | Empty-then-set vs lock-on-any-reference? | **Option A** |
| **Q-LOCK-2** | Dual advisory keys vs one umbrella? | **Dual** (tax + currency) |
| **Q-STD-1** | Confirm `defineField` `accountingCode` on person/company after Dev collision check? | Proceed with check-first |
| **Q-WS2-COLS** | Add quotation snapshot id/code columns in WS1 early or strictly WS2? | **Strictly WS2** |
| **Q-IRR-SEED** | Bootstrap only IRR in WS1? | **Yes** |

Residual open from 021-R1 (retire↔send) is **not** solved by WS1; remains on architect backlog.

---

## 10. Gate

**`STOP_FOR_ARCHITECT`**

No product schema apply until **WS1-OPEN** (and lock clarifications Q-LOCK-1/2 if WS2 is to follow without another stop). After approval, implement WS1 only; update Progress to `IN_PROGRESS` → `TECHNICALLY_VERIFIED`; do not claim Goal complete.
