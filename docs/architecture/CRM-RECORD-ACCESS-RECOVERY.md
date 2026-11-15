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

---

## CURRENT AUTHORITATIVE HANDOFF — 2026-11-14, tasks 105–111

**This section supersedes earlier historical next-step and restart instructions.** The earlier statement that 104 was unpushed and 105 not issued is obsolete.

### Completed work and actual Git state
- 105 audit: restricted users could list and count workflowVersions despite no WORKFLOWS permission; system-object ORM exemption swallowed explicit deny.
- 106 (7d9fa8e4b5): closed workflowVersion/workflowRun bypass. Real-row security checks passed; AI list_workflow_runs denial unit tested. Temporarily kept workflowAutomatedTrigger exception.
- 107: independently isolated activation/deactivation/manual-run creation passed, full worker queue/DB trigger end-to-end blocked. Discovered real workflowAutomatedTrigger leak on list/count/groupBy/singular. Internal service uses buildSystemAuthContext and explicit shouldBypassPermissionChecks. Workspace-specific manifest generation, upload and install passed on isolated copy; stale IDs fail closed.
- 108 (79b6a43c17): removed remaining blanket Workflow exemption. ORM 538 tests passed per Cursor. Internal trigger creation/deletion still worked, but four public GraphQL reads of workflowAutomatedTrigger STILL leaked because cache did not gate it and system-object default was true. Reported FAIL, not success.
- 109 (f9d8b91bbb): added workflowAutomatedTrigger to WORKFLOWS-gated object list in workspace-roles-permissions-cache.service.ts. Real rows: restricted app role and fresh no-flags role DENIED on list/count/groupBy/by-id and workflowVersion/workflowRun; authorized role/Admin allowed. Internal activation, manual-run creation, deactivation, trigger insert/delete passed. Queue-worker and DB-trigger end-to-end remain BLOCKED.
- 110: four commits pushed in order e3598c00d1 (104), 7d9fa8e4b5 (106), 79b6a43c17 (108), f9d8b91bbb (109). Fast-forward origin/crm-platform from 8a8ce1ae67 to full SHA f9d8b91bbbf2423f1dfb06152db1bd9570a422e8. No force, no deployment, no migration; ten files +1046/-122. GitHub commit 109 independently fetched. Do not rewrite history merely to remove Cursor co-author trailers.

### 111 — Dev READ-ONLY PREFLIGHT, STOP_FOR_ARCHITECT
This section summarizes the user-provided 111 report; its Dev facts have NOT been independently re-executed by the architect.

- Dev Record Access app 0.1.2 INSTALLED (old), Event Registration 0.1.11 INSTALLED. Running server image twenty-dev/o95:local does NOT contain pushed Workflow security patches. Thus Workflow leak remains on running Dev. Intranet :6080 untouched.
- Fields: person.assignee, eventLead.assignedTo, eventRegistration.assignee, registrationPayment.assignee exist. salesInteraction.assignee MISSING. Four predicates, no salesInteraction predicate, ZERO ownership sync triggers.
- Restricted role currently readAll=true and updateAll=true, zero override flags, and ZERO members; no real user is restricted.
- Records: person 194 total / 194 unassigned; eventLead 160/160 unassigned; eventRegistration 8/8 unassigned; registrationPayment 7/7 unassigned; salesInteraction 175/175 without assignee field. Dependent ownership drift reported zero for existing columns.
- Committed salesInteraction assignee UID 503a0aaa... is from a test workspace, not Dev. Must create field on Dev, generate Dev-specific identifiers, build, upload correct tarball; app install uses latest uploaded tarball rather than local build.
- Unsafe gap exists after app install and before owner-sync trigger installation. Do not grant restricted role to anyone during gap. Dry-run and install should be contiguous after reviewed checks.
- Reconcile derives dependent owner from person.assigneeId. All 194 persons currently NULL. Thus restricted users would see ZERO records without a deliberate initial assignment plan; reconcile writes data. Do NOT infer ownership from soldByRaw, performedBy, or historic actor names.
- Reported safe proposed sequence, NOT AUTHORIZED: verified backup; approved Person assignment plan or defer real role activation; create-assignee-fields; generate-workspace-identifiers; build and upload tarball; app install; install-record-access-sync --dry-run and review; trigger install/reconcile; synthetic A/B/admin permission and Quick Registration prepare+save checks; only then assign restricted role to real users.
- Trigger --revert removes triggers/functions but does NOT undo data changes from reconciliation. DB restore is a separate operation; verify backup AND restore viability. New server image, cache invalidation/restart and rollback need separate approval.
- Legacy custom app Logic Function source directory is empty despite tarball present, causing old workflow activation failure "Source file not found"; unrelated to Record Access.
- 111 performed NO writes, installs, pushes, restarts or changes to Dev/intranet.

