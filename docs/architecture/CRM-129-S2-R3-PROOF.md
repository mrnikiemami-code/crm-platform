# CRM-129-S2-R3 PROOF — permissioned immutability + Dev live checks

## Coverage gaps closed

- Privileged transitions require role capabilities (`approve` / `send` / `cancel` / `recordCustomerDecision` / …), not only legal edges
- Object-only editors: `quotation.edit` + `quotation.submitForApproval` only
- Line `quotationId` reassignment forbidden
- Optimistic `version` lock + bump on updateOne
- Batch delete/destroy/restore paths refused
- GraphQL auto-injected `updatedBy` / `createdBy` ignored as system stamps so lifecycle transitions are not false-frozen

## Dev load (isolation before restart)

| Target | Network | Host port | DB |
| --- | --- | --- | --- |
| Dev `twenty-server-1` | `twenty_default` | `3002` | `default` |
| Intranet `crm-intranet-server` | `crm-intranet-net` | `192.168.4.85:6080` | `crm_intranet` (untouched) |

Only `twenty-server-1` restarted after `docker cp` of quotation util. Intranet containers remained Up (server Up 2 days, RestartCount=0).

## Live GraphQL (Dev `:3002`)

Script: `packages/twenty-apps/internal/quotation/scripts/dev-exercise-s2-r3.cjs`

```
PASS create-draft
PASS create-line-on-draft
PASS transition-pending
PASS transition-ready
PASS transition-sent
PASS sent-content-blocked
PASS sent-content-blocked-without-version
PASS line-reassign-blocked
PASS line-create-on-sent-blocked
PASS legal-accept-allowed
S2_R3_LIVE_PASS
```

## Unit tests

- `packages/twenty-server/src/modules/quotation` — jest pass (incl. `updatedBy` stamp regression)
- quotation app suite — pass (prior + this round)

## Residual / known

- Object-only editor permission denial is unit-covered; live API-key actor holds full admin capabilities (expected for Dev key).
- Intranet `:6080` and Asan live were not touched.
