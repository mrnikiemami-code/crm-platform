# Goal 038 / G0 repair 090 — Immutable audit ledger A01–A19

**Candidate:** quotation@0.1.90 @ `24d78d521a16b36c44067ac249619c00e56a200e`  
**Mode:** BUILD + TEST + DEV APPLY + private package fresh install (no product source edits; no live Asan; no Intranet; no screenshots)  
**Executed:** 2026-11-28  
**Rule:** A passing test does not close an incomplete implementation.

| ID | Package | Acceptance | Implementation | Test execution | Evidence | Verdict | Remaining gaps |
|---|---|---|---|---|---|---|---|
| A01 | G0-A | Party parse Code/FullName; refuse conflicts | Source present | Asan HTTP + wire PASS | `vitest-asan.log` (84) | **PASS_SCOPED** | Live G1 sample attestation open |
| A02 | G0-A | TotalCount / safe integer | Source present | Product read/write PASS | `vitest-asan.log` | **PASS_SCOPED** | Full 64-bit matrix beyond safe integer open |
| A03 | G0-A | Probe JSON; no redirect; HTML≠reachable | Probe via approved transport path | Health + transport PASS | `asan-http-adapter.test.ts`, `asan-approved-transport.test.ts` | **PASS_SCOPED** | Real isolated TLS/cert fixture beyond unit mocks open (A12) |
| A04 | G0-B | Product create/update + exact readback | Preflight + confirmProductWrite | Write integrity PASS | `vitest-asan.log` | **PASS_SCOPED** | Item-import transactional ownership audit residual |
| A05 | G0-B | Customer create uniqueness + readback | Unique national/mobile; refuse empty | Write integrity PASS | `vitest-asan.log` | **PASS_SCOPED** | Ambiguous multi-match operational matrix residual |
| A06 | G0-B | Replacement update preserves fields | Pre-read merge + post readback | Preserve/incomplete PASS | `vitest-asan.log` | **PASS_SCOPED** | No vendor CAS |
| A07 | G0-B | Tier positions incl. zero | Preserve unspecified tiers | PASS | `vitest-asan.log` | **PASS_SCOPED** | SalesPrice10 full observation persistence open (A16) |
| A08 | G0-C | Discount once; sealed payable | validateAsanDocumentPayable | Mapping + money PASS | `vitest-full.log`, `vitest-money-unit.log` | **PASS_SCOPED** | Full %/fixed/combined/rounding fixture matrix residual |
| A09 | G0-C | Tax/duty special rows ≠ policy | Live Asan skips policy fallback | Mapping PASS | `vitest-full.log` | **PASS_SCOPED** | Store/warehouse preflight residual |
| A10 | G0-C | Exact RIAL/TOMAN; UNCONFIRMED refuses | asan-money-unit | **10 PASS** | `vitest-money-unit.log` | **PASS_SCOPED** | Installation unit confirmation = G1 |
| A11 | G0-A/D | Nest↔app capability parity + version | Actual Nest transpile compare + createInvoice false | Wire parity tests PASS | `asan-wire-contract.test.ts` in `vitest-asan.log` | **PASS_SCOPED** | Documented inventory ≠ verified live capability; existing-record recheck operator proof open |
| A12 | G0-D | Single private LF path; pinned HTTPS/IPv4; allowlist | asan-approved-transport + Nest probe via LF | Unit + probe Jest PASS | `asan-approved-transport.test.ts`, `jest-connection-locks.log` | **PASS_SCOPED** | Real TLS/DNS/socket identity fixture + secret rotation + old-config refusal operational proof open; LAN/IPv6 unsupported by design |
| A13 | G0-C/D | Durable claims; no blind replay; seal hash | Deterministic op id, ledger, MANUAL_EXPORT_REQUIRED | Outbound/plan Vitest + Jest PASS | `vitest-full.log`, `jest-quotation.log` | **PASS_SCOPED** | Independent fiscal readback / authorized ambiguous resolution not certified; recent-N ≠ nonexistence |
| A14 | G0-A | Incomplete datasets refuse destructive inference | Incomplete snapshot refused; bounded cancel | PASS | `vitest-asan.log` | **PASS_SCOPED** | Soft/hard 20k/100k operational scale open |
| A15 | G0-B/D | PG shared/exclusive lifecycle locks | Connection lock util + real PG harness | WS2 PG **4 PASS**; connection lock harness **PASS**; Jest authority/dispatch **48 PASS** | `jest-pg-locks.log`, `pg-connection-locks.json`, `jest-connection-locks.log` | **PASS_SCOPED** | Full save/retire/dispatch timeout/pool race matrix + item-import ownership residual |
| A16 | G0-A | Source-owned observations; no restricted balances | Party JSON + product observation fields | Covered in Asan/app tests | `vitest-full.log` | **PASS_SCOPED** | Long-term catalog observation persistence + restricted financial read permissions open |
| A17 | G0-A | Typed mobile/price/store/stock/proforma reads | Adapter methods present; createInvoice false | Parity + Asan suite PASS | `asan-wire-contract.test.ts` | **PASS_SCOPED** | Broader report inventory still docs-only; operator read-only scope proof open |
| A18 | G3 | Large UI filters 2500+ | Native table accepted 0.1.86 | numberedPagination **2 PASS** | `jest-numbered-pagination.log` | **NOT_RUN** (G3) | Deferred |
| A19 | G0-D | Existing + genuine fresh private install | Existing apply+idempotent; `app:publish --private` + `app:install` on isolated WS | Existing **0.1.90**; fresh **0.1.90**; 084 preserved **0.1.84** | `apply-*.log`, `app-publish-private.log`, `app-install-fresh.log`, `installed-version*.json`, `preserved-084-version.json` | **PASS_SCOPED** | Independent vendor dataset identity (beyond URL) and rebind refusal operator proof open; enterprise workspace-creation quota hit during extra WS attempts |

## Package rollups

| Package | Assessment |
|---|---|
| G0-A | **PASS_SCOPED** — inventory/parity/typed reads/field integrity exercised; live verification residual |
| G0-B | **PASS_SCOPED** — create/edit/tiers/identity fixtures PASS; operational residual with A15 |
| G0-C | **PASS_SCOPED** — seals/payable/claims unit PASS; fiscal readback residual A13 |
| G0-D | **PASS_SCOPED** — builds/tests/PG locks/existing+fresh private install PASS; TLS rotation residual A12 |

**Overall G0:** `SOURCE_AND_RUNTIME_VERIFIED_PARTIAL` — **NOT unconditional G0 PASS** (architect must accept residuals before G1). No live Asan. G1/G2 not authorized.
