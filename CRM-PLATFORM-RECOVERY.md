# CRM Platform Recovery — Persian / RTL / Jalali Track

Last updated: 2026-10-05

## Purpose

This file is the recovery Source of Truth for the customized Twenty CRM fork on branch `crm-platform`.

If a chat/session is lost, start a new session, read this file first, then continue from the **Current Checkpoint** section.

Repository: `mrnikiemami-code/crm-platform`
Primary branch: `crm-platform`
Local source path used during development: `D:\CrmSource\twenty`

---

# CURRENT CHECKPOINT

Repository:
`mrnikiemami-code/crm-platform`

Branch:
`crm-platform`

Verified baseline (before this documentation commit):
`cafce80a4e23fc5d817a56d80cb9e3e4dc1bd938` — `docs(recovery): record Communication W6-R2 native data path`

Origin Sync:
At that baseline `HEAD == origin/crm-platform`. This SHA is the **verified baseline the document was reconciled against**, not necessarily the current HEAD: each documentation commit moves the branch forward. Always run `git rev-parse HEAD` / `git rev-parse origin/crm-platform` yourself and fetch/fast-forward safely before acting.

Last Accepted Milestone:
`CRM-COMMUNICATIONS-001-W10-R6` — **isolated logic-function execution is RESTORED** on the v2.41.0 instance via a **container-scoped DNS override** (`--add-host` for the two registry names; no core, SDK, generated-code or global-DNS change). The Person composer was then verified through its real routes: phone options populate, submitting with incomplete config returns a **safe, truthful** result with **0** records and **no** provider request, and the instance still advertises **0** Workflow actions. `W10-R5` timeline verification and `W9-R2` workspace-owned configuration stand. **Per-workspace execution isolation is still NOT PERFORMED** (needs two configured workspaces).

## Communications milestones — code-review acceptance

Implementation SHAs and recovery-document SHAs are listed separately. "Code-review accepted" means the implementation and its focused tests were reviewed and accepted at code level; it does **not** mean live-verified (see the limitations below).

| Wave | Implementation SHA(s) | Recovery-document SHA(s) | Status |
|------|----------------------|--------------------------|--------|
| W0 / W0-R1 | `bbddd56c73` | `c7c64342a9`, `cd1851d9fb`, `8dc72d0b5b` | code-review accepted |
| W1 | `cf4d176d60` | `9a2da28810` | code-review accepted |
| W2 | `f951459e5a` | `770a79e99e` | code-review accepted |
| W3 | `b69c4a2ade` | `c311f43f3b` | code-review accepted |
| W4 / W4-R1 | `8c3866f5f5`, `f1469f4fb7` | `b34c641728`, `cf961581dd` | code-review accepted |
| W5 | `15ad660a64` | `0b987335f6` | code-review accepted |
| W5-R1 | `0853765a98` | `badd9a0ca1` | code-review accepted |
| W5-R2 | `defdc41e9d` | `d7bdbf60ce` | code-review accepted |
| W5-R3 | `7b21608880` | `c9662cdb5a` | code-review accepted |
| W6 | `b464171e2a` | `3014d5ece4` | code-review accepted |
| W6-R1 | `fd9e0988c6` | `1a61f6c4bf` | code-review accepted |
| W6-R2 | `10af7c560f` | `cafce80a4e` | code-review accepted |
| W7 / W7-R1 / W7-R2 | `d5a71d9232`, `8b58018393`, `ce2cc9e0d1a08368efafdbf1a1ba9764dd3bccff` | `7f536725e6`, `dc37b1c47e`, `96432fb60a`, `c399ee8587`, `1acc4430d2` | **IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED** |
| W8 / W8-R1 | `8ecbd449d6`, `f61744436b` | `cb7b067ed7`, `928645c3aa`, `832122c6ff`, `fa8a454755` | **accepted on dependency/build evidence only** — this is NOT server/runtime or live-install compatibility; Node-pin and live-install limitations retained |
| W9 / W9-R1 | `91961e601f`, `64cc23d558` | `55774de9ad`, `a7df6d1c89`, `0d7d232a50`, `bacdf3f5c2` | **accepted at code level** (live navigation NOT verified) |
| W10 / W10-R1 | (none) | `f6630ef5dd` | environment **prepared**; installed checks **NOT PERFORMED** (historical — superseded by W10-R2) |
| W10-R2 | `526997b77e` | `526997b77e` (implementation + docs committed together) | **installed + live-verified (synthetic integration)**; registration/upload/sync **PASS**, all 8 runtime checks **PASS**, 3 app defects fixed |
| W10-R3 | `a791ca8762` (docs only — no app change) | `a791ca8762` | browser pass performed; its **"front-component rendering FAIL"** finding was **later proven wrong (session artifact)** — see W10-R4 |
| W10-R4 | `521000b709` (docs only — no app change) | `521000b709` | **runtime restored at image level** (fresh v2.41.0 instance, new volumes); **logic-function execution BLOCKED** (dependency layer cannot reach a package registry); **front components PROVEN to render** (Hello World on both images); **Communication composer renders**; its "timeline card still not rendering" finding was **later proven wrong (W10-R5)** |
| W10-R5 | `8c15ea8668` (docs only — no app change) | `8c15ea8668` | **timeline renderer isolated and VERIFIED**: the card was always rendering but is a **collapsed row by default**; status, QUEUED→FAILED via manual Refresh, single-activity and read-only-Refresh checks all **PASS** |
| W10-R6 | (docs + container config only — no app change) | _this document_ | **logic-function execution RESTORED** on the isolated v2.41.0 instance via a container-scoped `--add-host` DNS override; routes, composer, safe-failure and zero-Workflow checks **PASS**; dependency install verified; per-workspace execution isolation **NOT PERFORMED** |
| W9-R2 | `b12a5c57f9` + `3654e15e1c` | `e8023c9b2e`, `a305247a1e`, `3654e15e1c` | **workspace-owned provider configuration** via native `applicationVariables` (9 vars, stable ids, secrets encrypted per workspace); native **Variables tab** verified with masked fake secret; registration `serverVariables` removed via an empty tombstone (0 registration rows on both instances); **runtime execution isolation NOT PERFORMED** (registry blocked) |

**Evidence levels (do not conflate them):**

1. **Registration / upload / sync — PASS.** 14/14 files, `Plan: 92 to add`, 1 object, 4 logic functions, 2 front components, 1 timeline type, 9 **workspace** application variables (re-verified on both the v2.41.0 and v2.42.6 instances).
2. **API / event execution — PASS on the isolated v2.41.0 instance (W10-R6).** After the container-scoped DNS fix, the dependency layer installed and the routes executed: `/communication/person-phones` → 200 with the real phone, `/communication/send` with incomplete config → a safe truthful failure with **0** records and **no** provider request. The earlier W10-R2 API results were obtained while the dependency layer was cached; the unchanged v2.42.6 instance still returns **HTTP 500**.
3. **Browser rendering — PASS for front components, the composer AND the timeline card (W10-R4/R5/R6).** Stock `Hello World` renders on both images; the composer renders and now shows **populated phone options** (W10-R6); the timeline card renders its persisted status — it is a **collapsed row by default**.
4. **Real sending — NOT PERFORMED.** No Kavenegar/RazPayamak request, no delivery receipt, no real credentials.

**Live verification: PARTIAL.** Registration/upload/sync and browser rendering (front components, composer and timeline card) are verified; **API/event execution is currently blocked (registry access unavailable)** and its only PASS evidence is historical. **No real provider request was ever made.**

Current Development State:
- Jalali Presentation Layer: COMPLETE / ACCEPTED / COMMITTED (Phases 1–5).
- Persian / RTL foundation, Data Model localization, Record Detail localization, Navigation RTL, Kanban/system-status localization: COMPLETE / COMMITTED.
- Settings / Experience Persian presentation: COMPLETE / COMMITTED.
- Enterprise / SSO / ClickHouse findings documented; NO Enterprise licence bypass is part of the desired architecture.
- Development startup reliability fixed (phased readiness); cold-start *performance* remains a separate, unstarted topic.
- Branding / white-label: PLANNED / NOT STARTED.
- Communications / Messaging: ACTIVE. W0–W9 implemented; **W9-R2** workspace-owned provider configuration (verified in the native Variables tab, secrets encrypted per workspace and masked); **W10-R4/R5** front components, composer and timeline card all render (the card is a collapsed row by default); **W10-R6** restored **logic-function execution** on the isolated v2.41.0 instance via a scoped container DNS override and verified the composer's real routes, with a safe truthful failure and zero records/provider requests. The Person send-message slice (command menu → composer front component → authenticated route logic function → certified durable orchestration) and the Person timeline integration both exist. SMS via Kavenegar or RazPayamak; architecture is multi-channel from day one.

## Communications — authoritative current behavior

- **Timeline data path:** `timelineActivityId` → activity (`GET /rest/timelineActivities/<id>`) → `activity.linkedRecordId` → Communication (`GET /rest/communications/<id>`). The renderer context's `recordId` is **null** for a timeline renderer and is never used as the linked record.
- **Activity label:** `communication` (outcome-neutral, so a QUEUED record never reads as sent).
- **Status source:** the persisted Communication record, read at render time — never the activity's creation-time snapshot.
- **Refresh:** **manual**, via a localized Refresh action shown on pending and unavailable cards. The card does **not** update automatically; no subscription or invalidation mechanism is exposed to the front-component sandbox.
- **Unavailable reasons:** `NO_ACTIVITY_ID`, `ACTIVITY_NOT_FOUND`, `NO_LINKED_RECORD`, `LINKED_RECORD_NOT_COMMUNICATION`, `ERROR`. None renders as QUEUED or as success.
- **One activity per Communication**, created on `communication.created` only; a status refresh renders the same card and never creates another activity or calls a provider.
- **Workflow entry point: DISABLED.** The `Send Communication` action is **no longer registered** (`workflowActionTriggerSettings` removed) and its production entry is a deterministic refusal returning `WORKFLOW_ACTION_DISABLED`. Reason: a failed/incomplete send cannot mark a Workflow step FAILED, and throwing would risk a duplicate send. The reusable adapter and its tests are retained but unreachable. See the W7 section.

Next Recommended Work:
No wave assigned. W7 is **IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED**. W8/W8-R1 and W9/W9-R1 are **accepted at code level**. **W10-R2** installed the app (registration → upload 14/14 → sync 92 entities) and its API/event checks passed **while the dependency layer was cached** (now historical). **W10-R3**'s browser pass was corrected by **W10-R4**, which proved front components and the composer **do render**. **W10-R4** left two blockers: logic-function execution (host DNS sinkhole) and the timeline card render. Do not start another wave automatically.

**Current test runtimes:**
- `twenty-comm-test-app2` — **fresh `twentycrm/twenty-app-dev:v2.41.0`**, port **3101**, NEW volumes, workspace `apple`, the Communication app installed. This is the working front-end runtime.
- `twenty-comm-test-app` — `twentycrm/twenty-app-dev:v2.42.6`, port 3100, preserved for diagnosis (its DB was migrated and cannot be downgraded).

**Open blocker (environment, not app):**
1. **Logic-function execution on the v2.42.6 instance** — `ensureDepsLayer` (Yarn 4.9.2) cannot resolve a package registry there; the host resolver returns loopback for `registry.yarnpkg.com`/`registry.npmjs.org`. **Restored on the isolated v2.41.0 instance by a container-scoped `--add-host` (W10-R6)**; the v2.42.6 instance was deliberately left unchanged as the control. This is **not** a global-DNS problem: egress works, only DNS is sinkholed, and the fix is scoped to one container.

**Resolved:** the **timeline card render** (W10-R5 — it is a **collapsed row by default**) and **logic-function execution on the isolated v2.41.0 instance** (W10-R6).

**W10/W10-R1 "no environment" prerequisites — HISTORICAL / RESOLVED:**
1. A disposable test workspace now exists: the isolated container `twenty-comm-test-app` with its own database, Redis and volumes, and the seeded workspace `apple` (`20202020-1c25-4d02-bf25-6aeccf7ea419`). The real stack and its single workspace were never touched.
2. Installation credentials exist: a test API key minted for `apple`, stored **outside Git** at `D:/twenty-comm-test/.test-api-key`, and a CLI remote `comm-test`.
3. A CLI-reachable server exists. `SERVER_URL` is set to `http://192.168.4.84:3100` so both the host browser and the Linux CLI container reach the same origin. The isolated instance currently runs **v2.42.6** (the v2.41.0 instance that W10-R2 verified cannot be restored after the 2.42.6 DB migration); v2.42.6 executes logic functions through an offline dependency-layer install and is therefore limited for runtime execution — see the W10-R3 section.

The old Windows CLI defects are **HISTORICAL**: the backslash symptom is real on Windows but was bypassed by running the CLI in Linux, and the "port 2020" upload failure was a **test-instance `SERVER_URL` misconfiguration**, corrected in the W10 section. Do not restate them as current blockers.

---

## Non-negotiable architecture rules

1. Persian/Jalali work is **Presentation Layer only**.
2. Database, API, GraphQL, domain, workflow-engine, cron and canonical date semantics remain unchanged.
3. Canonical date/time values remain UTC / ISO-8601 / Gregorian.
4. Jalali values must never be persisted as canonical timestamps or leak as `[u-ca=persian]`.
5. For `fa-IR`, user-facing dates may be Jalali/Persian.
6. For non-`fa-IR` locales, preserve existing behavior.
7. Prefer shared primitives and centralized localization utilities over page-specific patches.
8. Prefer logical CSS (`start/end`, `inline-start/end`) over physical left/right for RTL fixes.
9. Do not rename internal Twenty package/project identifiers merely for branding.
10. No new date dependency unless a later phase proves it is necessary.
11. **No Enterprise entitlement bypass in accepted architecture.** Any local override used for development/testing must stay out of accepted production behaviour.
12. Prefer app-first / minimal-core-change direction.

---

# Architecture Decisions

- **Presentation-only localization.** All Persian/Jalali work is display/input layer; canonical storage stays UTC / ISO-8601 / Gregorian.
- **Shared formatter architecture.** Central calendar-aware utilities (`formatDateISOStringToDate`, `formatDateISOStringToDateTime`, `formatDateTimeString`, `formatDateString`, `formatDateTimeForAppLocale`, `localizeDigitsForAppLocale`, the Jalali utilities, etc.) are the single path. No page-specific `Intl` code, no hardcoded Persian strings inside components.
- **Read-time metadata localization.** Metadata labels/descriptions/options are translated by the **server at read time** through `resolveEffectiveEntityProperty` / `resolveEffectiveTranslatedFlatEntity`, and field-metadata `@ResolveField`s. Stored metadata is not rewritten into Persian.
- **Cache-version strategy.** Because translation happens at read time, cached metadata collections must be refetched when the translation logic changes; this is controlled by `METADATA_LOCALIZATION_VERSION` (currently `4`).
- **No transliteration into technical names.** Canonical object/field technical (API) names stay Latin; Persian goes to labels only.
- **Logical CSS for RTL.** `inline-start/end`, `margin-inline-*`, `padding-inline-*`, `text-align: start`.
- **Enterprise licensing is real.** SSO and most audit-log types are licence-gated; the accepted architecture does **not** bypass them.

---

# Stable committed baseline (early track)

The following important early work is committed on `crm-platform`. All SHAs below were verified to exist in Git.

## Persian locale foundation

Commit: `6cf109d9ace39b72e2f863c9a8b811b86bd10d8b`

- fa-IR locale foundation
- locale registration
- date-fns / server / email locale wiring
- RTL-related locale support

## Windows/source development reliability

Commit: `4af6644215cf337e06ba8c1f50fcb347fbf027f9`

- reliable Windows source startup
- Nx / Nest / worker startup fixes
- reduced worker/server race conditions
- Windows-compatible scripts

## Professional Persian localization

Commit: `550e15631e9b0454e522bac1d3ad2eb06bc01d5f`

- broad fa-IR translation coverage
- terminology normalization
- corrected CRM terminology
- corrected impersonation wording

Key terminology decisions:
- Workspace → فضای کاری
- Record → رکورد
- Workflow → گردش‌کار
- Pipeline → قیف فروش
- Field → فیلد
- View → نما
- CRM object/entity → موجودیت
- JSON/programming object → شیء
- Impersonation → ورود به‌جای کاربر / ورود به حساب کاربر

## Danger-zone wording

Commit: `23f717ed25b1e7cd235d942d4e84b82c33ec7eee`

- Persian user-facing wording uses `عملیات حساس`.

## Record-table RTL resize

Commit: `145845fbc9b2bbb78611cbac0c6045d7226068bd`

- correct RTL column-resize direction
- shared pointer-delta direction helper
- table and board resize behavior

## Record-table footer / tooltip / RTL

Commit: `4f93e5005e49be49e0635b48cb7e7ec1170d6a61`

- aggregate footer logical alignment
- Persian aggregate phrasing
- truncated-text tooltip positioning
- shared tooltip positioning correction

The tooltip root fix changed the truncated-text tooltip positioning from document-relative `absolute` behaviour to the safe shared `fixed` positioning path.

## Timeline “You” localization + click-away reliability

Commit: `fa37575870d84367495fea97d35d3896a7ffa54a`

- timeline current-user label `You` goes through Lingui; fa-IR = `شما`
- shared click-outside listener moved to the correct window capture path
- fixes first click-away being swallowed by d3/react-flow and requiring a second action

---

# Other accepted frontend fixes (early track)

## Theme summary localization — PASS
Theme summary no longer exposes raw English values such as `Light`.

## Settings Section RTL — PASS
Shared `Section.Root` alignment uses logical `text-align: start`.

Important: Twenty front-end can consume `twenty-ui` from built `dist`, so after twenty-ui source changes a local `npx nx build twenty-ui` may be required before browser verification.

## TipTap placeholders — PASS
Shared placeholder positioning uses logical `inline-start` instead of physical left positioning.

## Profile picture on Windows — CONFIRMED_COMPLETE
Commit: `a9e3b0fbbf` — `fix(file): restore profile picture preview on Windows local storage` (2026-09-26, ancestor of HEAD).

- normalizes persisted file entity paths to POSIX (`normalize-file-entity-path-to-posix.util.ts`)
- tolerates legacy backslashes; robust by-ID reads (`is-file-entity-path-in-folder.util.ts`)
- resets `ImageInput` error state when URI changes
- touched `ImageInput.tsx`, `WorkspaceMemberPictureUploader.tsx`, file-storage/file services, plus unit tests

---

# Persian / RTL

Status: COMPLETE / COMMITTED (foundation) — ongoing incremental RTL polish commits exist through 2026-09-30.