### Next action: architect decisions required (112 not issued)
1. Decide initial ownership for 194 Persons (reviewable mapping or defer assigning restricted role). Never invent owner from sales history.
2. Decide whether to authorize a small, separately gated Dev change for backup verification, missing salesInteraction field creation and workspace-ID generation, stopping BEFORE app installation.
3. Decide separately on updated server image rollout of 106/108/109 and role-permission cache refresh; Git Push does not update running Dev containers.
4. Only after explicit approval: app install and owner-sync trigger/reconcile with counts, rollback, synthetic security checks, Quick Registration save, ownership transfer, cross-owner write denial; real role assignment last.
5. Queue-worker and DB-trigger end-to-end remain unverified; use isolated queue/worker or a separately approved maintenance gate.
6. Keep STOP_FOR_ARCHITECT, no screenshots, no loops, no main worker restart, no changes to intranet :6080.

### NEW CHAT RESTART PROMPT (LATEST)
> Open mrnikiemami-code/crm-platform, file docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md on branch docs/record-access-architecture-recovery-098-102. Read the LAST section first. Four commits 104/106/108/109 were pushed at f9d8b91bbb; 110 PASS. 111 preflight only: Dev still old app 0.1.2 and server image, salesInteraction.assignee missing, 0 triggers, 4 predicates, all 194 Persons unassigned, no members on restricted role. NO Dev rollout authorized. Architect must decide owner assignment, separate Dev field/generator gate, separate server image gate. Do not install app/triggers or assign real roles yet. Worker queue end-to-end remains BLOCKED. Intranet :6080 untouched.

---

## LATEST HANDOFF — 2026-11-14 — Task 113 Pilot Readiness (supersedes previous NEXT ACTION)

**Source:** user-provided CRM-RECORD-ACCESS-113 report. Report is analysis-only; findings are Cursor-reported and not independently re-executed. 113 did NOT deploy or change users/data.

### Current Dev state after 112 and 113
- Repo code pushed at f9d8b91bbb. Recovery document on separate docs branch.
- Dev workspace glorious-aqua-whale (:3002): 194 Persons (all without owner), 160 eventLeads, 8 eventRegistrations, 7 registrationPayments, 175 salesInteractions.
- Only one existing real workspace member, Admin. No A/B test users created.
- Task 112: verified DB backup and independent restore; added missing salesInteraction.assignee metadata (Dev UID 995296b6-48f4-44d4-9b44-7273f96dda97), generated target-specific identifiers, then reverted tracked source to clean state. Generated Dev identifier file saved outside repo at D:\CrmDeployment\migration\dev-identifiers-112.ts. Backup saved at D:\CrmDeployment\migration\pre112-20261114-184729.dump. The backup was made BEFORE field creation; later restore needs to account for that. No app install or triggers.
- Dev still has old Record Access app 0.1.2, four of five predicates, no owner-sync triggers, and restricted role with canReadAllObjectRecords=true, canUpdateAllObjectRecords=true, zero objectPermission rows and zero members. The intended 0.2.1 app has five predicates and reduced permissions; current pilot would be invalid.
- Running Dev server image twenty-dev/o95:local does not contain pushed workflow permission fixes 106/108/109. Git push is NOT deployment.

