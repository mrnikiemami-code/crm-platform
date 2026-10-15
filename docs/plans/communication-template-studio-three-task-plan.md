# Communication templates — user-flow completion plan

Status: **ACTIVE — replaces all earlier W19-B1/B2/B3 and native-template execution instructions**
Updated: 2026-10-15, following the user's screenshots and planning review.
Repository/branch: `mrnikiemami-code/crm-platform` / `crm-platform`.

## What completion means

A user can open «الگوهای پیامک», choose New or an explicit Edit action, choose a source,
see its allowed fields, insert a variable, preview, save, reload and continue editing.
The native Twenty table and record/side-panel mechanisms remain the shell.
The existing `messageTemplate` object remains the only template store.
No bespoke modal/backdrop/portal is to be reintroduced.

The previous promise of three short tasks was not met. Repeated executions of
CRM-NATIVE-TEMPLATES-02 were additional work, not evidence of completion.
The three stages below describe remaining deliverables; they are not a claim that
the original three-task/time commitment was achieved.

## Current evidence and limits

- Latest execution report: code/docs tip `9d4f0dc01e`, app 0.1.53 installed on main/4D.
  Reconcile actual branch, host and browser before implementation; these are a reported
  checkpoint, not a new independent live verification.
- Native list and record storage exist; inline clicks/typing were previously demonstrated.
  The old modal event mechanism was not repaired; that surface was retired.
- User screenshots on 2026-10-15 show no visible Edit action, a raw New form exposing
  duplicate source labels and technical identifier/relation fields, and no usable
  source-to-variable flow. Earlier isolated create/edit claims do not accept this UX.
- The user bridge exists in source but was reported NOT deployed because the renderer
  build emitted no artifact. The editor remains blocked by the auth guard.
- Stable metadata identifiers, conditional batch CAS, recipient resolution and sample
  labels have reported implementation/API evidence. Browser completion is still open.
- Source-record tokens `@source.*` are not implemented.
- A session cookie proves identity, not data authorization. Delegated permission
  enforcement still requires verification through the actual route and CoreApiClient.

## Order and status

| Stage | Deliverable | Status | Dependency |
| --- | --- | --- | --- |
| 1 | Complete Person template creation/editing in the real UI | **PARTIAL / NOT ACCEPTED** — see the Stage 1 report below | Renderer/bridge: DONE |
| 2 | Extend that same working editor to related sources | NOT ACCEPTED; partial underlying implementation exists | Stage 1 accepted |
| 3 | Connect single/bulk send and finish release acceptance | NOT ACCEPTED; existing send foundation is reused | Stage 2 accepted |

Do not expand related-source UI or sending while Stage 1 is unusable.
Fix failed acceptance within its stage; do not repeatedly issue the same broad task.
A blocker report must identify the failed command/boundary and the next concrete action.
Existing authorization for the limited host/bridge change persists.

## Stage 1 — Person templates, end to end

### Visible behavior

1. Keep the native table, filtering, sorting and paging.
2. Provide a visible «ویرایش» entry through the platform-supported row/record command
   mechanism. Opening the title may remain a shortcut; it is not the only discoverable path.
3. «الگوی پیام جدید» must lead to a usable template flow. Reuse supported native creation
   and side-panel/record extension points. If record-id creation is a prerequisite for the
   inline editor, expose only minimal business inputs, then open the editor immediately.
   Do not leave a completed raw form as the final destination or create a second store.
4. Show one source selector. Selecting «اشخاص» must load the permitted Person field
   catalog in both New and Edit. Changing a table cell alone is not catalog selection.
5. Show Persian field labels and canonical ASCII tokens; provide an explicit Insert action.
   If caret APIs are unsupported, label the real behavior «افزودن به انتهای متن».
   Do not claim caret insertion without runtime support.
6. The editor provides title, multiline RTL body, source, variables, sample Person,
   resolved preview, Save and Cancel/navigation with a dirty-state guard.
   No new modal-based editor is required.
7. Technical ids, relation API names, the redundant name field and duplicate source
   controls must not appear in normal create/edit/table flows. Hide via supported layout
   configuration; do not delete stored metadata or rewrite user records.
