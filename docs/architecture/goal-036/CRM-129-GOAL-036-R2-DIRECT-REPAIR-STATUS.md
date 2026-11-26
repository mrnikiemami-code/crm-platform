# CRM-129 Goal 036 R2 — Direct Architect Code Repair (2026-11-26)

**Mode:** DIRECT GITHUB SOURCE IMPLEMENTATION by architect; NOT a task proposal.
**Base:** `c2235a38442cc167754bc7740cc345b7d5363bf4` (`quotation@0.1.70` before edits).
**Branch:** `feat/crm-129-quotation`
**Staged frontend version:** `quotation@0.1.71` (**not installed or tested on Dev**).
**Status:** `CODE_COMMITTED / DEV_AND_RUNTIME_TESTS_NOT_RUN`. This status does NOT close R1 blockers or Goal 023.

## Implemented

1. `quotation-api.ts`: dedicated six-action allowlisted `callAccountingConnectionNestAction` uses existing authorized `/rest/quotation/actions`, **no /s fallback** for connection list/save/test/set-default/deactivate/reactivate.
2. `AccountingConnectionAuthorityService`: new ID is generated within the authorized create transaction and returned as `affectedRecordId`; controller exposes that exact id, full updated `connections`, nested `health` and a minimal **server-verified** `supportedAdapters` list (id, contractVersion, isLive). Workspace role and write guards are untouched.
3. `accounting-nest-response.ts`: single explicit Nest→UI DTO boundary; `recordId`→`id`; `settings.specialCodes.taxPolicyMappings` and `specialItemCodes` normalized by the existing domain compatibility parser; verifies local Persian adapter descriptors against server-supported id/version/live status; new save uses exact `affectedRecordId` rather than name/order; probe reads nested health. Fail-closed on malformed responses.
4. `accounting-settings-panel.tsx`: all six connection calls rerouted; existing edits submit `recordId` (previously `id`, which Nest does not accept); list and save normalization, exact ID selection, test health, truthful error/metadata states.
5. Unknown flags/secret state are **not** silently presented as verified. The Nest response does not authoritatively attest to the Logic Function's runtime env for secret/flags, so UI marks `metadataVerified:false`, uses safe false internally to block sends, and labels status as unverified in the main accounting/connection/documents views.
6. Tests added: pure contract parser/roundtrip/transport (`accounting-nest-response.test.ts`), updated accounting panel Nest mock, server transaction id test. No test execution environment is accessible from this architecture session.

## Source verification performed

- Retrieved real controller, authority service, DTO types, domain normalizer, adapter registry, UI call sites and R1 evidence from GitHub.
- Confirmed **zero** `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` calls remain in Accounting Settings panel; six calls use the Nest wrapper. Financial settings already use Nest.
- Existing separate `ACCOUNTING_IMPORT_ROUTE` and `ACCOUNTING_OUTBOUND_ROUTE` are still Logic Function dependencies. They do **not** have matching actions in the current `QuotationUiController.ALLOWED_ACTIONS`; no unsafe port or invented action was made.

## Explicit NOT_RUN / next runtime gate

- Frontend build/typecheck, Vitest/Jest, server integration, authorized/unauthorized role cases: NOT_RUN here (GitHub connector can write/read repo but cannot execute Windows repo).
- The changed Nest source requires a controlled server build/reload, then the `quotation@0.1.71` app apply on Dev. Merely applying a frontComponent on an old server build will not work because `supportedAdapters` and `affectedRecordId` need the new server version.
- Actual Dev `:3002` connection list/form/create/save/test/default/retire/reactivate, full browser responsive and quotation preview: NOT_RUN here.
- The remaining Import/Outbound Functions/`/s` dependency and historical retire/inflight/credential-rotation risks are NOT fixed by this repair.
- Do not call WS5/WS6 architect-accepted or Goal 023 complete without independently observed Dev behavior. No actual Asan outbound; `:6080` untouched; no runtime restarted.

## Safety

- No Money Domain/schema/PDF/sealed quotation mutation in this repair.
- No force push/rebase/reset or branch merge.
- Sensitive metadata is not exported by the Nest controller; only public adapter id/version/live contract.
- Existing catalog inactive/orphan/unverified rules from R1 remain unchanged.