### Task 113: Pilot test design
- Five proposed Person IDs, with expected owned record totals after assigning to A: 5 Persons, 5 eventLeads, 5 eventRegistrations, 4 registrationPayments, 3 salesInteractions.
  1. ce737a8a-dbb4-4edf-be39-4d4de250f7aa (1 lead, 1 registration, 1 payment, 1 interaction)
  2. c8ba568a-06be-4339-b789-da9f6cc05d7f (1/1/1/1)
  3. 1b73cd60-67f8-4610-b2af-75b39d725c80 (1/1/1/0)
  4. 986e2464-a974-4339-b7ca-7b042be05a48 (1/1/1/0; includes financial correction from 097)
  5. 3edc3089-58b7-4c28-a275-6b62f992b5bd (1/1/0/1).
- Invite-based creation of A/B is proposed through normal app flow, NOT direct DB inserts. On current Dev, EMAIL_DRIVER absent means LOGGER fallback (no SMTP) per 113; verify before use. Do NOT record invitation tokens, passwords, or auth URLs in repository/docs.
- Person.assignee already UI-editable and visible in list, record details and creation form; field label is «مسئول».
- Trigger design: Person.assigneeId is sole ownership authority; AFTER UPDATE propagates to four child types; BEFORE INSERT/UPDATE child triggers enforce owner match with PGRAC -> BAD_USER_INPUT. Not yet installed.
- Security test plan: A sees only 5/5/5/4/3; B cannot read/link/create against A's customers; Admin sees all; transfer one Person A->B atomically propagates and revokes A; verify direct URL/search and Quick Registration. Cleanup must be separately approved, preserve data.
- UI risks: restricted A might be able to reassign Person.assignee to B and immediately lose access; opened record may remain displayed until refresh. Requires product decision on permission to reassign owner.
- Quick Registration risk: event-registration save-registration does not populate Person.assigneeId for a new customer. A newly created Person by restricted actor would have NULL owner and disappear from that actor's view. Decision required: assign creator as owner securely on server, or explicitly prohibit new Person creation by restricted role during pilot. Never trust client-supplied owner blindly.
- Important 113 reported B1/B2/B3: old role is broadly permissive (readAll/updateAll=true, no object permissions), salesInteraction predicate missing, app 0.1.2 rather than 0.2.1. **Pilot cannot begin** until app install/security gates are resolved.

### CRITICAL NEW DEPLOYMENT HAZARD from 113
- The proposed new Twenty server image deployment uses a compose entrypoint that reportedly runs cache:flush -> upgrade -> cache:flush automatically.
- **Upgrade command 1794600000000-install-record-access-sync may install ownership triggers/reconcile DURING SERVER BOOT**, BEFORE separately planned field creation, app installation, owner assignment or dry-run. Therefore the previously proposed independent "deploy server image first, install triggers later" sequencing is UNSAFE unless the actual entrypoint, upgrade command preconditions and side effects are verified and controlled. Do NOT deploy the image by ordinary compose up without a verified way to suppress/stage the upgrade, or a reviewed atomic deployment plan. The command may fail if expected fields are absent or reconcile data prematurely.
- 113 also mentions intranet :6080 existing image crm-intranet/twenty:145b030 and source f9d8b91bbb being 22 commits ahead. **Intranet deployment is NOT authorized and is OUT OF SCOPE**. Do not infer Dev image and intranet image share identical deployment paths.
- Rollback cannot be called "safe" just because trigger down removes functions: reconciliation writes remain; app version and cache changes persist unless separately restored. Verify actual backup/restore and precise target environment.

### STOP_FOR_ARCHITECT decisions still open (NOT approved)
1. Whether and when to install Record Access 0.2.1 on Dev and execute trigger command; do NOT run automatically as part of image startup.
2. Policy for creating a new Person from restricted Quick Registration: server-side owner=authenticated actor (with role/permission checks), or out of pilot scope and explicitly denied. Do not silently leave a new record orphaned.
3. Whether restricted employees may edit Person.assignee and transfer ownership themselves, or only manager/Admin may reassign.
4. A/B test account creation and five-Person pilot assignment only after controlled installation, backup and verification.
5. Separate, controlled new server-image deployment, including explicit upgrade-command/entrypoint behavior and rollback. No restart of main worker, no intranet changes without separate authorization.