8. Native soft-delete and trash restore remain; explain immediate reversible delete
   honestly. Do not invent a delete-confirm flow absent from the platform.

### Internal dependencies to finish, not separate product deliverables

- Repair the renderer build using repository package scripts/configuration, Node/package
  manager and actual dependency resolution. Exit 0 without expected exports is failure.
  Identify the artifact actually consumed by twenty-front, including physical copies.
- Prefer the standard artifact build. A limited source alias is allowed only when the
  repository's supported development configuration makes worker/runtime resolution correct.
  No manual node_modules/dist patch or new bundler solely to bypass the problem.
- Deliver the fixed-route, action-allow-listed user bridge already authorized in chat.
  Host session supplies identity; no worker-provided URL/user/role/workspace authority;
  no user token in worker/storage/logs; no generic proxy or free GraphQL.
- Follow existing session/CSRF/origin and function/component authorization mechanisms.
  Confirm delegated CoreApiClient uses the user's effective data/field permissions;
  merely checking userWorkspaceId is insufficient. Keep app-only calls fail-closed.
- Preserve real conditional CAS: one id+updatedAt batch update; no match means CONFLICT;
  keep typed text on failure. Use the same record body, not parallel storage.
- Stage working build and rollback before loading main/4D. Rebuild/reload/restart only
  dependencies actually changed. Redeploy app only if its artifact changed.

### Required acceptance — start from the sidebar, use browser input

On disposable fixtures only:
- New -> select Person -> visible permitted fields -> insert exactly once -> select sample
  -> resolved preview -> save -> table -> reload -> visible Edit -> change -> save -> reload.
- No technical inputs or duplicate source control in the normal flow.
- Failure/CONFLICT retains typed text; no silent lost edits.
- Permitted user succeeds; app-only/forged identity is refused before data access.
- Restricted-user denial through the actual server permission path. Use an existing
  suitable identity or isolated test fixture; never alter a real user's role.
  If no live identity exists, report the live gap and provide a focused integration test;
  do not claim that live check passed.
- No runtime/front-component error and no blocked editor for the authorized user.
Capture the visible New, fields, Edit and preview results, not just API/DB output.

## Stage 2 — related sources in the same editor

- Discover Person plus active/readable objects with a singular usable relation to Person.
  Collections, arbitrary reverse traversal and unauthorized sources are excluded server-side.
- Persist object/field universalIdentifier values; resolve current API names from metadata.
  Names are hints only. Missing legacy source means Person; invalid stored identifiers
  must never silently fall back to Person. No write-back migration of user templates.
- One eligible relation may be selected automatically; multiple require explicit choice.
  Store relation definition, never a concrete sample Person in the template definition.
- Source change refreshes the authorized catalog and clears stale sample/preview.
  Preserve body; identify incompatible tokens rather than silently deleting/reinterpreting them.
- Implement safe readable `@source.*` values alongside `@person.*`, sharing resolver logic
  with later sending. No arbitrary traversal or credential fields.
- Sample picker uses the selected source's metadata label identifier, handles TEXT/FULL_NAME,
  has a Persian fallback, bounded server search and cursor paging.
- Preview resolves the selected source record's stored relation; never accepts a client
  Person override. Reject forged/stale contexts with TEMPLATE_CONTEXT_MISMATCH;
  null relation yields RELATION_EMPTY with Persian explanation.
- Acceptance: two disposable source records pointing to the SAME Person, different source
  values -> equal Person tokens and different source tokens; save/reload identifiers;
  unsupported objects absent; mismatch/null/denial paths covered.
- Remove only remaining obsolete studio-specific paths after checking references;
  retain shared catalog/preview/send behavior. Previously reported cleanup must be verified,
  not blindly re-deleted.

## Stage 3 — send and release closure

- Reuse existing record-selection command, sequential coordinator, provider services,
  persistence/Timeline and `POST /communication/send`; no parallel send route/table/provider.
- Server lists only templates matching the exact selected source context.
  Person selection must never offer a related-source template.
- Revalidate permission, source, relation, selected record and template at preview/send;
  resolve recipient/destination/body server-side. Unsupported context gets Persian explanation.
