# CRM-129 — P0 Financial Settings Recovery

**Parent:** Goal 023 / Goal 032  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.60` on Dev `:3002`  
**Gate:** `STOP_FOR_USER_UAT`

## Root cause

Settings page called `/s/quotation/tax-policies` (and currencies/rounding) via logic-function GraphQL. On Dev, those `/s` handlers return soft `PERSISTENCE_FAILED` (worker/image GraphQL drift). Nest `POST /rest/quotation/actions` already succeeded with workspace auth intact. Currencies additionally had empty `httpRouteTriggerSettings` → `TRIGGER_NOT_FOUND`.

## Fix

- Front tax/currency/rounding settings call Nest actions (same bearer; settings authority unchanged).
- Currencies logic-function route settings aligned (`httpRouteTriggerSettings`).
- Page renamed **پیش‌نیازهای حسابداری** with in-panel tabs: مالیات و عوارض | ارزها | قواعد رُند کردن.
- IRR rounding remains positive integer only; UI states decimals (e.g. 0.001) are future non-IRR only.

## Evidence

- Unit: tax-policy-settings-panel + rounding-rule → **40 PASS**
- Nest: tax list/create/set-default/restore; currency list + accountingCode `IRR-ACC-RECOVERY`; rounding `0.001` → `ROUNDING_STEP_INVALID`
- Browser: page loads without tax error; three tabs work; IRR + rounding catalogs visible; quotation record still opens
- Backup/evidence: `D:\CrmDeployment\backups\crm129-fin-settings-recovery\`

## UAT

http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d  
Sidebar: **پیش‌نیازهای حسابداری**

## Safety

No `:6080`, no real accounting send, no quotation-form redesign, no force-push/merge.