- Persian locale foundation, terminology, danger-zone wording, RTL resize, footer/tooltip RTL, timeline “You”, theme summary, Settings section RTL, TipTap placeholders (see baseline above).
- Record field value / icon overlap fix: `a4877ec4b9` — `fix(rtl): prevent record field values overlapping icons` (`MultiItemBaseInput.tsx`, `TextAreaInput.tsx`, + RTL test).
- Timeline RTL gray activity-group bar aligned with the icon column: `a81ef48efb` — `fix(rtl): align timeline group bar with icon column` (`EventsGroup.tsx`).

---

# Navigation / folder RTL fixes

Status: COMPLETE / COMMITTED.

- `baa6d7ce42` — `fix(rtl): prevent navigation actions overlapping labels`
  - logical `inset-inline-end` for row actions; reserved action slot so actions no longer overlap the label
  - `NavigationDrawerItem` uses `padding-inline-*` / `margin-inline-end`
  - `data-row-actions` CSS reservation in `NavigationMenuItemEditable`
  - static RTL guard test `navigationItemLogicalLayout.test.ts` (forbids physical left/right in the touched components)
- `eb7db4492f` — `fix(rtl): stabilize editable navigation and folder naming`
  - inline editor uses `text-align: start`; folder name input `shouldTrim={false}` so names with spaces («اطلاعات مشترک») are preserved; trims only on commit
  - `NavigationMenuItemInlineEditor.test.tsx` covers typing with spaces, Enter/Escape, trim-on-commit, shared label slot

---

# Jalali Presentation Program

## Overall target

For `fa-IR`:
- Persian/Jalali display
- Persian month names
- Persian digits for user-facing date/time text
- true Jalali calendar selection where a calendar picker exists

Canonical outbound values remain ISO/Gregorian. The core model is:

```
Database / API / GraphQL
        ↓
UTC / ISO-8601 / Gregorian
        ↓
Presentation Layer
        ↓
fa-IR → Persian/Jalali
other locales → existing behavior
```

## Status summary

The Jalali Presentation Layer is **COMPLETE / ACCEPTED / COMMITTED** (Phases 1–5).

- Phases 1–3B: `a842caff67` — `feat(i18n): complete Jalali presentation phases 1-3B`
- Phase 4: `6a1a81800d` — `feat(i18n): add Jalali record calendar`
- Phase 4 docs: `8aff38f8d0` — `docs: finalize Jalali phase 4 checkpoint`
- Phase 5: `af2d0bb974` — `fix(i18n): complete Jalali presentation cleanup`

No Jalali phase is pending. **Do NOT repeat Phases 1–5.**
No backend / DB / API / GraphQL / domain / workflow-engine / cron / canonical date semantic was changed by the Jalali program.

## Phase 1 — Foundation
- `CalendarSystem = 'persian' | 'gregory'`; `getCalendarSystemForLocale(locale)` (exact `fa-IR` → `persian`, else `gregory`)
- `useDateTimeFormat()` exposes `calendar`
- Temporal-based Jalali utility layer; ISO ↔ Persian `PlainDate` conversion; Persian month options; Jalali year range; Persian/Arabic digit normalization
- serialization guard keeps values ISO; no `[u-ca=persian]` leakage
- verified: 1405/01/01 = 2026-03-21, 1405/07/06 = 2026-09-28

## Phase 2 — Core Display
- calendar-aware: `formatPlainDateISOString`, `formatDateISOStringToDate`, `formatDateISOStringToDateTime`, `formatDateISOStringToRelativeDate`, `formatDateISOStringToCustomUnicodeFormat`, `formatDateString`, `formatDateTimeString`
- Persian path uses explicit `fa-IR-u-ca-persian`, Persian digits, existing timezone and 12h/24h preferences, `Intl.RelativeTimeFormat`
- custom Unicode (date-fns/Gregorian-token) formats fall back to the user's standard localized format under Persian calendar (no fake Jalali tokens)
- date-only values keep UTC/plain-date semantics (no day shift)

## Phase 3A — True Jalali Picker + Typed Input
- Twenty-owned Jalali grid (7 columns, Temporal Persian arithmetic, `calendarStartDay`, only when `calendar === 'persian'`)
- Persian month/year navigation; Esfand ↔ Farvardin handled with Persian arithmetic
- RTL logical positioning, mirrored chevrons; numeric inputs explicitly LTR on the Persian path
- typed input accepts Persian/Arabic/ASCII digits; real Jalali validation; invalid dates emit nothing
- verified leap/common Esfand (1403/12/30 valid, 1404/12/30 invalid, 1404/12/29 valid)

## Phase 3B — Remaining frontend display paths
- fa-IR filter chips use Jalali shared formatting (display only; filter values unchanged)
- `beautify*` paths calendar-aware; `RecordIdentifierBarCreatedAt`, `EventRowDate`, timeline month grouping localized
- host-locale dependency in `src/utils/format/formatDate.ts` fixed; previous 3 Windows `formatDate.test.ts` failures fixed
- `TimeZoneAbbreviation` intentionally remains technical English / GMT offset
- validation: 375 suites / 2277 tests PASS; 186 suites / 979 tests PASS; tsgo PASS; oxlint 0/0; oxfmt PASS

## Phase 4 — Record Calendar
- fa-IR month grid from the Persian month (`getRecordCalendarDaysRange` with `calendar`), `calendarStartDay` respected
- cells stay iso8601 `Temporal.PlainDate`; only boundaries/labels are Persian
- top-bar titles assembled from parts (ICU fa-IR persian `dateStyle: 'full'` patterns are malformed)
- Persian weekday headers + Persian-digit day numbers; RTL chevrons mirrored; logical properties replace physical ones
- event placement unchanged (no timestamp conversion); weekend shading intentionally still Sat/Sun (product decision)
- validation: record-calendar 12 suites / 70 tests; localization + date inputs + record-index 51 suites / 454 tests; object-record + localization + ui + utils 373 suites / 2116 tests; tsgo PASS; oxlint 0/0; oxfmt PASS; manual fa-IR smoke PASS

## Phase 5 — Final Presentation QA / Cleanup
- shared helper `useFormatDateTimeForAppLocale` + `NUMERIC_DATE_FORMAT_OPTIONS` / `NUMERIC_DATE_TIME_FORMAT_OPTIONS`
- admin panel surfaces, `SettingsEnterprise`, Settings → Applications dates, `SettingsDatePickerInput`, `groupThreadsByDate`, event-logs timestamp column, Settings → AI logs localized
- `formatToHumanReadableDate` takes the user timezone (no host-timezone day shift)
- durations: expiry logic separated from display; fa-IR digits localized at display only
- filter chips: DATE `IS_BEFORE` / `IS_AFTER` regenerate the label from the canonical plain-date value for fa-IR; payload/value never rewritten
- intentionally retained technical/Gregorian surfaces documented (AI prompt context, debug time, `TimeZoneAbbreviation`, gregorian branches, typed input masks, number formatting, weekend shading, out-of-frontend-scope chart/email/backend)
- validation: focused 6 suites / 89 tests; regression 590 suites / 3513 tests; tsgo PASS; oxlint 0/0; oxfmt PASS; fa-IR + en manual smoke PASS

## Jalali date input presentation (post-Phase-5, still presentation-only)
- `e449bb1937` — `fix(i18n): localize Persian date input masks` (`JalaliDateBlocks.ts`, jalali input-mask tests)
- `2679bf3551` — `fix(i18n): complete Persian Jalali date input presentation` (`formatDigitsAsPersian.ts`, `getPersianDayPeriodLabels.ts`, `DatePickerInput.tsx`, `DateTimePickerHeader.tsx`)
- `93cbacc11c` — `fix(i18n): align Persian date field display options`
- `a17235d982` — `fix(i18n): hide unsupported custom date format in Persian` (Custom stays hidden in Persian-calendar mode)

---

# Data Model localization

Status: COMPLETE / COMMITTED.

- Custom object creation separates the Persian label from the canonical technical name: `9492167bcb` (`fix(i18n): separate technical name and localize custom object creation`).
- Custom object name field localized at read time: `09af11c7a0` (`fix(i18n): localize custom object name field at read time`).
- Custom object system UI completed in Persian: `583dfc6fcc`.
- **No Persian transliteration into technical names.** Technical/API names remain canonical Latin.
- Field creation flow localized for fa-IR + RTL: `d417565d74`; field configuration copy polished: `65a0528055`.
- Field technical name shown for Persian labels: `af4ffe4790`; technical-name editing UX improved: `ed93888f25`; helper text refined: `762feb96bc`.
- Persian technical-name validation copy: `f8a6e7095a` — CONFIRMED_COMPLETE (fa-IR.po + generated + tests).
- Relation field technical names stabilized: `2424b82aaa` (front + server `compute-relation-target-field-name` tests).
- System / default field labels + Select / Multi-select option labels localized at read time via server `@ResolveField options` and the canonical-label utilities:
  - `localize-standard-field-options.util.ts`
  - `get-standard-field-option-canonical-label-by-id.util.ts`
  - preserves user-authored labels; restores canonical labels on submit (`restoreCanonicalStandardFieldOptionLabels`)
- Duplicate select-option recovery: `8237626085` (`fix(settings): allow recovery from duplicate select options`).
- Delete confirmation localization: `9bee4d30ac` — `fix(i18n): unify localized destructive confirmations` (all locales).
- Kanban / system status options localized in Persian at read time: `f6205d9092` — `fix(i18n): localize system status options in Persian` (To do / In progress / Done → برای انجام / در حال انجام / انجام‌شده).
- Metadata localization cache-version strategy: `bfaf4242de` — `fix(i18n): refresh localized metadata labels by locale`, controlled by `METADATA_LOCALIZATION_VERSION` (currently `4`).

---

# Record Detail localization

Status: COMPLETE / COMMITTED.

- `7b484247d9` — `fix(i18n): complete Persian record detail UI` (tabs/widgets, command menu, Timeline/Tasks/Notes/Files/Fields copy across locales).
- `a4877ec4b9` — `fix(rtl): prevent record field values overlapping icons` (RTL field value/icon overlap fix).

---

# Settings

## Field-save navigation fix

`0d5b0b772d` — `fix(settings): return to object settings after editing a field` (2026-09-29).

- `SettingsObjectFieldEdit.tsx` + `SettingsObjectFieldEdit.test.tsx` (269 lines of tests)
- after saving a field edit, navigation returns to the object settings page instead of a dead-end

## Experience settings (fa-IR presentation)

`6fad08b92c` — `fix(settings): align Persian experience and self-hosted feature gates` (2026-09-30).

- Settings → Experience date/time/number/timezone examples route through the **shared** formatter architecture:
  - `formatDateISOStringToDate` (Jalali date previews)
  - new `formatTimePreview` (Persian day period, Persian digits)
  - new `formatNumberPreview` (Persian digits/separators)
  - new `formatLocalizedTimeZoneLabel` (localized visible label; canonical IANA id unchanged)
- `DateTimeSettingsDateFormatSelect`, `DateTimeSettingsTimeFormatSelect`, `DateTimeSettingsTimeZoneSelect`, `NumberFormatSelect` no longer call `formatInTimeZone` / raw `Intl` directly.
- No hardcoded Persian strings in components; no second date-format system.
- Custom date format stays hidden in Persian-calendar mode (unchanged policy).
- Validation: `experiencePreviewFormatters.test.ts` + wider front suite (59 suites / 551 tests); server gate spec (2 suites / 22 tests); tsgo/oxlint/oxfmt PASS; live fa-IR smoke PASS.
- **en-US output unchanged**; locale switching updates examples without cache clearing.

---

# Enterprise / SSO / Logging

Status: findings documented. **No Enterprise licence bypass is part of the desired architecture.**

## Gate root causes (verified in source)

- **SSO** is gated by an Enterprise licence: `EnterpriseFeaturesEnabledGuard` (and other Enterprise checks) call `EnterprisePlanService.isValid()`, which requires a valid Enterprise validity token. `ENTERPRISE_KEY` / the validity token must be JWTs signed by Twenty's embedded public key. It is not a feature flag, migration, or UI-only lock.
- **Audit logs** have two gates in `EventLogsService.validateAccess`:
  1. ClickHouse must be configured via `CLICKHOUSE_URL`.
  2. `WORKSPACE_EVENT`, `PAGEVIEW`, `OBJECT_EVENT`, `USAGE_EVENT` additionally require `isValid()` **and** the `AUDIT_LOGS` billing entitlement.
  - `APPLICATION_LOG` has `requiresEntitlement: null` (free once ClickHouse is configured).

## Local configuration reality

- `packages/twenty-server/.env`: `ENTERPRISE_KEY` is commented out; `CLICKHOUSE_URL` is commented out. So SSO and entitled log types are locked, and even free application logs need ClickHouse.
- `IS_BILLING_ENABLED` is disabled locally; with billing off, `isEntitlementActive` reduces to `hasValidEnterprisePlan`.

## Enterprise override history (IMPORTANT)

- A development-only override was briefly introduced in `enterprise-plan.service.ts` (`isDevelopmentTestingOverrideEnabled()`) and pushed by the user in `2fa6612392` (`change`).
- It was then **disabled** in `272bfa0715` (`chore: disable enterprise development testing override`). Current HEAD has the method returning `false`, so `isValid()` depends on a real licence again.
- The committed method is a no-op at `false`. It must **not** be turned into a permanent entitlement bypass.
- **Accepted architecture = no licence bypass.** To enable Enterprise features legitimately, set a Twenty-issued `ENTERPRISE_KEY`; to enable free application logs, configure `CLICKHOUSE_URL`.

---

# Development Startup

Status: COMPLETE / COMMITTED.

## Root cause of the old failure

The old `wait-for-server-http.mjs` used a **single flat 300-second deadline** (`Date.now() + 300_000`) measured from process start. A legitimate cold boot (compile ~9228 files → emit `dist` → DB migrations → Nest init → `/healthz`) can exceed 300s. When it did, the script threw, its `&&` branch exited non-zero, and `concurrently --kill-others` (root `yarn start`) tore down the **still-healthy** backend in the sibling branch.

This was a **FALSE STARTUP FAILURE, NOT a startup performance problem.** Cold-start *performance* remains a separate, unstarted optimisation topic.

## Startup chain

- `yarn start` → `npx concurrently --kill-others "npx nx run-many -t start -p twenty-server twenty-front" "node packages/twenty-server/scripts/wait-for-server-http.mjs 3000 && npx nx run twenty-server:worker"`
- Branch `[0]` `nx run-many -t start` serves `:3000` (`twenty-server:start` = `rimraf dist && … nest start --watch`) plus the frontend.
- Branch `[1]` `wait-for-server-http.mjs 3000 && nx run twenty-server:worker` is the readiness gate that launches the queue worker.
- Failure propagation: `concurrently --kill-others` SIGTERMs all siblings when any command exits non-zero.

## Fix — phased readiness

Commit: `831204b74a` — `fix(dev): use phased readiness so cold backend startup is not killed`
File: `packages/twenty-server/scripts/wait-for-server-http.mjs` (only file changed).

- **Cold-compile phase:** generous window (default 600s) while the entrypoints have not yet been freshly emitted. The phase boundary latches only on an absent→present transition of the entrypoints *in this run*, so a leftover stale `dist/` cannot skip the wait.
- **Post-compile phase:** once entrypoints exist, a tighter bounded window (default 300s) for migrations + Nest init. A backend that has compiled but never becomes ready is a genuine failure.
- Both windows are bounded (not infinite), so real startup errors are never hidden. Tunable via `TWENTY_DEV_COMPILE_TIMEOUT_MS` / `TWENTY_DEV_READY_TIMEOUT_MS`.
- Failure detection preserved: a crashed backend is still torn down by `concurrently --kill-others`; a compiled-but-never-ready backend exits non-zero from the script.
- Warm-start behaviour preserved.
- Validation: hermetic focused test driving the real script in temp dirs — slow-but-healthy → exit 0; dead → non-zero; compiled-but-never-ready → non-zero (post-compile phase). `node --check`, `oxfmt --check`, `oxlint --type-aware` all clean.

---

# Multi-Workspace

Status: CONFIRMED_COMPLETE (local development enablement).

- `TWENTY-DEV-MULTIWORKSPACE-ENABLEMENT-001` enabled Multi-Workspace for the local development instance only, through the official runtime configuration path.
- Confirmed variable: `IS_MULTIWORKSPACE_ENABLED` (boolean, default `false`, in `twenty-config/config-variables.ts`).
- Config source for port 3000: `packages/twenty-server/.env` (loaded by `EnvironmentModule`; DB-stored config variables take precedence but no override row existed). The file is git-ignored and is **not** part of any commit.
- Local `.env` now has `IS_MULTIWORKSPACE_ENABLED=true`.
- Runtime evidence: `GET http://localhost:3000/client-config` → `isMultiWorkspaceEnabled: true`, `defaultSubdomain: "app"`; the frontend moved to `app.localhost:3001`.
- "Create Workspace" visibility depends only on `isMultiWorkspaceEnabled` (and `IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS=false`), so it is allowed; no workspace was created.
- No licence/edition/entitlement gate applies to Multi-Workspace.
- Note: because the frontend moved to `*.localhost` subdomains, a fresh login at `app.localhost:3001` is required.

---

# Branding / white-label

Status: **PLANNED / NOT STARTED**

Planning file (untracked, intentionally not committed): `docs/plans/branding-white-label.md`.

Architecture direction: **app-first / minimal-core-change.**
- create a centralized instance-wide product-branding configuration
- workspace display name/logo remains tenant identity (do NOT conflate with product brand)
- do not rename technical package/project identifiers or `@twenty/*` imports
- likely future fields: `PRODUCT_NAME`, `SHORT_PRODUCT_NAME`, `COMPANY_NAME`, `EMAIL_FROM_NAME`, `TOTP_ISSUER`, `SUPPORT_URL`, `WEBSITE_URL`, brand logo / dark logo / favicon

Do not start branding unless explicitly requested.

---

# Communications / Messaging

Status: **PLANNED / NOT IMPLEMENTED**

This supersedes the earlier SMS-only planning direction. Do **not** build an SMS-specific core subsystem.

## Product direction

Build a small extensible **outbound Communication** capability. The first real delivery channel will be **SMS**, but the boundary must allow later channels without redesigning the core:

- SMS
- WhatsApp
- Telegram
- Instagram
- Bale
- future providers/channels

Twenty's existing native email/message infrastructure must be inspected and reused where safe, but email must **not** be forced into the new abstraction if that would require a large core refactor.

## Architecture direction

- App-first / minimal-core-change.
- Prefer a generic Communication boundary over `ISmsProvider` as the top-level contract.
- Provider/vendor adapters sit behind the channel boundary; do not lock the CRM to Kavenegar, Melipayamak, FarazSMS, or any other vendor.
- Capability-aware channels are preferred because SMS, WhatsApp, Telegram, Instagram, etc. do not have identical semantics.
- Preserve workspace isolation.
- Provider credentials/secrets must not be stored as ordinary plaintext workspace records.
- UI and Workflow should eventually call the same application service.
- Reuse the existing Timeline/activity infrastructure rather than creating a duplicate history UI.

