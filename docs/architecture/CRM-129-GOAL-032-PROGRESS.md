# CRM-129-CUSTOM-ROUNDING-032 — Progress

**Parent:** CRM-129-GOAL-023 (stays ACTIVE)  
**Branch:** `feat/crm-129-quotation`  
**HEAD:** `8567405840`  
**App:** `quotation@0.1.59` on Dev `:3002`  
**Gate:** `STOP_FOR_USER_UAT`

## Shipped

- Money Domain: `floorMicrosToStepRials` + `PAYABLE_ROUNDED_TO_ZERO`; document totals accept `roundingStepRials` (default `1` = legacy whole-rial).
- Object `roundingRule` + quotation snapshot fields (`roundingRuleCode/Name`, `roundingStepRials`, `preRoundTotalExact`, `roundingRuleRecordId`).
- Nest `RoundingRuleAuthorityService` (bootstrap seeds 10…1e6, default = 10), GraphQL write guards, draft totals recompute floor + refuse silent zero.
- Settings: «قواعد رُند کردن» section on existing tax/financial settings panel.
- Form: «مبنای رُند کردن» picker beside summary; label `کسر بابت رُند (مبنای …)`; save/reopen snapshot; PDF label aligned.
- Front `0.1.59`: catalog load/mutations via Nest `/rest/quotation/actions` (survives Dev `/s` GraphQL worker drift).
- Logic-function `rounding-rules` HTTP route wired (`httpRouteTriggerSettings`); list prefers Nest.

## Tests (PASS)

- vitest: `rounding-rule.test.ts` + `document-discount-and-payable.test.ts` → **29 PASS**
- jest: `quotation-draft-totals.util.spec.ts` → **10 PASS**
- Nest Dev: bootstrap 6 seeds; create STEP_99; set default; reject 0/−1/1.5/abc; GraphQL `roundingRules` OK
- Browser Dev: picker lists STEP_10…1e6 + STEP_99; select STEP_1000 → `کسر بابت رُند (مبنای ۱٬۰۰۰ ریال) -۹۵ تومان`, payable `۹۳٬۱۰۰ تومان` (from `۹۳٬۱۹۵`)
- Settings page shows «قواعد رُند کردن» / «مدیریت قواعد رُند»

## Dev runtime notes

- Server image restored to monorepo build `twenty-dev/o117-restore` (`crm-intranet/twenty:53db32b3`) after stock `twentycrm/twenty:latest` ORM mismatch (`standardOverrides` / `RolePermissionFlag`).
- Quotation Nest module docker-cp + `core-engine` QuotationModule import.
- Backup: `D:\CrmDeployment\backups\crm129-goal-032-20261125-191247\`
- Intranet `:6080` untouched. No force-push/merge/outbound.

## UAT URL

http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729  
Settings: sidebar «مالیات و عوارض» → «قواعد رُند کردن»

## Safety

- Legacy drafts without snapshot keep step `1` until operator picks a rule.
- Sealed revisions keep stored payable; catalog edits do not reprice them.
