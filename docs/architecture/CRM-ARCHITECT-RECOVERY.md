# CRM — Canonical Architect Recovery (read first)

**Updated:** 2026-11-17
**Repository:** mrnikiemami-code/crm-platform
**Authoritative working branch:** `release/record-access-115`
**Historical detailed record:** [CRM-RECORD-ACCESS-RECOVERY.md](https://github.com/mrnikiemami-code/crm-platform/blob/docs/record-access-architecture-recovery-098-102/docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md), branch `docs/record-access-architecture-recovery-098-102`. The historical file has stale early headers: read its **latest appended checkpoint**.
**Scope:** CRM intranet on port 6080. Dev port 3002 is not production. Never silently substitute.

## First actions in a new chat
1. Fetch **this file from the working release branch**, then fetch the detailed historical file on the docs branch. Confirm actual remote HEAD and any newer reports before acting.
2. Distinguish verified GitHub state, user-provided Cursor reports, and live operational evidence. Do not assume code pushed = deployed.
3. Work in short approval-gated tasks, no screenshot/browser loops, no automatic worker/container restart, no unapproved production writes, app reinstall, restore or deploy. Stop at `STOP_FOR_ARCHITECT`.

## Current source and deployment
- Release branch HEAD `d2f3e2f645` (`9e1c239156` docs-only ⇒ `d2f3e2f645` version bump). Code fix itself is `53db32b3b8`; the two later commits changed only docs and two `version` fields.
- **DEPLOYED 2026-11-17:** image `crm-intranet/twenty:53db32b3` (`sha256:ad06c934f7cf0f0bbd29dc51ecaa325b0dea5c6bbc52cd455cac59762c5ff423`) on both server and worker.
- Installed apps: Event Registration **0.1.14**, Communication **0.1.75**, Record Access **0.2.4** unchanged. CRM-122 **CLOSED**.
- Communication's `yarn.lock` is now genuinely stored in the app storage volume (`dependencies/yarn.lock`, 121,153 B), not just a checksum. `yarnLockFileId` stays NULL for tarball-installed apps by design — that column is only populated for the workspace Custom/Standard apps; the layer builder reads the file, not the FK.
- Dependency layers are rebuilt from scratch on every container recreate and no longer need a registry: after the swap `/tmp/logic-function-executor-tmpdir` was empty, the first execution built `deps/33f3154e…` (Communication) and `deps/default` (Event Registration) offline with empty `node_modules`, i.e. nothing to install.
- Rollback image `crm-intranet/twenty:c4d3efd8` (`sha256:ae6a9e54…f362a`) retained. Pre-deploy backup `D:\CrmDeployment\migration\pre125r1-intranet-20261117-025647.dump` (1,750,186 B, sha256 `263F9408…10C2`, 1317 TOC entries, isolated restore verified 215 Persons). Out-of-band pre-release backup `pre122r1-…-152107.dump` (sha256 `98211C83…6E904`) also retained.

## Root cause and code fix
- `npm pack` ignores root `yarn.lock`; installer previously ignored nested lockfile, DB stored checksum but `yarnLockFileId=NULL`, fallback wrote 84-byte stub, dependency layer always ran Yarn and failed on unreachable registry.
- **Checksum did not change across 0.1.72 → 0.1.74**; reject old changed-checksum hypothesis.
- Pushed source fix at `53db32b3b8` ships `dependencies/yarn.lock`, checks md5 against manifest, stores lockfile, fails loudly when missing, resolves actual runtime externals, avoids installing esbuild-inlined/dead `@sniptt/guards` for these two apps, and tightens layer readiness.
- Cursor R1 tests: tarballs, offline cold start, container recreation at layer granularity, non-sending `CALLER_NOT_A_USER`, Event Registration prepare, SDK/server tests PASS. Full isolated app publish/install **NOT RUN**. Genuine external deps still require a registry or offline mirror.

## Blocker history — CRM-COMMUNICATION-RUNTIME-123A (RESOLVED 2026-11-17)
- Image build was blocked because Docker Desktop's VM could not reach the registry. Root cause was a **poisoned Windows DNS client cache entry**: `registry.npmjs.org` cached as `127.153.0.107` (loopback). Docker's embedded resolver `192.168.65.7` forwards to the host resolver, so every container inherited it. Not a proxy issue (Docker's proxy is `http.docker.internal:3128`; TLS to the real IP returned 200) and not a network block.
- Minimal, reversible fix: `ipconfig /flushdns` — cache clear only. No Docker Desktop setting, DNS server, proxy, VPN, host network or Dockerfile change. The standard `docker build --target twenty` then succeeded unchanged.
- The build-time dependency that had been failing was never a packaging defect: `packages/twenty-front` `lingui:extract` depends on `^build`, the SDK build script is `npx rimraf dist && npx vite build`, and `rimraf` is only a devDependency of `packages/twenty-server`, absent from the frontend dependency stage. With registry egress restored it resolves normally. Prebuilding the frontend alone would not have skipped Lingui.

## Production release 2026-11-17 (CRM-COMMUNICATION-RELEASE-125-R1)
- Order executed: server+worker image swap → Event Registration rebuild/install → Communication rebuild/install. PostgreSQL and Redis were never restarted or recreated (uptime preserved).
- A version bump was required first (`d2f3e2f645`): the installer rejects a package whose version equals the installed one (`APP_ALREADY_INSTALLED`), so the rebuilt tarballs could not be installed over `0.1.13`/`0.1.74`.
- Verification: `healthz` 200; `/communication/send` returns `CALLER_NOT_A_USER` (guard executes, nothing dispatched); `/event-registration/prepare` returns live data; money validation rejects decimal, negative, non-numeric and overpayment inputs (the operator gate refuses API keys before validation runs, so no writes occur); counts 215/183/6/6/191, payments 6 = 24,330,000, 5 RLS predicates, 8 triggers, 6 roles, ownership field ids unchanged; zero dependency/registry/runtime/worker errors. Temporary API key revoked and `apiKeyMap`/`apiKeyRoleMap` cache purged.
- Rollback constraint: reverting to the *old* app tarballs via `app:install` is **not** a valid rollback — they declare a checksum but ship no lockfile, so the new installer fails loudly. Rollback means the `c4d3efd8` image, or rebuilding the same versions with the fixed SDK.

## Next feature — CRM-123 multi-collaborator access (NOT STARTED)
**CRM-123 multi-collaborator access**: Person.assignee remains sole owner; manager grants multiple Person collaborators, propagating authorized access to EventLead, EventRegistration, RegistrationPayment, SalesInteraction without duplicating grants; finance default deny. Current RLS AND-composition means collaborator role cannot simply OR its way past owner-only predicate. First approved slice: `personCollaborator` metadata custom object, Person/WorkspaceMember relations, unique pair, active/revoke/reactivate, manager-only writes, isolated tests; **no RLS widening in first slice**. Further server-side security and child-object access require separate architecture review. Implementation is not authorized yet.

## Side backlog (not blocking this release)
Record field changed → selected saved SMS template → Workflow/Communication send after successful save, authorization, deduplication, audit. Integration feasibility not yet proven from source.

## Recovery rules
- Keep canonical summary here on the active working branch; keep detailed history in the linked docs branch. Update this file on each architect handoff so a new chat can discover it without knowing a special branch.
- Never label the SDK fix as deployed until a new image is built and both apps are rebuilt/reinstalled with live verification.
- No hidden continuation, no automatic next task. STOP_FOR_ARCHITECT.


## Checkpoint 2026-11-16 — CRM-125 Approval B PASS, production still unchanged

- Independently verified GitHub compare `9e1c239156454461556941675683ab3526ff1d9d...d2f3e2f645ff9124d459ac8daf0b5fd8bf8387a0`: ahead 1 / behind 0, exactly two changed paths, `packages/twenty-apps/internal/communication/package.json` and `packages/twenty-apps/internal/event-registration/package.json`, each one line replaced. No code/Dockerfile change in this commit.
- Cursor report: Event Registration `0.1.14` tarball `event-registration-0.1.14.tgz`, SHA256 `5CFC5F00609C776A63B25D9C159DB4F6267426F443BFB2A249EF7DBA74593269`, 443707 B, zero runtime deps, no lock required; money-code and offline layer checks PASS.
- Cursor report: Communication `0.1.75` tarball `communication-0.1.75.tgz`, SHA256 `BDD863D997622FACC4ACF13B2081AE2CA717E298B1FA9339F158624B1B44532E`, 2837076 B, zero runtime deps, nested `dependencies/yarn.lock` 121153 B, md5 `33f3154e3015f2c34379f3c3407fc931` matches manifest, offline cold start and non-sending authorization guard PASS. App identities preserved.
- Cursor reports production UNTOUCHED, installed Event Registration `0.1.13`, Communication `0.1.74`, Record Access `0.2.4`, healthz 200. Neither new tarball published nor installed. No deployment approval given.
- Docker registry egress was fixed by Windows `ipconfig /flushdns` after a poisoned DNS client cache entry; no Docker configuration changed. Image `crm-intranet/twenty:53db32b3` reported built with image ID `sha256:ad06c934f7cf0f0bbd29dc51ecaa325b0dea5c6bbc52cd455cac59762c5ff423` and isolated offline test PASS. Image ID is not necessarily a registry manifest digest.
- **Next gate:** obtain explicit approval for one coordinated operational release: fresh backup and baseline; image swap (server/worker) followed immediately by Event Registration `0.1.14` and Communication `0.1.75` publish/install, with preflight checks, no message send, data/security/finance smoke tests, and bounded downtime. Verify rollback compatibility and DB state; reverting image alone after app version progression is not automatically a complete rollback. Avoid untested automatic DB restore.
- `CRM-122` remains OPEN until live durable release and restart/cold-start behavior are proven. `CRM-123` collaborator work remains paused. `record-access-0.2.4.tgz` must not be modified.


## CRM-126 — Workflow-triggered template SMS, analysis checkpoint (2026-11-17)

**Status: ANALYSIS COMPLETE / STOP_FOR_ARCHITECT. No implementation authorized or performed.** User priority: workflow-driven SMS on real field change with user-selected saved template; CRM-123 remains deferred.

### Confirmed by Cursor source inspection (reported, not independently code-audited here)
- Native updated/upserted database event trigger supports selecting object and `settings.fields`; listener intersects `updatedFields`. Native `settings.filter` can check `trigger.properties.after.<field>`. Deep equality suppresses unchanged saves; relation fields excluded from diff.
- Existing logic-function workflow action supports `workflowActionTriggerSettings` and `inputSchema`; public Discord action is an example.
- Reuse internal Communication `send-communication-workflow-handler`, persistence, Kavenegar/Razpayamak providers, messageTemplate source scoping, `resolveSendContext`, and safe allow-listed template interpolation. Never accept arbitrary recipient from workflow user input.
- Four gaps: (A) automatic workflow run lacks workspaceMember acting identity and fails `CALLER_NOT_A_USER`; (B) logic function cannot communicate safe terminal failure status to workflow executor (SUCCESS/FAILED mapping, retry risk); (C) no saved-template picker in workflow UI; (D) no persistent send deduplication across retries/re-runs.
- Candidate app-side first slice (NOT APPROVED): unique `deduplicationKey` on Communication; new `send-template-workflow-action` with templateId, sourceObjectNameSingular, sourceRecordId; validate/resolve/interpolate before sending; unique key claim and dispatch via existing handler. Design must prove durable state machine, concurrent sends, and recovery from queued/unknown outcomes; a unique QUEUED row alone can suppress a send after crash, so cannot be treated as proof of delivery.
- Candidate core work: explicit authorized workflow actor identity and non-retryable/safe failure signaling; candidate frontend work: template picker by source-scoped template ID. Do not silently substitute workflow creator's identity: revocation, permissions at execution time, auditing, and security boundaries require architect decision.
- Open architecture choices: authorized actor for unattended workflows (creator vs designated service principal, with revocation rules); idempotency semantics (content key suppresses A→B→A and manual re-run vs event-identity per actual change); manual replay behavior; safe failure/unknown-provider outcomes; template selection UX and cross-workspace checks.
- User requested repository recovery update only. No operational changes, no SMS sent, no CRM-126 implementation. CRM-122 remains CLOSED after CRM-125-R1 live deployment; installed ER 0.1.14, Communication 0.1.75, Record Access 0.2.4.


## CRM-126 — R1 through R4 implementation handoff (2026-11-17)

**Latest status: DEV UI IMPLEMENTED / INTEGRATION NOT PROVEN / STOP_FOR_ARCHITECT.** This checkpoint supersedes the earlier CRM-126 *analysis-only* status above. All implementation and test claims below are **Cursor reports, not independently audited remote code**: the feature branch is local/unpushed. No approval to deploy to intranet.

- Feature branch: `feat/crm-126-workflow-template-sms` from `release/record-access-115`. R1 `e4e8a210f233d62f3774eceb6e7b8e934e3805a4`; R2 `26e7a5987b368b7f084e04395fb924042d4039fc`; R4 latest `9cceeb333fc700362975cc8e393ac06c043010ac`. R3 made no commit. **No push or merge reported**; these commits are not verified on GitHub.
- User chose **CRM system-owned identity**, not creator/editor identity, for unattended sends. App variable `WORKFLOW_SMS_SENDING` defaults disabled; controlled by `APPLICATIONS` permission; intended fail-closed on revocation/disabled. Reuses existing Communication send-and-persist, provider integrations, Person relation recipient resolution and allow-listed interpolation; no arbitrary recipient input.
- R1 introduced native Workflow logic-function action `communication-send-template-workflow-action` and persisted send dedup. R2 changed idempotency to an `eventId` minted once at ORM database-event formatting; tests report distinct identities for distinct writes, replay stability, A→B→A legitimate sends, and no retry after ambiguous provider result. Workflow step failures throw; Communication reports `SENT/DELIVERED`, `FAILED`, or `UNKNOWN`. Core safe-failure contract remains unmodified; no live SMS dispatch proven.
- R3: Dev frontend `http://localhost:3001`, backend `:3002`; Communication 0.1.75 installed, action registered, record picker API returned Persian sample template. Browser rendering was not independently confirmed at that stage. Server image `twenty-dev/o117` lacked R2 eventId code; `LOGIC_FUNCTION_TYPE` absent and `NODE_ENV=production`, so logic-function execution was disabled. No real end-to-end change→send test; no production send.
- User supplied a real screenshot of R3: action exposed many technical fields (`eventId`, record ID, object name, before/after, workflow ID, field name, JSON output), unsuitable for ordinary operators; screenshot trigger was **record created**, not updated. Architect requested a single template selector and derived context, not manual UUIDs.
- R4 report: introduced opt-in `InputSchema.isHidden` and `derivedFromTrigger`, plus `workflowActionTriggerSettings.hideExpectedOutput` and `triggerRequirementMessage`; builder init effect derives real `{{trigger...}}` expressions and hides technical fields/JSON, leaving only Persian-labeled template picker. Strictly refuses missing/created/manual/multi-watched-field/unknown-workflowId contexts, showing guidance and failing closed. Reported 743 frontend Jest + 812 app Vitest + 245 shared Nx tests PASS; three-package typecheck zero errors. Communication **0.1.76 installed in Dev only**, Vite HMR on `:3001`, backend `:3002` healthy. Browser visual rendering **still not independently verified** by user/architect.
- **Known UX limitation:** native `FormSingleRecordPicker` has no source/channel filter. A mismatched template can still be selected in the picker; server rejects with `TEMPLATE_SOURCE_MISMATCH` or `TEMPLATE_UNSUPPORTED_CHANNEL` (fail closed). Do not describe this as source-filtered UI.
- **Critical pending gate:** Dev backend still reportedly runs older image lacking R2 `eventId` and logic-function execution; therefore R4 frontend/schema/unit tests do **not** prove real workflow execution, system identity or durable idempotency in running Dev. Check trigger-derived variable paths and workflowId availability against actual runtime before authorizing sends. Review hidden-input initialization on edits/trigger changes and ensure stale derived values cannot be used. Inspect error status persistence and re-run semantics before production release.
- User explicitly prohibited any change to **crm-intranet :6080**, production database/worker, Docker image builds, live SMS, unapproved restarts, push/merge. Cursor reports intranet healthz 200 and no production writes or restarts through R4. Production Communication remains 0.1.75; 0.1.76 is Dev-only.
- **Next action:** user visually checks the simplified R4 action in Dev; any further fixes require a new narrowly scoped approved task. CRM-126 is **not production-ready and not closed as end-to-end verified**. CRM-123 remains paused. Do not let this checkpoint silently authorize deployment.


## CRM-126 — R5 Dev UX/performance checkpoint (2026-11-17)

**Status: R5 CODE/TESTS REPORTED PASS; PERCEIVED CLICK LATENCY UNVERIFIED; STOP_FOR_ARCHITECT.** This supersedes the R4 UI status above, without authorizing deployment. Source: user-supplied Cursor R5 report, not independent review of unpushed code.

- Local feature branch `feat/crm-126-workflow-template-sms`, R5 commit `e303b9f25174d983bef86e86137692d9a15528df` (not pushed). Dev Communication updated to **0.1.77**; frontend `http://localhost:3001` and backend `:3002` reported HTTP 200. Intranet `:6080` untouched, no restart, Docker build, real SMS, or push.
- User reported slow response when clicking trigger/action workflow nodes and an ugly mixed-language oversized warning. R5 network measurements across 3 samples: workflow 58/5/4 ms, workflowVersion 7/4/3 ms, getLogicFunctionSourceCode 7/2/2 ms. Reported node-action network path ~15→6 ms after removing redundant requests. **These are network timings, not browser click-to-render latency; React Profiler was NOT run due to missing authenticated UI access.** Rendering bottleneck remains a hypothesis, not a proven root cause.
- R5 removed redundant `useWorkflowWithCurrentVersion` from action node, reading existing trigger from `flowComponentState` instead; reduced 2 requests/4 hook chains/one `useFindOneRecord`. Corrected memo dependencies to primitives `triggerType`, `eventName`, `fields`; removed repeated JSON output rendering. Shared workflow engine not speculatively altered.
- Replaced `Trigger not configured` with **«محرک نیاز به تنظیم دارد»**, concise Persian instructions **«برای ارسال پیامک هنگام تغییر اطلاعات، رویداد «ویرایش رکورد» و ستون موردنظر را انتخاب کنید.»**, and Design System warning Callout with actionable **«تنظیم محرک»** selecting trigger; action hidden in read-only mode. R5 reports five tests on this component.
- Reported tests: **748 frontend Jest PASS**, app typecheck zero errors. **No authenticated browser render/React Profiler proof** and no real end-to-end SMS. User visual/latency acceptance is still required; do not claim that click lag is fixed or that production is ready.
- Next: user checks Dev UI click responsiveness and warning appearance. If lag remains, obtain authorized authenticated Dev profiling evidence in a narrowly scoped task; no screenshot loops. CRM-123 still deferred. STOP_FOR_ARCHITECT.


## CRM-126 — R6 workflow node click hit-testing checkpoint (2026-11-17)

**Status: REPORTED DEV INTERACTIVE PASS / USER ACCEPTANCE PENDING / STOP_FOR_ARCHITECT.** Cursor report supplied by user; local feature commit not pushed or independently audited.

- Task `CRM-WORKFLOW-CLICK-126-R6`; local commit `e5157b5009402e142dd10134c6f4f072cc2d8ae2` on `feat/crm-126-workflow-template-sms`; one file, +6 lines; tree clean, no push.
- Root cause identified in `@xyflow/react`: `nodeClickDistance` default 0, while existing canvas `paneClickDistance={10}`. Small mouse motion between press/release may suppress node click by beginning drag. Minimal change in `WorkflowDiagramCanvasBase.tsx`: `nodeClickDistance={10}`, matching pane tolerance. No intended changes to drag, connectors, persistence.
- Reported DOM hit-test `elementFromPoint`: 14/15 grid points hit node surface, 1/15 bottom connection handle intentionally intercepts; no widespread overlay or pointer-events blocker.
- **Authenticated interactive Dev test reported PASS:** five positions (icon, center, title, upper-right, inner-bottom) on both Action and Trigger opened correct panel; switching Action→Trigger updated editor states correctly; warning button «تنظیم محرک» selected Trigger. Direct A/B synthetic 2–4px pointer-jitter behavior **not demonstrated** due tooling limitations; code/library documentation supports hypothesis.
- Reported 748 frontend Jest PASS, typecheck zero errors, Vite HMR live on `:3001`, Dev Communication 0.1.77 installed; `:6080` healthz 200 and unchanged, no Docker build, restart, SMS or push.
- Architect disposition: **R6 implementation/test evidence accepted provisionally; final UX acceptance requires user clicking in Dev.** Do not claim production-ready or end-to-end SMS tested. Next separate open task from user: DEV mock workflow SMS end-to-end plus read-only diagnosis of missing SalesInteraction titles on intranet (CRM-127), not yet reported complete.


## CRM-127 — SMS runtime probe and SalesInteraction title investigation (2026-11-17)

**Status: INVESTIGATION COMPLETE; SMS E2E BLOCKED; NO CODE/DATA CHANGES; STOP_FOR_ARCHITECT.** Evidence below is from user-provided Cursor investigation report, not independently audited DB/code. Feature tree clean at `e5157b5009`.

**A — Communication SMS Dev:** Actual `/communication/send` returned HTTP 500: `No encryption key matches keyId '1cc589d8'`. Seven old provider app variables use keyId `1cc589d8`, while active server keyId is `b0f15747` and fallback keyId `e3b0c442` (empty). Failure at `ApplicationVariableEntityService.decryptValue` in `LogicFunctionExecutorService.getExecutionEnvVariables` occurs before driver selection. Newly added `WORKFLOW_SMS_SENDING` decrypts with active key. Contrary to prior assumption, Dev logic functions execute: `/event-registration/prepare` returned HTTP 200 with domain result `success:false, reason:UNREADABLE`. Provider variables include **real Kavenegar/RazPayamak credentials**; simply restoring decryption could permit real SMS. Mock provider exists only in unit tests, not runtime. Live mock harness failed because `CoreApiClient` is not generated outside app runtime; removed. No Communication rows created (reported 0). SMS template/Person relation path traced, 36 mocked unit tests pass, but **no real Workflow E2E**. Safety gate: first implement an isolated Dev runtime fake/no-network provider and prevent live provider calls, then test; never print secrets or restore old keys merely to test.

**B — Intranet SalesInteraction titles (read-only SELECT):** 190/191 `salesInteraction.name` rows are SQL NULL; one manually entered typo `پیکیری` last updated Nov 7. Field is nullable TEXT; no observed DB title trigger, SQL writer, app logic function on `salesInteraction`, or Git history implementation of `callAttempt` title generation. UI and GraphQL reflect NULL; evidence supports **missing title generation**, not a proven deletion/regression. `callAttempt` metadata already has Persian CALL_1..CALL_5 labels. Relation `salesInteraction.eventLeadId → eventLead.personId → person.nameFirstName/nameLastName` is available; 187 named persons, 4 linked unnamed, none without lead (per report). Proposed narrow implementation: title creation on `salesInteraction.created`, optionally update on `callAttempt` change; respect manual titles, avoid self-trigger loops, provide meaningful unnamed fallback. **Architect caveat:** `name IS NULL` guard alone cannot safely update previously auto-generated titles when `callAttempt` changes; explicitly decide/manual-vs-generated provenance before implementing updates. One-time backfill for existing NULL rows only after separate dry-run and approval. Do not modify intranet or data under this checkpoint.

**Environment:** intranet `:6080` read-only and healthy, no restart; Dev key/cache cleanup reported, no new records, Docker build, push, screenshots, or actual SMS. Await architect-approved narrowly scoped implementation tasks; no automatic next task authorized.


## CRM-128 — SalesInteraction title generation domain implementation (2026-11-17)

**Status: PARTIAL / STOP_FOR_ARCHITECT; architecture decision: explicit provenance field required.** Based on user-provided Cursor report, local unpushed code not independently audited.

- Local feature branch `feat/crm-126-workflow-template-sms` commit `7cd9f6391b1f501a969b5fb8b91f6d2fd894b07c` (3 files, +356/-2). 61 domain tests / 153 whole app PASS, typecheck 0. No Dev or intranet deployment, writes, push, Docker build, or restart.
- Implemented pure `buildSalesInteractionTitle` and `decideSalesInteractionTitle` helpers, including attempt labels, person name, fallback «مشتری بدون نام», reject unknown CALL_6, idempotency, and preserve manually distinct titles. Existing helper `clean` reused. 28 new tests reported.
- Dry-run read-only: 190 NULL titles, all 190 constructible; 4 unnamed person fallbacks, no unknown/missing callAttempt; 1 manual title `پیکیری` preserved. No backfill executed.
- Cursor stopped before wiring triggers because no reliable existing provenance flag/audit; suggested comparing title with reconstructed previous-state title via `properties.before`, which has ambiguity (user may manually type canonical text). **Architect rejects heuristic compare-and-set as sole ownership authority. Add explicit provenance field (e.g. `titleIsAuto`) with defined create/manual-edit/auto-update semantics and conservative legacy default.** Person rename updates must be handled from person events or explicit dependency propagation, not assumed to arrive in SalesInteraction before-image.
- Current helpers were placed inside `event-registration` app for convenience. **Architect requires domain ownership under SalesInteraction/communications or an independent narrowly scoped component; do not put this in record-access authorization module.** Need ensure no uncontrolled dependency on optional event-registration app for baseline CRM behavior.
- Next narrow task: implement provenance field and proper title lifecycle on Dev, add tests, then dry-run. Do not write intranet records or run backfill until separately approved. The separate CRM-126 SMS encryption/mock blocker remains unresolved.