### NEXT TASK RECOMMENDATION — 114, ANALYSIS ONLY
Audit actual entrypoint, automatic upgrade command and install-record-access-sync guard/dry-run/reconcile behavior to produce a safe deployment sequence for Dev. Also trace server-side owner assignment in Quick Registration and precise authorization of Person.assignee edits. STOP_FOR_ARCHITECT before any installation, restart, trigger, role/user/Person mutation. No screenshot, loop, heavy test or push.

### NEW ARCHITECT CHAT RESTART PROMPT (LATEST)
> Read docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md on docs/record-access-architecture-recovery-098-102, starting from the LAST section LATEST HANDOFF Task 113. The 104/106/108/109 fixes are pushed at f9d8b91bbb but not deployed to Dev. Task 112 backed up/restored and added Dev salesInteraction.assignee, generated Dev-only IDs outside repo. Task 113 was analysis-only and chose five candidate Persons. Dev still runs old app 0.1.2, 4 predicates, 0 owner triggers, broad restricted role, no A/B users, all 194 Persons unassigned, old server image. CRITICAL: ordinary server boot may auto-run upgrade and install triggers/reconcile; DO NOT deploy new image before auditing this. Quick Registration can create an ownerless Person, and restricted users may reassign Person.assignee: both require policy decisions. No Dev installation or intranet :6080 deployment authorized. Next: analysis-only Task 114 to verify upgrade ordering and authorization. STOP_FOR_ARCHITECT.


---

## 2026-11-15 — ADR-116: Dynamic CRM multi-collaborator access (architectural decision; NOT implemented)

**Decision status:** Architecture direction ACCEPTED for planning, technical design/proof PENDING. This is NOT an implementation approval or a production security claim.

### Task 115 — user-provided Cursor report (not independently executed)
- Cursor reports DEV_FUNCTIONAL_ACCEPTANCE PASS and Quick Registration create/save PASS. 194 Persons, 160 eventLeads, 8 registrations, 7 payments, 175 interactions; payment total 19,750,000 unchanged. 5 Persons assigned to pilot A, 189 unassigned, ownership drift zero.
- Dev Record Access app 0.2.4, image twenty-dev/o115:person-confine, 5 RLS predicates, 5 triggers, 7 functions, 13 object permissions, only 1 field permission on Person.assignee. Dependent ownership columns no longer field-write-denied because ORM insert permission intersection rejected legitimate writes; SQL triggers enforce ownership integrity.
- Local crm-platform branch contains nine UNPUSHED commits from 2c181acc6d through 96f39f9c36, including a Dev-only identifier. Separate LOCAL UNPUSHED release/record-access-115 branch has portable single commit d5cd91f1ea, 11 files, +919/-2; generated workspace UID block omitted. **This remote GitHub document update does NOT push those local branches or make their code available remotely.**
- Dev app 0.2.4 was installed with a Dev-only engine compatibility adjustment (>=2.41.0); shared app manifest requires >=2.42.0. Real deployment must complete 2.42 upgrade first; do not silently relax engine requirement. Intranet :6080 untouched.
- 115 Quick Registration save reportedly created a new registration and payment under restricted A with correct owner, then removed test data. All such results are Cursor-reported, not independently verified in this GitHub session.

### Business requirement
A Person/customer can have ONE accountable primary owner and MULTIPLE collaborating employees. Collaborators may see the Person and selected related records, log follow-ups, and be assigned individual activities. Activity actor/history is distinct from owner and access grant.

### Domain model
- Keep Person.assignee (workspaceMember MANY_TO_ONE) as single authoritative primary owner. Keep existing child ownership projections and database triggers. Do NOT turn Person.assignee into an array, duplicate Persons, or rewrite historical performedBy/soldByRaw.
- Define custom dynamic workspace object personCollaborator (or personAccessGrant) through Twenty metadata / app manifest, NOT a hardcoded business entity in shared server ORM. Minimum relations: person (MANY_TO_ONE), workspaceMember (MANY_TO_ONE); accessLevel (read/followUp/edit, exact permissions subject to policy review), grantedBy, createdAt, revokedAt; workspaceId isolation. Prevent duplicate active grants for same Person/member; handle revocation and owner transfer explicitly.
- Separately model per-activity assignee (task/interaction responsibility), never confuse it with primary owner or the authorization grant.
- Scope V1 to Person and the four existing child types; design an extensible policy interface for other dynamic objects later, but do NOT introduce a generic unrestricted cross-object sharing system in V1.