Conceptual capability examples (not yet locked interfaces):
- send text
- send media
- templates
- delivery receipts
- read receipts
- reply / conversation support

## MVP scope — outbound first

Fast delivery order:

1. **P0 — Analyze only:** inspect Twenty's actual email/message/thread/channel, Timeline/activity, Workflow/HTTP Request, Apps framework, webhook, queue/retry, provider settings and secret-handling seams. No code changes.
2. **P1 — Foundation:** minimal generic Communication model/contracts.
3. **P2 — SMS provider:** connect one selected Iranian SMS provider.
4. **P3 — Send UI:** Person record → «ارسال پیام» → choose available channel → send.
5. **P4 — History:** persist send result/status and surface it through the existing Person Timeline/history path.
6. **P5 — Workflow:** generic `Send Communication` workflow action using the same application service as the UI.
7. **P6 — Delivery:** provider callback/webhook for delivery/failure status.
8. **P7 — Second channel:** Telegram or WhatsApp to prove the abstraction without redesign.

Initial minimal status vocabulary should stay small unless repository analysis proves otherwise:
- QUEUED
- SENT
- DELIVERED
- FAILED

Likely message linkage requirements:
- workspace
- Person/contact
- channel/provider
- sender identity where applicable
- recipient
- body
- provider external message ID
- status/timestamps

## Explicitly OUT OF SCOPE for the first MVP

- multi-channel Inbox
- inbound chat/conversations
- chat UI
- attachments
- bulk marketing/campaign manager
- AI-generated messages
- implementing WhatsApp, Telegram, Instagram or Bale in the first wave

These are future consumers of the Communication boundary only.

## P0 architecture analysis — COMPLETE / ACCEPTED

Task: `CRM-COMMUNICATIONS-001-P0` (analyze-only; no production files changed).

Repository evidence confirmed that Twenty already provides most seams needed for a zero-core-change MVP:

- generic workspace message store: `message`, `messageThread`, `messageParticipant`, `messageThreadTarget`, `messageChannelMessageAssociation`
- `MessageChannelEntity` with `MessageChannelType = { EMAIL, SMS, EMAIL_GROUP, APP }`; `SMS` is currently a reserved/unused enum slot and must not be repurposed for MVP
- app-owned message channels via `ApplicationMessageChannelsResolver` and app message ingestion via `ApplicationMessageIngestionResolver`; app-channel design explicitly anticipates non-email handles such as WhatsApp numbers
- outbound precedent: `MessageOutboundDriver` + `MessagingMessageOutboundService` + `SendEmailService`
- UI/workflow precedent: `SendEmailResolver` and `SendEmailWorkflowAction` both funnel into `SendEmailService`
- existing Timeline engine can emit app-defined activity types through a Person relation; do not build a second timeline
- Apps framework supports objects, fields, relations, logic functions, workflow actions, front components, command-menu items, timeline activity types, connection providers and server-route/webhook triggers
- app variables are encrypted at rest; future OAuth providers can use connection providers / encrypted connected-account tokens
- queue/retry and application-job infrastructure already exist
- Person phone handles already exist at `PersonWorkspaceEntity.phones`

### Locked MVP ownership

Use one dedicated internal/private Twenty App, recommended location:

`packages/twenty-apps/internal/communication/`

The app owns:
1. provider drivers
2. provider secrets/config
3. send application service / logic function
4. workflow step
5. Person-record UI action
6. delivery webhook
7. communication persistence

Core stays untouched for MVP. Keep the generic `CommunicationProvider` contract inside the app; promote it to core only if a second independent consumer later proves that necessary.

### Locked minimal model

One app-owned workspace object: `communication`.

Minimum fields:
- `channel`: extensible channel value (SMS first; later WhatsApp/Telegram/Instagram/Bale)
- `body`
- nullable `subject`
- `status`: `QUEUED | SENT | DELIVERED | FAILED`
- `providerMessageId`
- nullable `failureReason`
- nullable `queuedAt / sentAt / deliveredAt`
- `direction = OUTBOUND` for MVP
- relation `targetPerson -> Person`
- relation `sender -> WorkspaceMember`
- channel/provider account identifier as needed

Workspace-object rows are already workspace scoped; do not introduce a user-managed `workspaceId` field.

### Provider boundary

Use an app-local generic provider boundary conceptually equivalent to:

`CommunicationProvider { channel; capabilities(); send(message); }`

A registry selects the provider/channel driver. Do **not** extend `MessageOutboundDriver` for MVP because it is email-shaped (`subject/html/cc/inReplyTo/threadExternalId`) and forcing SMS through it would create unnecessary core coupling.

### Integration decisions

- Timeline: `defineTimelineActivityType` through the communication→Person relation; consume existing routing/rendering infrastructure.
- Workflow: expose the same send logic through `workflowActionTriggerSettings`; do not add a core `WorkflowActionType` or modify `WorkflowActionFactory`.
- UI: Person command-menu/front component calls the same send application path.
- Secrets: encrypted app variables; OAuth-style future providers use `defineConnectionProvider`.
- Delivery callbacks: app logic function exposed through `serverRouteTriggerSettings`, with provider-specific signature verification/parsing.
- Existing core `message/messageThread` reuse for conversation continuity remains optional and is **not MVP-critical**.

### Do not touch for MVP

- email outbound drivers / `SendEmailService`
- core `message/messageThread/messageParticipant` import/sync pipeline
- `MessageChannelType` / core `messageChannel`
- Timeline core services/entities
- `WorkflowActionFactory` / core workflow registry
- Enterprise/licence code
- secret-encryption internals
- existing Persian/Jalali infrastructure

### Remaining implementation risks to verify in bounded waves

- outbound HTTP/egress availability from app logic-function runtime
- app relation capabilities only if future direct linkage to core `message` is desired (MVP avoids this)
- provider-specific rate-limit/backoff tuning
- encryption key availability in deployment environment
- timeline noise at high message volume

## W0 implementation review — HISTORICAL (superseded; W0 is code-review accepted)

> Historical record written before W0 was reviewed. W0 and W0-R1 are now **code-review accepted** (implementation `bbddd56c73`); see the milestone table in the Current Checkpoint. Nothing below is pending.

Task: `CRM-COMMUNICATIONS-001-W0`.

At the time this was written the implementation existed locally and was uncommitted pending review. It has since been committed as `bbddd56c73`. Reported implementation is confined to:

`packages/twenty-apps/internal/communication/`

W0 evidence:
- 14 new app-owned files; no tracked/core files modified by W0.
- generic `communication` object created.
- Person MANY_TO_ONE + inverse relation resolved in generated manifest.
- WorkspaceMember sender relation is supported and resolved with inverse relation.
- encrypted application-variable seam created for future provider credentials/config (later moved from `serverVariables` to workspace `applicationVariables` in W9-R2).
- no provider/send/workflow/timeline/webhook code added.
- `dev:build`, TypeScript and oxlint reported PASS.
- local app installation intentionally deferred because install requires an explicit remote/credentials and may mutate workspace metadata.
- 24 pre-existing modified files plus pre-existing untracked `docs/` remain unrelated and must stay out of the Communication commit.

### W0 review correction required before acceptance

Do **not** expose unimplemented future channels as selectable values. The generic `channel` field remains extensible without predeclaring dead UI options.

For W0, keep only the actually planned first channel option:
- `SMS`

Do not expose `WHATSAPP`, `TELEGRAM`, `INSTAGRAM`, or `BALE` until the corresponding channel is implemented/enabled. Adding a future SELECT option is an additive app change and does not require redesigning the Communication architecture.

This preserves the product rule: unsupported features must not appear as dead controls.

**HISTORICAL:** W0 was not committed until this bounded correction was validated; it is now committed and pushed (`bbddd56c73`, `W0-R1`).

## W0-R1 review — ACCEPTED / READY TO COMMIT

Task: `CRM-COMMUNICATIONS-001-W0-R1`.

Accepted correction:
- `communication.channel` remains a generic/extensible SELECT.
- only `SMS` is exposed in W0.
- default remains `SMS`.
- inert `WHATSAPP`, `TELEGRAM`, `INSTAGRAM`, `BALE` options were removed.
- Person and WorkspaceMember relation pairs remain intact.
- encrypted server-variable configuration seam remains intact.
- app build/manifest validation PASS.
- TypeScript PASS.
- oxlint PASS.
- core files changed by W0/W0-R1: ZERO.
- no provider/send/workflow/timeline/webhook implementation exists yet.

W0 + W0-R1 implementation scope remains exactly the 14 new files under:
`packages/twenty-apps/internal/communication/`

W0 is architecturally **ACCEPTED / COMMITTED / PUSHED**. Durable implementation commit: `bbddd56c734571a880d9e530a0cd3e65f399bca2` (`feat(apps): add internal Communication app skeleton`). The commit contains exactly the 14 app files under `packages/twenty-apps/internal/communication/`; core/unrelated files = ZERO.

## Next implementation wave

W1 is **COMPLETE / COMMITTED / PUSHED** at `cf4d176d605c40e0b752efd55a19968c587dfb2f` (`feat(apps): add Communication provider boundary`). It added the app-local generic provider contract, minimal capabilities/input/result types, instance-based provider registry, typed missing-provider failure, and 5 focused deterministic tests. Core changes = ZERO.

W2 is **COMPLETE / COMMITTED / PUSHED** at `f951459e5a9e194f7c09874aed7fa94f0c0c98fe` (`feat(apps): add Kavenegar communication provider`). It added the first SMS provider and shared send-service path. Kavenegar is retained as a valid provider implementation; it is not the user's intended primary SMS service.

Provider requirement clarified after W2: the intended SMS service is **RazPayamak / Smart Webservice** (official documentation supplied by the user at `http://razpayamak.ir/Files/webservice-Smart.pdf`). Do not replace Kavenegar merely because RazPayamak is added.

Architecture correction for the next wave: provider selection must support **multiple providers for the same channel** without channel-specific `if/else` branching. A registry keyed only by `channel` is insufficient once both Kavenegar and RazPayamak exist.

W3 is **COMPLETE / COMMITTED / PUSHED** at `b69c4a2ade34714e3823f9598743e3e9673d20d6` (`feat(apps): add RazPayamak multi-provider SMS support`). GitHub commit verification confirms 24 changed files. Provider identity is now independent from channel (`kavenegar | razpayamak`), the registry is keyed by provider id, multiple SMS providers coexist, channel/provider compatibility is enforced centrally, and `CommunicationSendService` remains provider-agnostic with no provider-specific branching. Kavenegar remains supported; both drivers truthfully expose delivery-receipt capability as false until implemented.

RazPayamak Smart implementation uses the official SmartSMS REST contract reported from the provider PDF: POST SmartSMS/Send, username + password(ApiKey), from/to/text, provider result normalized into `CommunicationSendResult`. No real SMS or credentials were used. Focused W3 validation reported 43/43 tests PASS, typecheck PASS, lint PASS, app build PASS, core changes ZERO.

Known W3 risks: the REST base host should be confirmed with a real RazPayamak account before production use; W2 generic provider config names were replaced with provider-scoped names (no deployment existed); no automatic provider fallback; recipient numbers currently pass through verbatim; no caller/persistence integration exists yet.

W4 is **ACCEPTED / ARCHITECT-CERTIFIED** after bounded correction W4-R1.

- W4 implementation: `8c3866f5f5f18d5c9367825e1306cbabcce94eab` — `feat(apps): persist outbound communications`
- W4-R1 correction: `f1469f4fb708a84a79a37f629e91f5455e5e9472` — `fix(apps): harden durable communication outcomes`
- Independent origin diff review verified W4-R1 changed exactly 7 Communication-app files and no core files.

Certified architecture: one `CommunicationSendAndPersistService` owns QUEUED→outcome orchestration; `CommunicationPersistence` is an app-local port; `CoreApiCommunicationPersistence` is the adapter; `CommunicationSendService` stays provider-agnostic; provider/recipient are immutable send-time snapshots; subject has one source of truth (`OutboundCommunication.subject`); transport/runtime exception text is never persisted; double failure (send exception + FAILED-state persistence failure) is explicit and retains both non-persisted causes; no provider retry occurs.

Known accepted limitations: no distributed atomicity between provider and workspace DB; a double failure can still leave the durable row QUEUED but is now explicit/diagnosable; recipient is not normalized; provider-declared response messages are persisted as failureReason; no live-workspace end-to-end smoke yet.

> **HISTORICAL W4 CHECKPOINT — SUPERSEDED.** The "immediate next task" recorded here (build the Person send-message vertical slice) was **completed** by W5, corrected by W5-R1/R2/R3, and the timeline was added by W6/W6-R1/W6-R2. All are code-review accepted. Nothing here is pending.

---

# Known Unverified / Pending Items

| Item | Classification | Evidence |
|------|----------------|----------|
| Timeline RTL gray activity-group bar fix | CONFIRMED_COMPLETE | `a81ef48efb` (`EventsGroup.tsx`) |
| Profile picture Windows path normalization | CONFIRMED_COMPLETE | `a9e3b0fbbf` (POSIX normalize util + tests; ancestor of HEAD) |
| Persian technical/API-name validation copy | CONFIRMED_COMPLETE | `f8a6e7095a` (fa-IR.po + tests) |
| Multi-workspace enablement | CONFIRMED_COMPLETE | local `.env` + `client-config` runtime evidence (no commit; git-ignored) |
| ClickHouse setup | CONFIRMED_INCOMPLETE | `CLICKHOUSE_URL` commented out in `.env`; no ClickHouse running |
| EnterprisePlanService / previous local entitlement override | CONFIRMED_COMPLETE (disabled) | override disabled in `272bfa0715`; method returns `false` at HEAD |
| Old Settings stashes | UNVERIFIED | `stash@{0}` exists (4 files incl. enterprise-plan override) — do not pop/drop without user instruction |
| Docker/source local-storage unification | UNVERIFIED | no dedicated unify commit found; `STORAGE_TYPE=local` available but commented; `docker-compose.dev.yml` is dev infra only (Postgres + Redis) |
| `2fa6612392` (`change`) intent | UNVERIFIED | user-pushed commit adding 15 lines to `enterprise-plan.service.ts`; later superseded by `272bfa0715` |
| Cold-start performance | PLANNED | explicitly out of scope for `831204b74a` (that fixed false failure, not speed) |
| Branding / white-label | PLANNED / NOT STARTED | `docs/plans/branding-white-label.md` untracked |
| Communications / Messaging | ACTIVE — W0–W9 implemented; **W9-R2 workspace-owned configuration VERIFIED**; front components + composer + timeline card render (W10-R4/R5); **logic-function execution RESTORED on the isolated v2.41.0 instance** (W10-R6, scoped container DNS); **W7 IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED**; real-provider sending NOT verified; per-workspace execution isolation NOT PERFORMED | W0 `bbddd56c73`, W1 `cf4d176d60`, W2 `f951459e5a`, W3 `b69c4a2ade`, W4 `8c3866f5f5`+R1 `f1469f4fb7`, W5 `15ad660a64`+R1 `0853765a98`+R2 `defdc41e9d`+R3 `7b21608880`, W6 `b464171e2a`+R1 `fd9e0988c6`+R2 `10af7c560f`, W7 `d5a71d9232`+R1 `8b58018393`+R2 `ce2cc9e0d1` (disabled), W8 `8ecbd449d633ddd248dfc08f3526fc34b0788cc0`, W10-R2 `526997b77e`, W10-R3 `a791ca8762`, W10-R4 `521000b709`, W9-R2 `b12a5c57f9`+`3654e15e1c`, W10-R5 `8c15ea8668`, W10-R6 (this wave); no next wave assigned |
| Real-provider end-to-end send | UNVERIFIED | Only synthetic integration was exercised; no Kavenegar/RazPayamak request was made and no delivery receipt was observed |
| Person composer React render | **PASS (W10-R4)** | The Communication `Send message` composer renders on the fresh v2.41.0 instance (Channel SMS / Phone number / Message / Cancel / Send). Its phone-options data call is blocked by the host DNS runtime blocker. |
| Front-component rendering (general) | **PASS (W10-R4)** | Stock `Hello World` renders in a sandbox iframe on **both** v2.41.0 and v2.42.6. The W10-R3 "do not render" claim was an expired-session artifact. |
| Timeline card status render + Refresh button | **PASS (W10-R5)** | The card is a **collapsed row by default**; expanding it mounts the app's front component, which renders the persisted status (`Message failed · SMS / 5552345678 / … / W10-R5 refresh test failure`). QUEUED→FAILED became visible after clicking the card's `Refresh`; the activity count stayed **1**; Refresh issued **0** writes and exactly **2** reads. |
| Logic-function execution on a fresh instance | **RESTORED (W10-R6)** | `ensureDepsLayer` runs Yarn 4.9.2 to install the app dependency layer. It failed `ECONNREFUSED 127.201.0.114:443` because the registry names resolved to loopback. **Fixed with a container-scoped `--add-host` on the isolated v2.41.0 instance only** — egress works, so no global DNS change was needed. The unchanged v2.42.6 instance still returns HTTP 500 (control). |
| Settings → app-registration `Config` → "Server Variables" | **HISTORICAL — shared route, no longer used** | Renders the **registration-scoped** `serverVariables`, which are shared by every workspace. W9-R2 moved this app's configuration to workspace `applicationVariables`; the registration table is now empty for this app. Kept only as history. |
| Settings → Applications → Communication → **Variables** | **PASS (W9-R2)** | Native workspace Variables tab ("Set your application configuration variables") lists all 9 workspace variables with a `Save settings` button; a fake `KAVENEGAR_API_KEY` reads back masked as `F********`. |
| Workspace `Variables` tab before W9-R2 | **NOT PRESENT (historical)** | `SettingsApplicationDetails` shows it only when `applicationVariables` is non-empty; before W9-R2 the app declared only `serverVariables`, so the tab was correctly hidden. |

**Rule:** never assume an UNVERIFIED item is complete. Re-check the repository before acting on any of these.

---

# Communications W5 — Person send-message vertical slice

Status: **IMPLEMENTED / COMMITTED**, then corrected by **W5-R1**, **W5-R2** and **W5-R3**; **code-review accepted**. **NOT live-verified** (see limitations).

> The W5-R1 / W5-R2 / W5-R3 subsections below are historical corrections applied to this slice. W5-R3 carries the current unknown-outcome wording and duplicate-submission behavior.

## Call path (native Twenty Apps patterns)

