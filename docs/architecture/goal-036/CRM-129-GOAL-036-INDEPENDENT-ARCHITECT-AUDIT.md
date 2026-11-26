# CRM-129 Goal 036 — Independent Architecture Audit (2026-11-26)

**Audited product tip:** `4ccff18f5f`; Git reconciliation merge: `ad909fe3f9857f5609fd5fe37114df82b36a2b19`. **Baseline product:** `1c5bc757fb`. Reviewed actual GitHub commit diffs for Packages A `cab53037`, B/WS5 `09c8c5b3`, C/WS6 `33ced3c9`, D/WS7-B `6912df5e`, E `4ccff18f5f`; read source and reports in `docs/architecture/goal-036/`. **Independent verdict: ARCHITECT_BLOCKED_ON_WS5_CONTRACT**, NOT a system PASS.

## Confirmed positive scope

- Diff shows **frontend/types/tests/docs only** for Goal 036, with a small draft-form copy edit. No SQL schema, Money Domain, Nest authority, PDF, sealed snapshot or historical revision modifications within the reviewed five commits. No direct proof this audit ran a live server/browser.
- A removes interactive row parents from `TaxLedger` and `RoundingList`, adds separate Edit buttons, and keeps the anchored menu. This addresses the verified user click propagation bug at the source structure level.
- WS5 separates CRM policy/currency catalog identity from destination/vendor mappings; no invented hard-coded USD/EUR mapping choices; orphan mappings remain *presented* in form; prior mappings are not explicitly purged in the diff.
- WS6 changes some provider display branching to server adapter descriptor `isLive`/`testProfiles`; does not add a real vendor call. WS7-B is only a Persian currency helper copy change; no major new UX.
- Worker reports 142 Vitest PASS and limited browser evidence; those tests were not independently rerun and neither full financial E2E nor all responsive sizes were proven.

## F01 P0 — Catalog read path regressed to known-broken /s Logic Function

**Evidence:**
- `packages/twenty-apps/internal/quotation/src/components/accounting/accounting-settings-panel.tsx` ~243-270: new `Promise.all([callAppRoute(TAX_POLICIES_ROUTE,{action:'list'}),callAppRoute(QUOTATION_CURRENCIES_ROUTE,{action:'list'})])`.
- `quotation-api.ts` ~1-60: `callAppRoute` resolves injected `TWENTY_FUNCTIONS_URL` or legacy `/s`; comments explicitly note Dev /s worker/GraphQL drift, with `callTaxPoliciesNestAction` and `callQuotationCurrenciesNestAction` defined to use authorized `/rest/quotation/actions` ~65-147.
- Prior financial-settings recovery deliberately used those Nest wrappers for exactly this issue; WS5 reintroduced an inconsistent data source into accounting mapping editor.

**Impact:** Tax/currency catalog reads can fail in Accounting Settings even while the same catalogs load on the primary financial settings page. Empty `policies`/`currencies` state can be confused with a legitimately empty catalog; vendor mapping decisions may be made against stale/absent source of truth.

**Required:** Use existing Nest catalog read wrappers with same auth/shape and same workspace authority; explicit loading/error/readiness per catalog. Verify both sections read identical catalog records on actual Dev and fail-closed behavior for failed catalog fetches. Regression test deliberately fails one catalog endpoint while other succeeds.

## F02 P1 — coupled Promise.all failures; silent fallback masquerades as valid catalog

- One rejection inside `Promise.all` suppresses both results; bare `catch {}` hides cause.
- `resolveCurrencyMappingRows` in `accounting-shared.tsx` ~507-541 fabricates IRR fallback when no rows; cannot distinguish catalog unavailable from genuinely empty; existing mapping keys become orphan in that state. Fallback IRR is a known operational default but **not** proof of a successful server catalog read.
- `baseCurrencyOptions = currencyRows.map(row=>row.code)` includes orphan and inactive codes. Validity of selected `baseCurrency` is currently checked only with `/^[A-Z]{3}$/` in `accounting-connection-rules.ts` ~127, not catalog-membership/active. This could let a retained orphan be newly selected as operational currency in the form (subject to server-side gate not verified here).

