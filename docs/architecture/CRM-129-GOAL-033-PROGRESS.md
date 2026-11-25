# CRM-129 — Goal 033 Financial Settings UX Repair

**Parent:** Goal 023 (ACTIVE) / Goal 032 context  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.61` on Dev `:3002`  
**Gate:** `STOP_FOR_USER_UAT`

## Shipped

- Shared destructive confirm: `confirmDestructiveAction` → host `openCommandConfirmationModal` (danger accent). Delete opens the dialog directly; no inline row confirm; no editor-for-delete path.
- Tax tab: compact default banner (`پیش‌فرض — …`), ledger without documents column, Edit + More menu (default / activate / deactivate / delete), inspector without inline confirm.
- Currency tab: compact IRR card, field-level save errors, shared toast with dedupe.
- Rounding tab: compact list + more menu, delete via shared confirm, Persian thousands on step labels, field errors beside inputs.
- Toasts: Twenty `enqueueSnackbar` only; empty messages skipped; success/error/warning with dedupe keys.
- Responsive: `container-type` on `.tax-root`, `@container` + `@media` breakpoints, 44px touch targets under 720px, no forced wide ledger min-width.

## Tests

- `tax-policy-settings-panel.test.tsx` — 31 PASS (shared confirm mock, more-menu actions)
- `confirm-destructive-action.test.ts` — 2 PASS

## Dev apply + browser evidence

- Apply: `quotation@0.1.61` → `dev-crm129` (2 frontComponent checksum updates)
- HEAD: `3730ef3aab`
- Page load at ~601px container: **no horizontal overflow**; default banner `پیش‌فرض — …`; Edit + More on each row
- Create policy «عوارض آزمایشی UX۰۳۳» via Nest `201`
- Delete → host dialog: title «حذف سیاست مالیات», subtitle with record name, focus on **لغو**, confirm «حذف سیاست» → toast «سیاست مالیات حذف شد», catalog back to 3
- Currency / rounding tabs load; long phase-1 copy removed; ~44px touch targets under narrow width

## UAT

http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d  
Sidebar: **پیش‌نیازهای حسابداری**

## Safety

No Money Domain / historical revision changes. No `:6080`. No force-push/merge. Nest settings APIs unchanged.
