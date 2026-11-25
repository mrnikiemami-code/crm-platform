# CRM-129 Goal 023 — WS4 Preflight (Document currency)

**Status:** frozen for implementation; **Dev Schema/App Apply NOT authorized** by this document alone.  
**App version prepared:** `0.1.56` (from `0.1.55`).

## New field UUID (frozen)

| Field | UUID |
|---|---|
| `quotationLine.currencyCode` | `fd6422e4-d8ec-54bf-b628-27bd5950fdaf` |

## Phase-1 rules

- Document currency select from `quotationCurrency` catalog; default = workspace default (IRR).
- Lines inherit document `currencyCode` (server write); no per-line currency UI.
- `MULTI_CURRENCY_DOCUMENTS = false`; non-IRR draft save → `OPERATIONAL_CURRENCY_MUST_BE_IRR`.
- تومان/ریال remain `MoneyUnit` display scale only (not ISO currencies).
- `totalsByCurrency` stub exists empty; no FX.

## Prior WS1–WS3 fields already prepared (apply together)

See [`CRM-129-GOAL-023-WS1-PREFLIGHT.md`](./CRM-129-GOAL-023-WS1-PREFLIGHT.md) and [`CRM-129-GOAL-023-WS3-PREFLIGHT.md`](./CRM-129-GOAL-023-WS3-PREFLIGHT.md).
