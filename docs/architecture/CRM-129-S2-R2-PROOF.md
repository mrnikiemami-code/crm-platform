# CRM-129-S2-R2 PROOF — GitHub backup + GraphQL immutability

## GitHub

- Branch: `feat/crm-129-quotation`
- URL: https://github.com/mrnikiemami-code/crm-platform/tree/feat/crm-129-quotation
- Base push tip (backup): `6d90516195` (S2-R1)
- No force-push; `main` / `release/record-access-115` untouched

Verified on remote: S1–S2-R1 docs and quotation source including `CRM-129-S2-R1-PROOF.md`.

## Why SENT was editable

Raw `updateQuotation` / line mutations go through the workspace GraphQL runner. App HTTP routes gated immutability, but GraphQL did not.

## Fix

Server workspace query hooks under `packages/twenty-server/src/modules/quotation/`:

- `quotation.updateOne` — content freeze + legal status transitions
- `quotation.updateMany` — refused
- `quotation.deleteOne` / `destroyOne` — freeze-aware
- `quotationLine.create|update|delete|destroy` — parent status freeze
- Decision util unit-tested; hooks registered in `WorkspaceQueryHookModule`

## Note

Hooks load with the server process. This slice does not restart main services; deploy/reload is required for live Dev GraphQL to enforce the new gate.
