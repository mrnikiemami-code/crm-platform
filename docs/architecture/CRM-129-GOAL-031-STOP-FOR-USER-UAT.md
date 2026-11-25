# CRM-129-GOAL-031 — STOP_FOR_USER_UAT

**Parent Goal 023:** ACTIVE / NOT COMPLETE  
**Gate:** `STOP_FOR_USER_UAT`  
**Branch:** `feat/crm-129-quotation`  
**Base:** `a0cdbf78d0`  
**Installed Dev app:** `quotation@0.1.57`  
**Schema:** unchanged (DEV-APPLY-030 already applied; not re-run)

---

## Real form (Dev)

http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729

Or: Person → **ایجاد پیش‌فاکتور**

---

## What changed (UX on existing form)

| Item | Status |
|---|---|
| حقیقی / حقوقی labels; clear on type change | PASS |
| Customer picker ≤100/page + load more + debounce | PASS |
| ارز سند + «نمایش مبلغ به» together | PASS |
| Document default tax UI removed; new lines inherit workspace default | PASS |
| Per-line net / مالیات / عوارض / جمع ردیف | PASS |
| Summary labels without policy name | PASS |
| Single financial summary + always-visible rounding | PASS |
| Distinct «تخفیف کل سند» section | PASS |
| Side-panel narrow width (~300px) no horizontal overflow | PASS |
| Nest `position` aligned with `sortOrder` on line write | PASS (deployed) |
| Accounting codes hidden on form | PASS (unchanged) |
| Outbound / `:6080` / worker | untouched |

---

## Tests

- Vitest (save + customer picker + draft/money focused suites): PASS  
- Jest `quotation-draft-persistence.service.spec.ts`: PASS  
- Browser Dev `:3002` after apply `0.1.57`: PASS (labels, line totals, single summary, type switch clear)

Evidence screenshot: `C:\\Users\\User\\AppData\\Local\\Temp\\cursor\\screenshots\\page-2026-11-25T14-53-40-959Z.png`

---

## Remaining / notes

- Form lives in Twenty side panel (~300px); responsive CSS targets ≤430px stacking. Full-viewport Emulation still shows the host chrome; form itself does not overflow.
- Historical UAT lines keep prior `position=0` until re-saved; new/updated saves write matching `position`/`sortOrder`.

---

**Do not start WS5/WS6 or redesign until user confirms this form.**
