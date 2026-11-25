# CRM-129 — Goal 034 Live Visual Redesign

**Parent:** Goal 023 (ACTIVE)  
**Supersedes:** Goal 033 UX acceptance failure  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.62` on Dev `:3002`  
**Gate:** `STOP_FOR_USER_UAT`

## Onlook

Evaluated from https://github.com/onlook-dev/onlook (Apache-2.0). Notes: `D:\CrmTools\onlook-evaluation-goal-034.md`.

**Not used for implementation.** Reasons: Windows host lacks a reliable free Onlook desktop path; design agent expects Claude/ChatGPT subscription (paid); quotation UI is a Twenty Front Component (host-injected), not a standalone Next/Vite+Tailwind app Onlook can drive end-to-end; Goal forbids converting Twenty to Next/Tailwind for tool fit.

**Tool used:** direct React redesign of the real settings Front Components + Twenty host ConfirmationDialog / snackbar + shared local dialog/portal menu.

## Shipped

- Page title left to host page once; compact tab toolbar
- Tax create/edit in `SettingsDialog` (portal modal) — ledger stays full width
- Portal `RowActionsMenu` (Escape / click-away / last-row safe)
- Delete via `runDestructiveConfirm` single-flight latch → host danger confirm
- Currency: auto idempotent bootstrap; no «راه‌اندازی ریال» button; edit dialog for accounting code
- Rounding: auto bootstrap when empty; create/edit dialog; portal more-menu
- Responsive tokens / container queries retained; dialog sheet on ≤430px

## Tests

- tax-policy-settings-panel: 31 PASS
- confirm-destructive-action: 2 PASS
- run-destructive-confirm: 2 PASS

## UAT URL

http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d

## Safety

No Money Domain / Nest authority / historical revision / `:6080` changes.
