# CRM — Canonical Architect Recovery (read first)

**Updated:** 2026-11-16
**Repository:** mrnikiemami-code/crm-platform
**Authoritative working branch:** `release/record-access-115`
**Historical detailed record:** [CRM-RECORD-ACCESS-RECOVERY.md](https://github.com/mrnikiemami-code/crm-platform/blob/docs/record-access-architecture-recovery-098-102/docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md), branch `docs/record-access-architecture-recovery-098-102`. The historical file has stale early headers: read its **latest appended checkpoint**.
**Scope:** CRM intranet on port 6080. Dev port 3002 is not production. Never silently substitute.

## First actions in a new chat
1. Fetch **this file from the working release branch**, then fetch the detailed historical file on the docs branch. Confirm actual remote HEAD and any newer reports before acting.
2. Distinguish verified GitHub state, user-provided Cursor reports, and live operational evidence. Do not assume code pushed = deployed.
3. Work in short approval-gated tasks, no screenshot/browser loops, no automatic worker/container restart, no unapproved production writes, app reinstall, restore or deploy. Stop at `STOP_FOR_ARCHITECT`.

## Current source and deployment
- Independent GitHub compare: `4995e67c486dbab3ad969493526c3164ec5fd53f` → `53db32b3b8`, 2 commits, ahead 2 / behind 0; 16 SDK/server application packaging/logic-layer files. No direct Person/RLS/collaborator file changes in that diff. Cursor reports release HEAD `53db32b3b8` clean and pushed.
- CRM-120 Event Registration `0.1.13` and CRM-121 Communication `0.1.74` deployed; Record Access `0.2.4`. CRM-122 **NOT durably closed**.
- Production Communication currently runs with manually repaired `/tmp` dependency layer `deps/33f3154e3015f2c34379f3c3407fc931`. **Restart/recreate can erase it and break functions.** Production healthz 200 reported; do not touch/restart.
- Prior rollback image `crm-intranet/twenty:c4d3efd8` digest `sha256:ae6a9e54c576f62fff1c1a2b4a380da750dda432ecaca2feac3b5b92529f362a`; verified isolated restore of backup `D:\CrmDeployment\migration\pre122r1-intranet-20261116-152107.dump` (reported SHA256 prefix 98211C83, suffix 6E904). Recheck before production deployment.

## Root cause and code fix
- `npm pack` ignores root `yarn.lock`; installer previously ignored nested lockfile, DB stored checksum but `yarnLockFileId=NULL`, fallback wrote 84-byte stub, dependency layer always ran Yarn and failed on unreachable registry.
- **Checksum did not change across 0.1.72 → 0.1.74**; reject old changed-checksum hypothesis.
- Pushed source fix at `53db32b3b8` ships `dependencies/yarn.lock`, checks md5 against manifest, stores lockfile, fails loudly when missing, resolves actual runtime externals, avoids installing esbuild-inlined/dead `@sniptt/guards` for these two apps, and tightens layer readiness.
- Cursor R1 tests: tarballs, offline cold start, container recreation at layer granularity, non-sending `CALLER_NOT_A_USER`, Event Registration prepare, SDK/server tests PASS. Full isolated app publish/install **NOT RUN**. Genuine external deps still require a registry or offline mirror.

## Current blocker — CRM-COMMUNICATION-RUNTIME-123A-R2
- New image `crm-intranet/twenty:53db32b3` **DOES NOT EXIST**. No image ID/digest; no production changes.
- Docker Desktop VM cannot reach registry; `registry.npmjs.org` resolved to `127.153.0.107` and ECONNREFUSED, while Windows host reportedly reaches it.
- Dockerfile line 71 invokes `npx nx run twenty-front:lingui:extract` unconditionally, before prebuilt front shortcut line 76. `packages/twenty-front/project.json` has `dependsOn: ["^build"]` and SDK `packages/twenty-sdk/package.json` build script is `npx rimraf dist && npx vite build` (independently read from GitHub). Front dependency stage lacks rimraf; npx fetch fails. Server build previously passed. `--network=host` on Windows Docker Desktop did not fix egress and invalidated cached layers. Prebuilding frontend alone **does not** skip Lingui.
- **Architect preference:** restore Docker VM registry egress in a bounded, non-disruptive manner, retaining reproducible locked build; obtain explicit permission before changing Docker host/network settings. Do not add arbitrary dependency, skip translation generation, mutate Dockerfile to bypass gates, change lockfile or prune caches without reviewed architectural proof.
- When image exists and isolated verification is acceptable, seek **separate explicit production approval** for image rollout/restart and reinstall in mandatory order: new server image → rebuild/reinstall Event Registration → rebuild/reinstall Communication. Old app tarballs have missing lockfile and fail-loud under new installer. Verify permissions, finance, offline/cold-start persistence and rollback before closing CRM-122.

## Next feature after durable runtime closure
**CRM-123 multi-collaborator access**: Person.assignee remains sole owner; manager grants multiple Person collaborators, propagating authorized access to EventLead, EventRegistration, RegistrationPayment, SalesInteraction without duplicating grants; finance default deny. Current RLS AND-composition means collaborator role cannot simply OR its way past owner-only predicate. First approved slice: `personCollaborator` metadata custom object, Person/WorkspaceMember relations, unique pair, active/revoke/reactivate, manager-only writes, isolated tests; **no RLS widening in first slice**. Further server-side security and child-object access require separate architecture review.

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
