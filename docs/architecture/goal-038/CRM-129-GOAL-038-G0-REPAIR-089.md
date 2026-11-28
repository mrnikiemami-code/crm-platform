# Goal 038 — architect repair checkpoint 089

Status: SOURCE_PARTIAL / BUILD_AND_RUNTIME_NOT_RUN — NOT G0 PASS.
Branch: feat/crm-129-quotation. Candidate quotation@0.1.89. Last runtime evidence is 0.1.88, source 8dfa4a52f4e19008f7c3bd1e1f12f023f77fc57f, evidence 694d383dd4ff75bceb1fb54a928481f9f6f83461. Do not transfer those test results to this candidate.

## Direct source changes
- f3a171701bd2e2f53e7aa469f9a5169e7317a2c1 — HTTPS-only Asan requests, reject unsafe URL components and cleartext approval, canonical JSON hashing; focused tests.
- d15c17875397a622e5bf08931cd29eeba84af35f — Nest health probe verifies bounded Products JSON, pinned DNS address/family and HTTPS; focused tests.
- b1fecd3126f53a7e723bac0f7a4310058faa739b — typed item/mobile/prices/stores/stock-by-store reads and optional canonical catalog observations; exact long strings and zero positions; focused tests.
- f1349585591fa896a9d7796da377e84e8284f118 — remove unsupported Asan createInvoice/readDocuments flags in both contracts, preserve Mock, add actual Nest/app capability parity test.
- 78390c76ac1a983558e4304f96cb48703956a9ef — workspace lifecycle shared/exclusive advisory lock, refuse changing bound connection destination/confirmed money unit, stale probe guard; focused tests.
- 74c5911516bca0b153b748d27614136e14da837b — remove ambient vendor fetch fallback; require an explicitly injected approved transport. Persian error and fail-closed test. This intentionally prevents actual Asan requests by the ordinary application until the approved transport is wired; NOT an A12 closure.
- Checkpoint commit: package version 0.1.89 and recovery documents.

## Open acceptance gates (not certified)
| ID | Source progress | Remaining |
|---|---|---|
| A11 | Contract flags corrected and parity test added | Separate documented/implemented/enabled/verified, old stored contract revalidation and runtime proof |
| A12 | HTTPS and response validation; default live application transport blocked | Single approved execution transport, Nest/LF DNS pin and credential scope/rotation, timeout/response parity; injected fixture only until approved |
| A13 | Lifecycle interlock strengthened | Exact document readback/reconciliation and durable idempotency/uncertainty recovery; recent document list is not an exact by-ID API; do not infer vendor monetary semantics |
| A15 | Workspace shared/exclusive lifecycle lock and stale guards | Actual PostgreSQL rollback and concurrent dispatch/retire/save proof, cross-connection links, transaction pool behavior |
| A16 | Typed catalog observations incl price positions, unit and tax code | Full canonical customer/party profile, safe persistence and restricted balances |
| A17 | Typed initial vendor reads implemented | Dispatch integration and actual schema fixture tests; no live vendor verification |
| A19 | Bound connection destination/confirmed money-unit change refused | Independent vendor dataset identity/rebind, supported fresh install and workspace isolation proof |

Previously scoped A01–A10/A14 acceptance is not expanded. A18/A20 remain G3. Fresh install attempt 088 targeted a workspace already holding 0.1.84 and failed with app registration owned by another workspace; no fresh-install PASS. Do not change universal identifier, transfer app ownership, uninstall or overwrite the accepted workspace merely to obtain green output. Verify supported install in an authorized isolated environment.

## Next executable verification
Use the exact checkpoint SHA. Full TypeCheck, relevant Vitest/Jest, builds and isolated HTTPS HTTP fixtures. Specifically verify no default network call, invalid/cleartext URLs, non-JSON/oversized probes, typed reads and zero/long values, runtime capability parity, and actual PostgreSQL lifecycle lock behavior. Preserve 084/086 and all 088 tests, including expected stricter transport refusals; report any regression rather than weakening tests. Existing Dev install only after builds pass; fresh install only via supported non-destructive method. Push evidence with exact code SHA, commands, raw outcomes and A01–A19 ledger. No Intranet changes, no screenshots, no actual Asan connection/writes, no outbound activation, no permission bypass. Architect retains responsibility for unfinished source gates; do not start G1.
