# CRM-129-ACCOUNTING-BUSINESS-UX-037 — Evidence

**Mode:** IMPLEMENT + ARCHITECTURE COMPLIANCE + BUILD + VERIFY  
**Branch:** `feat/crm-129-quotation`  
**Target app:** `quotation@0.1.77` (baseline task text said 0.1.73; Dev already held 0.1.73–0.1.76 from interim UX fixes)  
**Final gate:** `STOP_FOR_ARCHITECT`

## Verdict

`IN_PROGRESS` until Dev apply + A01–E08 operational rows below are filled from live Dev evidence.

Goal 023 remains ACTIVE. No real Asan document send. No Intranet `:6080` mutation. No hot patch.

## 1. Scope delivered in source

| Section | Change summary |
| --- | --- |
| Overview | Lean operational stats; clickable StatCards; no temp-view fluff |
| Connections | ⋯ row menu only; بازنشسته→غیرفعال; no temp view/localStorage; workspace default from backend; simplified adapter-first form; financial UI hidden (domain data preserved on save) |
| Products | Top toolbar; transfer selected/all; header checkbox; selection persists; Persian whole-rial prices; no bottom action bar |
| Customers | Same table/toolbar pattern; multi-select; transfer-all for unique matches + createNew via national-id contract; ambiguous/duplicates skipped |
| Documents | Pending/Sent tabs; queue from `list-exportable-quotations`; bulk/single send via existing `execute-quotation-export`; history retained |

## 2. Architecture compliance

| Constraint | Status |
| --- | --- |
| POST `/rest/quotation/actions` only | PASS (Nest dispatch map extended; no `/s` restored) |
| New Nest action `accounting-outbound-list-exportable-quotations` | Added with LF + client map |
| Financial settings ownership preserved on connectivity save | PASS (merge from existing connection settings) |
| Catalog owner for item create | Unchanged (`apply-items`) |
| CRM owner for person/company create | Added via `createPerson` / `createCompany` GraphQL in `applyPartyImport` when `createNew` |
| Existing outbound engine for document send | Unchanged |
| Hot patch | Not used |
| Intranet `:6080` | Untouched |

## 3. Local gates

| Gate | Result |
| --- | --- |
| `npx tsgo --noEmit -p tsconfig.spec.json` (quotation) | PASS |
| `npx vitest run src/components/accounting` (+ nest-response) | **91 PASS** |
| `npx vitest run` import service + accounting | **102 PASS** |
| Jest `accounting-operation-dispatch.service.spec.ts` | PASS |

## 4. Commit / Image / Apply

| Item | Value |
| --- | --- |
| Commit | _(fill after commit)_ |
| Image tag | _(fill after clean image build)_ |
| Image ID | _(fill)_ |
| Applied app | `quotation@0.1.77` |
| Server/Worker digest match | _(fill)_ |

## 5. Acceptance matrix (Dev — live)

Mark only from Dev browser + Nest evidence. Screenshot alone ≠ PASS.

### Connections

| ID | Result | Evidence |
| --- | --- | --- |
| A01 | | |
| A02 | | |
| A03 | | |
| A04 | | |
| A05 | | |
| A06 | | |
| A07 | | |
| A08 | | |

### Products

| ID | Result | Evidence |
| --- | --- | --- |
| B01–B07 | | |

### Customers

| ID | Result | Evidence |
| --- | --- | --- |
| C01–C07 | | |

### Documents

| ID | Result | Evidence |
| --- | --- | --- |
| D01–D10 | | |

### Security / Regression

| ID | Result | Evidence |
| --- | --- | --- |
| E01–E08 | | |

## 6. Known limits / honesty

- Sepidar: still unavailable (no fake adapter / fake successful test).
- Live Asan send remains disabled by outbound flags.
- Party auto-create requires a valid 10/11-digit national identifier; otherwise manual CRM pick is required (no name-based guessing).