```
Person record
  → Command menu item "Send message"        (availabilityType: RECORD_SELECTION, Person object)
  → Front component composer                (useRecordId + useTranslate, twenty-sdk/front-component)
  → POST /s/communication/person-phones     (httpRouteTriggerSettings, isAuthRequired: true)
  → POST /s/communication/send              (httpRouteTriggerSettings, isAuthRequired: true)
  → CommunicationSendAndPersistService      (the certified W4 durable path, unchanged)
  → CommunicationSendService → ProviderRegistry → Kavenegar | RazPayamak
```

- Sender is resolved from the **trusted logic-function execution context** (`context.workspaceMemberId`, resolved server-side by the platform) and is never accepted from the client.
- Person access and recipient ownership are validated server-side before any send.
- The front component imports **no** provider/config/persistence modules; provider HTTP and secrets stay server-side.
- Only implemented channels are offered (`SUPPORTED_COMMUNICATION_CHANNELS = ['SMS']`).
- Duplicate submission is prevented while a request is in flight (see W5-R1 for the synchronous guard); there is no automatic resend/retry.
- SENT is never presented as DELIVERED; a normalized `FAILED` result is reported truthfully with its provider-declared reason.

## W5-R1 — outcome truth and submission guard (IMPLEMENTED)

Status: **IMPLEMENTED / COMMITTED** at `0853765a9891b400aea20909cad62a17a18c4435` (`fix(apps): harden send outcome reporting`).

- **Outcome truth.** The handler now classifies failures instead of collapsing everything into "could not be sent":
  - `PROVIDER_FAILED` — the provider returned a normalized `FAILED` (with its declared reason).
  - `OUTCOME_NOT_PERSISTED` — the send outcome is **known** but history could not be written. The real provider outcome (`SENT` / `DELIVERED` / `FAILED`) is preserved and returned, so a successful send is never reported as "not sent". The message tells the user not to retry automatically.
  - `UNEXPECTED_FAILURE` with `isOutcomeKnown: false` — the send threw and the FAILED-state write also failed, so the outcome is genuinely unknown. Diagnosability is preserved **server-side** via `console.warn` with a stable classification, `communicationId`, and only the error *names* — never raw messages, secrets, URLs or request bodies.
  - `INVALID_INPUT` / `PERSON_NOT_ACCESSIBLE` — validation failures.
- **Submission guard.** The composer uses a synchronous `useRef` in-flight guard checked before any `await`, so two immediate clicks produce exactly one outbound request. React state still drives the visual pending state, and the guard is released only after the request settles (no automatic resend).
- **Unchanged:** the certified W4 orchestration (`CommunicationSendAndPersistService`) is untouched; provider is never retried.

### W5-R1 verification

- 94 focused tests PASS (68 W4 baseline preserved + W5 + W5-R1 additions).
- New regression coverage: SENT + persistence failure reports a known SENT outcome with one provider call; FAILED + persistence failure is distinguished from a plain provider failure; unexpected send + FAILED-write double failure returns a safe classification with no secret leakage and one provider call; two immediate submissions produce one request; the guard is released after failure without resending.
- typecheck PASS; oxlint 0/0 (54 files); app build PASS (7 files); manifest wiring unchanged.

## W5-R2 — production submission helper (IMPLEMENTED)

Status: **IMPLEMENTED / COMMITTED** at `defdc41e9d41c2fe040ac857ae711b8a95b233e6` (`test(apps): cover production submission helper`).

Two corrections on top of W5-R1, both inside the Communication app:

1. **Truthful unknown-outcome presentation.** `submitPersonCommunication` is now the single production submission path used by the composer. It classifies a transport/response-parsing failure as `OUTCOME_UNKNOWN` with the message *"The message may or may not have been sent. Check the communication history before retrying."* — it never claims the message was not sent. Known outcomes are preserved unchanged (`SENT` / `DELIVERED` / `PROVIDER_FAILED` / `SENT_BUT_UNRECORDED` / `FAILED_BUT_UNRECORDED`), and raw exception text never appears in a response or in history.
2. **Tests exercise production code, not a duplicate.** The earlier `composer-submit-guard.test.ts` re-implemented the guard inline; it has been **deleted**. The composer's real submission logic was extracted into `src/components/submit-person-communication.ts`, and `src/components/__tests__/submit-person-communication.test.ts` tests that exact shipped helper (with the transport injected). The React component now only renders the classified outcome (error vs. warning).

## W5 code-review acceptance

W5 + W5-R1 + W5-R2 + W5-R3 are **ACCEPTED at code-review level** (`7b21608880556576c7a75ba0860dcda7e517d23c`). The composer slice, its truthful outcome classification, and its synchronous submission guard are implemented and covered by focused tests against the shipped modules.

**Live verification (HISTORICAL — superseded by W10-R2/W10-R3).** At W5 the app had never been installed anywhere, so `composer → route → provider` was unverified end-to-end. That is no longer true: the app is now installed on the isolated instance (W10-R2) and the authenticated routes were exercised (synthetic integration). The composer's **React render** specifically remains **NOT PERFORMED** — see W10-R3. Real-provider sending is still unverified.

## W5-R3 — unknown-outcome wording and duplicate presentation (IMPLEMENTED)

Status: **IMPLEMENTED / COMMITTED** at `7b21608880556576c7a75ba0860dcda7e517d23c` (`fix(apps): correct unknown outcome and duplicate submission`).

Two verified defects fixed:

1. **Unknown-outcome wording.** `isOutcomeKnown: false` previously fell back to `data.error`, and the server's current payload asserts *"could not be sent"* — untruthful when the send may have happened. The classifier now **always** returns the canonical `OUTCOME_UNKNOWN` message and deliberately ignores `data.error` on that branch. Tests use the real server payload and assert the canonical wording is present and *"could not be sent"* is absent.
2. **Duplicate submission presentation.** An ignored duplicate previously returned `OUTCOME_UNKNOWN`, which the composer rendered as a warning and whose `finally` block cleared the pending state of the still-running request. Duplicates now return a distinct `DUPLICATE_IGNORED` result that the composer never renders and never uses to clear `sending`. The composer also short-circuits before any UI state change when the guard is already held.

### W5-R3 verification — actual coverage vs. simulations

- **Actual production coverage:** the shipped classifier and submission helper are tested directly. New assertions: the real server payload maps to the canonical wording with no *"could not be sent"*; a **deferred first request** proves the second submission issues **no** transport call, returns `DUPLICATE_IGNORED` with **no** renderable message, and the **first request stays pending** (guard still held) until it settles.
- **Still simulated / not covered:** the React render tree (button disabling, snackbar variant selection) is not rendered — it requires the front-component sandbox host. Provider HTTP is faked; no live workspace; no real SMS.
- 105 focused tests PASS; typecheck PASS; oxlint 0/0 (55 files); app build PASS (7 files); W4 orchestration unchanged.

### W5-R2 verification — actual coverage vs. simulations

- **Actual production coverage:** the submission helper, response classification, and in-flight guard are the real shipped modules. 104 focused tests PASS; the new suite asserts: two immediate submissions issue exactly **one** transport call; the guard is released after a failure with **no** automatic resend; a transport/parse failure yields `OUTCOME_UNKNOWN` with no raw error text; a sent-but-unrecorded outcome is never upgraded to success or downgraded to a non-send.
- **Still simulated / not covered:** the React component render tree (button disabling, snackbar variant) is not rendered in tests — it requires the front-component sandbox host. Provider HTTP remains faked. No live workspace, no real SMS.
- typecheck PASS; oxlint 0/0 (55 files); app build PASS (7 files); W4 orchestration unchanged (`git diff` on `src/services/` is empty).

## New files (all under `packages/twenty-apps/internal/communication/`)

- `src/logic-functions/send-person-communication.ts` (route trigger)
- `src/logic-functions/list-person-phone-options.ts` (route trigger)
- `src/logic-functions/handlers/send-person-communication-handler.ts`
- `src/logic-functions/data/find-person-phone-options.ts`
- `src/logic-functions/types/{person-phone,communication-channel-option,send-person-communication-input}.type.ts`
- `src/components/send-message-composer.front-component.tsx`
- `src/command-menu-items/send-message.command-menu-item.ts`
- focused tests under `src/logic-functions/__tests__/`

## Verification status

- Unit/build: 87 focused tests PASS (68 preserved + 19 new); typecheck PASS; oxlint 0/0; app build PASS (7 files); manifest wiring verified (1 command menu item → Person, 1 front component, 2 authenticated route logic functions).
- **Live-workspace verification: NOT PERFORMED.** The app is not installed on a running instance in this environment, so the end-to-end flow (real composer → real route → real provider) is unverified. Do not claim end-to-end completion until it is installed and smoke-tested.

## Known limitations

- No live end-to-end smoke (app not installed).
- ~~No timeline presentation yet (deliberately out of scope).~~ **HISTORICAL W5 LIMITATION — RESOLVED at code level by W6-R2** (the card loads `timelineActivityId` → activity → Communication and renders the persisted status with a manual Refresh). **Live Timeline rendering remains unverified.**
- Recipient numbers are not normalized (out of scope).
- Composer UI is functional but minimal (no RTL/i18n polish beyond `useTranslate`).

---

# Important Commits

Jalali program:
- `a842caff67` — feat(i18n): complete Jalali presentation phases 1-3B
- `6a1a81800d` — feat(i18n): add Jalali record calendar
- `8aff38f8d0` — docs: finalize Jalali phase 4 checkpoint
- `af2d0bb974` — fix(i18n): complete Jalali presentation cleanup

Persian / RTL / Data Model / Record Detail:
- `9492167bcb`, `09af11c7a0`, `583dfc6fcc`, `d417565d74`, `65a0528055`, `762feb96bc`, `af4ffe4790`, `ed93888f25`, `f8a6e7095a`, `2424b82aaa`
- `7b484247d9` — complete Persian record detail UI
- `a4877ec4b9` — record field values vs icons (RTL)
- `a81ef48efb` — timeline group bar alignment (RTL)
- `a17235d982` — hide unsupported custom date format in Persian
- `93cbacc11c` — align Persian date field display options
- `e449bb1937` — localize Persian date input masks
- `2679bf3551` — complete Persian Jalali date input presentation
- `8237626085` — allow recovery from duplicate select options
- `9bee4d30ac` — unify localized destructive confirmations
- `bfaf4242de` — refresh localized metadata labels by locale
- `f6205d9092` — localize system status options in Persian

Navigation / Settings / Startup:
- `baa6d7ce42` — prevent navigation actions overlapping labels
- `eb7db4492f` — stabilize editable navigation and folder naming
- `0d5b0b772d` — return to object settings after editing a field
- `6fad08b92c` — align Persian experience and self-hosted feature gates
- `272bfa0715` — disable enterprise development testing override
- `831204b74a` — phased readiness so cold backend startup is not killed

Windows / files:
- `a9e3b0fbbf` — restore profile picture preview on Windows local storage
- `4af6644215cf337e06ba8c1f50fcb347fbf027f9` — make Windows source startup reliable

---

# Recovery Instructions

A future agent MUST:

1. **Read this file first.**
2. **Verify HEAD/origin before making changes** (`git rev-parse HEAD`, `git rev-parse origin/crm-platform`, `git status`, `git stash list`).
3. **Never assume an UNVERIFIED item is complete.** Re-check the repository.
4. **Work one bounded task at a time.** Do not continue automatically into the next task.
5. **Implement → focused test → acceptance → commit → push → sync.**
6. **Do not modify unrelated files.** Keep pre-existing/unrelated working-tree changes out of commits.
7. **Preserve app-first / minimal-core-change architecture.**
8. **Never introduce Enterprise entitlement bypasses** unless explicitly requested by the user.

Additional reminders:
- Do not pop/apply/drop stashes without explicit instruction.
- Do not modify `.env`, DB, migrations, Docker, or dependencies for documentation/recovery work.
- Do not rename internal Twenty identifiers for branding.
- Keep any future date work presentation-only.

---

# Recovery prompt for a new chat

```
We are continuing work on mrnikiemami-code/crm-platform, branch crm-platform.

Read CRM-PLATFORM-RECOVERY.md from the repository first and treat it as the recovery Source of Truth.

Do not redo accepted work.

First inspect the current repository/local state and reconcile it against the recovery file.

Current accepted checkpoint:
JALALI PRESENTATION LAYER COMPLETE (Jalali Phases 1–5 committed),
plus Persian/RTL, Data Model, Record Detail, Navigation, Kanban/system-status,
Settings/Experience, and development-startup fixes committed.

Communications / Messaging is ACTIVE. Code-review accepted through **W9-R1** (W7 is IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED):
W0 app skeleton, W1 provider boundary, W2 Kavenegar, W3 multi-provider + RazPayamak,
W4 durable send/persist path (+ W4-R1), W5 Person send-message slice (+ W5-R1/R2/R3),
W6 Person timeline integration (+ W6-R1/R2), W10-R2 installed verification (synthetic).
Do NOT redo any of these waves.

INSTALLED VERIFICATION: the app is **installed and live-verified on the isolated instance**
(W10-R2): registration, upload (14/14 files) and metadata sync (92 entities) all PASS, and all 8
runtime checks PASS at API/event level — native variables, secret masking (fake value), Person
command-menu registration, the `/communication/person-phones` route, safe missing-config failure,
live absence of the Workflow action, and a synthetic QUEUED→timeline→FAILED→refresh cycle. This is
**synthetic integration evidence only**: provider config was kept incomplete and **no real
SMS/provider request was made**.

BROWSER VERIFICATION (W10-R3, CORRECTED BY W10-R4 and W10-R5): the W10-R3 claim that "front components
do not render" was **wrong** — it was an **expired browser session**. W10-R4 proved the stock `Hello World`
front component renders on **both** the v2.41.0 and v2.42.6 images, and that the Communication
`Send message` **composer renders** (Channel SMS / Phone number / Message / Cancel / Send). W10-R5 then
proved the **timeline card also renders** — it is a **collapsed row by default**; expanding it shows the
persisted status, and its manual `Refresh` updates QUEUED→FAILED with the activity count staying one.

CURRENT RUNTIME (W10-R6): **logic-function execution is RESTORED** on the isolated v2.41.0 instance
(`twenty-comm-test-app2`, port 3101) via a **container-scoped DNS override** — two `--add-host`
entries pinning `registry.npmjs.org` and `registry.yarnpkg.com` to their real CDN IPs. This is
reversible by recreating the container without those flags. No host DNS, core source, SDK version,
generated dependency code or cache marker was changed. The unchanged v2.42.6 instance still returns
HTTP 500, which is the control. Verified after the fix: the dependency layer installs
(`.twenty-layer-ready`), `/communication/person-phones` → 200 with the real phone, the composer shows
populated phone options, and submitting with incomplete config returns a safe truthful result with
**0** records and **no** provider request. **Per-workspace execution isolation is still NOT PERFORMED**
(only one workspace is configured).

TIMELINE RENDERER (W10-R5): the timeline card **does** render — it is a **collapsed row by default**.
Expanding the row mounts the app's front component, which shows the persisted status. Verified in the
browser: status renders; QUEUED→FAILED becomes visible after the card's manual `Refresh`; the
activity count stays **1**; Refresh issues **0 writes** and exactly **2 reads**
(`/rest/timelineActivities/<id>` then `/rest/communications/<id>`). The earlier "timeline card does
not render" claim was **wrong**; no app change was needed.

SETTINGS CONTRACT (W10-R4, ownership corrected by W9-R2): provider configuration is
**workspace-owned**. The authoritative surface is the app-detail **Variables** tab
(`Settings → Applications → Communication → Variables`), which edits native workspace
`applicationVariables`. The app-registration **`Config` → "Server Variables"** screen is the
**historical shared route** and is no longer used (the registration variable table is empty for this
app). W9-R2 moved all 9 variables to `applicationVariables` with stable identifiers; the API keys
stay secret and are encrypted per workspace, and a fake value reads back masked (`F********`).
**Per-workspace execution isolation is NOT PERFORMED** because only one workspace is configured (execution itself is now restored on the isolated v2.41.0 instance — W10-R6).

RUNTIME BLOCKER: logic-function execution is blocked — `ensureDepsLayer` installs the app dependency
layer with Yarn 4.9.2 and cannot reach a package registry (`RequestError: connect ECONNREFUSED
127.201.0.114:443`; a controlled request returns HTTP 500). Registry access is **blocked**; the exact
cause is a host-level resolver returning loopback for the registry names. Other remedies (a reachable
registry mirror, a network policy change, a pre-seeded dependency layer) were **not** investigated.

The install also fixed three real app defects (invalid option UUIDs, a wrong `person` query shape,
an untyped status union). W10/W10-R1's "Windows CLI defect" and "wrong upload host" claims are
corrected in the W10 section: the upload-URL failure was a test-instance `SERVER_URL`
misconfiguration, and the remaining upload failure was a CLI/server version mismatch on the file
MIME constraint.

W7 (Workflow reuse of CommunicationSendAndPersistService) is **IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED**: the native Workflow contract reports a business failure as a SUCCESS step, and no supported app-side mechanism exists to fail the step without risking a duplicate send. The Workflow action is therefore unregistered and its entry refuses to send. See the W7 section.

The Jalali presentation program is complete; do not start another Jalali phase.
Branding remains planned. Do not start W7 or any other wave automatically.

Any future date work must stay presentation-only.
Do not change DB/API/GraphQL/domain/workflow-engine/cron canonical date semantics.
Do not introduce Enterprise entitlement bypasses unless explicitly requested.
```

---

# Task Execution Policy — LOCKED

For CRM implementation work:

- Use roughly **15–30 minutes as a sizing guide, not a mechanical hard limit**.
- Balance cohesion, risk, and duration. If closely related work forms one natural low-risk unit, keep it together even if it may run somewhat beyond 30 minutes. Split only when the task becomes genuinely multi-concern, high-risk, or too long to validate confidently.
- Prefer focused, deterministic, repeatable automated tests. Do not make screenshot/manual visual confirmation a required PASS criterion.
- UI screenshot/manual smoke may be supplemental only when the change is inherently visual; it never replaces proper automated validation.
- Run the smallest relevant test/typecheck/lint/build surface first. Do not run huge regression suites for small isolated changes unless the risk justifies them.
- Each task has one bounded architectural objective and no automatic next wave.
- Normal successful wave lifecycle is: **implement → focused validate/test → scope review → commit → push → verify HEAD==origin → report → stop**.
- Do **not** create separate tasks only for commit or push.
- If validation fails or scope is contaminated, do not commit; report and stop.
- Recovery/audit/architecture decisions are maintained separately in this Source of Truth and should not require implementation agents to create documentation-only waves.

---

# Communications W6 — Person timeline integration

> **HISTORICAL RECORD.** This section describes W6 as originally implemented. It contains two superseded claims, both corrected by W6-R1 and W6-R2 and marked inline below. For the authoritative current behavior see **Communications — authoritative current behavior** in the Current Checkpoint, and the W6-R1 / W6-R2 sections.

