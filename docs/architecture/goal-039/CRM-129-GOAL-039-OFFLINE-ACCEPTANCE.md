# CRM-129 / Goal 039 — offline end-to-end quotation and accounting acceptance

## SUPERSEDING ARCHITECT DECISION — broad scope cancelled (2026-11-28)

The user explicitly rejected repeating development/verification of already delivered quotation functionality. Cancel the remaining broad Goal 039 scope. Preserve already completed 091 security verification and any existing raw operational evidence, including failures. Do not run a new comprehensive campaign, redesign, or modify product source on this authority.

User-relayed interim worker report (not yet independently verified on GitHub): 0.1.91 installed in existing Dev, typecheck/builds PASS, Vitest 815 PASS, isolated TLS PASS_SCOPED, PG lock primitives PASS, anonymous refusal PASS. Credential rotation/revocation remains BLOCKED pending authorized Dev administrator. Worker also reported four unresolved checks: B-PDF-PERSIAN-BYTES, B-ACCOUNTING-PREVIEW-MOCK, C-SHARE-COPY, C-CUSTOMER-LINK-CREATE. Do not classify these as product defects or harness false negatives without actual evidence and source/contract review. Preserve raw lifecycle-pdf-share.json and existing logs, redacted. No retries merely to obtain PASS. Record remaining unexecuted checks as NOT_RUN / scope cancelled, not PASS. Stop after safe fixture cleanup and evidence-only commit/push. No new product source or test campaign. No force-push. If remote advanced, reconcile evidence-only changes with this superseding decision.

Goal 038 G1/G2 remain suspended; no live Asan/API/write authorization. Last independently verified runtime remains 0.1.90 until 091 evidence arrives. Goal 023 remains ACTIVE, not a request to reimplement or recertify the existing quotation module. Next scope must be selected only after independent inventory of actual current source, prior accepted requirements and evidence; no new Goal authorized by this document.

The original plan below is archived, NOT executable.

---

Date: 2026-11-28. Parent Goal 023, branch feat/crm-129-quotation.
User directed development to continue because no real Asan API is available. This is authorization to advance the independent CRM workflow, not to connect to a real vendor or accept unresolved financial/security risks.
Candidate quotation@0.1.91 product/source checkpoint 568539924fa468dc3fdd6655f287f7df2fbdd924. Last verified installed Dev 0.1.90. Goal 038 G0 remains SOURCE_AND_RUNTIME_VERIFIED_PARTIAL for 090; 091 source-only until tested. G1/G2 are suspended pending access and separate explicit authorization. Do not relabel partial G0 as PASS.

## Scope and dependency decision

Advance the API-independent part of G3 / Goal 023 WS5–WS7 (SC8–SC10), retaining C1–C7 and all previously accepted native Twenty UI. Goal 039 is not production go-live. One continuous verification Goal, not a repeated entire vendor certification. Preserve immutable evidence 090, same app identity and existing fresh installation. No new workspace unless explicitly authorized.

| Residual | Disposition |
|---|---|
| A12 | Test 091 authorization/cache/rotation fail-closed and isolated TLS fixture now; actual gateway credentials, deployment topology and vendor endpoint proof resume G1. |
| A13 | Mock and local fixture sealed money, claim, uncertain-no-replay proof now; actual monetary readback and authorized ambiguous resolution remain G2 prerequisites; never mark fiscal success from an acknowledgement. |
| A15 | Independent full lifecycle race, rollback and scope checks now wherever executable; any defect in active Mock/CRM path blocks offline acceptance; real vendor mutation remains disabled until transactional ownership certified. |
| A16 | Catalog observation long-term persistence and restricted financial reads remain explicitly open architect source work before real import. Do not introduce speculative schema or claim complete profiles. |
| A17 | Additional sale/purchase/receipt/payment/balance reports deferred, outside quotation MVP. Existing typed reads and truthful capability declarations preserved. |
| A19 | Fresh install subgate accepted from 090; local rebind refusal and workspace isolation tests now; vendor company/dataset identity beyond URL requires actual G1 evidence before mapping/import. |
| A18/A20 | Execute independent native table scale/filters and complete quotation/communication workflow in Goal 039. |

