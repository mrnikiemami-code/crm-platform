# TASK — CRM-129-GOAL-036-R1-ACCOUNTING-CATALOG-AND-CAPABILITY-INTEGRITY

**Priority:** P0 correctness / security
**Parent:** CRM-129-GOAL-023; repairs Goal 036 Package B (WS5), verifies Package C (WS6), completes relevant Package E.
**Repository:** `D:\CrmSource\twenty`
**Branch:** `feat/crm-129-quotation`
**Known remote checkpoint when issued:** `76f2e7dfcc61af1f516e3295fcbcf9eecb08a4eb` (docs-only audit follow-up). ALWAYS fetch latest origin first; do not reset user changes to this hash.
**Execution:** SAME CRM OpenCode session, sequential packages; no parallel agents.
**Mode:** SOURCE+CONTRACT AUDIT → MINIMAL REPAIR → REAL RUNTIME TEST → DEV APPLY → ARCHITECT GATE.
**Final:** `STOP_FOR_ARCHITECT_AND_USER_UAT`, **NOT** `GOAL_023_COMPLETE`.

## Non-negotiable outcome

The Accounting Connection settings must consume the SAME authoritative tax-policy and currency catalogs as the operational Financial Settings page. Missing/failed/empty/inactive/deleted references must have distinct, truthful behavior. Existing vendor mappings must survive reload and unrelated saves without implicit purge, relabeling, or recreation of CRM identity. Mock/Asan display, save, effective capabilities, preview and gate must agree with server authority. Existing tax/rounding, money, saved quotations and historic revisions remain intact.

**Important:** Do NOT treat the prior 142 Vitest count as an architecture PASS. See `docs/architecture/goal-036/CRM-129-GOAL-036-INDEPENDENT-ARCHITECT-AUDIT.md` (F01–F05), `CRM-ARCHITECT-RECOVERY.md`, Goal 023 Master, Financial Contract and Execution Plan. In particular retain C1–C7 and F7.

## P0 PRE-FLIGHT — no unsafe Git reconciliation

1. In repo verify `git status --porcelain=v1`, branch, `git fetch origin`, local/remote graph. The architect has added docs after the Goal 036 merge. If local and origin diverge, **merge origin/feat/crm-129-quotation carefully (no rebase, force push, reset)**, preserving both recovery text and product commits; no blind ours/theirs. Stop only on unresolved semantic conflict.
2. Do not stage, remove or edit unrelated untracked `packages/twenty-shared/src/ai/**` build artifacts.
3. Establish baseline file hashes and a test command/results manifest. Separate documentation commits from product commits.
4. Read exact runtime API contract for both Nest catalog list actions and compare existing callers and response shapes with source. Verify workspace auth/permissions and how `quotation-api.ts` constructs bearer token. Record explicit ownership table. **Do not invent a new /s, GraphQL or read service.**

## PACK R1-A — F01: one actual catalog authority, no dual APIs

**Files:** `src/components/accounting/accounting-settings-panel.tsx`, `src/components/quotation-api.ts` and narrowly needed shared helpers/tests (full prefix: `packages/twenty-apps/internal/quotation/`).

1. REMOVE these accounting-settings catalog reads:
   `callAppRoute(TAX_POLICIES_ROUTE,{action:'list'})` and
   `callAppRoute(QUOTATION_CURRENCIES_ROUTE,{action:'list'})`.
2. REUSE exactly the existing exported, role-gated `callTaxPoliciesNestAction({action:'list'})` and `callQuotationCurrenciesNestAction({action:'list'})` that financial settings already use. Do not duplicate Nest fetch, auth headers, action-name mapping, or catalog state authority.
3. Inspect runtime successful response shape and normalize using existing `readTaxPolicies`/`readCurrencies` safely. A HTTP 200 with `success!==true`, missing required fields, invalid records, or a thrown response must be handled as **ERROR**, not accepted as an empty catalog.
4. Catalog calls should be independent (e.g., `Promise.allSettled` plus per-response shape checks), so failure of currency does not erase a valid tax result and vice versa. Avoid `catch {}` or silent promise rejection.
5. Per catalog, represent `loading | ready_nonempty | ready_empty | error`; on reload with stale data, retain the last successful data only for **display**, explicitly mark it stale, and **block catalog-dependent edits/saves until refreshed**. Never call a failed fetch `empty`. Provide one Persian retry per failed catalog and nontechnical messages.
6. Never make automatic `bootstrap` write requests simply because an Accounting Settings catalog fetch failed or returned empty. Existing authorized financial-settings bootstrap semantics stay within their owning domain.

**Proof:** On actual Dev `:3002`, both Financial Settings and Accounting Settings read identical tax/currency IDs/codes from the SAME Nest authority. Negative tests: tax returns success, currency throws; reverse; `ok:true` with malformed body; genuine empty; refresh stale; unauthorized; timeout. Verify each independent status and disabled actions.