### Actual repository inspection, 2026-11-15 (remote crm-platform at f9d8b91bbb)
1. packages/twenty-apps/internal/record-access/src/roles/assigned-records.role.ts defines one restricted role with five workspace-member-bound row predicates, one per customer object, and explicit object allow/deny list. Each predicate matches the acting workspace member, not a collaborator set.
2. packages/twenty-server/src/engine/twenty-orm/utils/build-row-level-permission-record-filter.util.ts compiles each role's predicates independently and ANDs role filters. Thus adding a second role does NOT automatically give a collaborator OR access.
3. packages/twenty-server/src/engine/twenty-orm/utils/build-row-access-policy.util.ts combines role predicate with record-share gate using SQL AND; object-level deny is checked first. The record-share path is separate and may be entitlement-gated: DO NOT bypass license or assume it can be reused.
4. packages/twenty-server/src/engine/twenty-orm/utils/compute-permission-intersection.util.ts intersects permissions and constrained fields across roles; 115 reportedly exposed an insert issue related to this. New grants must be tested against multi-role intersections and pre-insert validation.
5. packages/twenty-server/src/engine/metadata-modules/field-metadata and /flat-object-metadata exist; Twenty custom.workspace-entity.ts and metadata-driven ORM exist. Custom dynamic object provisioning is structurally plausible, but the precise supported SDK/manifest relation definitions, metadata migrations, and lifecycle have NOT yet been inspected/validated.
6. build-row-level-permission-record-filter.util.ts includes an Enterprise license header. Licensing/entitlement implications of extending that specific path must be checked before choosing the implementation point. Do not assume a license bypass is acceptable.

### Proposed authorization semantics (DESIGN, not code)
CanReadPerson(actor, person) = AuthorizedAdminOrManager(actor) OR person.assigneeId == actor.workspaceMemberId OR ActiveScopedGrant(actor, person, READ).
CanWritePerson(actor, person, field) = authorized owner/admin/manager OR active scoped grant with explicit permission for that field; primary owner changes only via authorized admin/manager policy.
CanReadChild(actor, child) must derive from its related Person's effective permission (not merely child's projected owner), with correct relation chain and no cross-person links.
Creation/update of a child must reject unauthorized parent links, including nested create, bulk, API, GraphQL, app-token and Logic Function paths. SQL triggers continue enforcing child.owner == Person.owner as an integrity projection; collaborator authorization is independent and must not mutate child.owner to the collaborator.
Revocation and reassignment must affect read/write access immediately, including direct ID, list/count, search, relation traversal, export, app/Logic Function and caches; no stale grants or count leaks.
Principle of least privilege: finance visibility separate from follow-up visibility; default deny, field/object policy and workspace isolation. Auth principal is server-derived, not user-supplied.

### Critical technical design risk / choices to resolve before coding
- Existing 5 role predicates implement owner-only AND conditions; a collaborator cannot see the record until a server-enforced OR-within-person-access policy is integrated. Do NOT add a collaborator role alone or OR roles globally.
- Two candidate designs to investigate:
  A. narrowly scoped native row policy extension using correlated EXISTS for active personCollaborator grants, preserving role/object denies and existing record-share entitlement; must support list/count/write and child relations.
  B. a proven, supported existing Twenty record-sharing mechanism if entitlement permits. Never bypass enterprise license checks.
- A custom SQL condition must be parameterized, workspace scoped, cache-safe and compatible with ORM query builders, filter/count, field permissions and transaction behavior. Validate performance indexes on (personId, workspaceMemberId, revokedAt) and child relation keys. Prefer a single security policy enforcement point rather than scattered resolver filters.
- Separate authorization for granting/revoking access: only admin/authorized manager, never grant escalation via client-supplied workspaceMemberId; log audit changes. Collaborators cannot change Person.assignee.
- Clarify whether collaborators can see registrations/payments and which operations they may perform; default read/follow-up only and finance denied until explicit policy.
- No automatic full rights for a team. No duplicated owner projections. No app-only or UI-only security.

