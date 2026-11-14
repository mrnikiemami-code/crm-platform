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

## 2026-11-14 update — 103 pushed, 104 local report; current handoff

### Verified remote commits (103)

Cursor reported and subsequently pushed to `origin/crm-platform`:
- `bee5d81a32` — customer/Person as ownership authority, synchronous projection onto children.
- `246d9d0d69` — salesInteraction assignee UID pinned to an isolated test workspace, app 0.2.1.
- `8a8ce1ae67` — dedicated `PGRAC` SQLSTATE mapping to existing `RLS_VALIDATION_FAILED`, and explicit system-object denies respected.

Architect independently fetched the actual remote commit `8a8ce1ae67262593ff6efccb4fc4f9b24201041e` and role/identifier/scripts. Findings:
- Both call sites of `isExemptFromObjectPermissions` were updated: `isObjectOperationPermitted` and `validateOperationIsPermittedOrThrow`. Previous concern about missed call site resolved for these paths.
- Exception mapping is based on SQLSTATE, not message text; generic 23514 retains its behavior. No independent runtime test performed by architect; Cursor reports isolated tests.
- **Workflow bypass is real**: `isExemptFromObjectPermissions` returns true for `isWorkflowRelatedObject` regardless of computed false. The `WORKFLOWS` settings permission in cache is NOT itself an ORM guard. Resolver-level guards are not proof for Logic Functions/app tokens/direct repository calls.
- System objects without permission-map entries retain historical bypass. A computed explicit false is enforced for non-workflow system objects.
- `create-assignee-fields.ts` as of 103 checked existing RELATION type but not relation target/direction; fixed in 104 per Cursor report, pending independent review.

### 104 — Workspace Portability & Permission Verification (user-provided Cursor report)

**Commit `e3598c00d1` reported LOCAL ONLY, NOT PUSHED; working tree clean on Cursor machine.** Never assume it is available on `origin/crm-platform` until confirmed. Dev :3001/:3002 and intranet :6080 not changed by 104; no real roles or triggers installed.

Reported findings:
- Custom object UIDs (`eventLead`, `eventRegistration`, `registrationPayment`, `salesInteraction`, `academyEvent`) and custom field UIDs (`person.assignee`, registration/payment/interaction assignee, `eventLead.assignedTo`) are workspace-specific. Standard object/field identifiers from `STANDARD_OBJECTS` are portable.
- Identical custom object UIDs between Dev and intranet do NOT establish portability: intranet is a Dev clone. Three copies generated distinct UIDs for the same assignee field.
- Native role manifest requires literal `fieldUniversalIdentifier`; it does not resolve names at install.
- New `scripts/generate-workspace-identifiers.ts` reportedly reads and validates 4 custom objects + 4 assignee fields + `eventLead.assignedTo`, rewrites only a marked block in `universal-identifiers.ts` with temporary-file + rename; `--check` exits 2 on mismatch, no mutation.
- New `src/domain/assignee-field.ts` reportedly checks RELATION, target workspaceMember, MANY_TO_ONE, joinColumnName `assigneeId`, nullable; `create-assignee-fields.ts` reportedly now traverses all pages and supports `--check`.
- Reported tests: app 18/18, server exemption 6/6, typecheck/lint/manifest build pass. These are Cursor claims, not independently reproduced by architect.
- Dev check: person, eventRegistration, registrationPayment assignee fields exist; **salesInteraction.assignee MISSING**. Generator intentionally failed without writing. Therefore **DO NOT install app on Dev** yet.
- Committed identifier block in local 104 still points to `salesInteraction.assignee` from a dead test database (`503a0aaa...`), NOT Dev. Prior 103 remote had `48ce5077-...` from another test workspace. Neither is safe to install on Dev.
- 104 proves with a unit test that `workflow` with `canReadObjectRecords: false` still returns permitted at ORM level. Five workflow resolvers reportedly have SettingsPermissionGuard; direct ORM/Logic Function/app-token paths may not. **STOP_FOR_ARCHITECT** for workflow authorization change. Do not simply remove bypass without tracing all internal consumers.

### Mandatory next work / architect decision (105 proposed, not yet issued)

1. **Obtain/review actual 104 diff** (push to an isolated review branch only with explicit permission, or paste full diff). Check generator's object/field identity validation, relation metadata correctness, pagination, write atomicity, safe handling of failure and whether it inadvertently changes tracked shared source per workspace. Reproducibility of builds is a concern: generated workspace-specific source must not contaminate shared branch or another workspace's deployment.
2. **Workflow security audit FIRST, analysis-only**: enumerate ORM entry points and consumers of `workflow`, `workflowVersion`, `workflowRun` (including direct GraphQL, API tokens, Logic Functions, app runtime, background services and internal lite contexts). Determine which callers have independent authorization, which intentionally run as trusted system principals, and where to enforce permission without breaking internal execution. Provide proof with an actual restricted actor, not only helper unit tests. No blanket patch or deployment before architect review.
3. Review `PGRAC` and Trigger install idempotence, reconciliation/rollback; ensure no leaked data on transfer or unauthorized write.
4. Plan Dev rollout in safe order only after approval: backup; provision and verify fields (including salesInteraction); generate/check target workspace identifiers; build/install app; dry-run drift; install triggers/reconcile; re-test full role and system-object behavior. **Never activate restricted role between app install and trigger installation** unless safe transaction/maintenance gate is established.
5. Keep real Dev and intranet unchanged pending security gate. No :6080 restart, no live role changes, no destructive scripts, no screenshots or unbounded tests.
6. After 104 is independently reviewed and 105 decision made, update this document, then merge docs into `crm-platform` through a reviewed docs-only change. The current recovery document resides on `docs/record-access-architecture-recovery-098-102` and is NOT yet on the main branch.

### Quick restart prompt for a new architect/chat

> Open `docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md` on branch `docs/record-access-architecture-recovery-098-102` in `mrnikiemami-code/crm-platform`. Read the 098–104 history. The 103 commits `bee5d81a32`, `246d9d0d69`, `8a8ce1ae67` are pushed to `crm-platform`; 104 `e3598c00d1` is reported local/unpushed. Security hold: direct ORM Workflow bypass proven; Dev lacks salesInteraction.assignee; generated field UID is environment-specific. Next: independent review of 104 diff and bounded analysis of Workflow entry points, then architect approval before any Dev rollout. Preserve intranet :6080 and real data. Do not assume Cursor PASS is architect acceptance.
