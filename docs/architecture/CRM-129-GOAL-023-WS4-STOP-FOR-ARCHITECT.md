# STOP_FOR_ARCHITECT — Goal 023 WS4 (document currency)

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Base verified:** `745bf58fea`  
**Task:** `CRM-129-GOAL-023-WS4-CURRENCY-029`  
**Dev Schema / App Apply:** **not performed** (app prepared `0.1.56`)

---

## What shipped (source)

| Area | Change |
|---|---|
| Form | Document currency select above line cards on **existing** draft form; workspace default auto-selected; phase-1 IRR-only options |
| Display | تومان/ریال remain display `MoneyUnit` only — not independent currencies |
| Inheritance | Every line stamped with document `currencyCode` (domain + server write); no per-line currency UI |
| Backend | `OPERATIONAL_CURRENCY_MUST_BE_IRR` + inactive refuse; WS2 currency snapshot unchanged path |
| Phase-2 stubs | `MULTI_CURRENCY_DOCUMENTS = false`; `totalsByCurrency` empty; nullable `quotationLine.currencyCode` |
| Money | No arithmetic/FX change; micros + Hamilton + WS3 per-line tax untouched |
| Sealed revisions | Untouched (hash-stable; currency already on header) |

---

## Evidence

| Suite | Result |
|---|---|
| Vitest money/draft (+ document-currency) | **206 PASS** (money + draft + outbound subset) |
| Jest persistence + document-currency util + totals | **37 PASS** (incl. non-IRR refuse + line `currencyCode: IRR`) |

---

## Consolidated Apply preflight

[`CRM-129-GOAL-023-DEV-APPLY-PREFLIGHT-WS1-WS4.md`](./CRM-129-GOAL-023-DEV-APPLY-PREFLIGHT-WS1-WS4.md) — WS1–WS4 schema/app checklist, collision/rollback, smoke steps. **No Apply until explicit grant.**

---

## Not started after this STOP

- Any new pack (WS5/WS6/…)
- Dev Apply / Deploy / USER_UAT (await Apply authorization)
- Outbound / `:6080`

---

## Architect actions

1. Accept or amend WS4 source.  
2. **Separate** grant for controlled Dev Schema + App Apply (WS1–WS4) using the consolidated preflight.  
3. After Apply: smoke on real `:3002` form → `STOP_FOR_USER_UAT`.

**STOP_FOR_ARCHITECT** — waiting for Apply authorization. Goal 023 ACTIVE / NOT COMPLETE.
