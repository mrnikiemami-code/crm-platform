# CRM — Canonical Architect Recovery (read first)

**Updated:** 2026-11-21 (CRM-129-QUOTATION-UNIFIED-CREATION-003)
**Repository:** mrnikiemami-code/crm-platform
**Authoritative working branch:** `release/record-access-115`
**Historical detailed record:** [CRM-RECORD-ACCESS-RECOVERY.md](https://github.com/mrnikiemami-code/crm-platform/blob/docs/record-access-architecture-recovery-098-102/docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md), branch `docs/record-access-architecture-recovery-098-102`. The historical file has stale early headers: read its **latest appended checkpoint**.
**Scope:** CRM intranet on port 6080. Dev port 3002 is not production. Never silently substitute.

## SOURCE FIX — CRM-129 RECORD PAGE USES PROFESSIONAL EDITOR (2026-11-21; deployed and verified on Dev)

- **Issue confirmed by user's browser image:** opening a quotation from the list still showed the generic Twenty **FIELDS** widget, despite the earlier command-menu creation and edit-flow fixes.
- **Root cause:** `src/page-layouts/quotation-record.page-layout.ts` explicitly configured the first tab as `type: 'FIELDS'`, while the existing `QuotationDraftForm` was only used in command-menu surfaces.
- **Source correction:** replace the first tab's widget with `FRONT_COMPONENT` pointing at `QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER`; rename tab to «پیش‌فاکتور». Keep the separate «اقدامات» lifecycle widget unchanged. The host's `FrontComponentWidgetRenderer` passes `selectedRecordIds` and `objectNameSingular` from the record page; the existing form uses these to load the current quotation.
- **Regression coverage:** `src/__tests__/s2-surfaces.test.ts` now asserts the record page uses the professional editor widget instead of raw fields (5/5 pass).
- **Deployed (2026-11-21):** `twenty apply -f -r dev-crm129` synced app **0.1.18** with `0 rows to add, 2 to change, 0 to destroy` (tab title/icon + widget `type: FIELDS → FRONT_COMPONENT`). DB readback: tab «پیش‌فاکتور» + «اقدامات» both `FRONT_COMPONENT`.
- **Real browser check on `:3002`:** `/object/quotation/b08cc49c-7b10-485d-afa7-b8f42793a75a` renders tabs «پیش‌فاکتور»/«اقدامات», the draft form with «ردیف‌های کالا و خدمت» and the real customer «فرید رفیعی»; the generic «فیلدهای پیش‌فاکتور» widget is gone.
- **Still open:** existing non-atomic draft persistence remains separately unclaimed (`DATA_INTEGRITY_PASS` not asserted). No `:6080` action.


## CURRENT CHECKPOINT — CRM-129-QUOTATION-UNIFIED-CREATION-003 PASS WITH OPEN INTEGRITY RISK / One Creation Door (2026-11-21; latest)

**Read first:** [CRM-129-QUOTATION-UNIFIED-CREATION-003-PROOF.md](./CRM-129-QUOTATION-UNIFIED-CREATION-003-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `82447297c8d52e55f02f67c4978a3f5ed3ddb749`. Quotation app **0.1.17** deployed to `dev-crm129`.
- **One creation door:** `quotation` now has `isUICreatable: false`, so Twenty's generic record form can no longer start a quotation from any screen (list, inline, panel). The only entry is the app's `GLOBAL_OBJECT_CONTEXT` command «پیش‌فاکتور جدید» (`create-quotation-from-quotations.command-menu-item.ts`), which opens `QuotationDraftForm`. Verified in dev: opening and cancelling the form leaves the table at 95 rows — no blank header row is written.
- **Customer:** new `CustomerPicker` (debounced real Person/Company search, loading/empty/error/retry, readable names) plus `/quotation/search-customers` (auth-required, app-role reads, Persian permission errors). `verifyCustomerRecord` refuses fabricated/empty customers **before the first write** (`CUSTOMER_NOT_FOUND`, zero mutations in test). Person/Company creation preselects and preserves the relation; the form resolves the id to a real label and never populates both sides.
- **Edit in place:** «اقدامات» → «ویرایش پیش‌نویس» opens the same form with the real `quotationId`; header, customer label (now hydrated via `person { name { firstName lastName } }` / `company { name }`), lines, discounts, payment terms and version are read from the DB. Save updates the same id with `expectedVersion`; stale saves get `VERSION_CONFLICT` (Persian). Dev: `3ac47bbf-fabe-492b-83a1-14e70905e8c3`, version 2 → 4, 33,000 + 2,970 = **35,970 IRR**, exactly one row and one line — no duplicate.
- **Locked documents:** non-DRAFT refuses content edits with `QUOTATION_IMMUTABLE` (Persian) and every content section is `pointerEvents: none`, dimmed, save disabled. Verified on the same document after it reached `READY_TO_SEND`.
- **Live list sync:** a narrow, argument-free `refreshRecordData` was added to the Front Component host API (`refetchQueries({ include: 'active' })`), so the table shows the new name/customer/status/amount/number right after an app-route save. Missing bridge degrades gracefully (stale row until reload, save still succeeds).
- **Lifecycle / number:** same document went `DRAFT` → `PENDING_INTERNAL_APPROVAL` → `READY_TO_SEND` (version 5 → 6) and claimed `QT-1405-000030`; `_quotationSequence` shows `QUOTATION:1405 lastIssued=30` — unique, no gap-filling. PDF action present and seven sharing channels listed; **no share row was written** and no provider was called (Bale stays `LIVE_UNVERIFIED`).
- **Regression:** metadata readback shows `person`, `company`, `task` still `isUICreatable = true`; native create forms still open for all three. RTL drawer resize re-checked (180 → 320 px out, back to 220 px).
- **DATA INTEGRITY — NOT PASS:** header and each line are still separate GraphQL round-trips (`update/create quotation` → per-line update/create → stale deletes → read-back). No transaction exists; a mid-save failure can leave a DRAFT with new totals and partly-old lines. It stays DRAFT, so numbering/PDF/send cannot consume it as final. A transactional server endpoint is required before any `DATA_INTEGRITY_PASS`.
- **Tests:** quotation app vitest **269**; renderer host-API jest **2**; front execution-context jest **60** (needs `NODE_ENV=test`); `tsgo` clean for twenty-front, twenty-sdk, twenty-front-component-renderer and the app. Dev scripts `dev-verify-crm129-unified-creation.cjs` and `tmp-uni003-locked.cjs` passed.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT. Next decision: approve a transactional save endpoint, and connect real outbound sharing separately.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + their test, plus `.tmp-*` probe files.

## PREVIOUS CHECKPOINT — CRM-129-QUOTATION-RECORD-UX-002 PASS / Record Panel Edit, Lifecycle, Sharing (2026-11-20; historical)

**Read first:** [CRM-129-QUOTATION-RECORD-UX-002-PROOF.md](./CRM-129-QUOTATION-RECORD-UX-002-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `8e91f7904cb30554b2d45519b23b175b59b6d7a7`. Quotation app **0.1.15** on `dev-crm129`.
- **Draft editing:** opening a row from «همهٔ پیش‌فاکتورها» now loads the real document and its lines into `QuotationDraftForm` (`services/quotation-draft-edit.service.ts`), and saving updates the **same** record with `expectedVersion` (Dev: `40f8213a-…`, version 3 → 4, payable ۹۸۱ → ۴٬۷۸۴ تومان, no duplicate row).
- **Protection:** computed/system fields are `isUIEditable: false`; server still rejects locked writes (`QUOTATION_IMMUTABLE`, Persian) and illegal transitions (`TRANSITION_NOT_ALLOWED`, Persian). `dev-verify-crm129-locked-guard.cjs` → `CRM129_LOCKED_GUARD_PASS`, nothing mutated.
- **Lifecycle/sharing:** «اقدامات» tab drives پیش‌نویس → در انتظار تأیید → آماده ارسال on the open record; document number `QT-1405-000019` and the new status appeared in the table without reload; «دانلود PDF فارسی» produced a real PDF; seven channels listed; Bale remains provider-only (`PROVIDER_FAILED` without a real API success, `LIVE_UNVERIFIED`).
- **RTL:** panel resize is fixed generally — RTL drag right 400→480 px, drag left 480→400 px; mirrored LTR narrows/widens correctly; unit tests cover both directions and zoom.
- **Operator copy:** quotation errors surface Persian `userFriendlyMessage` only (machine codes stripped by `ui-message.ts`), and the panel header shows the record label instead of `/object/quotation/…`.
- **Tests:** quotation app vitest **258**, server quotation jest **4**, front jest **65**; `tsgo` clean for twenty-front and the app. Server `tsgo` has 2 pre-existing errors in untouched files (`quotation-communication-outbound.service.ts:135`, `test/spikes/quotation-pdf/quotation-pdf-document.ts:125`).
- **Regression:** `S2_R8_FINANCE_PASS`, `S2_R6_UI_PDF_PASS`, `S3_R3_SHARE_PASS`, `S3_R4_BALE_CONTRACT_PASS`, `S2_R4_ROLE_PASS`, version-bypass guards, numbering race 000025–000028 distinct.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT.
- **Operational bans:** no `:6080`, no release-branch change, no parallel form/Send stack, no direct DB status edits, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + their test, plus `.tmp-*` probe files.

## PREVIOUS CHECKPOINT — CRM-129 LIST UX ACCEPTED (2026-11-20; historical gate)

- **Verified GitHub HEAD:** `8c33411c5c061502edaee26552c29e90e79571f3` on `feat/crm-129-quotation`. The 246 Vitest / 32 Jest / Dev `:3002` evidence is worker-reported in [CRM-129-QUOTATION-LIST-UX-001-PROOF.md](./CRM-129-QUOTATION-LIST-UX-001-PROOF.md), not a fresh architect-run browser test.
- **Decision:** ACCEPT app-owned sidebar view «همهٔ پیش‌فاکتورها» as the operator-facing view. KEEP Twenty's 34-column platform-provisioned `All پیش‌فاکتورها` view unchanged for now. Do **not** change Core/default-view provisioning or delete the other view without a separate product need and bounded approval.
- **Numbering contract:** null `quotationNumber` in DRAFT is intentional; number allocated atomically on transition to `READY_TO_SEND`. Never invent/backfill legacy numbers or mistake `version` for document number. Preserve concurrent issuance tests and no duplicate numbers.
- **Customer and money presentation:** app view projects customer from actual Person/Company relations and money through shared exact formatter; retain raw exact storage untouched. Dev browser operator URL is `http://localhost:3002/objects/quotations?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`.
- **Next:** resume CRM-129 customer acceptance/rejection online or other prioritized product capability as separately approved; no additional list-view Core task. Continue short source-grounded tasks with real browser handoff. Bale direct API remains `LIVE_UNVERIFIED`; `:6080` off-limits. Preserve unrelated local dirty files.

## PREVIOUS CHECKPOINT — CRM-129-QUOTATION-LIST-UX-001 PASS / Professional Quotation List (2026-11-20; historical)

**Read first:** [CRM-129-QUOTATION-LIST-UX-001-PROOF.md](./CRM-129-QUOTATION-LIST-UX-001-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `5ab67884a156095101e7bf171f550a6d95093316`.
- **Delivery:** List «همهٔ پیش‌فاکتورها» now shows `عنوان · شماره سند · مشتری · وضعیت · مبلغ کل`. Document numbers are claimed **at issuance** (`READY_TO_SEND`) by a single-statement `INSERT … ON CONFLICT … RETURNING` on `_quotationSequence` (Jalali year scope, `QT-۱۴۰۵-۰۰۰۰۰۱`); unnumbered rows render «بدون شماره» and were not reconstructed. `customerName` / `quotationNumberLabel` / `totalDisplay` are read-only projections; `totalExact` (six decimals) and `version` stay stored but hidden.
- **Money:** `۲٬۳۰۵٬۳۵۰ ریال` from stored `2305350.000000` via the shared Money Domain formatter — no `Number`/`parseFloat`/re-rounding.
- **Dev (`:3002`):** sidebar «همهٔ پیش‌فاکتورها» → `?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`; 61 active rows (5 numbered, 56 «بدون شماره»); 4-way race produced 4 consecutive distinct numbers.
- **Tests:** quotation app vitest **246**, server quotation jest **32**.
- **Known limitation:** the platform-provisioned `All پیش‌فاکتورها` view still lists all 34 columns; making the app view the workspace default is a platform-level change, left undecided.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT.
- **Operational bans:** no `:6080`, no bulk send, no SMS blast, no main-worker restart, no release-branch change, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + `enterprise-plan.service.ts`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R4-HF1 PASS / Quotation Form Crash Fix (2026-11-20; historical)

**Read first:** [CRM-129-S3-R4-HF1-PROOF.md](./CRM-129-S3-R4-HF1-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `a4e29f9a78fcbcf6019b2174c2b8d77a1fbe17a6`.
- **GitHub SHA:** `55eed5d8bc` (docs commit may follow).
- **Delivery:** Guard FC caret restore (`setSelectionRange` no-op when missing); sidebar nav «همهٔ پیش‌فاکتورها»; prefer application GraphQL token for catalog/quotation LF. Quotation **0.1.13** on `dev-crm129`.
- **Dev:** Form opens from Persons without crash; Persian money + 2-line draft + 10% discount saved (`2dd13611-…`); list reachable; math UI↔DB match. Vitest **240** PASS.

## PREVIOUS CHECKPOINT — CRM-129 S3-R4 PASS / Bale Direct Sending (2026-11-20; historical)

**Read first:** [CRM-129-S3-R4-PROOF.md](./CRM-129-S3-R4-PROOF.md). Feature SHA `ddfa3ccb1a`; docs HEAD was `a4e29f9a78`. `LIVE_UNVERIFIED` Bale contract.

## PREVIOUS CHECKPOINT — CRM-129 S3-R3 PASS / Quotation Multi-Channel Sharing (2026-11-20; historical)

**Read first:** [CRM-129-S3-R3-PROOF.md](./CRM-129-S3-R3-PROOF.md). Feature SHA `e18868767a`; docs HEAD was `03d6690d58`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R2 PASS / Link Authorization & Browser UAT (2026-11-19; historical)

**Read first:** [CRM-129-S3-R2-PROOF.md](./CRM-129-S3-R2-PROOF.md). Feature SHA `ff33b445ee`; docs HEAD was `a937656cc8`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R1 PASS / Secure Customer Quotation Link (2026-11-19; historical)

**Read first:** [CRM-129-S3-R1-PROOF.md](./CRM-129-S3-R1-PROOF.md). Feature SHA `e29f25d093`; docs HEAD was `0aa0ec2bd2`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R11 PASS / Catalog Perf, Persian Inputs, Rounding Verify (2026-11-19; historical)

**Read first:** [CRM-129-S2-R11-PROOF.md](./CRM-129-S2-R11-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from S2-R10 `a96056f217`.
- **GitHub SHA:** `72375a7aecdb34e4754e0023f189c13b72efd637`.
- **Delivery:** catalog search cut from 3→2 GraphQL round-trips (combined catalog+default priceList); client empty-page cache; Persian money inputs with validated grouping parser; caret-safe inputs; rounding case verified consistent UI/DB/PDF (no domain change). App **0.1.7** on `dev-crm129`.
- **Bench:** before open/page2/search avg 142/129/122 ms; after-combined 163/120/125 ms wall (LF cold-start noise); internal timings ~60–70 ms (catalog~50–58 + prices~10).
- **Continue at:** architect gate — **S3** not authorized here.
- **Operational bans:** no `:6080`, no live accounting, no SMS, no main-worker restart, no release-branch change, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + `enterprise-plan.service.ts`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R10 PASS / Professional Workspace & Floor Payable (2026-11-19; historical)

**Read first:** [CRM-129-S2-R10-PROOF.md](./CRM-129-S2-R10-PROOF.md). Superseded as “latest” by S2-R11 above.

- Feature SHA `5c831b52f7`; people display + floor payable; full page DEFERRED; app was `0.1.6`.

## PREVIOUS — CRM-129 S2-R9 UAT FEEDBACK (2026-11-19; historical REPORT then implemented in R10)

Historical report-only checkpoint on baseline `2ce697a779` / docs `ae65e83c29`: operator asked for primary add-row, alternating cards, people money display, and floor payable. Implemented and proven in **S2-R10** above.

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


## CRM-128-R2 — explicit title provenance and independent sales-followup app (2026-11-17)

**Status: IMPLEMENTATION/TESTS REPORTED PASS; DEV APP INSTALL APPROVED; INTRANET BACKFILL NOT APPROVED; STOP_FOR_ARCHITECT.** Based on user-supplied Cursor report; local unpushed implementation not independently reviewed.

- Commit `080cc2efdac2f27b779999701694d9cabffce8c4` on local `feat/crm-126-workflow-template-sms` (21 files, +1821/-115); tree clean, not pushed. 35/35 new sales-followup tests, 135/135 event-registration, typecheck 0, lint 0, build PASS.
- New `salesInteraction.titleIsAuto`: nullable BOOLEAN, default false. Dev field created; 175 existing records got false, none marked auto. Domain title logic moved from event-registration to independent `sales-followup` app; record-access untouched. Empty title gets generated with flag=true; flag=false/manual and NULL/unknown provenance protected; auto titles recomputed on attempt or person name change; unchanged writes skipped to prevent loops. Name and ownership flag written together. Unknown call attempt rejected; unnamed fallback provided.
- App manifest defines three triggers: `salesInteraction.created`, `salesInteraction.updated` watching `callAttempt,name`, and `person.updated` watching `nameFirstName,nameLastName`; person-rename propagation capped at 200 with truncation reporting. App permissions read/update salesInteraction, read eventLead/person, no deletes.
- Read-only intranet backfill dry-run: scanned 191, would fill 190 NULL titles, preserve 1 manual `پیکیری`, no unbuildable rows. Dev dry-run: scanned 175, would fill 0 and preserve 175. Script defaults dry-run, `--apply` required; no backfill executed.
- **Dev app not yet installed**; triggers and live updateSalesInteraction mutation not validated. Architect **approves installing and testing app on Dev only**, using reversible isolated test records, verifying create, callAttempt change, person rename, manual override, idempotency, and no unintended mass changes. Ensure manual edits set `titleIsAuto=false` in same operation (or fail safely), including when editing previously auto title. Verify update loops and trigger permissions. **No intranet --apply or schema change/deployment authorization yet**; requires successful Dev integration and separate explicit user approval. Keep :6080 read-only.
- Note: Dev CreateFieldInput did not accept universalIdentifier; generated field UID used, code resolves by field name. No Docker build, restart, push, SMS, or screenshots reported.


## CRM-128-R3 — Dev live integration blocked (2026-11-17)

**Status: BLOCKED / NOT ACCEPTED FOR INTRANET; STOP_FOR_ARCHITECT.** User-supplied Cursor evidence; no independent source audit of local unpushed branch.

- Local commit `d462e52ba1` (engine compatibility range + app version). Sales Follow-up **0.1.1** installed on Dev after lowering required Twenty version from >=2.42 to >=2.41 (Dev is 2.41). Three manifest triggers registered and fired: salesInteraction.created, salesInteraction.updated [callAttempt,name], person.updated [nameFirstName,nameLastName]. LogicFunctionTriggerJob jobs 36/37/38 reported completed, but **no title writes**. Creation left name empty; changing callAttempt did not refresh title; person rename not tested. Successful job completion does not prove app domain success.
- Root cause not proven. Hypothesis: code uses flat person.nameFirstName while Dev GraphQL uses composite `name { firstName }`; app may swallow READ_FAILED / return null. Need direct evidence of logic-function inputs/results and GraphQL shape, and fail-visible diagnostics rather than silent swallowing.
- **Critical invariant failed:** manual editing name left `titleIsAuto=true` instead of switching to false. This risks overwriting manually edited titles on future events. Must implement and test ownership handoff at write boundary (UI/API), or safe detection using event before/after plus flag without rewriting a user's text; do not assume app's own auto writes are manual edits.
- Test records cleaned (2 salesInteraction, 1 eventLead, 1 person); 175 real Dev rows unchanged, 0 auto flags true, 0 empty names, no test records remain. Intranet :6080 read-only, 190 NULL titles + 1 manual preserved; no backfill, build, restart, push, SMS.
- **Architect decision:** do not deploy app to intranet or apply backfill. Dev app 0.1.1 remains installed; reported lack of writes is not a safety guarantee. Disable Dev triggers pending fix if safely supported, retaining logs/evidence. Next bounded task: establish exact runtime read failure and make domain errors observable, fix trigger execution, and enforce manual title override -> titleIsAuto=false with tests. Revalidate real Dev create/update/person rename/manual edit/idempotency before any intranet approval. No automatic continuation.


## CRM-128-R4 — direct Dev handler PASS, worker transport E2E BLOCKED (2026-11-17)

**Status: DOMAIN LOGIC PASS (reported direct real-DB integration), WORKER-TRIGGER E2E BLOCKED, NO INTRANET APPROVAL; STOP_FOR_ARCHITECT.** User-provided Cursor report, local code not independently reviewed.

- Local commit `3048837aed`; 37/37 app tests PASS, typecheck 0, lint 0. Dev Sales Follow-up triggers currently **disabled** (`bound=false`) after controlled testing; original trigger settings captured in report. Intranet :6080 read-only, no backfill, Docker build, restart, push, or SMS.
- Root causes proven from deployed bundle: generated CoreApiClient cannot query custom `eventLead` and `salesInteraction` (GraphQL missing fields), and Person name is composite `name { firstName }` rather than flat `nameFirstName`. Changed app data access to raw `/graphql` fetch with app token as used by event-registration; explicit phase-tagged errors rethrown, avoiding silent READ_FAILED.
- Ownership invariant: on salesInteraction.updated, distinguish app-generated canonical title from manual name edit using updatedFields, release `titleIsAuto=false` when user changes name to noncanonical text, preserve text; change callAttempt/person name only when auto-owned; no-op/idempotency when unchanged. Reported direct handler+real Dev DB sequence: create auto title, CALL_1→CALL_2 title refresh, person rename refresh, manual edit releases ownership, subsequent CALL_3 preserves manual title, repeated event no-op. **Caveat:** if manual edit exactly matches computed canonical text, it is not distinguishable by this event heuristic; document as residual contract ambiguity, do not claim absolute manual provenance for that edge case.
- **Remaining E2E environment blocker:** triggered jobs run in `twenty-worker-1`, where `SERVER_URL=http://localhost:3002` and localhost:3000 connection refused; `LOGIC_FUNCTION_API_URL` unset. Server has `LOGIC_FUNCTION_API_URL=http://127.0.0.1:3000` and works. Triggered job can appear completed despite transport failure. Fix requires validated worker-reachable API URL and controlled Dev worker restart. **User explicitly approved restart of Dev worker only on 2026-11-18 for CRM-128-R5**; verify isolation first, do not touch intranet worker. No intranet backfill authorization. Verify complete Trigger→Worker→API→DB path before enabling backfill or deployment.
- Dev baseline restored: 175 real interactions, zero auto, 175 manual, zero empty names; isolated test records deleted. Triggers left disabled. Intranet 190 NULL + one manual unchanged. No automatic continuation.


## CRM-128-R5 — limited Dev worker authorization (2026-11-18)

User explicitly approved correcting the Dev worker-reachable LOGIC_FUNCTION_API_URL and restarting **only the isolated Dev worker**, after proving separation from intranet :6080. Verify connectivity before restart; test real Trigger→Worker→API→Database using disposable records; return three sales-followup triggers to disabled and clean test data. No intranet changes, backfill, Docker build, other service restarts, push/merge or SMS. **Approval is scope-limited, not evidence R5 has executed or passed.** STOP_FOR_ARCHITECT.


## CRM-128-R5 — Dev worker transport fixed; app-token E2E still blocked (2026-11-18)

**Status: PARTIAL PASS / E2E BLOCKED / STOP_FOR_ARCHITECT.** Based on user-provided Cursor report, not independently audited. No code commit (HEAD `3048837aed`, clean tree); Dev-only compose config changed.

- Isolation checked: Dev worker network `twenty_default`, DB `db/default`, Redis `redis`; intranet on separate `crm-intranet-net`; intranet service names NXDOMAIN from worker. No :6080 access or restarts.
- Dev compose worker-only settings: `LOGIC_FUNCTION_TYPE=LOCAL`, `LOGIC_FUNCTION_API_URL=http://twenty-server-1:3000`; backup `docker-compose.yml.bak-128r5`. Worker-to-server /healthz and /graphql both HTTP 200 before recreation. Only Dev `twenty-worker-1` recreated with `docker compose up -d --no-deps --force-recreate worker`; server, DB, Redis, intranet untouched.
- Triggered LogicFunctionTriggerJob processed/completed (630ms) and LOCAL executor instantiated, but salesInteraction title still blank. Runner `logic-function-job-runner.service.ts` reportedly swallows nonretryable error without exposing child function logs, returnvalue or failedReason. **Actual app-token function outcome unknown; do not infer success from completed job.**
- Same handler inside same worker with same API URL and **admin token** wrote expected title, so transport and handler work with elevated identity. This does NOT prove app-token permissions cause; hypotheses include field-level read denial or mutation RLS. **Do not use admin token as production workaround** or broaden app privileges blindly.
- Dev isolated test records cleaned; baseline 175 real interactions, 0 auto, 175 manual, 0 empty, triggers disabled (`bound=false`). Intranet read-only, no backfill, build, SMS, push, or other restarts.
- Architect next step: bounded diagnosis using the **same application identity as the triggered execution**, with safe/redacted outcome visibility. Prefer existing authorized execution/logging path; if absent, consider temporary Dev-only diagnostic HTTP route with exact payload, least privilege, and mandatory removal, or a delegated-user event only to compare identities (not substitute for app-token test). Avoid core modifications or broad changes unless necessity demonstrated. No intranet authorization.


## CRM-128-R6 — application token proven; executor/Core failure still opaque (2026-11-18)

**Status: BLOCKED / STOP_FOR_ARCHITECT.** Based on user-provided Cursor report; no independent audit of local code. Local HEAD `c00942ce6e` is version bump only; no behavioral change.

- Job payload has `logicFunctionId, workspaceId, payload`; absent userId/userWorkspaceId means application identity. App access token generated with `generateApplicationAccessToken({workspaceId,applicationId})` using same service. With that identity on Dev, read person (composite name), salesInteraction and eventLead succeeded, createPerson correctly FORBIDDEN, updateSalesInteraction(name,titleIsAuto) succeeded. Deployed handler executed inside same worker with same API URL and app token returned `WRITE_TITLE / TITLE_EMPTY`. **App permissions are not the demonstrated blocker.**
- Actual database-event job (e.g. 50) queued with correct recordId, executor instantiated but no write. A diagnostic build that would write on success/error also wrote nothing, suggesting failure before handler invocation. Actual executor error unavailable: `logic-function-job-runner.service.ts` reportedly returns on nonretryable errors (lines 56–60) without logging or persisting error; job may appear completed. Root cause not yet proven; do not label a specific executor error.
- Temporary HTTP diagnostic route added then removed; installed Sales Follow-up 0.1.6 has zero HTTP routes and zero bound DB triggers. Route payload packaging differs from database event and is not proof of event contract. Dev baseline 175 records, 0 auto, 175 manual, 0 empty, 0 test rows; intranet :6080 unchanged/read-only. No new restart, backfill, Docker build, SMS or push; temporary tokens/scripts removed.
- **Architect decision:** approve only a tiny, reversible Core observability change if review confirms `result.error` is present: log sanitized nonretryable error phase/code before existing return (no payload, PII, tokens or stack); preserve retry classification, job behavior, execution identity, permissions and contracts. If error shape cannot be safely classified, STOP without modification. Re-run isolated Dev E2E after diagnostic visibility; no intranet deployment/backfill or other service restart authorization. Separate code-change approval does not authorize restart. No automatic continuation.


## CRM-128-R7 — Core nonretryable error observability patch (2026-11-18)

**Status: CODE/UNIT TEST PASS (user-reported), LIVE DEV DIAGNOSTIC NOT YET PROVEN; STOP_FOR_ARCHITECT.** Local commit `170dc1aa39df0876aa5b89dc0f4e5302e5761866`, +299/-0 additive changes, 97/97 trigger suites, typecheck and lint PASS; not independently audited or deployed.

- `LogicFunctionExecuteResult.error` exposes errorType/errorMessage/stackTrace; local driver fills errorType/errorMessage on failure. Added structured warning only before existing nonretryable/no-retries return in `logic-function-job-runner.service.ts`, with allowlisted/validated errorType, structured errorCode or redacted fallback, enum status, retry count and logLineCount. No free-form message, stack, payload, token, userId or customer data in warning. Guard prevents warnings for success. Reported no change to retry logic, job status, permissions or executor contract; tests cover redaction, success, retry and exhausted retry.
- Warning evidence is from tests, **not live Dev**: Dev worker still runs old compiled code. Dev sales-followup DB triggers remain disabled, no HTTP diagnostic route. No restart, build, intranet change, backfill, SMS or push. Frontend Dev :3001 Vite process exited after approximately 24h terminal limit; backend :3002 and intranet :6080 healthy; frontend is not required for backend diagnostics.
- Architect: accept patch for limited Dev validation, but do not infer root cause or E2E success. Next requires **separate authorization for deploying/restarting Dev worker** if necessary, after confirming isolated worker, minimal compiled patch and redaction; test with disposable records, capture sanitized error code and prove trigger→worker→handler→DB; disable triggers/cleanup afterward. No intranet deployment or backfill authorization.


## CRM-128-R8 — user-authorized Dev-only diagnostic continuation (2026-11-18)

**Status: AUTHORIZED / NOT YET EXECUTED OR VERIFIED; STOP_FOR_ARCHITECT.** User approved restarting **only the isolated Dev worker** to activate R7's structured warning, diagnose the actual executor failure, fix only a proven narrow cause, and verify the complete Trigger→Worker→API→DB path using disposable Dev records. No R8 execution report or code commit has been supplied as of this update.

- Before any action, confirm the local source commit includes R7 `170dc1aa39df0876aa5b89dc0f4e5302e5761866`, working tree and worker isolation. Deploy the minimum necessary compiled worker code without a full Docker image rebuild. **If activating R7 requires restarting Dev server or other services, STOP and seek separate authorization.** Only Dev worker recreation/restart is authorized.
- Capture only sanitized executor error phase/code. Do not broaden application permissions, substitute admin token, alter retry/execution contracts, or change unrelated Core code. Repair only an independently proven narrow defect; otherwise STOP_FOR_ARCHITECT.
- Require real isolated Dev E2E evidence for create title, callAttempt change, Person rename, manual title preservation and idempotency. A completed job or unit tests alone do not qualify. Remove test data and leave all three sales-followup triggers disabled; check baseline and intranet isolation.
- Intranet :6080 remains read-only: **NO deployment, restart, backfill, real-data modification, Docker full build, SMS, push or merge.** Dev frontend :3001 Vite timeout is unrelated and restart not requested.
- **Repository sync limitation:** R7 code commit was reported as local/unpushed. This GitHub documentation commit does **not** push or synchronize the local source branch, and does not imply remote GitHub contains the R7 code changes. A separate reviewed push/merge decision is required.


## CRM-128-R8 — real Dev trigger E2E PASS (2026-11-18)

**Status: DEV FUNCTIONAL ACCEPTED / INTRANET NOT APPROVED; STOP_FOR_ARCHITECT.** Based on user-supplied Cursor evidence, not independently audited local source. Local code commit `8462cbaaa7711d566b062fbc45b8494f4b2dce34` (reported unpushed); 37/37 app tests PASS, typecheck 0.

- **Proven defect 1:** running worker image's logic-function executor builds API base URL from `SERVER_URL`, not `LOGIC_FUNCTION_API_URL`; worker `SERVER_URL=http://localhost:3002` addressed itself and handler failed `READ_INTERACTION:TRANSPORT`. Dev-worker-only compose corrected `SERVER_URL=http://twenty-server-1:3000` (backup `docker-compose.yml.bak-128r8`). Diagnostic compiled-file patch removed after worker recreation; no diagnostic residue reported.
- **Proven defect 2:** Person update events report `updatedFields: [\"name\",\"updatedBy\"]`; trigger watched `nameFirstName/nameLastName`, so rename event was filtered. Changed `title-on-person-rename.ts` watched fields to `['name']`; app version 0.1.6→0.1.7. No Core, permissions or other service code changes in R8.
- **Real Dev E2E evidence:** create interaction → `تماس اول با R8 آزمون` auto=true; CALL_3 → `تماس سوم با R8 آزمون` auto=true; Person rename → `تماس سوم با سارا رضایی` auto=true; manual title edit → `عنوان دستی R8` auto=false, still preserved after CALL_5; self-trigger/idempotency → updatedAt unchanged after 50s. These were actual Trigger→Worker→API→DB checks, not just job completion.
- **Cleanup/isolation:** Dev baseline 175 interactions, 0 auto/175 manual, 0 empty, zero test rows; three triggers disabled; installed app 0.1.7. Only Dev worker restarted/recreated (twice, user-authorized); Dev server and intranet :6080 not restarted; intranet read-only/healthy. No backfill, Docker full build, SMS or push.
- **Environment debt:** Dev worker image `twentycrm/twenty:latest` differs from Dev server image `twenty-dev/o117`; worker reportedly runs older upstream code and lacks R7-modified LogicFunctionJobRunnerService, so R7 structured logging was not live-tested on this image. Track as separate environment-alignment item, not R8 functional blocker. Do not change images or deploy without separate review.
- **Architect decision:** close CRM-128 Dev functional E2E as PASS. No further speculative diagnostic tasks. Intranet deployment, title backfill (190 NULL + 1 manual in last reported intranet snapshot), production enablement, image alignment and remote code push/merge remain **not authorized** and require separate review. This documentation update does not push the local R8 code.


## CRM-129 — Quotation + universal accounting integration plan (2026-11-18)

**Status: PLAN RECORDED / S0 SOURCE AUDIT TASK READY / NO IMPLEMENTATION APPROVED; STOP_FOR_ARCHITECT.** User requires CRM quotations for both products and services and vendor-neutral accounting connectivity. Architecture and bounded delivery gates are recorded in [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), created at commit `9ed2a8451230cba789b349c8c33bed3653aee624`.

Directly inspected this recovery file and root package.json on the remote release branch. GitHub code search returned no matches for quotation/product/invoice/catalog/price, which does not establish absence; guessed standard-object paths were not found, and local unpushed source cannot be inspected via remote GitHub. **Next task CRM-129-S0 is read-only local source inventory and reuse mapping only**, with exact paths and divergence evidence, followed by STOP_FOR_ARCHITECT. No schema, app installation, implementation, intranet :6080 changes, push, worker restart, migration, or backfill authorized.

## CRM-129 — CURRENT RECOVERY POINTER (2026-11-18, supersedes stale S0-next wording above)

**Canonical current plan:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), updated at GitHub commit `4c2d04c12b7611542ea288139e3e661b70a8c285`. The earlier section saying “S0 task ready” is historical and no longer current.

- S0 source audit completed per Cursor report; BRANCH-ALIGN completed with local merge `8e702032660e4a8462b94e3b7297d4259f9c46dd`, no conflicts/Push; local CRM-126/127/128 commits preserved.
- S1 contract/feasibility reported completed in **local-only** commit `910f497fc84a889eec91cf6f716ed32bc873cfdd`, 48 new files, 114 Vitest passes, 11 PDF checks, no schema/install/intranet deployment/Push. This is **report evidence, not remotely verified source or independently rerun tests**.
- S1 conditional PASS only; unresolved precision, Persian PDF extraction/ZWNJ, storage-backed numbering proof, Asan fixture compatibility, 6-decimal quantities and financial policy.
- **Vendor priority: Asan first, Sepidar second**, both behind a vendor-neutral accounting interface. User supplied `D:\HaniReference\LinqToAsan-API-Guide.pdf`; do not assert guide is in Git. Asan documented product creation and price-only edit; full product-field update unsupported by evidence.
- **NEXT = CRM-129-S1-R1**, narrow contract corrections and Asan mapping fixtures. Local worker must fetch and safely align newer remote docs (including Asan and this status) without rewriting local S1 commit. Compute fresh divergence; no Push.
- **STOP_FOR_ARCHITECT** after R1. S2 not authorized. No database writes, app install, live accounting writes, :6080 changes, service restart, deployment or automatic branch push.

## PREVIOUS CHECKPOINT — CRM-129 S2-R9 PASS / Professional Form & Catalog Picker (2026-11-19; historical)

**Read first:** [CRM-129-S2-R9-PROOF.md](./CRM-129-S2-R9-PROOF.md). Superseded as “latest” by S2-R10 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R8-R1 `d3eeff7a6d`.
- Catalog combobox + draft form; app was `0.1.5`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R8-R1 PASS / Allocation & Rounding Correctness (2026-11-19; historical)

**Read first:** [CRM-129-S2-R8-R1-PROOF.md](./CRM-129-S2-R8-R1-PROOF.md). Superseded as “latest” by S2-R9 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R8 `7084993d02`.
- Capacity-safe discount allocation + independent `roundingExact`; app was `0.1.4`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R8 PASS / Financial Rules & Discounts (2026-11-19; historical)

**Read first:** [CRM-129-S2-R8-PROOF.md](./CRM-129-S2-R8-PROOF.md). Superseded as “latest” by S2-R8-R1 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R7 `f4d1b7228d`.
- Introduced document discount + whole-rial payable; R8-R1 corrected allocation capacity and tax pollution by rounding.

## PREVIOUS CHECKPOINT — CRM-129 S2-R7 PASS / Dev Front UI Acceptance (2026-11-19; historical)

**Read first:** [CRM-129-S2-R7-PROOF.md](./CRM-129-S2-R7-PROOF.md). Superseded as “latest” by S2-R8 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R6 `c83d5bd7c1`.
- Browser UAT PASS for lifecycle + host PDF download; app was `0.1.2`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R6 PASS / browser UI PARTIAL (2026-11-19; historical)

**Read first:** [CRM-129-S2-R6-PROOF.md](./CRM-129-S2-R6-PROOF.md). Superseded as “latest” by S2-R7 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R5 `22b59bfc57`.
- **Lifecycle UI + Persian PDF API** shipped; `:3001` was down that round — browser click path completed in S2-R7.

## PREVIOUS CHECKPOINT — CRM-129 S2-R5 PASS / UI PARTIAL (2026-11-19; historical)

**Read first:** [CRM-129-S2-R5-PROOF.md](./CRM-129-S2-R5-PROOF.md). Superseded as “latest” by S2-R6 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R4 `7c504dab17`.
- **Integrity:** claim-then-fail fixed by atomic domain patch+version UPDATE. Live `S2_R5_INTEGRITY_PASS`.
- **Dev UAT then:** draft/catalog READY; lifecycle/PDF UI completed in S2-R6.

## PREVIOUS CHECKPOINT — CRM-129 S2-R4 PASS (2026-11-19; historical)

**Read first:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md) and [CRM-129-S2-R4-PROOF.md](./CRM-129-S2-R4-PROOF.md). Superseded as “latest” by S2-R6 (via S2-R5).

- **Branch / base:** `feat/crm-129-quotation` from S2-R3 `8161b40019`.
- **S2-R4 result: PASS** — atomic optimistic version claim via Workspace ORM `UPDATE … WHERE id AND version AND status`; concurrent same-version writers reduced to a single winner on isolated Dev; real limited role (object update only) cannot approve/send/cancel/record customer decision; Admin path still can.
- **Proof:** `docs/architecture/CRM-129-S2-R4-PROOF.md`. Live scripts under `packages/twenty-apps/internal/quotation/scripts/dev-exercise-s2-r4*.cjs` plus S2-R3 regression.
- **Isolation:** only Dev `twenty-server-1` `:3002` / DB `default`; intranet `:6080` untouched.
- **Residual (addressed in S2-R5 for quotation updates):** claim could commit before GraphQL write; experiment row cleanup deferred to R5.
- **Historical:** S1-R3 PDF browser ZWNJ remains PARTIAL / not production-accepted; Asan live still unauthorized.

## PREVIOUS CHECKPOINT — CRM-129 S1-R3 PARTIAL (2026-11-19; historical)

**Read first:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), including latest S1-R2/R3 checkpoint (plan update commit `09ddf0d51546317e09ec485f31d14bb34e389e81`). Superseded as “latest” by S2-R4 above for quotation concurrency/security work.

- **Verified remotely:** Architecture documents on `release/record-access-115` still preserve CRM-owned mixed product/service quotations, vendor-neutral accounting adapter, Asan first/Sepidar second, exact-money constraints and production isolation. No evidence in inspected remote docs that these architectural decisions were removed.
- **Not verified remotely (at S1-R3 time):** Cursor local quotation source and reports were unpushed on that checkpoint. S2 work later pushed on `feat/crm-129-quotation`.
- **Reported local timeline:** S1 `910f497fc84a` → S1-R1 `02ef6d7fc730` → S1-R2 `2d024c818459` → S1-R3 `d544cc83dd` (full SHA unknown). Last R3 status **PARTIAL**: generation-time ZWNJ preservation and proper PDF table columns; MuPDF correct; browser/pdf.js copy still drops ZWNJ; 171 tests reported passing.
- **Architect decision:** Accept R3 as PARTIAL; preserve browser-copy limitation as a documented issue, do not automatically replace PDF engine, and do not block all S2 domain work on it. PDF is not fully production accepted.
