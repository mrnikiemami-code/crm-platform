# CRM Platform Recovery — Persian / RTL / Jalali Track

Last updated: 2026-09-28

## Purpose

This file is the recovery Source of Truth for the current Persianization / RTL / Jalali presentation work in the customized Twenty CRM fork.

If a chat/session is lost, start a new session and ask the assistant to read this file first, then continue from the **Current Checkpoint** section.

Repository: `mrnikiemami-code/crm-platform`  
Primary branch: `crm-platform`  
Local source path used during development: `D:\CrmSource\twenty`

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

---

# Stable committed baseline

The following important work is committed on the `crm-platform` branch.

## Persian locale foundation

Commit:

`6cf109d9ace39b72e2f863c9a8b811b86bd10d8b`

Purpose:
- fa-IR locale foundation
- locale registration
- date-fns/server/email locale wiring
- RTL-related locale support

## Windows/source development reliability

Commit:

`4af6644215cf337e06ba8c1f50fcb347fbf027f9`

Purpose:
- reliable Windows source startup
- Nx/Nest/worker startup fixes
- reduced worker/server race conditions
- Windows-compatible scripts

## Professional Persian localization

Commit:

`550e15631e9b0454e522bac1d3ad2eb06bc01d5f`

Purpose:
- broad fa-IR translation coverage
- terminology normalization
- corrected CRM terminology
- corrected impersonation wording

Key terminology decisions include:
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

Commit:

`23f717ed25b1e7cd235d942d4e84b82c33ec7eee`

Persian user-facing wording uses:
- `عملیات حساس`

## Record-table RTL resize

Commit:

`145845fbc9b2bbb78611cbac0c6045d7226068bd`

Purpose:
- correct RTL column-resize direction
- shared pointer-delta direction helper
- table and board resize behavior

## Record-table footer / tooltip / RTL

Commit:

`4f93e5005e49be49e0635b48cb7e7ec1170d6a61`

Purpose:
- aggregate footer logical alignment
- Persian aggregate phrasing
- truncated-text tooltip positioning
- shared tooltip positioning correction

The tooltip root fix changed the truncated-text tooltip positioning from document-relative `absolute` behavior to the safe shared `fixed` positioning path.

## Timeline “You” localization + click-away reliability

Commit:

`fa37575870d84367495fea97d35d3896a7ffa54a`

Purpose:
- timeline current-user label `You` now goes through Lingui; fa-IR = `شما`
- shared click-outside listener moved to the correct window capture path
- fixes first click-away being swallowed by d3/react-flow and requiring a second action
- workflow title, record title, inline fields and dropdown/picker smoke-tested

---

# Other accepted frontend fixes

These were completed during the same Persian/RTL track and should be preserved when reconciling local work.

## Theme summary localization

Status: PASS

The theme summary no longer exposes raw English values such as `Light`; display labels go through localization.

## Settings Section RTL

Status: PASS

Shared `Section.Root` alignment uses logical `text-align: start`.

Important:
Twenty front-end can consume `twenty-ui` from built `dist`, so after twenty-ui source changes a local `npx nx build twenty-ui` may be required before browser verification.

## TipTap placeholders

Status: PASS

Shared placeholder positioning uses logical `inline-start` instead of physical left positioning.

## Profile picture on Windows

Status: implemented and validated locally before this recovery file.

Root issue:
Windows path separators were stored in file metadata, breaking folder lookup and signed image retrieval.

Fix direction:
- normalize persisted file entity paths to POSIX
- tolerate legacy backslashes
- make by-ID reads robust
- reset ImageInput error state when URI changes

Before modifying this area again, inspect the current branch/local diff because this work may not have been committed with the Jalali track.

---

# Branding / white-label

Status: PLANNED / NOT STARTED

A local untracked planning file was reported as:

`docs/plans/branding-white-label.md`

It was intentionally not mixed into unrelated commits.

Architecture direction:
- create centralized instance-wide product branding configuration
- workspace display name/logo remains tenant identity
- do not rename technical package/project identifiers

Likely future fields:
- PRODUCT_NAME
- SHORT_PRODUCT_NAME
- COMPANY_NAME
- EMAIL_FROM_NAME
- TOTP_ISSUER
- SUPPORT_URL
- WEBSITE_URL
- brand logo / dark logo / favicon

