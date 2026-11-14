# CRM Record Access — Architect Recovery / Handoff

**Updated:** 2026-11-14
**Scope:** CRM-RECORD-ACCESS-098 through 102; branch `crm-platform`.
**Status:** SECURITY HOLD — no real-user rollout or deployment approved.
**Important:** 101 is reported as local/unpushed work by Cursor. This file is a decision/history record, NOT proof that those changes are present in the remote repository. Do not assume 102 has been implemented.

## Read this first after chat/context loss

1. This is the Twenty CRM fork `mrnikiemami-code/crm-platform`, not the Tooba project.
2. Dev frontend `:3001`, backend `:3002`; intranet `:6080` must not be touched or restarted without explicit approval.
3. Goal: manager assigns 50 Person records to member A; A sees exactly those 50 and no other customers through lists, direct IDs, relations, GraphQL, search, exports, apps or logic functions.
4. Avoid Enterprise license dependency, a second authorization engine, and invasive shared ORM changes. Preserve existing Twenty architecture and user workflows.
5. Do not treat Cursor's PASS as independent verification. Distinguish code inspection, isolated runtime proof, remote commits, and deployment acceptance.

## Timeline / evidence

### 098 — initial implementation, Dev-only

Remote commits:
- `c7d84705765ef1842b005f85d190399a18e892ed` — initial Record Access app, role and four RLS predicates.
- `b0f932e474049ea422b46df6e246fe74d13b7246` — metadata field provisioning fixes and Dev identifiers.

Paths:
- `packages/twenty-apps/internal/record-access/src/roles/assigned-records.role.ts`
- `packages/twenty-apps/internal/record-access/src/constants/universal-identifiers.ts`
- `packages/twenty-apps/internal/record-access/scripts/create-assignee-fields.ts`

Initial design: one restricted member role; predicates on `person.assignee`, `eventLead.assignedTo`, `eventRegistration.assignee`, `registrationPayment.assignee`. No production user assignments. Isolated reported proof: admin ~194/195 people, A 50, B 5, direct unauthorized reads/writes blocked. These tests did NOT establish complete relational security.

Incident: `crm-task-reports.canvas.tsx` was accidentally truncated by a PowerShell operation; reports 088–098 were reconstructed from chat, earlier reports were not proven recovered. Avoid destructive rewrite.

### 099 — security audit, STOP_FOR_ARCHITECT

Cursor reported tracing RLS through:
- `engine/twenty-orm/workspace-orm.manager.ts`
- `twenty-orm/utils/build-row-level-permission-record-filter.util.ts`
- `twenty-orm/utils/build-row-access-policy.util.ts`
- `twenty-orm/repository/workspace-repository.ts`

Reported isolated proof: predicates enforced in tested paths without Enterprise entitlement. This is version-specific and not guaranteed by vendor; test on upgrades.

Confirmed design problems:
- **C1** transfer Person A→B did not revoke A's access to registration/payment: each child had independent assignee.
- **C2** a lead assigned to A could refer to B's Person and leak denormalized name despite relation being null.
- **H1** role `canReadAllObjectRecords: true`, `canUpdateAllObjectRecords: true` exposed unprotected objects, e.g. admin note.
- **H2** additional surfaces: salesInteraction, note, task, attachment, timelineActivity, etc.
- **H3** `{ lite: true }` ORM context lacks RLS maps; must remain inaccessible to user-originated reads.
- **H4** reliance on undocumented vendor behavior; regression gates required.
- Existing provisioning script checked field name but not full relation type/target; UIDs environment-specific.

### 100 — ADR (provided by user, 2026-11-13)

Three alternatives:
- A1 native inherited readability exists in `record-share` but is entitlement-gated; do NOT bypass commercial gate.
- A2 extend relation predicates in shared ORM: rejected due shared impact and metadata UI incompatibility.
- **B chosen conditionally:** Person is access authority; child assignee fields are security projections, maintained synchronously/atomically in workspace DB. Keep historical `soldByRaw` / `performedBy` unchanged.

Source ADR file was shared in conversation as `ADR-100 — معماری مالکیت امن`. It proposed versioned workspace command, SQL triggers, dry-run/reconcile, explicit object permission allowlist, and extra `salesInteraction.assignee`. **Architect required that unauthorized child creation be rejected, not merely made invisible; and that CRM workflows survive.**

