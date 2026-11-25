# STOP_FOR_ARCHITECT — Goal 023 WS2-R1 (fail-closed accounting snapshot)

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Recovery base:** `44c1951f83`  
**Task:** `CRM-129-GOAL-023-REAL-FORM-027` stage 1 only  
**Dev Apply:** **not performed**

---

## Defect fixed

`resolveAccountingSnapshot` previously **fail-opened**: tax/currency catalog read exceptions and missing rows could leave blank snapshot fields while the draft still saved.

### Fail-closed rules (WS2-R1)

| Condition | Behavior |
|---|---|
| Tax/currency table unreadable (throw) | `REJECTED` (`TAX_POLICY_UNAVAILABLE` / `CURRENCY_CATALOG_UNAVAILABLE`); no insert/update |
| Required reference row missing | `REJECTED` (`ACCOUNTING_REFERENCE_NOT_FOUND` / `CURRENCY_REFERENCE_NOT_FOUND`) |
| Reference exists, `accountingCode` empty | Snapshot empty **allowed**; record id still stored |
| Reference exists, non-empty code | Snapshot that code |
| Missing `currencyCode` on request | `CURRENCY_CODE_REQUIRED` |
| Sealed / historical docs | Untouched (no Money/PDF/status change) |

Tax → Currency shared advisory lock order preserved.

---

## Evidence

| Suite | Result |
|---|---|
| `quotation-draft-persistence.service.spec.ts` | **23 PASS** (fail-closed tax/currency read, missing currency row, legitimate empty codes, prior WS2 cases) |
| `tax-policy-authority.service.spec.ts` | PASS (incl. `ACCOUNTING_CODE_IN_USE`) |
| `quotation-currency-authority.service.spec.ts` | PASS |
| `quotation-accounting-code-lock.pg.spec.ts` | **4 PASS** on local PostgreSQL (lock order, exclusive blocked while shared held, usage-by-id, transaction rollback leaves no draft row) |

---

## Not in this gate

- Dev Schema / App Apply  
- WS3 Money Domain / per-line tax UI  
- WS4 document currency picker  
- USER_UAT / WS5–WS6  

---

## Architect actions

1. Accept WS2 + WS2-R1 → `ARCHITECT_ACCEPTED` (or amend).  
2. Separate grant for Dev Apply (WS1+WS2 columns, app `0.1.54+`).  
3. Then open WS3 with **narrow Money Domain** permission for per-line tax/duty only.

**STOP_FOR_ARCHITECT** — Goal 023 ACTIVE / NOT COMPLETE. Next after accept: WS3 on existing draft cards → WS4 → controlled Dev apply → **STOP_FOR_USER_UAT**.