Do not start branding unless explicitly requested.

---

# Jalali Presentation Program

## Overall target

For `fa-IR`:
- Persian/Jalali display
- Persian month names
- Persian digits for user-facing date/time text
- true Jalali calendar selection where a calendar picker exists

Canonical outbound values must remain ISO/Gregorian.

The core model is:

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

---

# Jalali Phase 1 — Foundation

Status: COMPLETE / ACCEPTED / CURRENTLY UNCOMMITTED LOCALLY

Important:
At the time this recovery file was created, Phase 1 changes existed in the developer's local working tree and had **not yet been committed**.

Completed:
- `CalendarSystem = 'persian' | 'gregory'`
- `getCalendarSystemForLocale(locale)`
  - exact `fa-IR` → `persian`
  - everything else → `gregory`
- `useDateTimeFormat()` exposes `calendar`
- Temporal-based Jalali utility layer
- ISO ↔ Persian PlainDate conversion
- Persian month options
- Jalali year range
- Persian/Arabic digit normalization to ASCII
- serialization guard ensures values leave the layer as ISO calendar values

Verified examples:
- 1405/01/01 = 2026-03-21
- 1405/07/06 = 2026-09-28
- leap/common Esfand behavior correct
- no `[u-ca=persian]` leakage

Live mismatch fixes:
- Gregorian grids explicitly use Gregorian calendar labels even under fa-IR
- January on Gregorian grid becomes `ژانویه`, not `دی`

No dependency was added.

---

# Jalali Phase 2 — Core Display

Status: COMPLETE / ACCEPTED / CURRENTLY UNCOMMITTED LOCALLY

Important:
At recovery-file creation time, Phase 2 was still part of the same local uncommitted Jalali working tree.

Central formatters now accept/use calendar-aware behavior:
- `formatPlainDateISOString`
- `formatDateISOStringToDate`
- `formatDateISOStringToDateTime`
- `formatDateISOStringToRelativeDate`
- `formatDateISOStringToCustomUnicodeFormat`
- dispatch through `formatDateString`
- dispatch through `formatDateTimeString`

Persian path:
- explicit `fa-IR-u-ca-persian`
- Persian digits
- existing user timezone preserved
- existing 12h / 24h preference preserved
- `Intl.RelativeTimeFormat` for Persian relative time

Verified display examples:
- 2026-03-21 → `۱ فروردین ۱۴۰۵`
- 2026-09-28 → `۶ مهر ۱۴۰۵`
- 2026-09-28T10:00Z in Asia/Tehran → `۶ مهر ۱۴۰۵، ۱۳:۳۰`
- relative examples: `امروز`, `دیروز`, `۳ ساعت پیش`

Custom Unicode date formats:
- existing custom patterns are date-fns/Gregorian-token based
- under Persian calendar, do not fake Jalali token support
- fall back to the user's standard localized date/date-time format

Date-only safety:
- date-only values retain UTC/plain-date semantics and do not shift a day

Non-fa path:
- current date-fns/Gregorian behavior preserved

Known unrelated old test issue (RESOLVED in Phase 3B):
- `src/utils/format/__tests__/formatDate.test.ts` had 3 old failures on Windows because its utility used `Intl.DateTimeFormat(undefined,...)` and therefore the host OS locale
- this was not a Phase 2 regression
- fixed in Phase 3B (explicit app locale, deterministic output)

---

# Jalali Phase 3A — True Jalali Picker + Typed Input

Status: COMPLETE / ACCEPTED / CURRENTLY UNCOMMITTED LOCALLY

Important:
At recovery-file creation time, Phase 3A was also still local and uncommitted.

## Jalali grid

New Twenty-owned Jalali calendar grid:
- 7 columns
- Temporal Persian calendar arithmetic
- correct month length/leap year behavior
- respects `calendarStartDay`
- selected-day and today states
- only used when `calendar === 'persian'`
- non-fa path continues using existing `react-datepicker`

## Month/year navigation

- Persian month names
- Jalali year list
- Persian calendar previous/next arithmetic
- Esfand ↔ Farvardin transitions work
- no Gregorian Date arithmetic for Persian navigation