### Delivery plan / gates
Phase 0: Preserve 115 release readiness. Review local portable release d5cd91f1ea and engine >=2.42 requirement, push only with explicit approval; never include Dev UID. Do not deploy intranet.
Phase 1: Source-anchored bounded architecture spike: inspect SDK custom object+relation manifest/provisioning, RLS SQL rendering and query paths, native record-share entitlement, object/field permissions and cache; compare A/B; write an ADR and targeted test matrix, STOP_FOR_ARCHITECT. This is a security design gate, not a repetitive exploratory loop.
Phase 2: Implement dynamic personCollaborator metadata and controlled grant management (including audit and UI) in isolated Dev with real workspace-specific identifiers; no new permanent shared hardcoded customer table.
Phase 3: Integrate server-enforced collaborator OR access into the narrow row-security path for Person and four children; keep role AND semantics for independent restrictions, owner triggers, and field denies. Targeted negative tests for data exfiltration and writes.
Phase 4: A/B/C pilot: A owner, B collaborator, C unassigned; test permissions, financial segregation, create/link, revocation, transfer, search/count, direct URL, Quick Registration and workflow. Backup/rollback, no intranet or real-user rollout until explicit approval.
Phase 5: Release review, portable commits, deployment separately approved.

### Current handoff / next action
- 115 is Cursor-reported Dev PASS, portable release branch local/unpushed. Do not claim remote release exists.
- Multi-collaborator design is recorded here, NOT implemented.
- Next recommended task is ONE bounded source inspection + ADR to decide the secure Twenty integration seam and supported dynamic entity provisioning, then a single gated implementation plan. User prefers speed, no screenshots, no loops, no unnecessary tasks.
- STOP_FOR_ARCHITECT. Do not modify Dev or intranet as part of this documentation update.


---

## AUTHORITATIVE CURRENT HANDOFF — 2026-11-15 — CRM 115–120 (supersedes historical deployment holds)

**Evidence status:** This update records user-supplied Cursor execution reports for 115–120. Production/Dev runtime and local-only commits have NOT been independently re-executed or fetched in this GitHub documentation update. The historical sections above describe older states; use THIS section for current planning. This docs branch is separate from release and main.

### Where things are now

- **Dev:** localhost:3002 reportedly running `twenty-dev/o117:69b776f62f`, source `69b776f62f8f6fa98fd9c2e361a4f90c1bd3df12`, including Record Access 115, default Persian/RTL, fixed relative Persian dates and five pre-existing RTL typing errors. User explicitly accepted visual results of 117-R1.
- **Intranet production:** :6080 reportedly deployed task 118, image `crm-intranet/twenty:c4d3efd8`, release SHA `c4d3efd8ddc4578977fe4e27f4c6e695b4ba8b40`, Twenty 2.42 upgrade, Record Access 0.2.4. `index.html` starts with `lang="fa-IR" dir="rtl"`; runtime i18n switches for explicitly selected English. Rehearsal on restored production copy before deployment, tested backup restore. Health 200. Worker restarted as part of compose deployment for version parity; no claim of zero downtime (~90s reported).
- **Production data baseline (118–120 reports):** Person 215, eventLead 183, eventRegistration 6, registrationPayment 6, salesInteraction 191; 6 payments totaling 24,330,000 (currency not asserted here). Zero assigned Persons in production. Do not infer owner assignment from sales attribution. Ownership triggers 5, predicates 5; ownership drift 0 reported. Restricted role exists but has no assigned production member. User's only real account is Admin according to report.
- **Production app state after 119:** Event Registration **0.1.12** installed with two pinned one-record command-menu entries (eventLead and salesInteraction), form and prepare/save logic functions. Communication **0.1.72**, Record Access **0.2.4**. `LOGIC_FUNCTION_TYPE=LOCAL` and `LOGIC_FUNCTION_API_URL` configured for server/worker. Prepare and form opening tested on production; **production save deliberately not executed** to avoid creating real financial records. Isolated-copy save, duplicate rejection and authorization tests PASS per Cursor. Do not claim production end-to-end save acceptance.
- **SDK Windows manifest path repair:** normalized package-relative paths for logic functions, front components and assets; 119-R1 reported 134 manifest tests and portability proof. Commit `575c47a848` **pushed** to `origin/release/record-access-115`; remote branch reportedly at that SHA. This is not the same as production deployment.
- **Task 120 changes:** local-only commit `6011fe727989e3d99c9c1098b4a2d1660a5b339f`, **NOT pushed and NOT deployed**. Event Registration proposed **0.1.13** and Communication **0.1.73** were installed/tested ONLY on isolated restored production copy. Production remains 0.1.12 / 0.1.72. Working tree clean per Cursor.
- **Main branch:** `origin/crm-platform` was previously reported at `f9d8b91bbb`; release branch is separate. Never equate documentation update, release push, or local commit with running production.

