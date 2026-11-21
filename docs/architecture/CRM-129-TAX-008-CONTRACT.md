# CRM-129-TAX-008 — Architecture Hardening Contract

Baseline: `feat/crm-129-quotation` @ `4b686a269e` (architect recovery commit).
Scope: close the four gates the TAX-007 review left open. No rewrite of the Money
Domain, the draft form, the accounting bridge, numbering or status flow.

## 0. Actual paths (verified in source, not assumed)

| Concern | Path |
| --- | --- |
| Tax settings route (app) | `packages/twenty-apps/internal/quotation/src/logic-functions/tax-policies.ts` |
| Tax policy persistence (app) | `packages/twenty-apps/internal/quotation/src/services/tax-policy.service.ts` |
| Tax settings UI | `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx` |
| Tax policy domain | `packages/twenty-apps/internal/quotation/src/domain/money/tax-policy.ts` |
| Draft pricing (app) | `src/domain/quotation/draft-quotation.ts`, `src/services/quotation-save.service.ts` |
| Draft save boundary | `packages/twenty-server/src/modules/quotation/controllers/quotation-ui.controller.ts` (`POST /rest/quotation/actions`, action `save-draft`) |
| Single draft write path | `packages/twenty-server/src/modules/quotation/services/quotation-draft-persistence.service.ts` |
| Server permission authority | `packages/twenty-server/src/modules/quotation/services/quotation-permission.service.ts` (reads `WorkspaceCacheService` role maps) |
| Sealed revision snapshot | `packages/twenty-server/src/modules/quotation/utils/quotation-revision-snapshot.util.ts` (`taxPolicy`, `taxRateBasisPoints`) |
| Auth primitives | `JwtAuthGuard`, `WorkspaceAuthGuard`, `WorkspaceAuthContext.type` = `system \| user \| apiKey \| application \| pendingActivationUser` |

The write path for every draft is the REST action, including the app logic function
(`src/data/atomic-draft-save-api.ts` posts to the same endpoint). That makes the REST
boundary the only place that must hold financial authority.

## 1. Gate 1 — principal identity (S1)

**Cause.** `logic-functions/tax-policies.ts` treats a missing `authorization` header as
trusted, and treats `FORBIDDEN`/`AUTH_REQUIRED` from the identity lookup as trusted.
`domain/tax-settings/settings-access.ts` returns `true` when the flag list is `null`.
A signed-in non-admin whose identity lookup fails, or an anonymous call whose header is
absent, therefore reaches the mutation path.

**Contract.**
1. Identity is decided at the server boundary, inside `POST /rest/quotation/actions`,
   using the platform's existing `JwtAuthGuard` + `WorkspaceAuthGuard`. No second auth
   system, no `currentUser` round-trip that can be absent.
2. Missing `Authorization` is an HTTP 401/403 from the guard; the app never translates
   it into permission.
3. `WorkspaceAuthContext.type` decides:
   - `system` → allowed (in-process only; an HTTP caller cannot produce it),
   - `application` → allowed (platform-issued, workspace-bound app identity; the
     quotation app role already grants `taxPolicy` update),
   - `user` / `apiKey` → allowed **only** when the role resolved from
     `WorkspaceCacheService` has `canUpdateAllSettings === true` (API-key scope is its
     role),
   - `pendingActivationUser` or an unresolvable role → refused.
4. A refused mutation returns `TAX_SETTINGS_FORBIDDEN` and performs zero SQL writes.
5. The app logic function becomes a thin forwarder: it passes the caller's
   `Authorization` header (when present) to the REST action. If a caller header is
   present but invalid, the call fails; there is no fallback to the app token.

**Acceptance.** Real HTTP negative tests: anonymous, a non-admin session, an API key
with a non-settings role → refused with `TAX_SETTINGS_FORBIDDEN`/401 and the policy
table unchanged (row count + updatedAt fingerprint). Admin session and app token →
allowed.

## 2. Gate 2A — tax-policy authority on direct writes (S2)

**Cause.** `QuotationDraftPersistenceService` re-derives line tax from the *declared*
basis points, but never proves that the declared `(taxPolicy, taxRateBasisPoints)` pair
is an existing, active policy of that workspace. A caller holding `quotation.edit` can
post to `POST /rest/quotation/actions` with any rate and a made-up policy code.
`taxRateBasisPoints: null` also skips the tax re-derivation entirely.

