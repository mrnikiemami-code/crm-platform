# CRM-129 / Goal 037 — Architect recovery 081

**Status:** SOURCE IMPLEMENTED; runtime verification pending. Debt CRM-129-ARCH-DEBT-001 and Goal 023 remain OPEN.
**Previous candidate:** quotation@0.1.80, adaca7705c5d507c16e5a49cb96ae6be65e86bdc.

## Actual previous result
User-provided Cursor report: image deployed, server/worker identical, Apply Synced, metadata readable, Person/Company app update grants present, 100-row preview 50 LINK_SUGGESTED / 50 NEEDS_CRM_RECORD, direct user JWT smoke passed, limited user denied and outbound disabled. All delegated LF party writes FORBIDDEN, 0 created, 0 links. Vitest source guard cwd ENOENT. Evidence path verification-080 not accessible in remote GitHub; exact JWT/GraphQL trace is therefore unverified. Source contradicts the blanket claim that every application JWT becomes an application auth context: JwtAuthStrategy hydrates a delegated user's membership, and WorkspaceAuthContextMiddleware selects user context when complete. Do not weaken guard or infer that JWT type alone proves authority.

## Architecture decision and source changes
- Keep one public Nest quotation actions endpoint and existing adapter registry/identity resolver. No additional public route, no legacy /s, no generic query proxy.
- Private LF prepare-parties reads the vendor and CRM identity/mapping data and returns a bounded typed plan; no customer or mapping writes and no user credential passed for this planner. Nest discards caller-supplied plan fields and uses only the fixed installed LF result.
- AccountingPartyApplyService receives the original authenticated user context, verifies settings authority and installed quotation app, constrains the operation to the intersection of the user's role and app role. Native CommonFindOne/CreateOne/UpdateOne query runners keep core field/record permissions and query hooks, no bypass. The previous guard remains fail-closed for app-only, API key, unrelated fields, bulk/direct destructive writes.
- Plan validation requires exact requested rows, permitted fields, deterministic IDs, stable link identity and no contradictory selection. A customer and its mapping are stored in one per-row PostgreSQL transaction, with scoped advisory locks, existing mapping recheck, CRM updatedAt recheck and confirmed returned IDs. A failed mapping rolls back customer write; counts are incremented only after transaction commit. Sanitized refusal includes stage. Stale plan requires refresh/retry.
- Unit harness uses dependency injection only, not an alternate production write path. Source guard resolves src from import.meta.url instead of cwd.
- No schema migration, external provider write, outbound switch change, Intranet deployment, or global authentication-policy modification.

## Single Cursor verification goal (0.1.81)
Build and deploy exact candidate source (the SHA provided by architect) to Dev only; verify app sync, matching clean server/worker images, TypeCheck, all Vitest and quotation Jest, new native apply tests and prior suites. Run guard test from package and repository roots. No product edits/hot patches/permission bypasses or skipped tests.

1. Verify authorized real Person and Company creation AND existing updates through /rest/quotation/actions accounting-import-apply-parties; native runner evidence, user/app-role intersection, planner read only, no delegated LF customer writes.
2. Verify 100-row PARTY_UAT on isolated Dev connection/workspace, seed 50 existing unambiguous customers (30 persons,20 companies), expect 50 new creates and 100 links, 0 refused for valid input. Include sparse identities, economic ID, mobile and ledger codes. Repeat: no additional records; verify fields and no overwrites of absent values.
3. Verify mapping failure rollback (DB evidence), stale customer and mapping plan rejection, same-source concurrent create/update, repeated import, duplicate/conflicting identity, same vendor code in different connections, limited user/app-only/API key denial, unrelated-field/nested/bulk/deletion denial, cross-workspace isolation. Confirm no source plan accepted from browser.
4. Full prior accounting and quotation regression including catalog price, queue revision, PDF and all previous blocked cases. Outbound disabled, live writes 0, Intranet :6080 untouched.
5. If failing, report exact sanitized native refusal stage/code, test name/stack and row counts; do not classify a JWT as app-only merely from its token type. Commit evidence only under docs/architecture/goal-037/verification-081/. STOP_FOR_ARCHITECT after full executable matrix. No closure until architect and user UAT.


## 0.1.81 operational result — 2026-11-27

FAIL_WITH_PRECISE_EVIDENCE (reported by worker): image and app sync successful, Vitest 781 and Jest 362; authorized native writes fail in CUSTOMER_CREATE and CUSTOMER_UPDATE; zero customers or links. The reported evidence commit f776c6a576 was not readable from the remote at architect inspection. Source-proven common defect: wildcard actor hooks run before the object-specific accounting guard, which rejects both generated actor fields. Superseded by [recovery 082](CRM-129-ACCOUNTING-PARTY-RECOVERY-082.md).