### 117 / 118 — localization and deployment detail

- Initial anonymous welcome had en/browser fallback, new user/member locale fell back to en, dateLocaleState was not initialized on login after anonymous latch. These were corrected; Persian relative dates now render e.g. «۲۱ روز پیش», «۳ روز دیگر». Existing explicit English selections retained. Broken missing logo asset uses letter avatar fallback, without changing file DB/storage.
- Five TypeScript errors in `mirrorResponsiveLayoutsForRtl.ts` traced to using `Layout[]` instead of `Layout | undefined` for readonly layout type; reported 1519 page-layout tests passed, front/server/shared typechecks clean.
- 118 release was made portable: no Dev-specific UID committed; each workspace must provision assignee fields, generate workspace identifiers, build/install app. Required Twenty >=2.42; never relax gate to 2.41. Production rehearsal and backup reported successful. Production rollback requires coordinated image and DB restoration, not only trigger revert.
- 118 corrected locale HTML shell and invalid localStorage locale handling. No data count or payment total drift reported.

### 119 / 119-R1 — Event Registration and LOCAL execution

- Root cause of absent «ثبت‌نام» command: Event Registration app was not installed in intranet. Installing on Windows exposed `path.relative` backslashes in SDK manifest; path normalization repaired and version bumped to 0.1.12 due cached invalid 0.1.11 tarball.
- LOCAL execution was disabled by default in production; enabling it activated **15** logic functions: Communication 9, Event Registration 2, Custom 3, Standard 1. It also enabled previously dormant send-message and settings-test-SMS routes, and communication-created event handling. This is a real production capability/security-surface expansion, not merely a UI change.
- 119-R1 reported authenticated route enforcement, workspace matching, delegated `TWENTY_APP_ACCESS_TOKEN` intersecting user/app roles, and restricted-user denial for foreign leads/interactions and communication reads. Isolated create/save and duplicate tests passed; production save not executed. 119-R1 corrected earlier mistaken claim of role UID change: role row IDs differ per workspace as expected; stable universalIdentifier same; production role newly created, no stale references.

### 120 — financial validation and communication permission gate (ISOLATED ONLY)

- `decideRegistrationPlan` server-side now rejects fractional agreed/paid amounts (`AMOUNT_NOT_INTEGER`), paid > agreed (`PAID_EXCEEDS_AGREED`), negative/non-numeric values; allows paid=0 without payment row, no amount, and paid with absent agreed (no comparison). Duplicate returns `ALREADY_REGISTERED`. Form has Persian messages. Reported tests on isolated production copy showed zero writes after invalid attempts and exactly one registration/payment on repeat. **This behavior is NOT live until 0.1.13 deployment.**
- Communication `/communication/send` previously authorized a user with read access to Person to dispatch a message. 120 added server-side permission check BEFORE body parse/dispatch using `SEND_EMAIL_TOOL` (existing core permission flag; imperfect semantic match for SMS). Restricted user receives NOT_PERMITTED; Admin passes gate. `/settings-test-sms` already guarded by WORKSPACE flag. No real SMS sent in tests.
- **Breaking compatibility:** API-key calls to `/communication/send` now fail closed (`currentUser` unavailable, CHECK_FAILED). Workflow send uses a different function and reportedly unaffected. Inventory all external API-key integrations before deployment; do not silently treat this as acceptable. `SEND_EMAIL_TOOL` is not a clean SMS permission: assess dedicated `SEND_MESSAGE_TOOL` or explicit principal policy with server-side enforcement, without bypassing RLS or widening role rights.
- Reported test totals: Event Registration 135/135, Communication 771/771; one unrelated pre-existing suite `w13-ux-closure` cannot load due missing `locales/fa-IR.json`, reproduced with stash. Both app typechecks clean. No real SMS, no production data change.
- 120 local commit `6011fe7279` remains unpushed. **No authorization to push/deploy it is implied by this documentation update.**