- Preserve deadline, UNKNOWN, stop, no automatic retry and truthful per-recipient results.
  Same phone does not authorize mixing source records or resolved message bodies.
- Prove Person and related-source single/bulk flows with mock/no-send.
  Mock results must not be presented as real provider delivery.
- Final regression begins at the sidebar and covers New/Edit/fields/preview/save/reload,
  native soft-delete/restore and command context filtering.
- Record installed host/app provenance, package checksum, remaining limits and user-review
  result. Do not label release accepted while a required user flow is blocked.

## Execution and data boundaries

- Only main/4D: `http://radiant-cyan-dragon.localhost:3001`.
  APPLE/app2 and other environments remain NOT ACCESSED.
- Preserve all seven provider variables byte-identically; W7 disabled; no real SMS without
  explicit new authorization. No credential/provider change or SDK upgrade.
- Limited host/renderer/bridge changes for the user-scoped Communication path are authorized.
  This is not authorization for general authentication redesign or app-permission expansion.
- Never change user templates, including trash. Fixtures must be created for the current
  execution and tracked by exact ids. Cleanup may soft-delete only those ids.
  No hard delete, no enumeration cleanup by deletedAt/name/predicate.
- Preserve unrelated/untracked work. Commit/push without force.
- Build from a known clean SHA/export and verify the source/artifact actually consumed.
  Package version/marker and cached green tests alone do not prove provenance.
- Run necessary behavior/integration checks; avoid unrelated full-suite loops.
- Estimate implementation + build/deploy + acceptance before starting; report full elapsed time.
  If the estimate is exceeded, explain progress and revise it. Do not stop with only cosmetic
  work because an arbitrary window elapsed, and do not claim an unbounded completion guarantee.
- Report each criterion PASS / FAIL / UNVERIFIED with the evidence scope.
  Typechecks, unit counts and API output never substitute for browser acceptance.

## Next authorized action

**Execute Stage 1 only:** make the actual sidebar-to-New/Edit-to-fields-to-preview-to-save
Person flow work. Finish renderer/bridge build as its dependency, hide technical form fields,
wire a discoverable Edit action, then verify the entire flow in the browser.
Do not issue another source-catalog or cosmetic-only completion report.
Update this ledger and Recovery after real acceptance; retain precise blockers if still open.

## Stage 1 progress report — 2026-10-15 (app 0.1.55)

**Dependency CLOSED.** The renderer build was never broken; the wrong command was being run.
The package's nx target is `vite build` (JS bundles) followed by
`tsgo --emitDeclarationOnly` + `tsc-alias` (the `.d.ts` files vite does not emit).
`node_modules/twenty-front-component-renderer` is a junction to the workspace package, so the
rebuilt `dist` is what the host consumes — no restart was needed and `twenty-front` typechecks.
**The user bridge is therefore LIVE**, and the container was untouched.

**Verified in the browser with this run's fixture:** the editor loads as the signed-in user
with no AUTH_REQUIRED; the catalog and sample people load (and reload on edit); a variable
inserts exactly once; the preview resolves «سلام تست شماره مشترک دو»; Save persists body and
source; a reload restores title, body, source and the catalog; the form is Persian-only with
one source control and no technical identifiers; and the Edit command opens the editor.

**Still open, and deliberately not claimed:**

1. UI creation from the sidebar was not exercised (the fixture was created through the app's
   API), so acceptance item A is UNVERIFIED.
2. The Edit action is registered and works, but appears only in the command menu — selecting a
   row shows no entry, and the platform renders no per-row button for this object. Its label
   also still renders in English although the catalog carries «ویرایش الگو», so that catalog
   entry is not applied.
3. A second edit→save cycle and the CONFLICT path were not re-verified through this UI
   (CAS behaviour was verified earlier at the service level).
4. Restricted-user denial has no live identity available; it stays covered behaviourally.

The next action is to close item 2 (make the Edit entry discoverable from the list and get its
label translated), verify item 1 by creating a template from the sidebar, and re-run the
edit→save→reload cycle — then Stage 1 can be considered for acceptance.