Status: **IMPLEMENTED / COMMITTED**, corrected by **W6-R1** and **W6-R2**; **code-review accepted**. **NOT live-verified** (see limitations).

## Mechanism (verified from source, not assumed)

The Person timeline is **not** updated automatically by the `communication.targetPerson` relation. `buildDirectRelationTargetShape` only matches a rule whose **source** object is the record being created — so a relation on the app object cannot emit an activity onto the Person. Two native mechanisms were verified instead:

- `defineTimelineActivityType` (`twenty-sdk/define`) declares the app-owned activity type. Its optional `emit` block is for automatic source-object events; this type deliberately has **no `emit`**.
- `createTimelineActivity` (`twenty-sdk/logic-function`) creates the activity explicitly, resolving the target field natively (`target<ObjectSingular>Id`) from universal identifiers.

Precedent: `packages/twenty-apps/fixtures/rich-app` (`post-card-created.timeline-activity-type.ts` with no `emit` + `on-post-card-created.function.ts` calling `createTimelineActivity`).

## Event / render path

```
communication row created (status QUEUED, providerId + recipient snapshotted)
  → database event trigger  communication.created
  → logic function on-communication-created        (databaseEventTriggerSettings)
  → buildCommunicationTimelineActivityInput        (pure; snapshot only)
  → createTimelineActivity                         (native SDK helper)
       target:   Person (targetPersonId)
       linked:   the Communication record
  → timeline activity type communicationSent  [SUPERSEDED: the label was "sent a message" in W6; W6-R1 changed it to the outcome-neutral "communication"]
  → front component communication-timeline-card    (native renderer slot)
```

- **One activity per Communication.** It is created only on `created`, so a QUEUED creation and a later outcome update do not produce two cards.
- **Status is a snapshot**, read from the persisted activity properties — never from the live Communication row and never from current Person/config values.
- **Recipient and provider come from the persisted send-time snapshots.**
- **Timeline failure is isolated:** the handler catches, logs a stable classification server-side, and returns `processed: false`. It never changes the send outcome, never calls the provider, and duplicates no send/persistence orchestration.
- **No `emit` block**, so the platform does not create additional activities for this type.

## Status truth (presentation mapping)

`buildCommunicationTimelinePresentation` is a pure, tested function:

- `QUEUED` (or a missing status) → "Message queued", `isPending: true`; never reads as sent.
- `SENT` → "Message sent"; never reads as delivered.
- `DELIVERED` → "Message delivered" — the only status that sets `isDelivered`.
- `FAILED` → "Message failed" and exposes the stored failure reason; the reason is hidden for every other status.
- Channel is appended to the summary; the body is truncated to 140 characters.
- Credentials and raw diagnostics are never copied into the activity (asserted).

## W6-R1 — truthful renderer wiring and neutral label (HISTORICAL CORRECTION)

> Historical record of the first correction. Its renderer-wiring claim was itself superseded by W6-R2; the neutral label it introduced is still current.

Status: **IMPLEMENTED / COMMITTED** at `fd9e0988c6af4eca3b0e52ad6a387f3989eb50ac` (`fix(apps): render truthful communication timeline status`).

W6 shipped two defects, both corrected here:

1. **The renderer contract was assumed, not verified.** A front component in the timeline renderer slot receives only `timelineActivityId` (and `recordId`) through the execution context — **the activity row and its `properties` are never injected as props**. The W6 card read `event.properties`, so it would have rendered nothing. The card now loads the linked Communication through the supported `RestApiClient` path (`GET /rest/communications/<id>`), which is how app front components read data (Slack precedent).
2. **Status was frozen at creation time.** Because the card used the activity's creation snapshot, a communication that was later updated could keep showing "Message queued". The card now renders the **current persisted status** read from the record at render time, with explicit `LOADING` and `UNAVAILABLE` states. A missing or inaccessible record is reported as unavailable — **never as QUEUED and never as success**.

Also corrected: the activity type label changed from `"sent a message"` to the outcome-neutral `"communication"`. The type exists for every recorded communication, so claiming "sent" was false while the outcome was still QUEUED. The **universal identifier is unchanged** (`a093b325-527d-4282-a0c9-9921745de0e2`).

### One activity per Communication, no provider involvement

The activity is still created only on `communication.created`, so a status refresh renders the same card with new data and never creates a second one. The timeline path reads through REST only: it does not import the provider registry, the send service, or the persistence orchestration, and it cannot trigger a send (asserted).

## W6-R2 — native data path and explicit refresh (CURRENT)

Status: **IMPLEMENTED / COMMITTED** at `10af7c560f583acc8f08d9b4ba1b13f9a8a742d0` (`fix(apps): load timeline activity and refresh explicitly`). This is the **authoritative** W6 behavior; the summaries in the Current Checkpoint restate it.

Two more defects in the timeline card, both corrected here:

1. **Wrong linked-record source.** The host injects only `timelineActivityId`; `recordId` is `null` for a timeline renderer (`useFrontComponentExecutionContext` sets `recordId: selectedRecordIds?.length === 1 ? selectedRecordIds[0] : null`, and no selection is passed for a timeline). W6-R1 wrongly treated the context record as the linked Communication. The card now loads the **timeline activity** by `timelineActivityId` (`GET /rest/timelineActivities/<id>`), reads its `linkedRecordId`, and then loads that Communication (`GET /rest/communications/<id>`). `context.recordId` is no longer used at all.
2. **The linked record is now validated.** A response without a `communication` payload means the linked id did not resolve to a Communication, which is reported as `LINKED_RECORD_NOT_COMMUNICATION` rather than rendered as a communication.

### Refresh behavior — MANUAL, not automatic

No subscription or invalidation mechanism is exposed to the front-component sandbox (the SDK exposes only host actions such as snackbars, navigation and clipboard — no query client or cache invalidation). The card therefore provides an explicit, localized **Refresh** action on pending or unavailable cards.

- Refresh re-runs the same read-only chain; it never creates an activity and never reaches a provider.
- A monotonically increasing request id discards stale responses, so a slow earlier load cannot overwrite a newer one.
- Refreshing resets the card to its loading state, and the button is disabled while a refresh is in flight.
- **The card does NOT update automatically.** A user must press Refresh to see a status change.

### Unavailable reasons (each localized by the component)

`NO_ACTIVITY_ID`, `ACTIVITY_NOT_FOUND`, `NO_LINKED_RECORD`, `LINKED_RECORD_NOT_COMMUNICATION`, `ERROR`. None of them renders as QUEUED or as success.

## W7 — Workflow entry point (IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED)

Status: implementation `d5a71d9232`, corrected by **W7-R1** `8b58018393`, then **disabled by W7-R2** `ce2cc9e0d1a08368efafdbf1a1ba9764dd3bccff`. **BLOCKED / NOT ACCEPTED.** **NOT live-verified.**

### Inspected native mechanism (source paths)

- `packages/twenty-shared/src/application/workflowActionTriggerSettingsType.ts` — `workflowActionTriggerSettings` (`label`, `icon`, `inputSchema`, `outputSchema`) exposes an app logic function as a Workflow step. **No core change is required.**
- `packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/logic-function/logic-function.workflow-action.ts` — result mapping:
  ```ts
  if (result.error) { return { error: result.error.errorMessage }; }
  return { result: result.data || {} };
  ```
  A returned `{ success: false, error }` therefore arrives as `actionOutput.result` (defined).
- `packages/twenty-server/src/modules/workflow/workflow-executor/workspace-services/workflow-executor.workspace-service.ts` — `processStepExecutionResult`:
  ```ts
  const isSuccess = isDefined(actionOutput.result);
  ...
  } else if (isSuccess) { stepInfo = { status: StepStatus.SUCCESS, result: actionOutput.result }; }
  ...
  return { shouldProcessNextSteps: isSuccess || isStopped || isSkipped || isFailedSafely };
  ```
  So a defined `result` ⇒ **step SUCCESS and downstream steps continue**.
- Same file, retry machinery: a thrown exception becomes `{ error, isUserError }`; then `if (isDefined(actionOutput.error) && !actionOutput.isUserError)` the executor retries while `stepHasRetryAttemptsLeft` (attempts from the author's `settings.errorHandlingOptions.retryOnFailure.value`, default `0`, capped at 3 by `STEP_RETRY_DELAYS_MS`).
- `logic-function-executor.service.ts` → `local.driver.ts` — a handler that **throws** yields `{ data: null, error: { errorType, errorMessage }, status: ERROR }`; the workflow action turns that into `{ error }`.

### The blocker (concrete)

There is **no supported app-side mechanism** to fail a Workflow step:

- `WorkflowActionOutput` (`shouldFailSafely`, `isUserError`, `shouldEndWorkflowRun`, …) is **server-internal**; it is not exported by `twenty-sdk` or `twenty-shared` and no app in the repository returns it.
- The only paths to `actionOutput.error` are (a) the logic function throwing, or (b) `result.error` from the driver. Both routes also feed the **retry** machinery.
- The user-facing exception codes that would suppress retry (`WorkflowStepExecutorException`, `LogicFunctionException`) live in `twenty-server` and are **not importable from an app**; fabricating an exception name to imitate them is not supported.

**Consequence:** returning `{ success: false }` reports the step as SUCCESS and lets downstream steps run; throwing instead risks Twenty's automatic step retry re-sending the message. Neither is acceptable, so W7 is **BLOCKED / NOT ACCEPTED** rather than shipped with a wrong contract.

### W7-R2 — disabled to prevent an unsafe offer (completed)

1. **Registration removed.** `workflowActionTriggerSettings` was deleted from `send-communication-workflow-action.ts`, so the built manifest no longer advertises a `Send Communication` action. Verified in the generated manifest: **zero** logic functions carry `workflowActionTriggerSettings`.
2. **Production entry refuses.** The function keeps its **unchanged universal identifier** (`e55f7b79-cf61-45b4-a1c4-259fa7089b28`) but its handler now returns a constant, before constructing any client or resolving configuration:
   ```
   success: false
   failureCode: 'WORKFLOW_ACTION_DISABLED'
   error: 'Communication sending from Workflow is unavailable.'
   ```
   It performs no provider, persistence, Person or HTTP call.
3. **Reusable code retained.** `sendCommunicationWorkflowHandler` and its focused tests remain for future work, but no trigger exposes them: the disabled entry never calls the handler (asserted with a spy).
4. **No alternative entry.** No HTTP, tool, cron, database-event or server-route trigger was added, and no configurable bypass re-enables sending.

#### Native behavior for existing Workflow steps (source-inspected, NOT live-verified)

- `logic-function.workflow-action.ts` resolves the step's logic function from the workspace's flat maps and throws `WorkflowStepExecutorException(INVALID_STEP_TYPE)` when the function is **missing**, or when its `workflowActionTriggerSettings` is **not defined**: *"Logic function <name> is not exposed as a workflow action"*. `INVALID_STEP_TYPE` is in `USER_FACING_STEP_EXECUTOR_EXCEPTION_CODES`, so such a step fails as a **user-facing** error rather than a system error.
- `from-logic-function-manifest-to-universal-flat-logic-function.util.ts` maps `logicFunctionManifest.workflowActionTriggerSettings ?? null`, so an app **upgrade/sync** writes `null` and the capability disappears for that workspace.
- **Unverified:** whether an already-installed workspace's existing workflow steps are updated on sync, and what an existing step renders before/after. No installation exists here, so no workspace, workflow or database was touched and nothing is claimed beyond the source reading above.

### W7-R1 corrections (completed)

1. **Unknown outcome wording.** The generic catch also covers "provider threw, then the FAILED-state write succeeded". A definite non-send cannot be inferred from that, and a stored `FAILED` status does **not** prove external non-delivery. It now returns the canonical uncertainty wording: *"The message may or may not have been sent. Check the communication history before re-running this step."* Both throw variants (FAILED write succeeds / fails) are tested.
2. **Subject coverage.** The previous subject test only asserted `result.success`. It now captures the message received by the fake provider **and** the `createCommunication` payload, asserting both equal the input and each other, plus omission when no subject is supplied.
3. **Shared validation.** W7 **refactored the Person handler** (`send-person-communication-handler.ts`) to use the new shared `validateCommunicationRequest`. W5's Person tests were updated accordingly — the W5 files were **not** left unchanged.

### Call path — HISTORICAL / INACTIVE (kept for reference only)

```
Workflow step "Send Communication"
  → app logic function communication-send-workflow-action   (workflowActionTriggerSettings)
  → sendCommunicationWorkflowHandler                        (thin adapter)
      validate via shared validateCommunicationRequest
      optional Person access + recipient-ownership validation
  → CommunicationSendAndPersistService.sendAndPersist       (certified durable path)
  → CommunicationSendService → ProviderRegistry → Kavenegar | RazPayamak
```

### Current behavior (authoritative)

The Workflow entry is **disabled**: no trigger is registered, and the handler returns
`{ success: false, failureCode: 'WORKFLOW_ACTION_DISABLED', error: 'Communication sending from Workflow is unavailable.' }`
before constructing any client. Nothing below this line executes in production.

### Outcome and retry semantics — HISTORICAL / INACTIVE (adapter retained for future work)

- `success: true` only for a completed send whose outcome was durably recorded.
- Normal `FAILED` → `PROVIDER_FAILED`, `isOutcomeKnown: true`.
- Known outcome, persistence failed → `OUTCOME_NOT_PERSISTED`, real `status` preserved.
- Provider threw (either FAILED-write variant) → `UNEXPECTED_FAILURE`, `isOutcomeKnown: false`, canonical uncertainty wording.
- Errors are returned as **data**, never thrown, so the adapter itself never triggers native retry.

### Retry / replay limitations (precise)

- **No durable idempotency.** "One provider call per invocation" holds only within a single execution.
- Because a failed step is reported as SUCCESS, **downstream steps continue** after a failed or unknown send.
- **Runtime timeout or a lost execution response after a possible provider send**: if the handler exceeds `timeoutSeconds` (30) or the execution response is lost, the platform records an execution error and the author's `retryOnFailure` can re-run the step — the adapter cannot observe or prevent that, and a duplicate message is possible.
- Author- or operator-initiated re-runs (retry workflow run) also send again.
- Delivery has no evidence source yet, so `SENT` is never presented as `DELIVERED`.

## W8 — dependency/build boundary and version compatibility

Status: **IMPLEMENTED / COMMITTED** at `8ecbd449d633ddd248dfc08f3526fc34b0788cc0`. Live installation still **NOT PERFORMED**.

### Dependency findings

The app imported two packages it never declared, so both were supplied indirectly by the monorepo:

| Package | Where used | Correct scope | Why |
|---------|-----------|---------------|-----|
| `@sniptt/guards` | `isNonEmptyString` in production code | **`dependencies`** | Bundled into the logic-function runtime, so it must be a runtime dependency (matches Fathom / Call-recorder / Fireflies / Slack precedent, which all declare it in `dependencies`) |
| `vitest` | test files | **`devDependencies`** | Test-only (matches every app that ships tests) |

Also added `@typescript/native-preview` (`tsgo`), which the `typecheck` script needs, and a documented `build` script. **No business logic was rewritten and no framework was introduced.**

### Version compatibility — evidence separated by kind

**A. Published SDK symbols and successful app compilation (verified).**
The app imports `defineTimelineActivityType`, `createTimelineActivity`, `CreateTimelineActivityInput` and `useTimelineActivityId`. Published SDK versions were installed into throwaway directories and their `dist` typings inspected:
- `2.30.0`, `2.31.0` (and `2.31.0-alpha.1`), `2.33.0` — **missing** these symbols.
- `2.35.0` — **all present**; also verified present at 2.35.1, 2.37.0 and 2.38.0.
- **Note the SDK tag list has gaps** (`sdk/v2.30.0`, `sdk/v2.31.0`, `sdk/v2.31.0-alpha.1`, `sdk/v2.33.0`, `sdk/v2.35.0`, `sdk/v2.35.1`, …). Because no `2.34.x` SDK was ever published, "**the earliest published SDK version tested successfully**" is the accurate claim — **not** "the first SDK version that could ever work".
- The app **compiles and builds** against 2.35.0 (isolated build + full suite).

**B. Minimum server version supporting those features (source + tag evidence).**
The capability landed in a single commit, `2f27360df3` — *"Make timeline activity types a generic application contract (#24620)"* (2026-08-23). That commit added the manifest contract (`timelineActivityTypeManifestType.ts`), the server-side converter (`from-timeline-activity-type-manifest-to-universal-flat-timeline-activity-type.util.ts`), the SDK's `createTimelineActivity` helper, and the renderer-context field (`timelineActivityId`, wired from `EventRowDynamicComponent.tsx` as `timelineActivityId={event.id}`).

Release-tag containment (`git tag --contains 2f27360df3`):
- `sdk/v2.35.0` is the **first SDK tag** containing it.
- `twenty/v2.34.0` is the **first `twenty/` (server) tag** containing it.

So the evidence-based **minimum server release is 2.34.0** (the first server tag containing the capability), which is **earlier than the SDK version the app must compile against** (2.35.0). `engines.twenty` therefore stays **`>=2.35.0`**: the app requires the SDK at 2.35.0+, and 2.35.0 is also a valid server release, so the range is conservative and defensible rather than minimal. The server minimum was **not** inferred from the SDK version alone.

**C. Live-installed compatibility (PARTIALLY verified — W10-R2/W10-R3).**
The app **has** been installed and executed on the isolated instance (`twenty-comm-test-app`). The W10-R2 run installed it against **server v2.41.0** with the locked **2.35.0** app dependencies and its logic functions/routes executed (synthetic). A **v2.42.6** instance was also tried: it registered and served the app but could not execute logic functions because its dependency-layer install requires registry access (unavailable here). No claim is made about other live server versions.

**D. Future upgrade compatibility (NOT verified).**
Nothing is claimed about 2.36.0+ server releases, future SDK majors, or upstream merge behavior.

**Deployment note:** a real deployment must set a reachable `COMMUNICATION_PROVIDER` and the chosen provider's variables (see the settings requirement below); no live environment was configured in this wave.

### Reproducibility — lockfile and exact environment

- **Native convention:** every standalone app in `packages/twenty-apps` commits its **own `yarn.lock`** (verified with `git ls-files "*/yarn.lock"`: examples, fixtures, internal and public apps all do). W8-R1 adds the missing **app-local `yarn.lock`**. The root `yarn.lock` and root `package.json` are **untouched** (verified with `git status`).
- **Exact environment used for isolated verification:** Node **v24.16.0**, Yarn **4.13.0**, resolved `twenty-sdk` **2.35.0**, `twenty-client-sdk` **2.35.0**.
- **Node caveat (reported, not worked around):** every app's `.nvmrc` pins Node **24.5.0** (the root repo pins 24.16.0). **24.5.0 is not installed on this machine** (`nvm list` shows only 24.16.0), and installing a runtime or altering global configuration is out of scope. The isolated copy therefore ran on **24.16.0**; the declared Node pin could **not** be exercised. The `.nvmrc` itself was left in place and the working tree untouched.

### Isolated verification (performed, with the lockfile)

A disposable copy outside the monorepo (`D:\twenty-iso-comm2`) containing **only** the app's source and configuration plus the committed `yarn.lock` — no `node_modules`, no `dist`, no parent packages:

- `yarn install --immutable` → **succeeded** (lockfile honoured; no borrow from the monorepo).
- `yarn test` → **165/165 tests pass**.
- `yarn typecheck` (`tsgo -p tsconfig.spec.json`) → **pass**; `tsc --noEmit -p tsconfig.json` → **pass** (both relevant typechecks).
- `yarn lint` (`oxlint`) → **0 warnings / 0 errors**.
- `twenty dev:build` → **build succeeded (14 files)**.

**Claim corrected:** W8 previously said the boundary was "independently reproducible". What is actually proven is that the app's **dependency and build boundary** installs and passes from its own declared dependencies and lockfile, on **Node 24.16.0 rather than the declared 24.5.0**. Exact-pin reproducibility is **not** verified.

### REQUIRED NATIVE SETTINGS SURFACE — NATIVE VARIABLES TAB IS AUTHORITATIVE (W9-R1, ownership corrected by W9-R2)

> **Update (W9-R2):** the authoritative surface is the app-detail **Variables** tab at **Settings → Applications → Communication → Variables**, and it now edits **workspace** application variables (the app declares `applicationVariables`, not `serverVariables`). The app-registration `Config` → "Server Variables" screen is the **historical shared route** and is no longer used. A custom settings tab remains **retired** (Twenty hides the Variables tab whenever a custom settings tab exists, and the published SDK exposes no app-side variable editor). The retained `buildCommunicationSettingsView` mapper is still **inactive in the UI** (no registered consumer). Readiness feedback and richer per-provider UX remain **PLANNED / NOT IMPLEMENTED**.

A durable product/architecture requirement (recorded here, **not implemented in this wave**):

The Communication app must expose a **discoverable native settings entry** covering:

1. **Connections and implemented providers** — the providers the workspace can actually send with.
2. **Default provider selection** — the value of `COMMUNICATION_PROVIDER`, chosen from implemented providers only.
3. **Channel-specific configuration** — sender identity and per-channel options for implemented channels.
4. **Configuration feedback with honest limits** — what is *observable* (which provider is selected, whether the non-secret configuration fields are present) and clear messages for missing or invalid configuration, without echoing secret values. It must **not** claim readiness to send: credential completeness and provider connectivity are separate, currently unverified concerns.
5. **Permission-controlled administration** — only authorised workspace members may view or change provider configuration.

Constraints that must hold when this is built:

- Use Twenty's **supported app/settings capabilities** (app roles/permissions, application variables, connection providers, and the app's own settings surface). **Do not** build a custom core Settings page or a parallel credential database.
- **Secrets remain in native server-side secret storage** (`applicationVariables` with `isSecret: true`, encrypted per workspace). Stored secret values must **never** be returned to frontend code or written to record history — the UI may only learn whether a value is set.
- **Only implemented capabilities appear as usable controls.** Unsupported channels/providers must not appear as selectable dead controls.
- The disabled Workflow entry stays disabled; this requirement does not re-enable it.

