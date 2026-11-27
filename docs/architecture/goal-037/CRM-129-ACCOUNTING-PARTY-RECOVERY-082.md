# CRM-129 / Goal 037 — Architect recovery 082

Status: source remediation candidate; operational acceptance pending. Previous source: 3f1c7431885429736821d4189cf13b983c6df1f3. Worker report 081: Apply Synced, Vitest 781, Jest 362; all customer writes FORBIDDEN at CUSTOMER_CREATE / CUSTOMER_UPDATE, zero writes and mappings. Reported evidence commit f776c6a576 was unavailable on remote; do not claim to have inspected runtime logs.

## Source-proven cause

1. ORM is-object-operation-permitted.util.ts checks canUpdateObjectRecords for both insert and update. There is no separate create grant to add.
2. CommonBaseQueryRunnerService.processArgs computes data, then executes WorkspaceQueryHookService.executePreQueryHooks.
3. WorkspaceQueryHookStorage.getWorkspaceQueryPreHookInstances returns wildcard hooks BEFORE object-specific hooks.
4. ActorFromAuthContextService injects createdBy and updatedBy on create, updatedBy on update. Person and Company have both fields.
5. AccountingPartyWriteGuardService 081 rejected all keys outside its business allowlist, including these authentic core-generated audit fields. This is a deterministic denial on both paths and was missing from mock-only tests.

## Narrow repair

- Keep native transaction, user/app role intersection, normal metadata writability, RLS, workspace and settings gates, adapter/identity contract, outbound flag.
- Share business-field allowlist between plan and guard. Never permit raw plan audit/owner fields.
- Native customer mutation opens a server-only async-local scope tied to the same auth context, object, action and record ID. Direct app/delegated GraphQL or REST mutations without that scope remain denied. No changes to global hooks or ORM permissions.
- Guard accepts only canonical actor metadata exactly matching the authenticated workspace member; updatedBy on create/update, createdBy only on create. A person owner stamp from the existing record-access hook is allowed only on create for the same member. Scope and field checks do not grant ORM authority.
- Sanitized reason codes differentiate guard failures, metadata/field/parent permission denials and ORM/runner errors without tokens or PII.
- Regression exercises actual wildcard actor service and accounting hooks via the real hook storage/dispatcher, instead of mocking away the failing composition.

## Cursor verification (one goal)

Exact source SHA supplied by architect, quotation@0.1.82. Clean build, typecheck, all Vitest/Jest, Sync, matching server/worker. First verify ONE existing Person update, ONE existing Company update, ONE new Person and ONE new Company through the canonical Nest operation, including actual persisted actor fields and mapping. Record exact stage/reason on any failure; no generic FORBIDDEN-only report. Then execute the full 100-customer, rollback, stale/concurrency, security and regression matrix in recovery 081 and contract 079. Use isolated fixture and clean precondition counts; no live writes, no outbound enablement, no Intranet changes, no source edits, no hot patches, no permission bypass or test skipping. Commit evidence only under verification-082. STOP_FOR_ARCHITECT after all executable checks. Debt remains OPEN until operational proof.