### Architectural invariants / guardrails

1. Person.assignee remains the ONE accountable owner; four child owner projections stay consistent via five DB triggers. Historical sales/actor fields are not access ownership. Do not assign the 215 production Persons or give restricted roles to real users without explicit approved mapping.
2. RLS, role object/field rights, and server-side delegated token checks must protect direct routes, GraphQL, apps, Logic Functions, counts and foreign-ID access. Never substitute UI hiding for authorization.
3. App roles and metadata use workspace-specific generated IDs; portable source/release must exclude generated Dev or intranet UUID blocks. Re-resolve runtime row IDs; stable universalIdentifier is not a runtime row ID.
4. Money rules are **current requested application policy**, not proof of general accounting policy. In particular paid-without-agreed remains allowed; clarify currency and overpayment business flow before expanding.
5. Enabling LOCAL changes the executable attack/cost surface for every installed app. Inventory route permissions, sending side effects, event hooks and API-key compatibility on any change.
6. Keep :3002 Dev and :6080 intranet distinct. No production writes, migration, restart, deployment, push or merge without explicit new authorization; isolate mutation tests on restored copies. No screenshots, no unbounded loops, no unnecessary worker restart.
7. Preserve tested backups, images and reversible rollout. Cursor PASS is evidence as reported, not independent architect verification.

### Next architect decisions — in priority order

**A. Immediate (before 120 deployment):** Decide API-key send compatibility and whether `SEND_EMAIL_TOOL` is an acceptable temporary SMS guard. Prefer a narrow source-anchored design/proof for dedicated message permission or a principal-specific route policy; preserve fail-closed behavior and avoid breaking authorized integrations. Identify which API-key integrations actually use `/communication/send` (do not assume none). Audit whether Communication's other send surfaces are equally protected.

**B. Release gate:** Review local `6011fe7279` diff and test evidence, compare production 0.1.12/0.1.72 to candidate 0.1.13/0.1.73, ensure backup/rollback, then request explicit permission to push and deploy. No automatic deployment.

**C. Product acceptance:** User visually accepted Dev 117. Intranet 118 health and data parity are reported; production Quick Registration form/prepare PASS, but save intentionally not run. Obtain user acceptance of command visibility/form and a separately approved safe production save smoke test only if required.

**D. Later:** Decide and implement dynamic Person multi-collaborator access from ADR-116 with narrow server-side owner-OR-grant semantics; NOT implemented. Do not expand into a second security engine or hardcode business entities.

### New-chat restart instruction (LATEST)

> Open `docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md` on branch `docs/record-access-architecture-recovery-098-102` in `mrnikiemami-code/crm-platform`; read the LAST section first. Tasks 115–118 deployed Record Access 0.2.4, Persian RTL/default locale and Twenty 2.42 to intranet :6080 (reported). Task 119 installed Event Registration 0.1.12 and enabled LOCAL, making Communication send routes executable. Task 119-R1 pushed SDK Windows manifest fix at release branch `575c47a848`. Task 120 local-only `6011fe7279` (not pushed/deployed) adds integer/overpayment checks and guards Communication send using SEND_EMAIL_TOOL, but breaks API-key send. Production remains Event Registration 0.1.12 / Communication 0.1.72; 215 Persons, 183 Leads, 6 Registrations, 6 Payments, 191 Interactions; total 24,330,000; no Persons assigned. Next: resolve SMS permission semantics/API-key compatibility BEFORE any 120 push/deploy; then review isolated tests and gated release. No production changes, no automatic tasks. Multi-collaborator ADR-116 is only design. STOP_FOR_ARCHITECT.