## PACK R1-B — F02/F03: precise reference lifecycle; lossless persisted mappings

**Decision table (mandatory, no reinterpretation):**

| Catalog fetch | Reference | Display | Can create/change vendor mapping? | Can select as NEW operational currency? |
|---|---|---|---|---|
| loading/error | any existing key | `وضعیت مرجع در دسترس نیست` + preserved prior value | **NO** | **NO** |
| successful | active matching row | real name/code; active | **YES** per permissions/capability | **YES** only if server permits in phase-1 |
| successful | inactive matching row | real name/code; `غیرفعال` | **NO new map**; preserve existing until explicit authorized correction | **NO** |
| successful | missing matching row with saved key | `مرجع موجود نیست` / `نگاشت قدیمی` | **NO new map**; preserve existing until explicit authorized correction | **NO** |
| successful | genuinely empty catalog | explicit empty (not failure) and retained historical keys separately | **NO new map** | **NO** |

**Definitions:** "orphan" means truly absent from a **successfully read** complete authoritative catalog. Inactive exists and is **not orphan**. A currently saved legacy orphan currency/map must remain visible, without being offered as a new selectable currency. `IRR` is the only operational document currency for the current phase; `USD/EUR` must never be invented in the UI. A syntactically valid three-letter code alone does not prove a valid active catalog currency.

**Implementation:**

1. `resolveTaxPolicyMappingRows` must receive ALL tax catalog rows, not only filtered active policies. Include explicit `active | inactive | orphan | unverified` status in view model; do not label inactive as deleted.
2. `resolveCurrencyMappingRows` must NOT synthesize catalog success or a default row when the fetch failed. Remove or strictly isolate `FALLBACK_OPERATIONAL_CURRENCY_CODES` from catalog-backed mapping UI; `IRR` fallback may be a display placeholder ONLY where the valid backend contract explicitly allows it, never an editable verified catalog record.
3. `baseCurrencyOptions` should include only verified active server-authorized options; do NOT derive new options from orphan/inactive mapping keys. If a saved obsolete selected value exists, display it clearly as legacy/inactive with required correction, not as an enabled choice.
4. Existing persisted tax/currency maps must round-trip with all original keys and values intact across refresh and saves of unrelated fields, even if catalog missing, inactive, unknown or partially unavailable. Do not silently normalize, drop, zero, remap, overwrite, or auto-delete them. `setMappingRow` and `parseKeyValueLines` must be examined for duplicate keys/empty values; preserve old server map semantics, never automatically rewrite old values on load.
5. **Fail closed precisely:** when a catalog required by visible/active adapter capability is unavailable, disable catalog-dependent mapping edits and connection Save until it is verified, with a Persian reason and Retry. When that catalog is provably irrelevant to the active connection contract, unrelated saves may proceed ONLY if test proves all existing mapping objects unchanged byte-for-byte/logically and no hidden field clears.
6. For legacy missing/inactive mapping: preserve read-only during ordinary edits. An explicit authorized correction flow (pick a valid destination for an active valid source) may replace it; DO NOT silently clear an orphan; if safe replacement/removal is not already covered by server contract, leave read-only and report separately rather than inventing new write semantics.
7. The application server remains the authority for workspace, currency phase, catalog membership and permissions. Audit actual server save validation; add narrow server guard + negative tests ONLY if a real bypass is verified and within existing contract; do not edit schema or Money Domain as a shortcut.
8. Distinguish source catalog policy `accountingCode` vs `taxPolicyMappings` vendor destination code vs Asan special-row codes. Never treat them as same field or transfer authority from source to adapter.

**Proof matrix:** active/inactive/deleted source tax policy; active/inactive/missing currency; orphan stored tax and currency keys; empty and failing catalogs; saved legacy `USD=...`; `IRR` valid case; unauthorized; two-workspace segregation; re-open and re-save unrelated fields without map loss. Assert exact persisted mapping object before/after and no invented currency.

## PACK R1-C — F04: server-authoritative Mock / Asan capabilities end-to-end