## RTL

- logical positioning
- navigation chevrons mirror in RTL
- numeric editable date/time inputs are explicitly LTR on the Persian path to prevent bidi reordering

## DatePicker output

Example:
- `۱۴۰۵/۰۷/۰۶` / selected ۶ مهر ۱۴۰۵
- emits canonical `2026-09-28`

## DateTimePicker output

- Jalali date + local time
- existing timezone precedence preserved
- output remains ISO-calendar `Temporal.ZonedDateTime`

## Typed input

Accepts:
- Persian digits
- Arabic-Indic digits
- ASCII digits

Validation:
- real Jalali date validation
- invalid dates emit nothing
- no silent coercion

Verified:
- 1403/12/30 valid
- 1404/12/30 invalid
- 1404/12/29 valid
- month 13 invalid
- day 0 / month 0 invalid
- Persian/Arabic/ASCII inputs round-trip correctly
- no `[u-ca=` serialization leakage

Manual smoke tests passed in fa-IR for:
- DateTime record field
- Date filter
- Jalali month/year dropdowns
- RTL navigation
- invalid date handling
- restoring original record/filter values afterward

Known remaining visible gap (RESOLVED in Phase 3B):
- filter chip could still display a Gregorian label such as `Oct 2, 2026`
- fixed in Phase 3B; fa-IR chips now use Jalali shared formatting

---

# Current Checkpoint

Current accepted implementation checkpoint:

`JALALI PHASE 4 COMPLETE`

Phases 1–3B are committed in `a842caff67 feat(i18n): complete Jalali presentation phases 1-3B`.
Phase 4 is committed as `feat(i18n): add Jalali record calendar`.

The next coding phase is:

`JALALI PHASE 5 — FINAL QA / CLEANUP`

Do NOT repeat Phase 1, Phase 2, Phase 3A, Phase 3B or Phase 4.

Before continuing in a recovered session:
1. inspect `git status`
2. inspect the local diff
3. verify the Phase 1/2/3A/3B/4 files are still present
4. do not overwrite or regenerate them blindly
5. continue only after confirming the local state

---

# Jalali Phase 3B — Remaining frontend display paths

Status: COMPLETE / ACCEPTED / COMMITTED (`a842caff67`, together with Phase 1, Phase 2 and Phase 3A)

## Phase 3B accepted results

