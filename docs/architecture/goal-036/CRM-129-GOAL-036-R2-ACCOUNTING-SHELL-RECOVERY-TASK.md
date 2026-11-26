# TASK — CRM-129-GOAL-036-R2-ACCOUNTING-SHELL-AND-AUTHORITY-RECOVERY

**Parent:** Goal 023 ACTIVE; Goal 036 R1 `BLOCKED_WITH_PRECISE_EVIDENCE`.
**Base:** `quotation@0.1.70` product commit `33babfc0d4c989b9e12cab7e963fd91fbea4bce5`. Check latest remote HEAD first.
**Repo:** `D:\CrmSource\twenty` · branch `feat/crm-129-quotation`
**Execution:** ONE existing CRM OpenCode session, sequential, no separate worker.
**Mode:** REPAIR EXISTING NEST ACTION BRIDGE → NORMALIZE RESPONSE → VERIFY CRUD/TEST → REAL F01/F05 → SAFE DEV APPLY.
**Gate:** `STOP_FOR_ARCHITECT_AND_USER_UAT`; no automatic Goal 023 closure.

## Root cause independently confirmed from source

- `accounting-settings-panel.tsx` still calls `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` for `list,save,test,set-default,deactivate,reactivate`. `callAppRoute` targets Functions/`/s`, which fails on Dev; all mapping UI is blocked.
- The SAME repo ALREADY has authorized `POST /rest/quotation/actions`, controller `packages/twenty-server/src/modules/quotation/controllers/quotation-ui.controller.ts`, `handleAccountingConnectionAction`, with `accounting-connection-list/save/test/set-default/deactivate/reactivate`, and `accounting-settings-authority`. Backend service `AccountingConnectionAuthorityService` enforces role/workspace, adapter ID, settings, locked transaction. **Do NOT invent another endpoint, restore broken /s, or bypass permission guards.**
- Critical response differences: Nest list returns `{success,connections,canManage,authority,message}`, records identify as `recordId` and include `settings/capabilities`; legacy Functions list returned also `adapters,credentials,flags,capabilityRows`. Nest save returns **connections list** not `connection`; Nest test returns nested `health` object, while UI reads top-level `healthState/message/detail`. Naive URL substitution breaks behavior.
- Distinct remaining Functions dependencies `ACCOUNTING_IMPORT_ROUTE` and `ACCOUNTING_OUTBOUND_ROUTE` exist in the same panel; audit them separately; do not assume the connection fix makes those operational or migrate them without owning services/security gates.

## R2-A — single authorized transport; explicit 6-action mapping

1. Read current controller, service, types, client `quotation-api.ts`, `accounting-settings-panel.tsx`, and legacy logic-function to compare exact semantics. Probe `accounting-connection-list` on Dev with authorized read-only session and unauthorized negative control. No source-change until response observed.
2. Add one typed frontend `callAccountingConnectionNestAction` following existing `callTaxPoliciesNestAction` and `callQuotationCurrenciesNestAction`. Action map MUST be exactly:
   `list→accounting-connection-list`;
   `save→accounting-connection-save`;
   `test→accounting-connection-test`;
   `set-default→accounting-connection-set-default`;
   `deactivate→accounting-connection-deactivate`;
   `reactivate→accounting-connection-reactivate`.
   `accounting-settings-authority` can be separate explicit read where needed. Reject unknown actions, no implicit fallback to /s or dynamic arbitrary Nest actions.
3. Convert all **connection** operations of this page to that single transport. Preserve caller bearer token and session, no app-token escalation or user impersonation. No GraphQL direct writes to `accountingConnection`.
4. Use existing authorized service for mutations: never accept client-set `healthState`, `capabilities`, `isDefault`, `verificationState` as authority.

## R2-B — precise compatibility contract (NOT field guessing)

Define ONE tested adapter `normalizeAccountingConnectionOutcome`, between Nest response and the existing `PanelData` / form state, or update consumers to native DTO in a single controlled migration. Match these exact fields:

| Operation | Source Nest response | Required UI behavior |
|---|---|---|
| list | `connections[]` with `recordId`, `settings`, `capabilities`, `canManage`, `authority` | each record gets stable `id=recordId`, precise status; no phantom adapter/default |
| save existing | list of connections; no top-level `connection` | update selected id, show success only after actual saved row verified |
| save new | list; no created id in current contract | DO NOT choose first/last/name-matching record; extend existing Nest outcome narrowly with explicit `affectedRecordId` (or similarly named authoritative id) from the transaction insertion result; test under duplicate names and concurrent creations |
| set-default/deactivate/reactivate | updated list | merge/read authoritative list; preserve working selection rules; never auto-set default |
| test | nested `health:{healthState,message,detail,checkedAt,latencyMs}` | use nested health, not undefined top-level fields; do not call mock success live-verified |
| forbidden/error | `success:false,code,message`, actual HTTP status may differ | safe Persian error; no optimistic fake success; no data mutation |

Avoid permissive `as unknown as ConnectionRecord` that hides missing keys; validate required DTO shape in this boundary and fail closed on malformed success.

### Adapter metadata and safety flags