**Required:** Separate read states (loading/success-empty/error) and independent calls (e.g. allSettled with result checks); show stale existing mappings as read-only/quarantined and do not offer orphan or inactive values as *new* operational choices. Preserve persisted mapping until explicit authorized correction. Test failed/empty/orphan/inactive permutations and enforce on backend as applicable.

## F03 P1 — inactive existing tax policy misclassified as missing

`accounting-connection-form.tsx` ~96 / ~435 and ~845:
`activePolicies = policies.filter(policy=>policy.isActive)` passed to `PolicyTaxTable`; `resolveTaxPolicyMappingRows({ policies: policies.length > 0 ? policies : allPolicies.filter(row=>row.isActive), mappingKeys })` uses ONLY active policies whenever any exist. A stored mapping for an existing inactive policy is thus rendered `orphan` (as if removed), not known-but-inactive. If no active policies, only mapping keys are shown as orphan. This is inaccurate operational status; retained mapping is not proof of deleted identity.

**Required:** Build rows from all catalog policies with explicit inactive flag, then limit new selection by active policy status; show orphan only when identity truly absent in successfully read catalog; verify saved inactive mappings remain recoverable.

## F04 P1 — WS6 capability display not complete contract equivalence

- UI uses `descriptor.isLive` and `testProfiles.length` for display and fields, while actual save still uses `form.adapterId==='mock'` for `mockProfile` submission. This is potentially intentional per server contract; must ensure server-declared adapter ID remains authoritative and displayed controls never imply unsupported capability.
- Missing descriptor currently maps to generic adapter label, and `adapterIsLive = descriptor?.isLive === true`; unknown descriptor reads as non-live in UI even if saved adapter points to unsupported/removed provider. **Risk is misleading UI**, not demonstrated server bypass.
- No independent proof that connection save/read/test, preview/gate and outbound all consume the same effective capabilities across mock profiles/Asan, or that changing profiles revalidates persisted configuration.

**Required:** Test unknown/unavailable descriptor fail-closed and a real Mock profile matrix across UI, save authority, preview, and gate; confirm server cannot be overridden by client `isLive` or `testProfiles`.

## F05 OPEN E2E and security gates

- Goal 036 reports **142 Vitest** and Package A browser. Independent auditor did not rerun; no complete responsive 320..1440, no full quotation create→tax/duty→round→snapshot→accounting preview journey, no cross-workspace authorization negative controls, no retire/inflight and credential rotation resolution.
- No source changes to financial authority within this pack is a strong scope containment signal, **not** proof that end-to-end integration is safe or that WS5/WS6 settings semantics preserve future sends.

## Architect decision and next execution

**Package A: SOURCE_SCOPE_ACCEPTABLE / UAT OPEN.**
**Package B WS5: ARCHITECT_BLOCKED (F01 must fix; F02/F03 before acceptance).**
**Package C WS6: SOURCE_DIRECTION_ACCEPTABLE_WITH_OPEN_INTEGRATION_GATES (F04).**
**Package D WS7-B: PARTIAL / PENDING_USER_DESIGN_APPROVAL.**
**Package E: REPORTED_TESTS_ONLY / INCOMPLETE_E2E.**
**Goal 023: ACTIVE / NOT COMPLETE.** No merge to main, no live vendor outbound, no authorization/financial contract relaxation. Keep independent commits and unrelated untracked AI build artifacts untouched. Repair F01–F04 narrowly in same CRM session; tests + actual Dev browser proof; then independent re-review and USER_UAT.

This audit is based on **retrieved remote source**, not agent PASS claims; it does not claim runtime access to Windows Dev or an independent test execution.
