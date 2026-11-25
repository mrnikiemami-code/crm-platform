# CRM-129-FINANCIAL-CONTRACT-023

**Companion to:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md)  
**Progress:** [`CRM-129-GOAL-023-PROGRESS.md`](./CRM-129-GOAL-023-PROGRESS.md)  
**WS1 preflight:** [`CRM-129-GOAL-023-WS1-PREFLIGHT.md`](./CRM-129-GOAL-023-WS1-PREFLIGHT.md)  
**Activation:** EXECUTION-024 @ checkpoint `cdb890b3f5`  
**Gate:** pack-level `STOP_FOR_ARCHITECT` as required

---

## Ratified amendments (C1–C7) — normative

These clauses are **binding**. They close prior open decisions as listed below.

| Amendment | Closes |
|---|---|
| C4 lock by **reference id** | **D-023-1** |
| C2 phase-1 **IRR-only** operational amounts | **D-023-2** |
| C7 multi-policy outbound only with proven adapter support else **block** | **D-023-3** |
| C5 person/company via app `defineField` on `STANDARD_OBJECT` | **D-023-4** |
| C7 keep legacy **document-level** tax fields | **D-023-5** |
| Lock family for tax/currency codes | **D-023-6** → proposal in WS1 preflight (architect must confirm before WS2) |

### C1 — Policy

- Optional single `taxPolicy.accountingCode` for the whole policy (tax + duty).
- Independent `rateBasisPoints` and `dutyRateBasisPoints`.
- Quotation UI: select policy only; per-line policy allowed; default policy auto-applied.

### C2 — Currency

- Currency catalog with optional `accountingCode`, `isDefault`, `isActive`.
- Phase 1: operational amounts **IRR only**; all lines inherit document `currencyCode`.
- Phase 2: schema/types may prepare `totalsByCurrency` / line currency fields; flag off; no cross-currency sum.

### C3 — Quotation codes

- No tax/currency accounting-code inputs on draft/record forms.
- No issuer edit of snapshotted codes; not shown as editable line settings.
- Server resolves codes from references at save; non-empty reference ⇒ mandatory persist; empty ⇒ empty allowed.

### C4 — Lock (Q-LOCK-1 Option A — ratified)

- First successful save (incl. DRAFT) that **snapshots a non-empty** `accountingCode` for a tax policy or currency reference locks that reference’s `accountingCode` mutation (by **entity id**).
- Empty→set remains allowed until that first non-empty snapshot; thereafter any change is refused (`ACCOUNTING_CODE_IN_USE`).
- Server + DB transaction + deterministic concurrency tests (WS2).
- **Does not** auto-extend to item/person/company codes.

### C5 — Item / party codes

- `catalogItem.accountingCode`, `person.accountingCode`, `company.accountingCode`.
- Distinct from `accountingItemLink` / `accountingPartyLink` vendor ids.

### C6 — Settings

- Connection settings must not author CRM tax/currency accounting codes.
- Vendor mapping only when adapter capability documents need; no physical purge of existing mappings before compatibility review.
- Asan special item codes remain Asan-only mechanics.

### C7 — Calc / compatibility / outbound

- Line tax after discount allocation uses **line** policy rates.
- Keep header tax fields for legacy; sealed revisions immutable.
- PDF/API follow snapshot.
- Multi-tax export gated on adapter proof.

---

## S0 — Reality baseline (unchanged facts)

| Concern | Evidence |
|---|---|
| Tax policy | `tax-policy.object.ts` — no `accountingCode` yet |
| Quotation tax | Document-level only; lines have `taxExact` amounts |
| Draft currency | `draft-quotation.ts` forces `'IRR'` |
| Lock today | `quotation-tax-policy-lock.util.ts` (rate/policy↔draft), not accounting-code lock |
| Settings maps | `taxPolicyMappings` / `currencyMappings` = vendor destination, UX conflates ownership |
| Item/party | Vendor links only; no CRM ledger code on records |
| Person/company extension | Existing pattern: `defineField` on `STANDARD_OBJECT` (`person-quotations.field.ts`) |

Terminology:

| Term | Meaning |
|---|---|
| CRM `accountingCode` | Ledger code on reference record |
| Policy/currency `code` | CRM identity (`IR_VAT_9`, `IRR`) |
| Vendor destination code | Connection mapping / link external id |

---

## S1 — Gap matrix (post C1–C7)

| Capability | Status | Notes |
|---|---|---|
| Tax/currency/item/party CRM accounting codes | **MISSING** | WS1 |
| Currency catalog + default | **MISSING** | WS1 (IRR seed) |
| Snapshot of CRM codes on quotation | **MISSING** | WS2 |
| Lock accountingCode by reference id | **MISSING** | WS2 (design in preflight) |
| Per-line tax policy | **MISSING** | WS3 |
| Phase-1 IRR inheritance modeled | **PARTIAL** | WS4 |
| Phase-2 hooks inactive | **MISSING** | WS4 |
| Settings stop CRM code authoring | **CONFLICT** | WS5 |
| Mock/Asan shared capability UI | **PARTIAL** | WS6 |
| Persian UX Goal-level | **BLOCKED** on design/UAT | WS7 |
| Multi-tax outbound gate | **MISSING** | WS3 + C7 |
| Retire↔send hard lock (021-R1) | **BLOCKED** open | Orthogonal; do not ignore |

---

## Field contracts (implementation-facing)

### Shared `accountingCode`

| Aspect | Rule |
|---|---|
| Storage | Nullable TEXT; empty = unset; max 64; trim; no float |
| Charset (WS1 proposal) | Printable non-control; reject leading/trailing space after trim; exact charset can tighten in panel validation |
| Quotation UI | Never editable (C3) |
| Lock | Tax policy + currency only under C4; item/party editable until separate contract |

### F1 — `taxPolicy.accountingCode`

One optional code; tax panel edits under existing settings authority; GraphQL still guarded.

### F2 — `quotationCurrency` catalog

Fields: `code`, `name`, `isDefault`, `isActive`, `accountingCode`. Bootstrap IRR default. Phase-1 save refuses non-IRR operational documents.

### F3 — Item / person / company

`defineField` TEXT on catalog item object + standard person/company. Labels Persian. Not used as vendor match key.

### F4 — Line tax (WS3)

Line: `taxPolicy`, `taxRateBasisPoints`, `dutyRateBasisPoints`, snapshotted `taxAccountingCode`. Header legacy fields retained (C7).

### F5 — Document currency (WS4)

Document select from catalog (IRR only in phase 1); lines copy header `currencyCode`; snapshot `currencyAccountingCode` when set.

### F6 — Lock concurrency (WS2) — Q-LOCK-2 dual keys ratified

1. Keep TAX-008 key `quotation-tax-policy:{workspaceId}` as first lock on draft save and policy mutations (ordering unchanged).
2. Add `quotation-currency-catalog:{workspaceId}` shared/exclusive for currency catalog / accountingCode mutations vs draft.
3. Usage / lock trigger (C4 Option A): a reference id is locked only when a quotation (any status) has persisted a **non-empty** snapshotted accounting code for that reference — detected by **reference id** (not code-text equality).
4. Empty→non-empty before first non-empty snapshot remains allowed; after lock, any `accountingCode` change refused (`ACCOUNTING_CODE_IN_USE`).
5. WS1 creates the currency advisory lock helper for catalog mutations; enforcement of C4 usage checks ships in WS2 with snapshot columns.

### F7 — Settings (WS5)

Remove CRM ledger-code affordances from connection form. Keep capability-gated vendor maps; migrate UX to pickers; no physical delete of stored maps in WS5 without audit.

---

## Compatibility

| Case | Behavior |
|---|---|
| Legacy header-only tax docs | Readable; sealed untouched; draft reopen may copy header policy onto lines once (WS3) |
| Empty codes | Valid |
| Existing `taxPolicyMappings` | Retained pending WS5/C6 review |
| IRR history | Remains IRR |

---

## Security

REST authority paths; GraphQL write-guards; workspace isolation; no secrets; outbound flags off; `:6080` / main worker untouched.