**Status: LOCATION ESTABLISHED (W9-R1); richer UX PLANNED / NOT IMPLEMENTED.** The configuration surface is the **native Variables tab at Settings → Applications → Communication → Variables** (see the W9/W9-R1 section). A custom settings tab was attempted and retired, and no app-side application-variable editor is supported by the inspected SDK 2.35.0.

### Boundaries verified

- No production imports from `twenty-server` / `twenty-front` internals (the only match is a comment in a test naming the verified source file).
- No raw DB access; no `twenty-shared` imports.
- Platform access stays behind app-local SDK adapters (`RestApiClient`, `CoreApiClient`, `MetadataApiClient`).
- Stable universal identifiers unchanged; the Workflow entry remains **disabled and unregistered**.

## W9 / W9-R1 — native settings path (ACCEPTED at code level)

Status: W9 implementation `91961e601f`, **corrected by W9-R1** `64cc23d55852bb65a32b6d530ebe55727b14906b`. **ACCEPTED at code level.** **Live navigation NOT verified.**

### W9-R1 correction 1 — the custom settings tab was retired

W9 registered a custom settings front component. That was **wrong**, and it is now removed:

- **Verified defect:** `packages/twenty-front/src/pages/settings/applications/SettingsApplicationDetails.tsx` includes the **Variables** tab only when there is no custom settings tab:
  ```tsx
  ...(!hasCustomSettingsTab && displayedApplicationVariables.length > 0
    ? [{ id: VARIABLES_TAB_ID, title: t`Variables`, Icon: IconVariable }]
    : []),
  ```
  and `configurationTabId` becomes `CUSTOM_SETTINGS_TAB_ID` when one exists. A read-only custom tab therefore **replaced** the native variables screen that owns credentials and `COMMUNICATION_PROVIDER`. The W9 claim that both tabs coexist was **false**.
- **No supported app-side editor exists:** the published `twenty-sdk@2.35.0` exposes only `getApplicationVariable` (a read of non-secret variables). `twenty-client-sdk@2.35.0`'s `metadata` and `core` entries declare **no** variable mutation, and **no app in this repository** edits application variables from settings. The only editor is the native `updateOneApplicationVariable` mutation, guarded by `SettingsPermissionGuard(PermissionFlagType.APPLICATIONS)` + `WorkspaceAuthGuard` in `application-variable.resolver.ts`. **Scope of this limitation:** it was established against the **inspected published SDK 2.35.0**; a later SDK may expose an app-side editor, which would need re-inspection.
- **Decision (smallest supported solution):** **remove the custom settings registration** so the native Variables tab remains visible. The component was **deleted** (`src/front-components/communication-settings.front-component.tsx` retired explicitly) and the reserved identifier was withdrawn — it was never installed anywhere, so nothing needed deprecating. A `settings-registration` test now locks this decision (no `settingsFrontComponent` in the manifest or config).

### Authoritative configuration path

**Settings → Applications → Communication → Variables** (route shape `SettingsPath.ApplicationDetail` = `applications/:applicationId`).

That native tab manages, with no parallel system:

- `COMMUNICATION_PROVIDER` — default provider selection;
- `KAVENEGAR_ENDPOINT` / `KAVENEGAR_SENDER` / `KAVENEGAR_API_KEY` — Kavenegar configuration and credential;
- `RAZPAYAMAK_USERNAME` / `RAZPAYAMAK_SENDER` / `RAZPAYAMAK_API_KEY` (+ backup senders) — RazPayamak configuration and credential.

