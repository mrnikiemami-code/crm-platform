# CRM-129-CUSTOM-ROUNDING-032 — Progress

**Parent:** CRM-129-GOAL-023 (stays ACTIVE)  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.58`  
**Gate:** `STOP_FOR_USER_UAT`

## Shipped

- Money Domain: `floorMicrosToStepRials` + `PAYABLE_ROUNDED_TO_ZERO`; document totals accept `roundingStepRials` (default `1` = legacy whole-rial).
- Object `roundingRule` + quotation snapshot fields (`roundingRuleCode/Name`, `roundingStepRials`, `preRoundTotalExact`, `roundingRuleRecordId`).
- Nest `RoundingRuleAuthorityService` (bootstrap seeds 10…1e6, default = 10), GraphQL write guards, draft totals recompute floor + refuse silent zero.
- Settings: «قواعد رُند کردن» section on existing tax/financial settings panel.
- Form: «مبنای رُند کردن» picker beside summary; label `کسر بابت رُند (مبنای …)`; save/reopen snapshot; PDF label aligned.
- Tests: vitest money/draft **55 PASS**; jest draft-totals + UI controller **16 PASS**.

## Safety

- No `:6080` / main worker restart / outbound / historical rewrite / force-push.
- Legacy drafts without snapshot keep step `1` until operator picks a rule.
- Sealed revisions keep stored payable; catalog edits do not reprice them.