### 101 — Cursor implementation report, isolated tests only

**Reported changes are local and NOT pushed**, so independently re-read local diff before approving any merge or rollout.

Reported files:
- `packages/twenty-server/src/database/commands/upgrade-version-command/2-42/2-42-workspace-command-1794600000000-install-record-access-sync.command.ts` (idempotent triggers, drift, revert)
- `packages/twenty-apps/internal/record-access/src/roles/assigned-records.role.ts` (deny-by-default, explicit allowlist, fifth predicate for salesInteraction)
- `packages/twenty-apps/internal/record-access/src/constants/universal-identifiers.ts`
- `packages/twenty-apps/internal/record-access/scripts/create-assignee-fields.ts` (pagination, field type checks, salesInteraction)
- `packages/twenty-apps/internal/record-access/src/__tests__/assigned-records.role.test.ts`
- `packages/twenty-apps/internal/record-access/package.json` (0.2.0)

Reported isolated results: A 50 of admin 195 people; unauthorized lead/registration INSERT rejected with zero residual rows; unauthorized owner/relation change blocked; A→B revokes Person/Lead/Registration/Payment/Interaction immediately; interaction count A 1 vs previously 175; quick registration prepare and owner attribution pass; admin counts unchanged; drift reconciliation to zero; no changes to shared ORM/Billing/entitlement; intranet untouched.

**Remaining blockers (101 STOP_FOR_ARCHITECT):**
1. Unauthorized INSERT trigger raises HTTP/GraphQL **500 `Data validation error.`**, not a controlled authorization/validation error. Correct error mapping without masking genuine DB faults.
2. `timelineActivity` count still returns **774** for restricted A despite object read deny, even if content is empty. Metadata existence leakage remains; must fix at server permission boundary, not UI.
3. Verify rollback covers app role/metadata/data as well as trigger removal. `--revert` alone removes functions/triggers, not prior data transformations. Backups and restore plan required.
4. Confirm all user-accessible paths cannot reach lite context. Re-test regression on upgrades.

`salesInteraction.assignee` was created only in isolated copy, NOT main Dev, per report.

### 102 — issued task, not reported complete

Bounded security closure:
- Trace trigger exception to GraphQL and fix 500 classification narrowly; if shared exception architecture change required, STOP.
- Trace timelineActivity resolver/service/cache/query; enforce read permission for count and contents at server boundary; shared-layer changes require architect approval.
- Recheck atomicity, rollback, metadata, role, app workflows and deployment readiness.
- Isolated tests only; no push, migration, deploy, real-user role change or :6080 touch without approval.

## Architectural invariants

- **Access owner:** Person's current assigned workspace member.
- **Child access projections:** Lead, registration, payment, sales interaction must agree with Person for security; changes atomic, not asynchronous.
- **Business history:** `soldByRaw` and `performedBy` are historical attribution, not access ownership; never rewrite them on reassignment.
- **No privilege escalation:** restricted user cannot claim someone else's Person, change protected links, or create a child of unauthorized Person.
- **Default deny:** only necessary object rights explicitly allowed; special `isSystem` objects may default to true without explicit false override. Review new objects.
- **Authorization on server:** not merely hidden UI, not a second permission engine.
- **Safety:** preserve :6080, real users/data and worker. Isolated copy before rollout; backup, dry-run, drift report, reversible rollout.

## Next architect action

1. Request Cursor's complete **local unpushed 101 diff** and 102 report, with exact source lines and targeted test evidence.
2. Verify the 500 and timeline count root causes; reject UI-only suppression and broad exception catching.
3. Confirm trigger race/locking and row consistency, denied INSERT rollback, role/object rights, newly created records, relation updates, and app/Logic Function execution.
4. Verify field UIDs and migration idempotence on destination, backup and full rollback including role/metadata; no automatic deployment.
5. Issue explicit approval only after both security blockers are closed and tested. Otherwise STOP_FOR_ARCHITECT.

## Recovery keywords

`CRM-RECORD-ACCESS-098` `099` `ADR-100` `101` `102` `Record Access` `Person assignee` `salesInteraction` `timelineActivity 774` `Data validation error 500` `lite context` `2-42-workspace-command-1794600000000`.
