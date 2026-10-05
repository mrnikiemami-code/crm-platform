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

HEAD:
`cafce80a4e23fc5d817a56d80cb9e3e4dc1bd938` — `docs(recovery): record Communication W6-R2 native data path`

Origin Sync:
`HEAD == origin/crm-platform` at `cafce80a4e23fc5d817a56d80cb9e3e4dc1bd938`. Direct recovery-document commits may subsequently move origin ahead; each task must fetch/read Recovery and fast-forward safely before implementation.

Last Accepted Milestone:
`CRM-COMMUNICATIONS-001-W6` + `W6-R1` + `W6-R2` — Person timeline integration, **code-review accepted** (`b464171e2a` implementation, corrected by `fd9e0988c6` and `10af7c560f`).

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

**Live verification: NOT PERFORMED** for every Communications wave. The Communication app has never been installed on a running instance in this environment, so no composer submission, no provider call, no database-event delivery and no timeline activity has ever occurred end to end.

Current Development State:
- Jalali Presentation Layer: COMPLETE / ACCEPTED / COMMITTED (Phases 1–5).
- Persian / RTL foundation, Data Model localization, Record Detail localization, Navigation RTL, Kanban/system-status localization: COMPLETE / COMMITTED.
- Settings / Experience Persian presentation: COMPLETE / COMMITTED.
- Enterprise / SSO / ClickHouse findings documented; NO Enterprise licence bypass is part of the desired architecture.
- Development startup reliability fixed (phased readiness); cold-start *performance* remains a separate, unstarted topic.
- Branding / white-label: PLANNED / NOT STARTED.
- Communications / Messaging: ACTIVE. W0–W6 implemented and code-review accepted (see the milestone table above). The Person send-message slice (command menu → composer front component → authenticated route logic function → certified durable orchestration) and the Person timeline integration both exist. SMS via Kavenegar or RazPayamak; architecture is multi-channel from day one.

## Communications — authoritative current behavior

- **Timeline data path:** `timelineActivityId` → activity (`GET /rest/timelineActivities/<id>`) → `activity.linkedRecordId` → Communication (`GET /rest/communications/<id>`). The renderer context's `recordId` is **null** for a timeline renderer and is never used as the linked record.
- **Activity label:** `communication` (outcome-neutral, so a QUEUED record never reads as sent).
- **Status source:** the persisted Communication record, read at render time — never the activity's creation-time snapshot.
- **Refresh:** **manual**, via a localized Refresh action shown on pending and unavailable cards. The card does **not** update automatically; no subscription or invalidation mechanism is exposed to the front-component sandbox.
- **Unavailable reasons:** `NO_ACTIVITY_ID`, `ACTIVITY_NOT_FOUND`, `NO_LINKED_RECORD`, `LINKED_RECORD_NOT_COMMUNICATION`, `ERROR`. None renders as QUEUED or as success.
- **One activity per Communication**, created on `communication.created` only; a status refresh renders the same card and never creates another activity or calls a provider.

Next Recommended Work:
`CRM-COMMUNICATIONS-001-W7` — **Workflow reuse of the certified durable send path** (`CommunicationSendAndPersistService`). **NOT STARTED.** Do not start automatically; it requires explicit assignment.

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

## W0 implementation review — IMPLEMENTED / VALIDATED / NOT YET ACCEPTED

Task: `CRM-COMMUNICATIONS-001-W0`.

Implementation exists locally but is intentionally uncommitted pending review. Reported implementation is confined to:

`packages/twenty-apps/internal/communication/`

W0 evidence:
- 14 new app-owned files; no tracked/core files modified by W0.
- generic `communication` object created.
- Person MANY_TO_ONE + inverse relation resolved in generated manifest.
- WorkspaceMember sender relation is supported and resolved with inverse relation.
- encrypted `serverVariables` seam created for future provider credentials/config.
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

W0 remains **NOT COMMITTED / NOT PUSHED** until this bounded correction is validated.

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

Immediate next task: build the first real **Person send-message vertical slice** using Twenty Apps native server logic-function + command/front-component patterns. The UI must call the same certified durable orchestration; secrets/provider HTTP remain server-side. Keep unsupported channels hidden. Do not duplicate send logic in the UI.

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
| Communications / Messaging | ACTIVE — W5 CODE-REVIEW ACCEPTED; W6 + W6-R1 + W6-R2 TIMELINE IMPLEMENTED (acceptance pending W6-R2) | W0–W4 accepted; W5 slice `15ad660a64` with R1 `0853765a98`, R2 `defdc41e9d`, R3 `7b21608880`; W6 timeline `b464171e2a`, corrected by R1 `fd9e0988c6` and R2 `10af7c560f583acc8f08d9b4ba1b13f9a8a742d0`; live end-to-end verification still pending |

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

**Live verification is still pending.** The app has never been installed on a running instance in this environment, so composer → route → provider remains unverified end-to-end. Do not treat W5 as live-verified.

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
- No timeline presentation yet (deliberately out of scope).
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
- `831204b74a` — phased readiness so cold backend startup is not killed (HEAD)

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

The Jalali presentation program is complete; do not start another Jalali phase.
Branding remains planned. Communications / Messaging is ACTIVE: W0 skeleton, W1 provider boundary, and W2 Kavenegar/send path are committed. The next Communications task is multi-provider-per-channel selection + RazPayamak Smart; do not redo P0/W0/W1/W2.

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

## W6 / W6-R1 / W6-R2 verification — actual coverage vs. simulations

- **Actual production coverage:** the shipped modules are tested directly — `buildCommunicationTimelineActivityInput` (Person linkage, snapshot mapping, no-credential guarantee, `null` when no target person, one activity per communication), `loadCommunicationTimelineState` (the full `timelineActivityId → activity → linked Communication → presentation` chain, with `recordId: null` in the context, every unavailable reason, no error leakage, and read-only access), and `buildCommunicationTimelinePresentation` / `buildCommunicationTimelineView` (QUEUED/SENT/DELIVERED/FAILED truthfulness, refreshed status replacing the creation-time state, unavailable states, snapshot use, body truncation). 136 focused tests PASS.
- **Refresh coverage:** the tests drive the same Communication from QUEUED to SENT and to FAILED **through the implemented refresh path** (re-running the chain) and assert the rendered status changes while the activity id stays the same.
- **Still not verified:** the React render tree of `communication-timeline-card` (it needs the front-component sandbox host), the actual REST round trips, database-event delivery, and live timeline rendering in a workspace. The app is not installed anywhere, so no timeline activity has ever been produced end to end.
- typecheck PASS; oxlint 0/0; app build PASS (11 files); manifest confirms 1 timeline activity type (label `communication`, no `emit`, renderer wired), 3 logic functions and 2 front components. W4/W5 modules unchanged; the timeline path cannot reach a provider and never uses `context.recordId`.