**Contract.** Inside the same draft transaction, before any write:
- a non-empty `taxPolicy` must match a non-deleted `taxPolicy` row by `code`;
  unknown → `TAX_POLICY_UNKNOWN`;
- a policy that is inactive is refused for a **new** draft (`TAX_POLICY_INACTIVE`) and
  allowed on update only when it is the code already stored on that quotation;
- `taxRateBasisPoints` is mandatory whenever a policy is named, and whenever stored tax
  is non-zero (`TAX_RATE_REQUIRED`);
- the declared rate must equal the policy's current rate, **or** — on update — the rate
  already stored on that quotation. That second branch is what lets an open draft
  survive a later settings edit without ever accepting a rate the server did not
  write itself;
- anything else → `TAX_POLICY_RATE_MISMATCH`.
Sealed revisions are untouched: they read `taxRateBasisPoints` from the snapshot.

**Acceptance.** Jest over the real persistence service: counterfeit rate, unknown code,
inactive policy on create, inactive-but-stored policy on update, null rate with tax,
legacy draft with no policy and zero tax; each asserts the DB is unchanged.

## 3. Gate 2B — atomic default + non-mutating reads (S3)

**Cause.** `setDefaultTaxPolicy` issues "clear others" then "set chosen" as separate
GraphQL mutations; a parallel request or a mid-write failure can leave zero or two
defaults. `loadTaxPoliciesWithBaseline` **inserts** the 9% baseline on a `list` read.

**Contract.**
- All policy mutations run in one `runInWorkspaceTransaction`, taking
  `pg_advisory_xact_lock` keyed by the workspace so concurrent default changes
  serialize; clear + set happen in the same transaction (rollback restores the old
  default).
- Exactly one non-deleted default is left active after `set-default` and `save`.
- `list` performs no write. The 9% baseline is created only by an explicit,
  idempotent `tax-policy-bootstrap` action (zero rows → insert, otherwise no-op), shown
  in the panel only when the list is empty.
- `save` with `isDefault` also clears the previous default under the same lock.

**Acceptance.** Real PostgreSQL: concurrent `set-default` × N leaves exactly one default;
injected failure rolls back; `list` twice leaves a byte-identical table fingerprint;
double bootstrap leaves one row.

## 4. Gate 2C — rate stability and history (S4)

**Contract.**
- A draft stores its own `taxRateBasisPoints`; the edit form keeps that stored rate when
  reopening (it only adopts the catalog rate when the operator picks a different
  policy), so a policy edit cannot silently reprice it.
- `set-default` affects only new documents.
- Issued revisions keep the sealed snapshot rate/hash (already true; regression-tested).
- A legacy document with no stored rate is never assigned one: the form falls back to
  the policy row only for display of a *new* selection, and the server never guesses.

**Acceptance.** App test: reopening a draft whose policy rate changed keeps the stored
rate; saving it is accepted at the stored rate. Server test: sealed revision rate stays
`900` after the policy moves to `1200`.

## 5. What is reused (and why no parallel domain service)

- `WorkspaceCacheService` + `QuotationPermissionService.resolveRoleId` are the existing
  server-side role authority; the new gate is one method on that service, not a new
  authorization subsystem.
- `WorkspaceOrmManager.runInWorkspaceTransaction` / `executeRawQuery` are the existing
  transactional primitives; no new data layer.
- The workspace `taxPolicy` object and its row shape stay the only policy store.
- `evaluateQuotationDraftTotals` keeps owning the arithmetic check; the new code only
  answers "is this policy/rate pair legitimate for this workspace".
- The app keeps its Money Domain untouched; validation moves authority to the server
  instead of duplicating arithmetic.

## 6. Unrelated working-tree changes (preserved, not staged)

```
M packages/twenty-front/src/modules/settings/data-model/fields/forms/select/components/SettingsDataModelFieldSelectForm.tsx
M packages/twenty-front/src/pages/settings/data-model/__tests__/SettingsObjectFieldEdit.test.tsx
M packages/twenty-front/src/pages/settings/developers/api-keys/SettingsDevelopersApiKeyDetail.tsx
?? packages/twenty-apps/internal/quotation/scripts/tmp-*.json|pdf|cjs
```

## 7. Phase order

0. this document (no executable change);
1. Gate 1 + negative/zero-write tests, then 2A, then 2B/2C, then dev deploy on `:3002`,
   then independent regression. Any FAIL stops at that phase.
