# Goal 038 / G0 — Immutable audit ledger A01–A19

**Candidate:** quotation@0.1.88 @ `8dfa4a52f4e19008f7c3bd1e1f12f023f77fc57f`  
**Mode:** BUILD + TEST + DEV APPLY (no product source edits; no live Asan; no Intranet; no screenshots)  
**Executed:** 2026-11-28  
**Rule:** A passing test does not close an incomplete implementation. No unsupported PASS.

Evidence roots: `vitest-asan.log` (69), `vitest-full.log` (797), `jest-quotation.log` (368), `vitest-money-unit.log` (10), `asan-*.test.ts`, `apply-*.log`, `installed-version.json`, `capability-parity-snapshot.json`.

| ID | Package | Acceptance (summary) | Implementation status | Test execution | Evidence | Verdict | Remaining architectural gaps |
|---|---|---|---|---|---|---|---|
| A01 | G0-A | Party parse uses CustomerServiceViewModel (`Code`/`FullName`/…); refuse Code/PersonCode conflict | Source fixed in `asan-http-adapter.parseParty`; fixtures cover documented fields + conflict | Asan HTTP + wire tests PASS | `vitest-asan.log`; `asan-http-adapter.test.ts` guide contract | **PASS_SCOPED** | Live/real-schema malformed-row completeness and G1 sample attestation still open |
| A02 | G0-A | Product stock from `TotalCount` incl. zero; safe integer | `TotalCount` precedence implemented; unsafe IDs refused in write path | Product read + write integrity PASS | `vitest-asan.log` | **PASS_SCOPED** | Full 64-bit/unsafe large-ID matrix beyond Number.MAX_SAFE_INTEGER not closed |
| A03 | G0-A | Health probe: JSON list shape; no redirect follow; 2xx HTML ≠ reachable | Adapter `redirect:'error'` + JSON probe | Health check suite PASS | `asan-http-adapter.test.ts` | **PASS_SCOPED** | Nest probe/LF DNS pinning/TLS policy parity not proven identical (A12) |
| A04 | G0-B | Product create/update: strict result + exact price/identity readback; no success on body 0 | `confirmProductWrite` / refuse on zero/malformed | Write integrity PASS | `asan-http-adapter.test.ts` Asan write integrity | **PASS_SCOPED** | Persistent mapping transactional rollback / stale revision operational matrix incomplete (A15) |
| A05 | G0-B | Customer create: uniqueness preflight; unique assigned readback; refuse empty/fractional/blank | Unique national/mobile readback; empty code refused | Write integrity + response codes PASS | `asan-http-adapter.test.ts`, `asan-mapping.test.ts` | **PASS_SCOPED** | Ambiguous multi-match + blocked second request after uncertainty not fully fixture-proven for all paths |
| A06 | G0-B | Customer update is replacement: preserve all fields incl. blanks/gender/account nature; refuse incomplete | Pre-read OneCustomer merge + post readback | Preserve fields + incomplete refuse PASS | `asan-http-adapter.test.ts` | **PASS_SCOPED** | No vendor CAS; lost-update under concurrent remote edit unproven |
| A07 | G0-B | Three price positions: preserve zeros; never erase unspecified tiers | Load current tiers; explicit replace; `SalesPrice` length bound | Preserve unspecified positions PASS | `asan-http-adapter.test.ts` | **PASS_SCOPED** | Full 10-tier SalesPrice10 observation profile not in RemoteCatalogItem (A16) |
| A08 | G0-C | Discounts once; sealed payable matches wire; no double subtraction | Gross line + separate discount row; `validateAsanDocumentPayable` | Discount/tax mapping + payable mismatch refuse PASS | `asan-mapping.test.ts` | **PASS_SCOPED** | Independent full %/fixed/combined/rounding fixture matrix incomplete; no rounding special row |
| A09 | G0-C | Tax/duty special rows ≠ policy codes; refuse invalid/missing codes | Live Asan skips taxVendorCode fallback; special code checks | Split tax/duty rows + custom codes PASS | `asan-mapping.test.ts`; outbound uses payable gate | **PASS_SCOPED** | Store/warehouse/customer/product preflight before register not fully executable |
| A10 | G0-C | Exact RIAL/TOMAN conversion; UNCONFIRMED refuses | `asan-money-unit.ts` exact bigint conversion | 10/10 money-unit PASS | `vitest-money-unit.log` | **PASS_SCOPED** | Installation unit confirmation requires G1 accountant attestation |
| A11 | G0-A/D | Capabilities: documented/implemented/enabled/verified; Nest↔app parity | Duplicated objects with matching key flags; **no generated parity gate**; declares listPrices/readStock/createInvoice while many routes have no adapter method | Textual snapshot only | `capability-parity-snapshot.json` | **FAIL** (incomplete implementation) | Need versioned single descriptor or generated parity; capability ≠ method coverage; old connection revalidation open |
| A12 | G0-D | Single allowlisted transport; TLS/DNS; no cleartext secrets; credential rotation | Writes gated; HTTPS ok; approved plain HTTP still allowed; redirects blocked at adapter | Transport gate unit PASS | `asan-http-adapter.test.ts` write transport | **FAIL** | Nest/LF DNS pin, token scope, rotation, no-secret logs, identical probe/write transport authority unproven |
| A13 | G0-C/D | No blind replay; durable claim; exact document reconciliation | Live uncertain → `MANUAL_EXPORT_REQUIRED`; no remoteIdempotency; no read-by-id | Outbound/mapping unit coverage in full Vitest | `accounting-outbound.service.ts`; `vitest-full.log` | **FAIL** | Exact proforma readback by id absent; retire/inflight interlock incomplete; RequestNumber idempotency unproven |
| A14 | G0-A | Incomplete/invalid datasets block destructive inference; deterministic version | Incomplete product snapshot refused; hash version markers | Incomplete snapshot refuse PASS | `asan-http-adapter.test.ts` | **PASS_SCOPED** | Soft/hard 20k/100k/64MiB operational proof; incremental change token; active flag sourcing open |
| A15 | G0-B/D | Rollback, stale mapping, deleted mapping, cross-connection isolation | Mock/party services covered in Jest; real-vendor fixture matrix incomplete | Jest quotation 368 PASS incl. party/dispatch | `jest-quotation.log`; prior 084 residual | **FAIL** | Operational rollback/stale/cross-connection/workspace races not closed on real-schema fixtures |
| A16 | G0-A | Versioned neutral profiles (10 tiers, units, warehouse, balances read-only) | RemoteCatalogItem still flattened; party profile limited | Inventory docs exist; profile expansion not implemented | wire contract + capabilities | **FAIL** | Canonical observation profiles incomplete; no new CRM schema assumed |
| A17 | G0-A | Typed reads for mobile/one product/prices/stores/stock | Endpoints inventoried; adapter implements subset (All/Last/national create path; OneProductWithoutSerial for readback) | Inventory 47/17 PASS; method coverage partial | `asan-wire-contract.test.ts`; endpoints | **FAIL** | Mobile lookup, GetStores, GetAllPrice, stock-by-store not executable adapter commands for first rollout |
| A18 | (G3) | Large UI filters/selection 2500+ | Native table accepted 0.1.86; numbered pagination unit PASS | Jest numberedPagination 2 PASS | `jest-numbered-pagination.log`; goal-037/085–086 | **NOT_RUN** (G3) | Server-wide status filters + 2500 browser fixture deferred; not a G0 close |
| A19 | G0-D | Install/upgrade/fresh; permissions; dataset identity; no cross-workspace leak | Existing Dev apply 0.1.88 + idempotent PASS; fresh 084 apply **blocked** by app registration ownership (still shows 0.1.84) | apply-existing/idempotent PASS; apply-fresh-084 FAIL | `apply-*.log`, `installed-version*.json` | **FAIL** | Fresh install requires registration transfer procedure; dataset rebind/identity certification open; permission matrix not re-proven end-to-end |

## Package rollups

| Package | Assessment |
|---|---|
| G0-A | **PARTIAL** — inventory/contracts/fixture subset PASS_SCOPED; A11/A16/A17 incomplete |
| G0-B | **PARTIAL** — create/edit/readback/tier/preserve PASS_SCOPED; A15 operational isolation incomplete |
| G0-C | **PARTIAL** — discount/payable/money-unit PASS_SCOPED; A13 reconciliation/idempotency incomplete |
| G0-D | **PARTIAL** — builds/tests/existing install PASS; A12/A15/A19 open; fresh install FAIL |

**Overall G0:** `SOURCE_AND_TEST_VERIFIED_PARTIAL` — **NOT G0 PASS**. Do not authorize G1.
