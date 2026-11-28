# Goal 038 — architect repair and verification checkpoint 090

Status: SOURCE_AND_RUNTIME_VERIFIED_PARTIAL — NOT unconditional G0 PASS.
Branch: feat/crm-129-quotation. Candidate quotation@0.1.90 @ `24d78d521a16b36c44067ac249619c00e56a200e`. Runtime evidence: [verification-090](verification-090/). Existing Dev and fresh private install both report **0.1.90**. Residuals remain in A12/A13/A15/A16/A17/A19. No actual Asan connection, CRM live import, accounting write, Intranet change or outbound flag activation was performed.

## Source commits after checkpoint 089

- a08014383135c20e8160ffb1b26565aeaeb61170 — exact workspace connection/base URL/public IPv4 binding, pinned HTTPS transport without DNS re-resolution, fixed allowed read routes, scoped token and default no network.
- 19ea59a8f91f35a55e1924aef2389886479b2e01 — read-only adapter gate before operation claims, sealed revision identity/hash checks, bounded paged ledger, oversized response cancellation.
- 2733adff79d09f8fbaaf557b20b25cf40a24c456 — typed recent-proforma report; deterministic operation marker; preserve acknowledged document number, refuse fiscal success/replay pending actual reconciliation.
- bd5a5a6b0e04ed4bf676372ea0b9856e4e9a5938 — Nest health executes through the same fixed private LF/adapter transport; no independent direct socket or public health-dispatch endpoint; mock stays in memory.
- f955b06c0754d118a6d18d0331bf50ea8bcb2d91 — source-owned customer profile observations, restricted balances excluded, real CRM imports blocked, read-only previews and complete ledger identity.
- cd10ff9c82d7dcc26fe03ea3dc2a564e8bddea51 — product create preflight, exact long read identity and supplied customer field readback.
- 5bb5c92db155c8d11ba2173e2e3c2407cd6e2953 — exact live persistence receipts for every operation claim/finalization, entity-scoped history scans and Asan-owned price tier read.
- 940f00c9b69f9893b3b9829548bae981a118c818 — Asan contract version 2026-11-2; old live records need re-save/recheck; bound remote user and mock dataset profile protected.
- 7b59291a6a89bc0f91361c7aa432754d34543ca4 — stale contract regression coverage; legacy approval is not transport-security evidence.
- 17dec8ddfcec68e98cbbfb9a70c72de8bfc0c6b3 — product source observation adds hierarchy, size, serials, price 3/4, representative percentage and carton count; restricted buy costs excluded.
- Checkpoint commit — version 0.1.90, recovery and executable verification contract.

## Remaining gate ledger (source status, not test PASS)

| ID | Implemented | Remaining |
|---|---|---|
| A11 | Actual Asan/Nest capability parity test, new Asan version, explicit read-only deployment gate | Run actual parity/build and existing-record recheck. Documented inventory still not equivalent to executable or verified capability. |
| A12 | Single private LF network path for health/import/report; exact approved connection, URL, public IPv4, TLS verification, no redirect, explicit GET allowlist, bounded response | Real isolated TLS fixture including DNS/socket identity, auth/secret rotation and old configuration refusal. Public IPv4 HTTPS gateway is an intentional limited rollout design; private LAN/IPv6 not supported by this candidate. Confirm operator-controlled variable permissions and actual deployment topology before G1. |
| A13 | Deterministic operation ID, strict persistence receipt, complete ledger, seal hash and revision identity, exact reported number/customer/marker observation, preserved candidate and no blind replay | Full independently verified fiscal readback and authorized resolution of ambiguous operations not yet implemented/certified. Recent-N absence cannot prove nonexistence; report price/discount semantics need G2 controlled observation. Do not enable actual writes. |
| A15 | Shared/exclusive lifecycle interlock, bound connection history guard, exact write receipts | Real PostgreSQL concurrent save/retire/dispatch, rollback, timeout/pool behavior, isolation and existing import regression. Item import transactional ownership remains to be audited. |
| A16 | Typed source catalog and party observations, source-owned party JSON persistence, long/zero values, no exposure of restricted financial balances/buy cost | Catalog long-term observation persistence and restricted financial read contract/permissions remain open; no invented CRM fields or unapproved schema. |
| A17 | Explicit typed item, mobile, price, store, stock and recent-proforma reads | More documented report types remain inventory only; typed fixture execution, runtime integration and read-only operator scope proof remain. |
| A19 | Immutable binding of existing mapped connection to destination/remote user/confirmed money unit/mock dataset profile; stale adapter version guard; supported installation flow identified from source | Genuine package installation into fresh isolated workspace; proof of independent vendor dataset identity (not merely URL), no cross-workspace leakage or overwrite of accepted baseline. |

