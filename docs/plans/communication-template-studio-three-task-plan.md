# Communication Template Studio — three-task closure plan

Status: **ACTIVE ARCHITECTURE PLAN**

Created: 2026-10-14

Authoritative baseline: `6f84b24a3e23106c01a4f92b26fb46d337fca619`

Installed baseline on main/4D: Communication `0.1.40`

This file is the bounded plan for closing the SMS-template experience. It must be
read together with `CRM-PLATFORM-RECOVERY.md` before issuing or executing another
Communication task. Do not replace this plan with an open-ended “Company sending”
wave and do not combine all three tasks into one execution loop.

## Non-negotiable product model

- The final SMS recipient is always a **Person**.
- A template has one **source context**: Person itself, or another object whose
  selected record has a readable singular relation to one Person.
- “Singular” is judged from the selected source record: the source record resolves
  to at most one Person. Reverse lists and other collection traversal are excluded.
- Template creation stores metadata identifiers, not a selected Person and not a
  sample record value.
- A source-specific template is returned only in its matching source context.
  For example, a Sales Follow-up template must never be returned when the user has
  selected Person records; one Person can have several follow-ups, so guessing is
  forbidden.
- Incompatible objects and incompatible templates are excluded server-side before
  the browser receives them. The server revalidates every source/relation/template
  tuple and rejects a forged or stale mismatch with a stable application code.
- Provider, persistence, Timeline and the existing `POST /communication/send`
  path remain the authority. No second send route, provider or template table.

## Defects proven by the user's 2026-10-14 screenshots

1. The page leaks the English title **“SMS Template Studio”** in a Persian UI.
2. The production front component throws
   `Uncaught TypeError: ot.focus is not a function`.
3. The target entity is effectively fixed to «اشخاص».
4. Clicking controls can close the editor unexpectedly; the modal lifecycle is not
   reliable enough for data entry.
5. Drag/drop still reaches a failing focus path and is not accepted as closed.
6. The sample-Person control opens as an unattractive raw list; actual selection is
   not reliably completed.
7. The modal and its field/sample areas do not provide dependable bounded scrolling
   on the real viewport.
8. Spacing, hierarchy, actions and dense field cards are not yet sale-ready.

Earlier automated or live claims that conflict with these screenshots are
superseded. These defects must be reproduced against the real mounted component,
fixed at the root and accepted again on main/4D.

## Task 1 — W19-B1: Persian UX and runtime stability

Goal: make the currently installed Person-only studio stable, Persian and pleasant
to use before expanding its data model.

- Replace every visible English studio title with Persian product copy. The page
  title is exactly «مدیریت الگوهای پیامک».
- Root-cause and remove the `focus is not a function` crash. Focus management must
  call `focus()` only on a verified focusable DOM element; no minified/raw exception
  may reach the user.
- Make modal dismissal deterministic: only explicit Cancel/close, Escape and an
  actual backdrop click may request close, all through the unsaved-change guard.
  Clicks in inputs, comboboxes, field cards, dropdowns and scrollbars never close it.
- Deliver a viewport-safe modal with fixed header/actions and a bounded scrollable
  body. The variable palette and combobox list have their own sensible maximum
  heights and scrolling.
- Make the target and sample-Person inputs real searchable ARIA comboboxes with
  loading, empty, selected and clear states. A Person can actually be selected and
  previewed without the modal closing.
- Restyle actions, spacing, form hierarchy, table and variable rows consistently.
  Keep tokens canonical ASCII/LTR and the body multiline RTL.
- Double-click/keyboard insertion remain first-class. Drag/drop must insert once or
  safely do nothing; it must never crash, close the modal or move the caret wrongly.
- Exercise the real production component and repeat live browser acceptance only on
  main/4D. Package/deploy Task 1 so the user can inspect it before Task 2 starts.

Exit gate: no console/front-component error; title fully Persian; modal remains open
through edit/search/select/insert/drag; a sample Person is selected and preview is
rendered; all scroll regions work in the real viewport.

## Task 2 — W19-B2: dynamic eligible source model and preview

Goal: replace the hardcoded Person target with a metadata-driven, unambiguous source
model without enabling sending yet.

- Discover eligible source objects at runtime: Person plus active/readable objects
  with at least one active/readable singular relation from the source record to
  Person. Exclude unrelated objects and collection-only relations before returning
  data to the browser.
- Extend the existing native `messageTemplate` object with optional stable metadata
  identifiers for source object and recipient relation. A missing source on legacy
  rows reads as Person; no write-back migration.
