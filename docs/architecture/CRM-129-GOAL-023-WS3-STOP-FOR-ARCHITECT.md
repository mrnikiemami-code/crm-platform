# STOP_FOR_ARCHITECT — Goal 023 WS3 (per-line tax/duty)

**Goal:** ACTIVE / NOT COMPLETE  
**Branch:** `feat/crm-129-quotation`  
**Base verified:** `d1d5da6c4a`  
**Task:** `CRM-129-GOAL-023-WS3-PER-LINE-TAX-028`  
**Dev Schema / App Apply:** **not performed** (app version prepared `0.1.55`)

---

## What shipped (source)

| Area | Change |
|---|---|
| Schema | Line fields: `taxPolicy`, `taxRateBasisPoints`, `dutyRateBasisPoints`, `taxAccountingCode`, `taxPolicyRecordId` (UUIDs in [`CRM-129-GOAL-023-WS3-PREFLIGHT.md`](./CRM-129-GOAL-023-WS3-PREFLIGHT.md)) |
| Money | `finalizeLinesWithDocumentDiscount` optional `lineTaxRates` **after** Hamilton document-discount allocation; micros/rounding/Hamilton unchanged |
| Draft UI | Per-line policy `<select>` on **existing** line cards; header select = default for **new** lines only; **no** accounting codes on form (C3) |
| Snapshot / lock | Every distinct line policy resolved fail-closed; non-empty codes stored on lines; C4 lock also queries `quotationLine.taxPolicyRecordId` |
| Save / reopen | Line policy codes + frozen rates in atomic save; legacy reopen copies header policy onto lines once |
| Revision / PDF | Optional per-line policy/rates on sealed lines (absent on pre-WS3 seals → hash stable); PDF line tax amounts unchanged |
| Outbound | Distinct line policies → `MULTI_TAX_UNSUPPORTED` (fail-closed; no adapter proves multi-tax) |
| Legacy | Header tax fields retained (C7); sealed revisions untouched |

---

## Financial proof

| Suite | Result |
|---|---|
| Money domain + draft + outbound vitest (`document-discount`, `draft-quotation`, money/`*`, `outbound-plan`, `financial-contract`) | **240 PASS** |
| Two-line distinct rates + duty + document discount + rounding | Covered in `document-discount-and-payable.test.ts` + `draft-quotation.test.ts` + server `quotation-draft-totals.util.spec.ts` |
| `quotation-draft-persistence.service.spec.ts` + revision snapshot + totals | **44 PASS** (incl. prior WS2-R1 fail-closed paths) |
| Multi-tax outbound gate | `MULTI_TAX_UNSUPPORTED` assert in `outbound-plan.test.ts` |

---

## Diff focus (review)

- `packages/twenty-apps/internal/quotation/src/domain/money/document-totals.ts`
- `packages/twenty-apps/internal/quotation/src/domain/quotation/draft-quotation.ts`
- `packages/twenty-apps/internal/quotation/src/components/quotation-draft-form.tsx`
- `packages/twenty-server/src/modules/quotation/services/quotation-draft-persistence.service.ts`
- `packages/twenty-server/src/modules/quotation/utils/quotation-draft-totals.util.ts`
- `packages/twenty-apps/internal/quotation/src/domain/accounting/outbound-plan.ts`

---

## Not in this gate

- Dev Schema / App Apply / Deploy  
- WS4 document currency picker  
- Real `:3002` USER_UAT  
- Outbound enablement / `:6080`  
- Hamilton redesign / multi-currency  

---

## Architect actions

1. Accept or amend WS3 financial integrity (narrow Money Domain).  
2. Then open **WS4** (document IRR default + line inheritance hooks).  
3. Separate grant for controlled Dev apply (WS1–WS4) → smoke on **actual** form → `STOP_FOR_USER_UAT`.

**STOP_FOR_ARCHITECT** — Goal 023 ACTIVE / NOT COMPLETE. Next: WS4, then controlled Dev apply for real-form UAT.