Legacy `/s` supplied `adapters`, `flags`, `credentials`; Nest currently does **not** provide them. This is a **real contract gap**, not an invitation to fill with made-up defaults.

- The server's `accounting-adapter-contract.util.ts` and `accounting-connection-settings.util.ts` are authoritative for supported IDs, contract versions, capabilities and closed Mock profile IDs. Provide *public non-secret* server adapter availability metadata via the EXISTING accounting list/action authority, or a server-verifiable equivalent. Local `ADAPTER_DESCRIPTORS` may supply Persian presentation labels only **after** its id/profile/contractVersion is confirmed against server metadata. Unknown/unavailable adapter = read-only unavailable; never automatically Mock.
- Determine the authoritative runtime source of `ACCOUNTING_OUTBOUND_ENABLED`, `ACCOUNTING_DOCUMENT_EXPORT_ENABLED`, `tunnelTokenConfigured` and `insecureWritesApproved`; if safe authenticated metadata access exists, include only booleans, NEVER secrets. If a trustworthy source is not reachable, mark `UNKNOWN` and disable actions requiring certainty; never silently convert missing to `false` and claim 'not configured' or allow live send.
- Keep `canManage` from server authority; legacy UI cannot grant access by constructing `PanelData.canManage=true`.

## R2-C — Data safety and no regressions

1. For existing Asan and Mock connections verify list, open, edit, save, reopen, set-default, deactivate, reactivate, and test with mocked outbound or safe allowed endpoints ONLY. **No real Asan probe/send**; in Dev safe Mock test only. Historical connections/mappings survive byte-for-byte/logical round-trip, even orphan/inactive/unverified from R1-B.
2. Ensure save payload serializes `recordId` correctly, source `accountingCode` vs destination mapping remain separate, no implicit creation of `USD/EUR`, no catalog data fallback that presents success. R1-A/B/C regressions must remain green.
3. Preserve the connection's capability snapshot and `isDefault`/health only from server response; verify role and workspace separation with server integration negative controls.
4. Inventory `ACCOUNTING_IMPORT_ROUTE`, `ACCOUNTING_OUTBOUND_ROUTE` and any other `/s` links reachable from this page. Record which are actually broken on Dev and which actions are read-only/preview vs live-changing. Do NOT reroute import/preview blindly to `/rest/quotation/actions`, which has no corresponding allowed actions. If a safe existing server API exists, reuse it with matching DTO/authorization; if not, preserve current safe behavior, surface precise localized unavailable status, and report residual blockers; do not declare fully operational end-to-end. Real writes/imports/outbound remain OFF.

## R2-D — required independent runtime proof

A. **Client/component tests:** all six actions, old→Nest DTO, explicit affected created ID with duplicate names, health nested shape, canManage, known/unknown adapter, metadata unavailable, profile switching, orphan map preservation, errors/timeout/invalid JSON, real no /s fallback.
B. **Backend tests:** authorized list; unauthorized GET-equivalent POST 403/refused; insufficient-role save refused; workspace A≠B; no GraphQL write bypass; controller action whitelist; unknown adapter rejected; no client capability injection; concurrent create ID invariant; no real vendor calls.
C. **Actual Dev browser :3002:** Accounting Settings page loads; list→form→mapping; dual financial/accounting catalogs equal IDs; inspect Mock/Asan form labels; save Mock→reload; default and deactivate/reactivate safety; read-only role sees but cannot edit; 320/360/390/430/768/1024/1280/1440 widths; no accidental menu/edit; nested health shape. Record CDP screenshots and DOM facts, not only unit PASS.
D. **Synthetic quotation (no send):** Person/Company → draft with distinct line tax/duty → IRR → named rounding → persisted code snapshots → reopen → accounting preview; compare before/after. If preview remains on broken /s, state NOT_RUN with concrete endpoint, do not invent output. Existing document/financial and security regressions must run.
E. Exact command/exit, test counts, app version, commit IDs, source API response shapes (redacted), archived evidence, known NOT_RUNs and rollback.

## R2-E — delivery

- Independent small commits for transport, DTO/metadata, tests, Dev evidence.
- No destructive migration, schema/Money Domain/PDF/sealed revision change, no `:6080`, no main-worker restart, no new paid tools, no production/live vendor send, no force push/rebase/reset/merge-to-main. Preserve untracked `twenty-shared` AI artifacts.
- Fetch/merge latest origin safely; architect may have added documentation. Never hard reset.
- Apply one controlled `quotation@` next version only after tests and rollback checkpoint. Confirm actual page and service.
- Update `docs/architecture/goal-036/CRM-129-GOAL-036-R2-EVIDENCE.md`, `CRM-ARCHITECT-RECOVERY.md`, Goal 023 progress. Final gate `STOP_FOR_ARCHITECT_AND_USER_UAT`.

**Binary acceptance:** REAL Accounting form loads and saves via preexisting Nest authority, all six operations response-safe; metadata truthful; F01–F04 pass runtime + negative controls; F05 E2E/UX matrix honestly complete or explicitly BLOCKED; historical maps/seals intact. Do NOT claim `READY_FOR_ARCHITECT_REVIEW` or WS5/WS6 accepted if a required case is NOT_RUN. Goal 023 ACTIVE.