A01–A10/A14 scoped 088 evidence is historical, not transferable. A18/A20 remain G3. Do not declare G0 PASS while source gaps or failed/not-run mandatory tests remain. G1/G2 not authorized. Goal 023 ACTIVE.

## Correct fresh installation proof (A19)

The 088 log shows development sync rejected registration ownership; dev-crm129-084 was also an existing 0.1.84 workspace, not fresh. This is not proof that a packaged install fails. Source evidence:
- packages/twenty-server/src/engine/core-modules/application/application-registration/application-registration.service.ts rejects development of an application registered to another workspace.
- packages/twenty-server/src/engine/core-modules/application/application-install/application-install.service.ts skips LOCAL source installation (CLI watcher handles local apps), resolves a deployed package and applies it per workspace.
- packages/twenty-sdk/src/cli/commands/app/index.ts exposes app:publish --private -r <owner-remote> and app:install -r <target-remote>; operations/deploy.ts and install.ts use tarball upload and installation by unchanged universalIdentifier.

Only inside an authorized isolated Dev registration/instance: confirm SDK CLI/server versions and actual remotes; build tarball from exact candidate; verify ownership, target truly empty, no auto-upgrade or changes to accepted workspaces. Use the supported private package publication (never npm) from its existing authorized owner and package installation into the separate fresh workspace. If safe isolation or required authorization is missing, record BLOCKED rather than change UUID, transfer ownership, uninstall an accepted version, bypass ACL, or force install. Verify same application universalIdentifier, version, independent workspace data, default settings and flags, install job status and repeat/upgrade behavior. Preserve the registration and existing accepted 084/086 environments.

## One comprehensive Cursor verification, source edits forbidden

Pull the exact checkpoint HEAD from the named branch and confirm clean scoped source and version. Build and typecheck before any application apply. Execute all G0-A/B/C/D verification, including every runnable gate in audit 087 and earlier 088/089 ledgers, plus:
- real-schema isolated HTTP/TLS fixtures; zero network with missing/mismatched binding, pinned approved HTTPS origin and certificate, refusal of private addresses/redirect/mutating GET and any live write, no secret leakage, bounded cancellation; health via same private dispatch as reads;
- all exact source observation fields, long ID strings, reject unsafe numeric JSON, no balances/buy-cost leak, complete create preflight/readback and unchanged prior price tiers;
- full Nest/app capability parity and stale contract re-save/recheck, actual typed reads, malformed/duplicate rows and count boundaries;
- sealed revision mismatch/hash, actual ledger claims/readback, paginated/cursor/duplicate cases, document number acknowledgement vs report identity vs fiscal proof, no duplicate write, no false success, no replay of uncertain operations;
- real PostgreSQL shared/exclusive locks and lifecycle races, rollback/permissions/cross-workspace/connection isolation, existing Mock regression, valid/invalid identity, rebind refusal;
- TypeCheck, complete quotation Vitest/Jest, relevant server/front/worker/shared/UI/SDK production builds, existing Dev installation/idempotent reapply and safe fresh package installation as above.
- No source modifications; fixtures and evidence only. No actual Asan, no real external credentials, no live CRM import/accounting write, no outbound enablement, no Intranet, no screenshots, no destructive install or permission bypass. Record actual PASS/FAIL/BLOCKED/NOT_RUN for every gate with command, exit code, SHA, fixture scope and logs. Push evidence to branch. STOP_FOR_ARCHITECT.

The local bridge list_projects still failed internally; GitHub combined statuses for the inspected source head were empty. No new build/runtime evidence exists. Source fixes remain architect-owned. Do not present the candidate as deployed or accepted.