- fa-IR filter chips use Jalali shared formatting (display only; filter values/boundaries unchanged)
- legacy `beautify*` display paths are calendar-aware where appropriate (optional display context; non-fa output unchanged)
- `RecordIdentifierBarCreatedAt` relative text + exact tooltip localized (fa-IR Persian calendar, user timezone, Persian digits)
- `EventRowDate` localized (Persian relative time, Jalali exact tooltip, timezone preserved)
- timeline grouping uses Persian year/month for fa-IR (client-side presentation only; non-fa Gregorian grouping unchanged)
- direct user-facing `toLocale*` surfaces route through explicit app locale/timezone helpers
- host-locale dependency in `src/utils/format/formatDate.ts` fixed
- previous 3 Windows `formatDate.test.ts` failures fixed
- `TimeZoneAbbreviation` intentionally remains technical English / GMT offset (ASCII, technically correct; Intl's fa-IR name embeds bidi marks)
- no backend/server/email/chart/date semantics changed
- no dependency added

## Phase 3B validation

- 375 suites / 2277 tests PASS
- 186 suites / 979 tests PASS
- tsgo PASS
- oxlint 0 warnings / 0 errors
- oxfmt PASS

## Remaining frontend date gaps (NOT blockers for Phase 3B acceptance)

These belong to Phase 4 / Phase 5 cleanup:
- Admin panel host-locale date surfaces
- `SettingsEnterprise`
- Settings Applications `toLocaleString` surfaces
- `SettingsDatePickerInput`
- `groupThreadsByDate`
- event-logs relative column
- Settings AI hardcoded en-US surfaces
- Calendar tab / `formatToHumanReadableDate` timezone caveat (host timezone)
- duration digit localization (`beautifyDateDiff` / `formatExpiration`)
- old persisted filter `displayValue` possibility
- ~~Record Calendar grid + top bar (Phase 4)~~ RESOLVED in Phase 4

## Original Phase 3B scope (for reference)

## Filter chip labels

Known bug:
A Jalali-selected date can still appear in a filter chip as Gregorian English text such as:

`Oct 2, 2026`

Fix display only. Do not change filter semantics or canonical values.

## Legacy date helpers

Audit/route through central calendar-aware formatting:
- `beautifyExactDateTime`
- `beautifyExactDate`
- `beautifyPastDateRelativeToNow`
- `beautifyDateDiff`
- other user-facing helpers in `~/utils/date-utils.ts`

## Record identifier created-at

`RecordIdentifierBarCreatedAt` must respect:
- app locale
- Persian calendar for fa-IR
- user timezone
- Persian digits

Both visible relative text and exact tooltip need coverage.

## Timeline row dates

`EventRowDate`:
- Persian relative time
- Jalali exact tooltip
- existing timezone semantics

## Timeline month grouping

For fa-IR:
- group visible timeline sections by Persian month/year
- label using the same Persian month/year

For non-fa:
- preserve existing Gregorian grouping

This is client-side presentation grouping only.

## Direct locale bypasses

Audit remaining user-facing:
- `toLocaleDateString`
- `toLocaleTimeString`
- `toLocaleString`
- `Intl.DateTimeFormat(undefined,...)`

Known examples:
- `CoreWorkflowVersionsListItem`
- `WorkflowRunStepLogsEntries`
- `CalendarEventsCardContent`
- `getCoreWorkflowFilterChipLabel`
- `TaskRow`

Do not change technical/logging/AI-context formatting.

## TimeZoneAbbreviation

Current hard-coded English path must be reviewed.

Do not invent misleading Persian timezone abbreviations.
A technically correct GMT offset is preferable to an incorrect localization.

## Host-locale utility

Fix/isolate:

`src/utils/format/formatDate.ts`

Problem:
- it uses `Intl.DateTimeFormat(undefined,...)`
- output depends on the developer/server OS locale
- this causes the 3 known Windows tests to fail under a fa-IR machine locale

Goal:
- deterministic explicit locale behavior
- no host-machine locale dependency

---

# Jalali Phase 4 — Record Calendar

Status: COMPLETE / ACCEPTED / COMMITTED (`feat(i18n): add Jalali record calendar`)

## Phase 4 accepted results

- fa-IR month grid is built from the Persian month (`getRecordCalendarDaysRange` with `calendar`): Persian month start/end, leading/trailing cells, `calendarStartDay` respected (Saturday-first supported)
- every grid cell stays an iso8601 `Temporal.PlainDate`; only boundaries and labels are Persian
- week and day ranges are calendar-independent (identical days for both calendars)
- top bar titles always match the grid: month `فروردین ۱۴۰۵`, week via Intl `formatRange` (`۲۴ اسفند ۱۴۰۴ تا ۱ فروردین ۱۴۰۵`), day `weekday، <formatPersianDate with user dateFormat>`
- ICU fa-IR persian `dateStyle: 'full'` / month+year patterns are malformed (year-first, ASCII comma), so titles are assembled from parts
- navigation: month steps use Persian arithmetic through `updateTemporalValueInCalendar` (`shiftRecordCalendarSelectedDate`); day/week are plain ISO steps; Today unchanged (`Temporal.Now.plainDateISO(user timezone)`)
- Persian weekday headers and Persian-digit day numbers; `isOtherMonth` uses the Persian month
- RTL: top-bar chevrons mirrored with `DATE_PICKER_NAVIGATION_BUTTON_CLASS_NAME`; physical `border-right` / `margin-left` / `padding-left` replaced with logical properties (identical in LTR)
- top-bar dropdown `DatePickerWithoutCalendar` month/year handlers reuse `updateTemporalValueInCalendar` (gregorian path is a pass-through)
- event placement unchanged: DATE via `PlainDate.from`, DATE_TIME via instant → user timezone → plain date; no timestamp conversion
- fetch range still derives from the visible grid `firstDay`/`lastDay` (filter semantics unchanged; Persian month grids simply request the Persian-month grid range)
- weekend shading intentionally still Sat/Sun (Iran's Friday weekend is a product decision, not calendar presentation)
- `TimeZoneAbbreviation` intentionally unchanged
- en / fr-FR output unchanged
- no backend/DB/API/GraphQL/timestamp/timezone-precedence change, no dependency added

## Phase 4 validation

- record-calendar: 12 suites / 70 tests PASS
- localization + date inputs + record-index: 51 suites / 454 tests PASS
- object-record + localization + ui + utils: 373 suites / 2116 tests PASS
- tsgo PASS
- oxlint 0 warnings / 0 errors
- oxfmt PASS
- manual fa-IR browser smoke PASS (temporary Tasks calendar view, deleted afterwards): Mehr 1405 month grid, next month Aban 1405, Today, week `۵ تا ۱۱ مهر ۱۴۰۵`, day view, previous day, mirrored RTL chevrons, record placed on its user-timezone day

---

# Jalali Phase 5 — Final Presentation QA / Cleanup

Status: NOT STARTED

Purpose:
- global search for remaining Gregorian/host-locale leaks in fa-IR UI
- RTL visual QA
- timezone midnight boundaries
- mobile/responsive picker QA
- table/list/detail/filter/workflow/timeline/calendar smoke tests
- en/non-fa regression check
- serialization guard check
- ensure no backend/domain date semantic changes slipped in
- address the remaining frontend date gaps listed under Phase 3B

Optional presentation-only extras should be evaluated separately:
- chart labels
- email-rendered dates

Do not include them automatically if the user wants to stop strictly at frontend UI.

---

# Remaining Jalali roadmap

```
Phase 3B — display stragglers   (COMPLETE, committed)
        ↓
Phase 4 — record calendar       (COMPLETE, committed)
        ↓
Phase 5 — final QA / cleanup    (NEXT)
        ↓
Jalali Presentation Layer complete
```

After Phase 4, it is a safe point to pause Jalali work and return to broader UI/RTL fixes before Phase 5.

---

# Current validation state for Jalali work

Phase 1:
- focused tests passed
- tsgo passed
- oxlint passed
- oxfmt passed

Phase 2:
- relevant formatter/display tests passed
- tsgo passed
- oxlint passed
- oxfmt passed
- only 3 known old host-locale-dependent `formatDate.test.ts` failures remained

Phase 3A:
- picker/date-input tests: 169/169 passed
- wider relevant run: 620 passed, same 3 old host-locale failures
- tsgo passed
- oxlint 0 warnings / 0 errors
- oxfmt passed
- manual fa-IR DatePicker/DateTimePicker smoke tests passed

Phase 3B:
- 375 suites / 2277 tests passed
- 186 suites / 979 tests passed
- old 3 host-locale `formatDate.test.ts` failures fixed
- tsgo passed
- oxlint 0 warnings / 0 errors
- oxfmt passed

Phase 4:
- record-calendar 12 suites / 70 tests passed
- localization + date inputs + record-index 51 suites / 454 tests passed
- object-record + localization + ui + utils 373 suites / 2116 tests passed
- tsgo passed
- oxlint 0 warnings / 0 errors
- oxfmt passed
- manual fa-IR record-calendar smoke test passed

---

# Recovery prompt for a new chat

Use this message in a new chat if needed:

```
We are continuing work on mrnikiemami-code/crm-platform, branch crm-platform.

Read CRM-PLATFORM-RECOVERY.md from the repository first and treat it as the recovery Source of Truth.

Do not redo accepted work.

First inspect the current repository/local state and reconcile it against the recovery file, especially the committed Jalali Phase 1–4 work.

Current accepted checkpoint should be:
JALALI PHASE 4 COMPLETE.

Next planned phase:
JALALI PHASE 5 — FINAL QA / CLEANUP.

Keep all Jalali work presentation-only. Do not change DB/API/GraphQL/domain/workflow-engine/cron canonical date semantics.
```

---

# Important working style

- Prefer one bounded phase at a time.
- Do not continue automatically into the next phase.
- Audit → implement → validate → report → wait for acceptance.
- Keep unrelated changes out of commits.
- Preserve local user data during manual smoke tests and restore temporary edits.
- Before committing any Jalali phase, inspect the complete diff and exclude unrelated files such as branding planning artifacts.