- The Persian target combobox lists only eligible objects. If an object has one
  eligible Person relation, select it automatically; if it has more than one, show
  a second searchable combobox for the relation definition. Never ask for a concrete
  Person while defining a template.
- Build one permission-aware catalog containing readable safe scalar tokens from
  the source record plus recipient tokens under `@person.*`. No relation collections,
  arbitrary traversal, credential-looking fields or client-owned authority.
- Preview selects a sample **source record**. The server resolves its stored Person
  relation, then resolves the body. Null relation and missing values use translated,
  stable reasons; provider text is not involved.
- Add server-side compatibility checks and the stable code
  `TEMPLATE_CONTEXT_MISMATCH`.
- Package/deploy Task 2 on main/4D for live studio inspection; do not send an SMS.

Exit gate: the studio lists Person and a disposable eligible related object, omits
an unrelated/collection-only object, saves stable identifiers, reloads them, and
previews source + recipient tokens against a selected source record.

## Task 3 — W19-B3: generic command, strict template filtering and release closure

Goal: connect the safe source model to single/bulk sending and finish the sale-ready
flow.

- Make the existing command a generic `RECORD_SELECTION` command by omitting its
  fixed Person object identifier. The current `recordContext.objectNameSingular`
  and selected record IDs determine the source context.
- For an unsupported object, show only the translated explanation
  «این موجودیت رابطهٔ تکی قابل استفاده با اشخاص ندارد.» and do not request
  templates, preview or send.
- Template-list routes filter server-side by the exact source object. Person context
  returns only Person templates; Sales Follow-up context returns only Sales Follow-up
  templates. Incompatible templates must not be sent to the browser as disabled
  options.
- Revalidate the source object, stored relation, selected records and template on
  every preview/send. Never guess among multiple reverse records.
- “بدون الگو” is available only when recipient resolution is unambiguous.
- Snapshot source record ID, resolved Person ID, destination and final body, then use
  the existing sequential coordinator and existing `/communication/send` route.
  Preserve UNKNOWN/deadline/stop/no-retry semantics and truthful per-recipient results.
- Prove Person and one related-object flow in the real main/4D UI, with mock/no-send
  unless the user separately authorizes a real SMS. Package, deploy, update Recovery
  and freeze the Communication release candidate.

Exit gate: command behavior, strict context filtering, stale/forged mismatch defense,
single and sequential bulk resolution, results and main/4D deployment all pass. No
APPLE/app2 or other environment is accessed.

## Permanent execution boundaries

- Work, backup, install and live-test only main/4D at
  `http://radiant-cyan-dragon.localhost:3001`.
- APPLE/app2 and every other environment are UNTOUCHED / NOT ACCESSED.
- Preserve all seven provider variables byte-identically and keep W7 disabled.
- No real SMS, credential change, provider change, core/host change or SDK upgrade
  unless a later explicit user instruction authorizes it.
- Preserve unrelated worktree files. Commit implementation and Recovery separately;
  push without force; record exact SHAs, package checksum and honest live evidence.
- If live acceptance finds a defect inside the current task, fix it within that task
  and rerun only relevant checks. Do not create a fourth architecture task.

## Progress ledger

| Task | Status | Deployed version | Evidence |
| --- | --- | --- | --- |
| W19-B1 Persian UX and stability | **DONE — deployed, one item pending user confirmation** | 0.1.41 | Impl `6587f7ce4b`; pkg SHA256 `f91c26b4a0…`; app 723/723; live A–J with H unproven (see below) |
| W19-B2 Dynamic source model | NEXT (blocked only on H confirmation) | — | — |
| W19-B3 Generic send and release closure | BLOCKED BY B2 | — | — |

### W19-B1 closure notes

Baseline for this task: `300bebdf74523f6165d93723bff24eb708c2b4ed` (HEAD ==
`origin/crm-platform` at start, confirmed with `git ls-remote`).

Exit gate status: no console/front-component error, the title is fully Persian, the modal
stays open through edit/search/select/insert/drag, and every scroll region works in the
real viewport. The one gate not proven live is **H — the rendered preview**: the sample
Person was selected and the Preview control became enabled, but the automation browser
could not activate any button inside the modal (see the W19-B1 section of
`CRM-PLATFORM-RECOVERY.md`). A **user click on main/4D is required to close that gate**
before Task 2 starts, because Task 2 changes the same preview path.