## A — Final 091 security gate
- Verify exact product source and branch; no uncommitted product modifications. Re-read checkpoint 091 and security notice. Revoke/rotate exposed disposable Dev fixture credentials and associated API keys/sessions using authorized Dev administration only; confirm no production/shared credential was used. Do not print values, rewrite history, reset data or alter accepted workspaces. If unable, precise BLOCKED.
- Typecheck, full quotation Vitest, relevant Nest Jest, production app/server/worker/front/shared/UI/SDK builds; focused read authorization generation, both item and party snapshot no-approval refusal, new namespace on rotation, no live stale fallback, no network without binding; local network-isolated TLS fixture with trusted fixture cert, SNI/pinned socket, bad-cert/redirect/timeout/size rejection and secret rotation. Never weaken production destination policy or contact real vendor.
- Deploy 0.1.91 only to existing Dev after green mandatory build/security tests. Verify server/app version, idempotent apply, Asan read binding absent, live writes and import disabled. Preserve 084 and 090 fresh proof. No redoing successful private installation unless the new manifest actually requires targeted upgrade verification.

## B — Operational CRM and Mock integration
Use isolated synthetic records and existing authorized Dev workspace. Restore test-only configuration and clean only identified synthetic fixtures; never delete accepted records.
- Settings: use existing tax/currency/rounding authority, distinct CRM reference codes vs destination mapping; locked code after first successful nonempty draft snapshot; independent line tax/duty; default currency IRR; non-IRR/multi-currency activation refused. Mock and Asan same native shell, honest unverified/disabled states. No new route or redesign.
- Accounting: actual native tables, item/customer import with Mock only, search, paging, 2500+ synthetic rows where possible, selection across pages, valid/unmapped/stale/deleted/cross-connection identity, default selection consistency, retired connection refuses new work/history preserved, rollback and full shared/exclusive dispatch/save/retire concurrency with real PostgreSQL. Check item-import ownership; no partial import silently presented as success. Use local authorized fixtures only.
- Complete quotation workflow from Person and Company via canonical create action: create draft, add catalog lines, quantities/price/defaults, percent and fixed line/document discounts including combined case, independent tax/duty, rounding and payable IRR, save/edit version conflict, submit/approve/send/customer decision following actual lifecycle. Validate server seal, displayed totals and Persian PDF against independent arithmetic, immutable approved revision, permission boundaries, no unsupported lifecycle state transition.
- Accounting document preview from real approved quotation, same workspace default, correct item/customer mappings and financial snapshot. Mock export only if safely isolated and explicitly test-scoped, flags restored byte-for-byte; duplicate/uncertain refusal; never claim actual Asan submission. No actual vendor credentials or writes.
- Communication: existing seven-channel copy/share text and revocable secure customer link, history, correct recipient/quotation/version, expired/revoked/draft token denial and honest failure if provider unavailable. Do not send real messages, activate external providers or invent delivery success. Test isolated provider fixtures where available.
- Persian RTL existing native forms/table, mobile and desktop supported viewport tests with real Playwright DOM evidence, no screenshots. Verify no extra jargon, unwanted redesign, duplicated form or unauthorized code entry. User visual acceptance remains user-only.

## C — Acceptance and handoff
Record each check with immutable ID, command/exit result, code SHA, fixture isolation, direct HTTP/DB/browser DOM evidence where required. Reuse prior verified evidence for unchanged subgates explicitly; don't inflate scope. Continue independent tests after failures; if build fails don't deploy. No product source changes by Cursor (architect owns repairs). No hotpatch, bypass, destructive reset, Intranet :6080, screenshots, live Asan or actual outbound message. Commit and push redacted evidence under docs/architecture/goal-039/verification-091/ with final report, ledger, exact SHA, blocker and user UAT checklist. Do not commit passwords/token/session artifacts. STOP_FOR_ARCHITECT_AND_USER_UAT. Goal 023 still ACTIVE until architect and user approve independent scope. Real accounting release remains gated on Goal 038 G1/G2 and unresolved source gates.
