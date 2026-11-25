# DESIGN-DECISION — GOAL-023 / WS7-A

**Status:** **CANCELLED as product Design of Record** (user STOP redesign). Archival / non-binding reference only — do not ship into product.  
**Preview:** [`index.html`](./index.html) (mock data only; no product code)  
**Goal:** [`CRM-129-MASTER-GOAL-023.md`](../../architecture/CRM-129-MASTER-GOAL-023.md)  
**Live path:** targeted UX repair on existing draft + accounting settings; Pack B financial capabilities behind `STOP_FOR_ARCHITECT`; appearance gate is `STOP_FOR_USER_UAT` on real Dev UI.

---

## Operator defects addressed

| # | Defect | Design choice |
|---|---|---|
| D1 | Settings scattered; operator cannot see the five accounting surfaces as one system | Single dark rail with five numbered settings sections + one operational «پیش‌فاکتور» entry |
| D2 | Mock vs Asan feel like two products | Shared connection form; adapter toggle only changes capability chips and Asan-only fields |
| D3 | CRM ledger codes confused with vendor link ids | Items/customers tables show both columns side-by-side; labels distinguish «کد حسابداری CRM» vs «شناسه لینک فروشنده» |
| D4 | Tax/currency codes re-authored on quotation | Quotation form has **no** tax or currency accounting-code inputs (C3); codes authored only on reference settings |
| D5 | Document-only tax hides line exceptions | Each quotation line has its own tax-policy select; new lines inherit the active default policy |
| D6 | Money shows noisy decimals (ریال) | `fa-IR` format with `maximumFractionDigits: 0`; tabular numerals |
| D7 | Non-IRR surprise default | Currency section surfaces phase-1 rule; UI refuses promoting USD/other as default |
| D8 | Dense enterprise clutter | Compact 32px controls, single composition panels, no hero cards, no decorative chrome |

---

## Information architecture (five settings + quotation)

1. **اتصال** — shared Mock/Asan profile; capabilities from adapter; never authors tax/currency CRM codes (C6)
2. **کالاها** — catalog list; CRM `accountingCode` on the item
3. **مشتریان** — person/company list; CRM `accountingCode` on the party
4. **مالیات و عوارض** — policy rates + optional policy-level accounting code; lock badge after snapshot (display-only here)
5. **ارز** — catalog; IRR bootstrap/repair; phase-1 default IRR only
6. **پیش‌فاکتور** — party + inherited IRR + per-line tax policy; money summary without code fields

---

## Visual system

- Twenty gray/blue token palette (same family as prior tax-panel pilots); no purple gradient theme
- Vazirmatn for professional Persian RTL
- Organizational density: tables over cards; actions in-row
- Amber banner states that the preview is experimental / non-product

---

## Explicit non-goals (this pack)

- No product component edits (WS7-B only after approval)
- No live Asan/Mock network calls
- No Dev schema apply
- No WS2 snapshot/lock enforcement in product

---

## Approval question for the user

Does this IA, density, Persian microcopy, and quotation line-tax interaction feel right as the Design of Record for WS7-B?

- **Approve** → unlock WS7-B (still no Goal COMPLETE)
- **Amend** → list concrete visual/IA changes; stay on WS7-A
- **Reject** → redesign before any product UI work
