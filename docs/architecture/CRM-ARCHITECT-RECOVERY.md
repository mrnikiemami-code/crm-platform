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