1. Read `AdapterCapabilities`, `resolveFinancialModes`, descriptor source, `connectionFormFields`, `validateConnectionForm`, actual save/test/preview and send-readiness checks. Document the exact source for each decision.
2. UI labels and sections can use trusted descriptor `isLive`/`testProfiles`, but **these values are display data, NOT authorization**. Server must independently check the stored adapter and effective profile/capabilities.
3. A missing, unknown, invalid or unsupported descriptor is `UNAVAILABLE`: show saved connection in read-only with a clear error; never automatically treat it as Mock/`isLive=false`, never suggest a successful mock test, and never permit test/send based on absence of a descriptor.
4. Preserve `mockProfile` wire behavior only when existing server contract explicitly binds it to adapter `mock`. Do NOT rewrite adapter ID semantics to `isLive` for persistence; `isLive` is not equivalent to server adapter identity.
5. Build a consistent matrix for mock profiles `SIMPLE,CODED,AMOUNT,AGGREGATE,TAX_ONLY,NO_TAX` (only if each profile exists in authoritative returned descriptor), and Asan: form visibility, data saved, validation, mapping requirements, preview, document readiness gate. Unsupported/unverifiable capabilities remain blocked with honest labels. `REMOTE_UNPAGED` and unverifiable tax catalog cannot become "verified" through display logic.
6. No real Asan outbound requests; no credential changes, no live send, no sensitive logs. Keep outbound flags OFF. Tests should stub adapters and verify no external call.

## PACK R1-D — F05: reproducible verification (not only 142 reported tests)

**Tests required and logged with exact commands/exit codes, no invented counts:**

- Focused React/Vitest: data parsing, tax/currency status, mapping round-trip, orphan/inactive, failed endpoint independence, capability profile switches, unknown descriptor, preserve existing A row-menu tests.
- API/authorization negative controls: workspace A cannot read/edit workspace B mappings, read-only role cannot save, locked accounting reference cannot mutate; unauthorized or malformed requests fail closed. If runtime API test harness unavailable, state `NOT_RUN` and block architect PASS—do not substitute mocks.
- Financial regression: per-line tax/duty, IRR-only, discounts, named rounding, snapshot locks, sealed revision immutability, PDF and accounting preview. Use existing test infrastructure.
- Browser on ACTUAL Dev (served `:3002`, no isolated HTML): independent tax success/currency fail; retry; inactive vs orphan; preserved old mapping after refresh/save; Mock profile switching; Asan capability UI **without vendor call**; tax/rounding three-dot menu vs Edit; source Financial Settings list matches Accounting list. Viewports 320,360,390,430,768,1024,1280,1440 and constrained Twenty container, with overflow/visible-controls checks.
- Safe synthetic quotation journey: permitted Person/Company → draft → 2 lines with distinct tax/duty → IRR + rounding → save/reopen → preview; assert same rates, snapshots and mapping IDs before/after. No send. Use disposable test data and clean up safely.

For each case, evidence must contain expected/actual result, relevant API/status, workspace/role test scope, build id/commit, and screenshot/DOM measurements where applicable. A test file merely containing cases does not count as executed.

## PACK R1-E — controlled deployment and independent review

1. Use commits separated by behavior: R1-A catalog authority, R1-B mapping lifecycle, R1-C capability guards, R1-D tests/evidence. Commit/PUSH to feature branch only, fast-forward where safe; never force push or merge to main. Keep product diffs narrow and reversible.
2. Verify clean build/typecheck and relevant runtime tests, protected `:6080` untouched. Dev deploy `quotation@` next version only after tests and rollback snapshot; verify actual served app version and logged-in role.
3. Write `docs/architecture/goal-036/CRM-129-GOAL-036-R1-EVIDENCE.md` with matrix F01–F05, before/after and proven preservation of old maps. Update canonical `CRM-ARCHITECT-RECOVERY.md` and `CRM-129-GOAL-023-PROGRESS.md` accurately; do not prematurely mark WS5/WS6 architect-accepted or Goal 023 complete.
4. Final response must report commit SHAs, exact tests and NOT_RUNs, Dev app version, screenshots, risk list, a realistic rollback path and final `STOP_FOR_ARCHITECT_AND_USER_UAT`.
5. If blocked by missing permissions/backend change outside scope, finish independently safe packs and report exact blocker. **NEVER** turn failure into fake PASS; do not redesign UI, delete legacy records, activate multi-currency, alter sealed revisions, purchase credits, restart main worker, touch `:6080`, or make live vendor calls.

## Acceptance criteria (binary, ALL required)

- [ ] F01 single Nest catalog authority observed on both UIs in real Dev
- [ ] F02 independent fail/empty/ready states; no IRR masquerade; no new orphan/inactive selection
- [ ] F03 inactive != missing, all existing mapping keys preserved across reload and unrelated save
- [ ] F04 Mock/Asan descriptor/gate/preview equivalence proven including unknown adapter and negative controls
- [ ] F05 full verified test ledger with actual browser, auth, financial and responsive results
- [ ] No Money/Schema/PDF/historical seal changes, no real outbound or unsafe Git operations
- [ ] Independent architect review and USER UAT still pending until explicitly granted

**Finish state:** `READY_FOR_ARCHITECT_REVIEW` only when every requirement is evidenced; otherwise `BLOCKED_WITH_PRECISE_EVIDENCE`. Goal 023 remains `ACTIVE / NOT COMPLETE`.
