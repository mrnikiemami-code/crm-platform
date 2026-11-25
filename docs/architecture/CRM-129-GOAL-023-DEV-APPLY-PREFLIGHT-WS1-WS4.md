# CRM-129 Goal 023 — Consolidated Dev Apply Preflight (WS1–WS4)

**Status:** PREPARED — awaiting **separate** architect Apply authorization.  
**This document does not authorize Schema Apply, App Apply, Deploy, or `:6080`.**

**Branch:** `feat/crm-129-quotation`  
**App package:** `quotation@0.1.56`  
**Goal:** ACTIVE / NOT COMPLETE — after Apply: smoke on real `:3002` form → `STOP_FOR_USER_UAT`.

---

## Why apply is needed

| Pack | Source accepted? | Needs Dev schema/app? |
|---|---|---|
| WS1 Reference accounting codes | Yes | Yes (`taxPolicy`/`quotationCurrency`/`person`/`company`/`catalogItem` accountingCode + currency catalog) |
| WS2 Snapshot + lock | Yes | Yes (quotation snapshot columns + advisory locks) |
| WS3 Per-line tax | Yes | Yes (line tax policy/rates/snapshot columns) |
| WS4 Document currency | TECHNICALLY_VERIFIED (this pack) | Yes (line `currencyCode` inherit stub; form uses catalog already in WS1) |

Without Apply, the operator cannot see WS3/WS4 controls on the real Dev form.

---

## Schema / object surface (apply checklist)

### Catalogs & references (WS1)
- `taxPolicy.accountingCode`
- `quotationCurrency` object + `accountingCode` / default / active
- `person` / `company` / `catalogItem` `accountingCode` (standard forms)

### Quotation header (WS2)
- `taxAccountingCode`, `taxPolicyRecordId`
- `currencyAccountingCode`, `quotationCurrencyRecordId`

### Quotation line (WS3 + WS4)
- WS3: `taxPolicy`, `taxRateBasisPoints`, `dutyRateBasisPoints`, `taxAccountingCode`, `taxPolicyRecordId`
- WS4: `currencyCode` (`fd6422e4-d8ec-54bf-b628-27bd5950fdaf`)

UUID registries: WS1 / WS3 / WS4 preflight docs.

---

## Collision / safety checks before Apply

1. Dev workspace collision count on `accountingCode` for person/company/catalogItem/taxPolicy (WS1: was **0** — re-check before Apply).
2. Backup Dev DB (or snapshot) before schema apply.
3. Confirm app install target is Dev only (`:3002`), not production.
4. Confirm outbound remains disabled; no `:6080` / primary worker restart.
5. Rollback plan: revert app to prior installed version; nullable columns remain safe.

---

## Apply order (when authorized)

1. Schema apply for all WS1–WS4 quotation/catalog fields.
2. App apply `quotation@0.1.56`.
3. Bootstrap tax policies + quotation currencies if catalogs empty.
4. Smoke on **existing** draft form:
   - Default IRR document currency
   - Per-line tax policy select (WS3)
   - Save → reopen preserves currency + tax policies
   - No accounting codes visible on draft
5. `STOP_FOR_USER_UAT` — user reviews appearance/behavior on real UI.

---

## Explicitly out of scope until further grant

- Multi-currency operations (`MULTI_CURRENCY_DOCUMENTS` stays **false**)
- FX / cross-currency totals
- Outbound enablement / vendor send
- WS5/WS6 polish packs
- Force push / merge to main