**Evidence level:** source-inspected (front-end tab condition and the server mutation's guards). **Live navigation is NOT verified** — the app is not installed, so the path has never been exercised at runtime.

### W9-R1 correction 2 — readiness claims removed

W9 reported "Ready to send" and an `isReady` flag. That was **unproven**: presence of non-secret configuration says nothing about whether the secret credential is set, and nothing about connectivity. Both are now removed from the mapping.

**The retained mapping is INACTIVE in the UI.** `buildCommunicationSettingsView` is a pure module with no registered consumer: it was written for the retired settings component, and nothing in the app renders it. It is kept as a tested specification of what may be observed; it is not part of any user-visible surface.

The mapping reports **only what is observable**:

- the selected default provider (rejected if it is not an implemented provider);
- per-provider presence of the **non-secret** configuration fields;
- the implemented channels (`SMS`).

When every visible field is present it states: *"A default provider is selected and its non-secret configuration is present. **Credential completeness and connectivity are NOT verified.**"* No provider request, test SMS or readiness endpoint was added.

### Permissions and secrets (source-inspected)

- **Authorization:** editing application variables goes through `WorkspaceAuthGuard` + `SettingsPermissionGuard(PermissionFlagType.APPLICATIONS)`. UI visibility is not treated as authorization; this app adds no authorization logic and exposes no privileged action.
- **Secrets never reach the frontend:** `ApplicationVariableService` filters by `isSecret` before exposing variables, and `getApplicationVariable` reads only the sandbox's `process.env.applicationVariables`. **Scoped claim:** nothing in this app's **frontend and settings code** reads `KAVENEGAR_API_KEY` / `RAZPAYAMAK_API_KEY` or requests plaintext. Provider drivers necessarily read their own credentials **server-side** when sending; that is unchanged and intended.
- **No parallel storage:** configuration stays in the declared native application variables (workspace `applicationVariables` since W9-R2); nothing is duplicated into Communication records, `localStorage`, frontend state or a new object.

### Validation

- **Production-code tests:** 12 tests across `communication-settings-view.test.ts` (9) and `settings-registration.test.ts` (3) — implemented providers only, default marking, missing provider, unknown provider id rejected, missing non-secret configuration, **no readiness claim even when all visible fields exist**, blanks treated as missing, implemented channels only, no credential value in the output, and the registration decision (no `settingsFrontComponent`). **177 tests / 21 files PASS.**
- **Manifest/build wiring:** app build PASS (**14 files**); the manifest registers **no** `settingsFrontComponent`, and still carries 2 front components (composer, timeline card), 4 logic functions and **0 Workflow actions**.
- **Isolated validation** against published `twenty-sdk@2.35.0` with the committed lockfile: `yarn install --immutable`, tests (177/177), `yarn typecheck`, lint and `twenty dev:build` all **pass**.
- **Live navigation: NOT verified.** Source inspection and a green build are not runtime evidence.

### Remaining work

Richer per-provider configuration UX (validation guidance, provider-specific fields, connection testing) is **PLANNED / NOT IMPLEMENTED** and is blocked on a supported app-side editing mechanism. Until then the native Variables tab is the single configuration surface.

## W10 / W10-R1 / W10-R2 — installed-app verification

Status: **INSTALLED; API/event execution VERIFIED on the isolated v2.41.0 instance after the W10-R6 registry fix** (the unchanged v2.42.6 instance still returns HTTP 500). Browser rendering is **PASS** (W10-R4/R5). The app is registered, uploaded and metadata-synced on the isolated instance. Provider configuration was deliberately kept incomplete: **no real SMS or provider request was made**.

### 1. Historical blockers — RESOLVED / CORRECTED

The W10 / W10-R1 claims are retained only as history; W10-R2 supersedes them with observed evidence.

| Old claim (W10-R1) | W10-R2 finding |
|--------------------|----------------|
| "Windows CLI upload defect blocks all metadata sync" | The failure was **not** a Windows-only defect. Running the CLI from a Linux container still failed until the real causes were fixed (below). The backslash symptom is Windows-specific, but it was not the only blocker. |
| "Second upload batch targets the wrong host (port 2020)" | **Corrected.** `file-upload-target.service.ts` builds `uploadUrl` from `SERVER_URL` (`${serverUrl}/${ApiPath.FileUpload}/${fileId}?token=…`). The test instance's `SERVER_URL` defaulted to `http://localhost:2020`, so the server itself handed out an unreachable upload URL. This is a **test-instance configuration** issue, not a CLI defect; it was fixed by setting a reachable `SERVER_URL`. |
| "No environment prerequisite" | **Resolved.** A disposable Linux CLI environment and a reachable `SERVER_URL` now exist. |

### 2. Toolchain — verified (executable path and version)

| Tool | Path / version | Role |
|------|----------------|------|
| Workspace SDK (source, unused for the install) | `packages/twenty-sdk` — **2.42.0** | monorepo source; never used to apply the app |
| App-locked published SDK | `twenty-sdk@2.35.0` (from the app's committed `yarn.lock`) | the dependency the app is pinned to |
| Locked CLI (2.35.0) | `/work/app/node_modules/twenty-sdk/dist/cli.cjs` — **2.35.0** | used first; **failed** on the server's file constraint |
| Install CLI (server-aligned) | `/usr/local/bin/twenty` — **2.41.0** (`npm i -g twenty-sdk@2.41.0`) | performed the successful upload + sync |
| Node / Yarn (Linux) | `v24.21.0` / **4.13.0 in-app** (the W10-R2 report's "1.22.22" was read outside the app; see W10-R3 §1) | inside `node:24-bookworm` |

The 2.35.0 CLI uses the legacy `uploadApplicationFile` mutation, which does not satisfy the v2.41.0 server's `CHK_FILE_PENDING_MIME_OCTET_STREAM` constraint (`status = 'PENDING'` requires `mimeType = 'application/octet-stream'`), producing `new row for relation "file" violates check constraint "CHK_FILE_PENDING_MIME_OCTET_STREAM"`. A published CLI at the server's own version (2.41.0) was used instead. **No app dependency was changed, no SDK source was patched, and no CLI was hand-modified.**

### 3. Environment (isolated; real stack untouched)

| Aspect | Value |
|--------|-------|
| Instance | `twenty-comm-test-app`, host port **3100** → container 2020 |
| Image | `twentycrm/twenty-app-dev:v2.41.0` (pinned digest), server **v2.41.0** |
| Network | user-defined `twenty-comm-test-net`; instance reachable as `twenty-comm-test-app:2020` |
| `SERVER_URL` | **`http://twenty-comm-test-app:2020`** (authorised config change on the isolated instance only) |
| Volumes | `twenty-comm-test-app-data`, `twenty-comm-test-app-storage` (dedicated, preserved across the restart) |
| CLI environment | container `twenty-comm-cli` (`node:24-bookworm`) on the same network; app copied **without** Windows `node_modules`/`dist`/`.twenty`; installed from the app's locked `yarn.lock` |
| Workspace | seeded `apple` (`20202020-1c25-4d02-bf25-6aeccf7ea419`) preserved (1 workspace before and after) |
| Credentials | test API key kept outside Git at `D:/twenty-comm-test/.test-api-key`; never printed |

No change was made to the real stack, source `.env`, global host configuration, or the container's ports/volumes. **No proxy that rewrites signed URLs was created.**

### 4. Installation — registration → upload → sync (all three succeeded)

1. **Registration:** application `Communication` (`768bca20-0b81-4d33-a624-0a894a193ffd`).
2. **Upload:** **14 / 14 files**.
3. **Sync:** `Plan: 92 to add, 0 to change, 0 to destroy` → `✓ Synced Communication (14 files)`.

Verified in the test database for application `Communication`: **1** object (`communication`), **4** logic functions, **1** timeline activity type, **2** front components, **1** command-menu item (`Send message`, `RECORD_SELECTION`), and **9** application-registration variables with correct secret flags.

### 5. App defects found and fixed (W10-R2)

Three real defects were found **by the install**, not by code review, and fixed in the app:

| # | Defect | Fix |
|---|--------|-----|
| 1 | Five `communication` option ids were **not valid UUID v4** (wrong version/variant nibbles) → `INVALID_FIELD_INPUT: Option id is invalid` for `status` and `direction`. | Replaced with valid v4 ids in `communication.object.ts`. |
| 2 | `find-person-phone-options.ts` queried `person` as a **connection** (`__args.first`, `edges.node`), but the workspace `person` field is **singular** and takes only `filter` → live `HTTP 500: no typing defined for argument 'first'`. | Query `person(filter: …) { id phones { … } }` and read `result.person`. Tests updated to the verified shape. |
| 3 | `CommunicationOutcomeFields.status` was `string`, not the generated enum, so the app did not typecheck. | Typed as the `'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'` union. |

After the fixes: **typecheck PASS**, **177 focused tests PASS**, **oxlint 0 warnings / 0 errors**, and a re-sync of the two changed logic functions succeeded.

### 6. Live runtime checks — actual results

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Native Variables surface (declared variables readable) | **PASS** | `findApplicationRegistrationVariables` returns all 9 keys with `isSecret` correct |
| 2 | Secret masking with a fake value | **PASS** | Set a fake `KAVENEGAR_API_KEY`; read-back is `•••••••••••••`, `isFilled: true`; the value is never echoed |
| 3 | Person "Send message" composer registered for Person | **PASS (registration)** | front component `SendMessageComposer` + command-menu item `Send message` (`RECORD_SELECTION`, Person) synced. React render **NOT PERFORMED** (needs a signed-in browser session) |
| 4 | Authenticated `/communication/person-phones` route | **PASS** | `HTTP 200 {"success":true,"phones":[{"id":"primary","value":"5552345678","isPrimary":true}]}` |
| 5 | Safe failure with incomplete configuration | **PASS** | `HTTP 200 {"success":false,"failureCode":"UNEXPECTED_FAILURE","isOutcomeKnown":false}`; a recipient not owned by the Person returns `INVALID_INPUT`; **0** Communication records were created; no provider request |
| 6 | Workflow sending action absent live | **PASS** | `workflowActionTriggerSettings` is empty for `communication-send-workflow-action`; the built manifest advertises **0** Workflow actions |
| 7 | Synthetic `QUEUED` record → database-event delivery → timeline activity | **PASS (synthetic)** | A record created through the supported API produced exactly **1** timeline activity via the `communication.created` database event |
| 8 | Update to `FAILED` → manual Refresh, same activity | **PASS (synthetic)** | Activity count stayed **1** after the update; the REST refresh chain `timelineActivities/<id>` → `linkedRecordId` → `communications/<id>` returned `status: FAILED` for the same activity |

### 7. Synthetic evidence vs. real-provider proof

The evidence above is **synthetic integration evidence**: the record was created through supported APIs and no provider was contacted. It proves registration, upload, sync, route execution, database-event delivery and timeline rendering. It is **not** a real-provider end-to-end proof: no Kavenegar/RazPayamak request was made, delivery receipts are unverified, and the composer's React render was not exercised.

**Retained limitations:** real-provider sending, delivery receipts, the exact Node 24.5.0 pin, future upstream upgrade compatibility, and W7 (disabled, blocked, not accepted) all remain unverified / blocked.

## W10-R3 — signed-in browser verification and evidence reconciliation

> **CORRECTED BY W10-R4.** The W10-R3 conclusion that "front components do not render in this environment" was **wrong** — it was caused by an **expired browser session**. W10-R4 proved the stock `Hello World` front component **does** render on both the v2.41.0 and v2.42.6 images, and that the Communication composer renders too. Read §4 below as historical and superseded by the W10-R4 section.

Status: **browser pass PERFORMED**. UI navigation **PASS**; ~~in-app front-component rendering FAIL (environment)~~ → **CORRECTED (was a session artifact)**; timeline card status render + Refresh **NOT PERFORMED**.

### 1. Deployed toolchain — recorded and distinguished

| Role | Tool | Version |
|------|------|---------|
| Build SDK (app's locked published SDK) | `twenty-sdk` (devDependency, from the app's `yarn.lock`) | **2.35.0** |
| Generated client | `twenty-client-sdk` (from the same lockfile) | **2.35.0** |
| Installation CLI (locked, first attempt) | `twenty-sdk` **2.35.0** — failed on the server file constraint | **2.35.0** |
| Installation CLI (successful) | `npm i -g twenty-sdk@2.41.0` → `/usr/local/bin/twenty` | **2.41.0** |
| Install-time Node / Yarn | `node:24-bookworm` | Node **v24.21.0**, Yarn **4.13.0** |
| Server (isolated instance) | `twentycrm/twenty-app-dev` | **v2.41.0** (used for W10-R2 runtime checks); **v2.42.6** was also tried (see §5) |

**Yarn reconciliation (corrects a W10-R2 ambiguity).** The app declares `packageManager: yarn@4.13.0` and its `yarn.lock` is a Berry lockfile (`__metadata.version: 8`). The W10-R2 report's "Yarn 1.22.22" was read **outside** the app directory (`/work`), where Corepack had not yet switched; it was **not** the Yarn used to install the app. Re-established inside the app:

- `cd /work/app && yarn --version` → **4.13.0** (the declared version).
- `yarn install --immutable` → **success**, lockfile **unchanged** (MD5 `aadbef644d43748b2c797751af6ef5c5`, identical to the committed lockfile and unmodified in git).

So the install **did** honour the lockfile, and immutable reproducibility **is** established for the declared toolchain. (The successful `twenty apply` was executed with `twenty-sdk@2.41.0` as a **global** CLI; it read the app's `package.json`/`yarn.lock` and uploaded them, and the resolved in-app `twenty-sdk`/`twenty-client-sdk` remained **2.35.0**.)

### 2. Test browser and instance configuration

- Signed in to the **isolated** instance with the seeded workspace account `tim@apple.dev` (workspace `apple`).
- `SERVER_URL` was set to `http://192.168.4.84:3100` (the host LAN address) so the **host browser** and the **Linux CLI container** both reach the same origin. A Docker-only hostname (`http://twenty-comm-test-app:2020`) is **not** reachable from the host browser and was therefore not used for the browser pass.
- Volumes preserved throughout; workspace `apple` and all data survived each restart (verified: 1 workspace, 1 `communication` object, 4 logic functions, 2 front components, 9 registration variables, 3 timeline activities).

### 3. Signed-in browser checks — actual results

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Settings → Apps → Communication opens | **PASS** | `/settings/applications/23f3ab89-3355-43a4-bf30-a0e9880e1840` rendered the app ("Generic outbound communication for People…", `0.1.0`, `Uninstall`) |
| 2 | Declared variables editable / fake secrets masked — **native Variables tab** | **NOT PERFORMED — NOT PRESENT** | The deployed front (v2.41.0, and v2.42.6) renders **no Variables tab** for this app because the workspace `applicationVariables` list is **empty** (`core."applicationVariable"` = 0 rows) and `settingsCustomTabFrontComponentId` is null. Masking itself was verified at API level (W10-R2): a fake `KAVENEGAR_API_KEY` reads back as `•••••••••••••` |
| 3 | Person **Send message** opens the actual composer | **PASS (opens + renders) — corrected by W10-R4** | The command menu lists `Send message · Communication`; clicking it opened a side panel titled `Send message`. In this session the panel body was empty (expired session); W10-R4 confirmed the composer **does** render (Channel SMS / Phone number / Message / Cancel / Send) |
| 4 | Phone options appear from the authenticated route | **PASS (renders) / NOT PERFORMED (data) — corrected by W10-R4** | The composer form **does** render (W10-R4); its phone-options data call is blocked by the registry execution blocker |
| 5 | Deliberate submission with incomplete config shows a safe result | **NOT PERFORMED (browser)** | Blocked by the registry execution blocker. The same behaviour **PASSES** at API level (W10-R2): safe `UNEXPECTED_FAILURE`, **0** Communication records, no provider call |
| 6 | Timeline card renders the persisted status | **PASS — corrected by W10-R5** | The card is a **collapsed row by default** (26 px summary); expanding it mounts the front component, which renders the persisted status |
| 7 | Update to `FAILED` → click Refresh → status changes, activity count stays 1 | **PASS — corrected by W10-R5** | QUEUED→FAILED became visible after the card's `Refresh`; activity count stayed **1**; Refresh issued **0** writes and exactly **2** reads |

### 4. The blocker claimed here (SUPERSEDED — see W10-R4)

> **This section was incorrect.** It reported that front components "do not mount" because the lazy `FrontComponentRenderer` chunk was never requested and the sample `Hello World` command was "also empty". W10-R4 established that the browser session had **expired** before those checks, so every panel was empty for a session reason. With a fresh session, `Hello World` renders on both images and the Communication composer renders. The observations below (no chunk request, no iframe, no error) were real **for an unauthenticated session** and must not be read as a platform defect.

### 5. Server-version attempt and why v2.41.0 was retained

The deployed front (v2.41.0) renders an application detail UI that predates the native Variables tab. A newer image **v2.42.6** was tried (volumes preserved, `appVersion: v2.42.6`, data intact). Findings:

- The v2.42.6 front bundle **does** contain the application Variables tab (`SettingsApplicationDetails-*.js` reads `applicationVariables` and gates the tab on a non-empty list) — but it is still **hidden here** because the workspace variable list is empty.
- v2.42.6's logic-function driver installs the app dependency layer at first execution via **Yarn 4.9.2**, and the container **cannot reach package registries** (`registry.yarnpkg.com` / `registry.npmjs.org` resolve to loopback inside the container), so every logic-function execution fails with `connect ECONNREFUSED`. **SUPERSEDED (W10-R6):** the earlier claim that "v2.41.0 executes logic functions directly" was **wrong** — v2.41.0 uses the *same* `ensureDepsLayer` dependency-layer install and fails identically without registry access; it only succeeded in W10-R2 because its layer was already cached.
- v2.41.0 **cannot** be restored after the 2.42.6 migration (the DB migration is not backward-compatible), so the instance stays on v2.42.6 with the dependency-layer limitation documented above.

### 6. App changes in this wave

**None.** No app-local defect was exposed by the browser pass (its "rendering failure" was a session artifact — see W10-R4). No core edit, SDK upgrade, new channel, or Workflow enablement was made.

### 7. Remaining limitations

- Real-provider end-to-end sending and delivery receipts: **UNVERIFIED** (no provider credentials, no request).
- Native Variables tab visibility: **RESOLVED by W9-R2** — the app now declares workspace `applicationVariables`, and the tab renders all 9 variables (verified live on v2.42.6). Runtime execution of configured values is now **restored on the isolated v2.41.0 instance (W10-R6)**.
- Per-workspace **execution** isolation (two live workspaces with distinct configuration and no cross-workspace inheritance): **NOT PERFORMED** — it requires **two configured workspaces**; only `apple` is configured. Data-model isolation (`workspaceId`-scoped rows, workspace-key encryption, workspace-only env map) **is** verified.
- Front-component rendering, and therefore the timeline card body/Refresh button: **PASS** (the composer, stock front components and the timeline card all render — W10-R4/R5).
- v2.42.6 logic-function dependency-layer install: **BLOCKED** (registry names sinkholed; no scoped fix applied to that instance).

## W10-R4 — test-runtime restoration, front-component trace, settings contract

Status: **runtime restored at the image level; logic-function execution BLOCKED (registry access unavailable)**; **front components PROVEN to render** (corrects W10-R3); **Communication composer renders**; its "timeline card still not rendering" finding was **later proven wrong (W10-R5 — the card is a collapsed row by default)**; **settings contract resolved and verified live**.

### 1. Current runtime (established)

| Instance | Image | Port | Role |
|----------|-------|------|------|
| `twenty-comm-test-app` (app1) | `twentycrm/twenty-app-dev:v2.42.6` | 3100 | the migrated instance (preserved for diagnosis) |
| `twenty-comm-test-app2` (app2) | `twentycrm/twenty-app-dev:v2.41.0` | 3101 | **fresh**, NEW volumes, seeded `apple` workspace + stock sample apps + the Communication app installed (92 entities) |

**Controlled failure (one request, app2, fresh v2.41.0):**

```
POST http://192.168.4.84:3101/s/communication/person-phones
-> HTTP 500 {"code":"ROUTE_TRIGGER_PLATFORM_ERROR","messages":["Logic function execution failed for 73072230-..."]}
```

**Root cause — registry access blocked (not an app defect).** Inside the container the logic-function driver installs the app dependency layer with Yarn 4.9.2 and fails:

```
➤ YN0001: │ RequestError: connect ECONNREFUSED 127.201.0.114:443
   at LocalLayerManagerService.ensureDepsLayer (.../local-layer-manager.service.js:26)
```

- `registry.yarnpkg.com` → `127.201.0.114` and `registry.npmjs.org` → `127.201.0.55` **inside the container** — because the **host itself** resolves them to loopback: `Resolve-DnsName` on the Windows host returns the same `127.201.x.x`, and even a direct query to `8.8.8.8`/`1.1.1.1` returns loopback (the resolver answer is rewritten upstream). `github.com` resolves correctly (`140.82.121.4`), so the filter is **selective**, not a total network outage.
- The container has only Docker's internal resolver (`nameserver 127.0.0.11`, `ExtServers: [host(192.168.65.7)]`) and therefore inherits the host's rewritten answers. There is **no `/etc/hosts` entry** and **no container-level override** to change.

**Concrete blocker (SUPERSEDED by W10-R6):** restoring logic-function execution requires a package-registry host that actually resolves (a real, reachable registry). **Registry access was blocked by the host resolver.** This document did **not** claim that changing global host DNS is the required remedy, and W10-R6 confirmed it was **not** — a **container-scoped `--add-host`** pointing the two registry names at their real CDN IPs restored the install while leaving host DNS untouched. No global DNS edit, verification disabling, or dependency patching was performed. **The v2.41.0 image is not itself broken** — it fails for the same registry reason now (see §5).

### 2. Front-component trace — stock `Hello World` (signed-in browser)

`Hello World` renders on **both** instances:

| Instance | Panel content | Sandbox |
|----------|---------------|---------|
| v2.41.0 (app2) | full component output (USER ID, EXECUTION CONTEXT JSON) | iframe `srcdoc` ≈ 937 KB |
| v2.42.6 (app1) | full component output (USER ID, EXECUTION CONTEXT JSON) | iframe `srcdoc` ≈ 981 KB |

Traced boundary: command-menu item → `frontComponentId` = `7b051d47-04a2-5995-a5a1-1fb624bcdb4f`; the side-panel page is `SidePanelFrontComponentPage` (`viewableFrontComponentId` state, set by `useOpenFrontComponentInSidePanel`); the renderer mounts a **sandbox iframe** with the component's `srcdoc` (front components run in an iframe/worker sandbox, not a top-level module chunk). `frontComponentSharedDependenciesChecksum` is `null` for every installed component and the built bundles have no external imports, so **no shared-dependencies or functions-domain fetch is required** for rendering.

**Correction to W10-R3:** the "front components do not render in this environment" finding was **wrong**. In W10-R3 the browser session on app1 had **expired** ("You must be authenticated to perform this action.") before the composer checks, so the panels were empty for a **session** reason, not a platform one. `Hello World` renders on both images; no front-component platform defect is established.

### 3. Communication composer — renders

On the fresh v2.41.0 instance (app2), with the Communication app installed, `Send message · Communication` opens a **fully rendered composer**:

```
Send message | Channel | SMS | Phone number | No phone number | Message | Cancel | Send
controls: SELECT(SMS), SELECT(No phone number), TEXTAREA, BUTTON(Cancel), BUTTON(Send)
```

The `Phone number` selector shows `No phone number` and an **Error** appears, because the composer's phone-options call hits the same blocked logic function (HTTP 500). So the **composer UI renders**; only its data call is blocked by the runtime blocker in §1.

### 4. Settings contract (source-inspected + verified live)

Two **separate** stores, exactly as the SDK types them:

| Store | Manifest key | Server table | Native screen |
|-------|--------------|--------------|---------------|
| Registration variables (shared by all workspaces) | `application.serverVariables` | `core.applicationRegistrationVariable` | **Settings → Apps → [app registration] → `Config` tab → "Server Variables"** |
| Workspace variables (per workspace) | `application.applicationVariables` | `core.applicationVariable` | app-detail **`Variables`** tab (`SettingsApplicationDetailVariablesTab`) |

**Verified live (v2.42.6, app1):** the registration Config tab renders a `Server Variables` section — *"Server variables are applied to all workspace installations."* — listing **all 9** Communication variables (`COMMUNICATION_PROVIDER`, `KAVENEGAR_*`, `RAZPAYAMAK_*`), each editable, with the stored secret `KAVENEGAR_API_KEY` masked as `•••••••••••••`.

- Route: `/settings/applications/registrations/:applicationRegistrationId` (`SettingsPath.ApplicationRegistrationDetail`).
- Editor component: `SettingsApplicationRegistrationConfigTab.tsx` → `findApplicationRegistrationVariables` / `updateApplicationRegistrationVariable`.

**Workspace `Variables` tab requires a separate definition.** `SettingsApplicationDetails` renders it only when `displayedApplicationVariables.length > 0`; those come from `findOneApplication.applicationVariables` (workspace-scoped). The app declares **`serverVariables`**, so the workspace list is empty and the tab is correctly hidden. Materialising it requires declaring `application.applicationVariables`, which **is** supported by the declared SDK 2.35.0 type (`ApplicationConfig = Omit<ApplicationManifest, …>` includes both `serverVariables?` and `applicationVariables?`). **This wave made no such change** (no app edits). Conclusion: **the supported configuration route for this app's credentials is the registration `Config` tab**, and the earlier W9/W10-R2 search for a per-workspace "Variables" tab was looking at the wrong screen.

### 5. Historical v2.41.0 API/event evidence (separate from current runtime)

The W10-R2 API/event results were obtained on the **earlier** v2.41.0 instance **while its dependency layer was still cached** (the `deps-ready` sentinel existed, so `ensureDepsLayer` short-circuited and no registry fetch happened). Those results remain valid **as historical evidence**: routes returned 200, secret masking worked, and a synthetic `QUEUED` record produced exactly 1 timeline activity. They are **not** reproducible now, because the fresh instance has no deps layer and the registry is unreachable. This is an **environment** difference, not an app regression.

### 6. Timeline card — CORRECTED by W10-R5

> **This section was incorrect.** W10-R5 proved the card **does** render: it is a **collapsed row by default** (26 px summary) and mounts its front component only when the row is expanded. The row resolved the renderer correctly all along; nothing was broken. See the W10-R5 section.

### 7. Configuration changes and remaining checks

**Changes:** new volumes + a fresh v2.41.0 container (`twenty-comm-test-app2`, port 3101); `SERVER_URL=http://192.168.4.84:3101`; a test API key minted for `apple` and stored **outside Git** (`D:/twenty-comm-test/.test-api-key2`); a CLI remote `comm-test2`. The app1 instance and its volumes were **preserved untouched**; the real stack was not touched.

**Remaining checks:** composer submission / safe missing-config failure in the UI (blocked by §1); real-provider sending (never performed). The timeline card status + Refresh checks **PASS** (W10-R5).

## W10-R6 — isolated logic-function execution restored

Status: **RESOLVED — logic-function execution is restored on the isolated v2.41.0 instance**, and the Person composer was verified end-to-end through its real routes. The fix is a **container-scoped DNS override**; no core source, SDK version, generated dependency code or global DNS was touched.

### 1. What `ensureDepsLayer` actually needs (deployed v2.41.0)

`LocalLayerManagerService.ensureDepsLayer` (`/app/packages/twenty-server/dist/.../local/services/local-layer-manager.service.js`):

1. builds the layer at `/tmp/logic-function-executor-tmpdir/deps/<yarnLockChecksum>` (`get-local-deps-layer-path.util.js`);
2. short-circuits if the sentinel `.twenty-layer-ready` exists;
3. otherwise copies the app's `package.json` + `yarn.lock`, then runs `copyYarnEngineAndBuildDependencies`, which executes **Yarn 4.9.2** (`execFile(process.execPath, [localYarnPath, 'workspaces', 'focus', '--all', '--production'])`) with the inherited environment.

The dependency set is the app's own: `@sniptt/guards` (the only runtime dependency). Registry addresses are **Yarn's defaults** — `registry.yarnpkg.com` (and `registry.npmjs.org` for `npm` metadata) — with **no configurable registry override** in the driver. Configuration scope is therefore the **container's name resolution**, not the app.

### 2. The scoped solution

- **Diagnosis:** every package registry (`registry.npmjs.org`, `registry.yarnpkg.com`, `registry.npmmirror.com`, `npm.pkg.github.com`, `registry.npmjs.cf`) resolved to `127.201.x.x` from both the host and the container, while `github.com` resolved correctly. However, **egress to the real registry was fully functional**: `curl --resolve registry.npmjs.org:443:104.16.24.34 https://registry.npmjs.org/twenty-sdk` returned **HTTP 200** with correct metadata and valid TLS — so only **DNS** was broken.
- **Fix (native, container-scoped, reversible):** recreate only the isolated instance with two host entries — `--add-host registry.npmjs.org:104.16.24.34 --add-host registry.yarnpkg.com:104.16.24.34`. TLS verification and Yarn's integrity checks are **untouched** (real CDN hosts, real certificates). No `/etc/hosts` edit on the host, no DNS server change, no cache marker fabricated, no dependency code modified.
- **Applied to:** `twenty-comm-test-app2` only. **`twenty-comm-test-app` (v2.42.6) was left completely unchanged** (`ExtraHosts: null`) as the control.

### 3. Evidence — distinct levels

| Level | Result | Evidence |
|-------|--------|----------|
| **Network access** | **PASS** | From the container: `registry.npmjs.org` and `registry.yarnpkg.com` → HTTP 200 (previously `127.201.x.x`, HTTP 000) |
| **Dependency installation** | **PASS** | `/tmp/logic-function-executor-tmpdir/deps/aadbef644d43748b2c797751af6ef5c5/.twenty-layer-ready` created and `node_modules/@sniptt` installed |
| **Route execution** | **PASS** | `POST /s/communication/person-phones` → **HTTP 200** `{"success":true,"phones":[{"id":"primary","value":"5552345678","isPrimary":true}]}`. Control: the unchanged v2.42.6 instance returns **HTTP 500** `ROUTE_TRIGGER_PLATFORM_ERROR` for the same request |
| **Browser submission** | **PASS** | Composer rendered `Channel SMS / Phone number 5552345678 / Message / Cancel / Send`; submitting with incomplete config produced the truthful result *"The message may or may not have been sent. Check the communication history before retrying."* |
| **Provider sending** | **NOT PERFORMED** | **0** Communication records created by that attempt; **no** provider request in the logs (`kavenegar`/`payamak` absent); all nine workspace variables are **empty** (no credentials) |

Additional route check: `POST /s/communication/send` with a recipient not owned by the Person → `{"success":false,"failureCode":"INVALID_INPUT","error":"Selected phone number does not belong to this person."}`.

### 4. Workflow actions — still zero

The test instance advertises **0** Workflow actions: `core."logicFunction"` rows with a non-null `workflowActionTriggerSettings` = **0**, and all four Communication logic functions have an **empty** `workflowActionTriggerSettings`. W7 remains disabled; no fake production provider was added.

### 5. Environment change and how to reverse it

| Aspect | Value |
|--------|-------|
| Container | `twenty-comm-test-app2` (isolated) |
| Change | `HostConfig.ExtraHosts = ["registry.npmjs.org:104.16.24.34","registry.yarnpkg.com:104.16.24.34"]` |
| Preserved | image `twentycrm/twenty-app-dev:v2.41.0`, `SERVER_URL`, port `3101:2020`, network `twenty-comm-test-net`, volumes `twenty-comm-test-app2-data` + `twenty-comm-test-app2-storage` (data intact) |
| **Reversal** | recreate the container **without** the two `--add-host` flags (the volumes keep the data; the installed dependency layer lives in the container's `/tmp` and is rebuilt on demand) |
| Not changed | host DNS, core source, app SDK versions, generated dependency code, the v2.42.6 instance, the real stack |

### 6. Boundary — not a per-workspace isolation claim

The registry fix restores **execution** for the single `apple` workspace on app2. It does **not** demonstrate per-workspace execution isolation; that still requires **two** configured workspaces and remains **NOT PERFORMED**.

## W10-R5 — timeline renderer isolated and verified

Status: **RESOLVED — the Communication timeline card DOES render.** The earlier "timeline card does not render" finding was **wrong**; the card is a **collapsed row by default** and mounts only when the row is expanded. No app change was needed and none was made. All four W10-R5 verification checks **PASS**.

### 1. The failure boundary (concrete)

The deployed v2.42.6 timeline row (`pjn`) does **all** of the following correctly:

1. resolves the activity type (`PF`) → `frontComponentUniversalIdentifier = 762996db-f9e9-4781-8a88-3820b2943689`;
2. looks the front component up in the `frontComponentsSelector` store (instrumented `Array.find` captured the real call: 5 components, `foundUid = 762996db-…`, `foundId = 02d42791-fc74-45e6-a624-9dfc1d552ba0`);
3. builds `{ type: 'frontComponent', frontComponentId: '02d42791-…' }` (`ujn`) and passes it as `renderer` to `X9n`.

The boundary is inside `X9n`: it renders the **collapsed summary row** first, and the card body is mounted only when the row is expanded (the row's own "Expand details" control). Nothing was failing — the renderer was simply not mounted while collapsed. The 26 px row observed in W10-R3/W10-R4 was the **collapsed summary**, not a broken renderer.

### 2. Proof that the rendered card is the app's front component

The visible text exists **only** in the app's component bundle, never in the deployed front bundle:

| String | deployed `index-urwXLTGf.js` | app component `02d42791-…` |
|--------|------------------------------|-----------------------------|
| `Message failed` | 0 | 1 |
| `Message sent` | 0 | 1 |
| `Delivered` | 0 | 1 |
| `Refresh` | 0 | 10 |

So the timeline row **is** mounting `communication-timeline-card`; the native front has no such strings.

### 3. Browser verification (actual, signed-in, fresh session)

Instance: `twenty-comm-test-app` (v2.42.6), workspace `apple`, existing synthetic Communication `b4910847-5a18-4325-8672-1be56edf5073` and its existing activity `3265501c-0b41-4f41-a0d3-3a13836bfeb5`.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Reproduce with a fresh session | **DONE** | Row collapsed at 26 px, no iframe — reproduced |
| 2 | Stock front component renders in the same session | **PASS** | `Hello World` renders (USER ID + EXECUTION CONTEXT JSON) |
| 3 | Persisted status renders correctly | **PASS** | Expanded card: `Message failed · SMS / 5552345678 / W10-R2 synthetic integration record / W10-R2 synthetic failure` |
| 4 | QUEUED → FAILED visible after manual Refresh | **PASS** | Before: `Message queued · SMS … Refresh` → after clicking the card's `Refresh`: `Message failed · SMS … W10-R5 refresh test failure` |
| 5 | Same activity, count exactly one | **PASS** | DB: exactly **1** `timelineActivity` with `linkedRecordId = b4910847-…` (activity id unchanged) |
| 6 | Refresh performs reads only, never sends | **PASS** | Network capture during Refresh: **0** writes; exactly **2** reads — `GET /rest/timelineActivities/3265501c-…` and `GET /rest/communications/b4910847-…` |

The Refresh button is rendered only when the status is pending (`view.isPending`), which is the intended design: a failed/sent record has no re-read affordance.

### 4. App change

**None.** The timeline integration was already correct; the defect was in the **observation**, not the code. No core edit, no app workaround, no identifier change.

### 5. Separated blockers

- **Renderer:** **resolved** (this wave).
- **Registry/logic-function execution:** **still blocked** — unchanged and unrelated. `ensureDepsLayer` installs the app dependency layer with Yarn 4.9.2 and cannot reach a package registry (`RequestError: connect ECONNREFUSED 127.201.0.114:443`). This does **not** affect rendering (front components load from `/rest/front-components/<id>`, which works) and is **not** claimed to have a single possible remedy.

## W9-R2 — workspace-owned provider configuration (native application variables)

Status: **IMPLEMENTED / VERIFIED at source + build + UI level**. Provider credentials, sender identities and the default-provider selection are now **workspace-owned** native application variables. **Runtime execution (logic functions) remains BLOCKED**, so per-workspace *execution* isolation is **NOT PERFORMED**.

### 1. Native contract (verified in the locked SDK 2.35.0 and the server source)

| Aspect | Finding |
|--------|---------|
| Type (SDK 2.35.0) | `applicationVariables?: ApplicationVariables`, where `ApplicationVariable = SecretApplicationVariable \| NonSecretApplicationVariable`. Both require `universalIdentifier` (`SyncableEntityOptions`). `TypedApplicationVariable` adds `type?`, `options?`, `isDeprecated?`. Secret: `{ isSecret: true }`. Non-secret: `{ value?, isSecret?: false }`. |
| No `isRequired` | The application-variable contract has **no** `isRequired` field (only `serverVariables` does). Optional provider configuration is therefore optional by construction. |
| Materialisation | `compute-application-manifest-all-universal-flat-entity-maps.service.ts` iterates `manifest.application.applicationVariables`, encrypts each value with `secretEncryptionService.encryptVersioned(rawValue, { workspaceId })`, and creates a workspace-scoped `core.applicationVariable` row keyed by `universalIdentifier`. |
| Secret storage | `isSecret: true` → the stored value is `''` (never the plaintext); the entity enforces `CHECK ("value" LIKE 'enc:v2:%')`. The platform masks stored secrets (`getDisplayValue`). |
| Permission-controlled editing | `ApplicationVariableEntityResolver` is guarded by `WorkspaceAuthGuard` + `SettingsPermissionGuard(PermissionFlagType.APPLICATIONS)`; editing is the native `updateOneApplicationVariable(key, value, applicationId)` mutation. |
| Execution-context injection | The logic-function executor merges `{ ...serverVariables, ...workspaceVariables }` — registration values first, **workspace values win** — and only for the running workspace's own map. |
| Precedence (confirmed) | Workspace `applicationVariables` **override** registration `serverVariables` with the same key. |

**No app precedent exists in this repository** for editing application variables from app code: the only editor is the native settings surface. That is why the app declares the variables and lets the platform render them.

### 2. Implementation

Moved all nine variables from `serverVariables` to `applicationVariables` in `src/application.config.ts`:

- **Keys unchanged** (`COMMUNICATION_PROVIDER`, `KAVENEGAR_ENDPOINT`, `KAVENEGAR_API_KEY`, `KAVENEGAR_SENDER`, `RAZPAYAMAK_USERNAME`, `RAZPAYAMAK_API_KEY`, `RAZPAYAMAK_SENDER`, `RAZPAYAMAK_BACKUP_SENDER_ONE`, `RAZPAYAMAK_BACKUP_SENDER_TWO`).
- **Stable identifiers added** — nine new UUIDs in `src/constants/universal-identifiers.ts`. A changed identifier is treated by the platform as a different variable, so these are pinned by test.
- **`KAVENEGAR_API_KEY` and `RAZPAYAMAK_API_KEY` stay `isSecret: true`**; everything else is non-secret.
- **Nothing is required** — an unused provider cannot block installation.
- **`serverVariables: {}` — an explicit removal tombstone.** The platform only reconciles registration variables when the key is **present** (`application-registration.service.ts`: `if (isDefined(manifest.application.serverVariables))`), and `syncVariableSchemas` deletes every registration variable for the app when the declared set is empty. Omitting the key entirely would therefore **leave the previous shared rows behind**, so the app declares it empty and the sync removes them. This is removal through supported sync — never a direct DB write.
- **No provider/orchestration code changed.** The providers already read `process.env[name]` (`src/providers/config/read-required-env.ts`), and the executor injects both maps into that environment, so only the declaration moved.

### 3. Verification

| Check | Result |
|-------|--------|
| Focused tests | **184 PASS** (22 files), incl. 7 new contract tests |
| Typechecks | **PASS** (`tsgo -p tsconfig.spec.json` and the app config) |
| Lint | **PASS** — 0 warnings / 0 errors (78 files) |
| App build | **PASS** — 14 files |
| Immutable build | **PASS** — `yarn install --immutable` under the declared Yarn 4.13.0; lockfile unchanged (`aadbef644d43748b2c797751af6ef5c5`) |
| Built manifest | `serverVariables` **present and empty** (removal tombstone); `applicationVariables` **9**, correct `isSecret`, unique valid UUID v4 identifiers |
| Sync (isolated only) | v2.41.0 instance: `9 to add, 2 to change` then `No changes`; v2.42.6 instance: same |
| DB (isolated) | `core.applicationVariable` = **9 rows**, all `workspaceId = 20202020-1c25-4d02-bf25-6aeccf7ea419`, `applicationId = 23f3ab89-…`; `core.applicationRegistrationVariable` for Communication = **0 rows** (removed by the tombstone sync, verified on **both** instances) |
| Native **Variables** tab (v2.42.6, signed-in browser) | **PRESENT** — "Variables / Set your application configuration variables" with all 9 keys and a `Save settings` button |
| Secret masking (live) | Set a fake `KAVENEGAR_API_KEY`; read-back is **`F********`** (masked, not echoed); the unset `RAZPAYAMAK_API_KEY` reads empty |
| Non-secret values readable | `COMMUNICATION_PROVIDER`, `KAVENEGAR_ENDPOINT/SENDER`, `RAZPAYAMAK_*` all readable and independently settable |
| No silent inheritance of shared credentials | Registration variable table is **empty** for this app, so there is nothing to inherit; and workspace values take precedence anyway |
| **Per-workspace execution isolation** | **NOT PERFORMED** — see below |

**Note — `twenty apply` rewrites the app's generated API client.** Running `twenty apply` against a server whose schema differs from the app's locked `twenty-client-sdk@2.35.0` overwrote `node_modules/twenty-client-sdk`'s generated schema with that server's schema, which broke typecheck (`createCommunication`, `updateCommunication`, `person` "do not exist"). Restoring the pristine locked package from the offline Yarn cache (`yarn install --immutable`) returned typecheck to **PASS**. The committed app is unaffected (the client is a dependency, not app source), but a **local install can be left broken by a sync against a mismatched server**, so run `yarn install --immutable` before typechecking after any `twenty apply`.

**Runtime isolation is NOT PERFORMED.** The v2.41.0 and v2.42.6 instances both fail logic-function execution because the local driver installs the app dependency layer with Yarn 4.9.2 and **cannot reach a package registry** (`ensureDepsLayer` → `RequestError: connect ECONNREFUSED 127.201.0.114:443`, one controlled request → HTTP 500). Therefore two live workspaces with distinct non-secret configuration could not be exercised end-to-end. What **is** established: the variables are physically scoped by `workspaceId` in the DB, encrypted with the workspace key, and the executor reads only the running workspace's map — i.e. **data-model isolation is verified; execution isolation is not**.

### 4. Migration behaviour

- **Existing real installations:** **none were changed.** No real installation of this app was discovered, and only the two isolated test instances were synced.
- **Isolated test installations (v2.41.0 and v2.42.6):** the sync **added 9 workspace variables** and **changed 2** objects. It did **not** copy registration credentials into the workspace: the previous registration rows were **empty**, and the new workspace rows were created with empty encrypted values.
- **Shared declarations removed through supported sync:** the app declares `serverVariables: {}` as a removal tombstone, and `core.applicationRegistrationVariable` for this app is now **0 rows** on both isolated instances — so a workspace can no longer inherit a shared credential.
- **Upgrading an installation that had *populated* registration values:** because the registration variable rows are removed by the same sync, such values would be **dropped, not migrated**. The operator must re-enter them once in the workspace Variables tab. This is intentional (the shared values were not workspace-owned and must not be silently promoted), and it must be communicated in any future release note.

### 5. Corrections to earlier claims

- **Ownership model corrected.** The authoritative configuration surface is the app-detail **Variables** tab (`Settings → Applications → Communication → Variables`), which edits **workspace** application variables. The **app-registration `Config` → "Server Variables"** screen is the **historical shared route** and must no longer be used for this app's configuration.
- **Why workspace credentials must not use shared registration values:** `serverVariables` are stored once on the registration and are shared by every workspace that installs the app, so all workspaces would send with the same provider account and sender. Provider credentials and sender identities are per-workspace facts; sharing them is both a security and a correctness defect. Workspace values also override registration values in the execution context, so a leftover shared value would otherwise silently shadow the workspace value.
- **Stale composer-rendering claim corrected:** W10-R3's "front components do not render" was an expired-session artifact (corrected in W10-R4); the composer renders. Likewise W10-R3/W10-R4's "timeline card does not render" was wrong — the card renders and is simply **collapsed by default** (W10-R5).
- **Broad W0–W9 acceptance corrected:** "accepted at code level" never meant live-verified. The accurate position is: registration/upload/sync, the settings contract, the UI Variables tab, the front components, the composer **and the timeline card** are verified; **API/event execution is verified on the isolated v2.41.0 instance (W10-R6)**; real-provider sending is **NOT PERFORMED**.
- **Registry access:** was **blocked** by name resolution (`ensureDepsLayer` could not reach a package registry). W10-R6 proved that a **global DNS change was not required**: egress worked and a **container-scoped `--add-host`** restored the install. No global DNS, core source, SDK version, generated dependency code or cache marker was changed.
- W8 remains **accepted at dependency/build level only**; W7 remains **disabled and blocked**.

## W6 / W6-R1 / W6-R2 / W7 / W7-R1 verification — actual coverage vs. simulations

- **Actual production coverage:** the shipped modules are tested directly — `buildCommunicationTimelineActivityInput` (Person linkage, snapshot mapping, no-credential guarantee, `null` when no target person, one activity per communication), `loadCommunicationTimelineState` (the full `timelineActivityId → activity → linked Communication → presentation` chain, with `recordId: null` in the context, every unavailable reason, no error leakage, and read-only access), and `buildCommunicationTimelinePresentation` / `buildCommunicationTimelineView` (QUEUED/SENT/DELIVERED/FAILED truthfulness, refreshed status replacing the creation-time state, unavailable states, snapshot use, body truncation). 136 focused tests PASS.
- **Refresh coverage:** the tests drive the same Communication from QUEUED to SENT and to FAILED **through the implemented refresh path** (re-running the chain) and assert the rendered status changes while the activity id stays the same.
- **Still not verified (updated by W10-R2/W10-R3):** the **React render tree** of `communication-timeline-card` and the composer is **still NOT PERFORMED** — the front component does not mount on the isolated instance (environment-wide; see W10-R3). What **is** now verified: the actual **REST round trips** (`GET /rest/timelineActivities/<id>` → `linkedRecordId` → `GET /rest/communications/<id>`), **database-event delivery**, and that a timeline activity **is** produced in a real workspace — all exercised in W10-R2 with synthetic data.
- **W7 runtime-boundary vs simulation:** `workflow-step-status.contract.test.ts` **simulates** the documented server mapping (`{ result }` ⇒ `StepStatus.SUCCESS`, `shouldProcessNextSteps: true`) to lock the consequence in code. It is **not** a runtime test: the Twenty server is never executed here. Live Workflow execution remains **NOT PERFORMED**.
- **W7-R2 actual production coverage:** the shipped disabled entry is tested directly (valid input, empty and malformed input, and hostile input carrying senderId/workspaceId/enabled all return WORKFLOW_ACTION_DISABLED), together with configuration assertions (no workflowActionTriggerSettings, no alternative trigger, unchanged universal identifier) and a spy proving the reusable send handler is never called.
- **W7-R1 actual production coverage:** the shipped `sendCommunicationWorkflowHandler` and the shared `validateCommunicationRequest` are tested directly with injected client and registry — valid mapping reaching the durable service exactly once, subject preservation, unsupported channel / empty body / empty recipient preventing any send, Person access and recipient-ownership validation, normalized `FAILED`, initial-persistence failure preventing the send, `SENT` + outcome-persistence failure staying truthful, unknown double-failure staying unknown with no secret leakage, no automatic resend, and the absence of a required workspace member. 151 focused tests PASS.
- **W7 still not verified:** live Workflow execution. The app is not installed, so the step has never run inside a real workflow; manifest registration is wiring evidence only, not proof of execution.
- **Current validated totals (after W9-R1):** 177 focused tests PASS; typecheck PASS (`tsgo` spec config **and** `tsc` app config); oxlint 0/0 (77 files); app build PASS (14 files). Manifest confirms **1 object** (13 fields), **4 relation fields**, **4 logic functions** (1 database event `communication.created`, 2 HTTP routes, 1 **trigger-less disabled** function), **0 Workflow actions advertised**, **0 settings front components**, **2 front components** (composer, timeline card), **1 timeline activity type** (label `communication`, no `emit`, renderer wired) and **9 server variables** with `requiredServerVersionRange` **`>=2.35.0`**. An app-local `yarn.lock` is committed; isolated runs used Node 24.16.0 / Yarn 4.13.0 (declared Node 24.5.0 unavailable).
- W4 `CommunicationSendAndPersistService` unchanged; the timeline path cannot reach a provider and never uses `context.recordId`. **W7 did refactor the W5 Person handler** to use the shared validation.

