# CRM Platform Recovery — Persian / RTL / Jalali Track

Last updated: 2026-10-08 (W15-A-R2-DESTINATION-CLOSURE — an invalid phone override now leaves NO destination instead of falling back to the primary; source-only correction; 0.1.7 BUILT ONLY; main instance remains 0.1.6)

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
- task baseline (given for W15-A-R2): `91b4a935d0` — the W15-A-R1 docs commit
- previous code commit: `73b554cce1` — W15-A-R1 app + tests
- earlier: `be0fc52089` — W15-A app + tests; `7697b2ae39` — W14-MAIN-CLOSURE (0.1.6)
- previous code-verified baseline: `20939d2324` — the W14-R3-SECRET-INPUT-CLOSURE commit

Origin Sync:
At that baseline `HEAD == origin/crm-platform`. This SHA is the **verified baseline the document was reconciled against**, not necessarily the current HEAD: each documentation commit moves the branch forward. Always run `git rev-parse HEAD` / `git rev-parse origin/crm-platform` yourself and fetch/fast-forward safely before acting.

Last Accepted Milestone:
`CRM-COMMUNICATIONS-001-W12-MAIN-VERIFY` — **ACCEPTED by the architect, scoped.** The architect accepted **only** this: the composer renders in **Persian and English**, **phone loading works**, and a **load failure is shown as an error** (not "no number"). **`W14-R3-SECRET-INPUT-CLOSURE` is also ACCEPTED — scoped to the secret-input fix only** (the field-flag secret detection and the real form-connection test). Previous accepted milestone: `CRM-COMMUNICATIONS-001-W11-MAIN-R4-VERIFY`. `W12-R4-APP-LOCAL-I18N` remains **SUPERSEDED / NOT ACCEPTED**. **`W13-UX-CLOSURE`, `W14-SMS-SETTINGS-AND-UX-FINAL`, `W14-R1-SETTINGS-CORRECTIONS`, `W14-R2-FINAL-FIX`, `W14-MAIN-CLOSURE`, `W15-A-BULK-PREVIEW-AND-TEMPLATES`, `W15-A-R1-PREVIEW-CLOSURE` and `W15-A-R2-DESTINATION-CLOSURE` are REVIEW PENDING — no architect acceptance is claimed here.** W15-A (+R1/R2) is **preview + templates only** and explicitly **does NOT include bulk sending** (that is W15-B).

- **W15-A — bulk selection preview + workspace templates (PREVIEW ONLY; no bulk send).** The Person `Send SMS` command now branches on the host's multi-record selection: **one record → the existing single-person form (unchanged)**, **many records → a bulk preview form**. Multi-selection is delivered through the **locked SDK hook `useSelectedRecordIds()`** — the host already forwards the ids (`targetedRecordsRule.selectedRecordIds` → `selectedRecords` → `selectedRecordIds` in `FrontComponentExecutionContext`), so **no SDK API was invented and no core file was changed** (see the W15-A section for the exact call path). The bulk form loads recipients from a **read-only server route**, shows each Person with their number(s), lets a user pick an alternate number when several exist, remove a recipient, and see a **per-recipient preview**. **Bulk send is deliberately disabled** — W15-A is preview/templates only; the safe bulk execution path is W15-B.
- **Recipient resolution is server-authoritative and honest.** Duplicate Person ids are **reported** (not pre-removed); a Person with no number is **NO_PHONE**; a requested id the server does **not** return (no read permission, or another workspace) is **NOT_ACCESSIBLE** — never silently dropped, so the count a user sees matches what they selected. A number shared by two or more **distinct** recipients raises a **warning**, computed from the **current numbers of the remaining recipients** on the client and **recomputed after overrides** on the server. The frontend is **not** the authority for recipient access or template evaluation.
- **Stale previews are invalidated (W15-A-R1).** A change to the message, template, any number, the recipient set or the selection **immediately voids the preview** and silences the in-flight request, so an older response (success **or** failure) can never reappear; the same `invalidate()` runs on unmount. Verified with **deferred responses on the real production connection** (`createPreviewConnection`).
- **Destination correctness (W15-A-R1 / corrected by W15-A-R2).** An invalid phone override is **reported explicitly** (with the reason) and the recipient is left with **NO destination** (`selectedPhone: null`, not ready, excluded from `readyCount`) — the primary is **never** substituted. *(The W15-A-R1 build wrongly claimed "keeps their own number / never silently substituted" while actually falling back to the primary; R2 corrects the code AND the claim.)* An **empty/whitespace body is never ready**; the **200 cap applies to preview too**; templates show **separate `LOADING`/`EMPTY`/`ERROR`** states; a failed preview shows a **Persian** error.
- **Workspace-owned templates are a NATIVE app object.** A new `messageTemplate` object (`title`, `body`, `channel`) with `isUICreatable`/`isUIEditable` true, plus a `Message templates` view. Templates are created/edited/selected through the platform's own object + permissions; **no parallel storage** (no local file, no out-of-band table). A workspace only ever sees its own templates (the workspace API client is the sole source).
- **Safe interpolation, closed catalog.** Variables are exactly `@name` (first name), `@lastName`, `@fullName`, `@company` (company name), with `@firstName`/`@companyName` aliases. Substitution is a **plain string walk over an allow-listed identifier grammar** — **no eval, no SQL, no traversal, no dynamic property access**; a trailing `.foo`/`()` is not resolved. An **empty field** or an **unknown token** is reported and left visible, and any such issue means the recipient is **never** marked ready to send. Extending the catalog = appending one typed definition.
- **The server builds the final per-recipient text.** The `preview-template` route re-reads the authorized Person records (never trusting the frontend for names/values) and returns each recipient's interpolated text with explicit `hasUnresolvedVariables` / `issues` / `isReadyToSend` flags, plus `invalidOverrides` and shared-number warnings recomputed after overrides.
- **Persian/English + RTL** are covered: the new copy is in the app catalog (fa-IR **97** keys) and the forms flip direction. **Untouched:** single-send flow, providers, durable send/persist, Timeline, settings and Workflow (**still disabled**, `workflowActionTriggerSettings: null`). **No real SMS, no credentials, no main-instance install** (0.1.7 is built only; the main instance remains **0.1.6**).
- **Checks:** app **327/327** tests (37 files, after the W15-A-R2 correction), **both** app typechecks exit 0, app lint 0/0. Linux package **0.1.7** built with the **fork's own `twenty-sdk` 2.42.0** (not the upstream tool): `sha256 0E8E29909B7C43CE3042E9772DFD2D386EE30B1899C05A3A598D27AF694BAE9A`, POSIX paths, native `fa-IR` banner (97 keys); **clean copy with the app's own lockfile (no borrowing) typechecks exit 0 and resolves the locked `twenty-sdk@2.35.0`**, container suite **315/315** (before R2), lint 0/0. Manifest diff **0.1.6 → 0.1.7: 0 removals**, app UID unchanged, only additions (template object + 4 fields incl. the engine's base `name` + 3 routes + 1 view).
- **Evidence level (honest):** the selection, workspace and template-read suites are **pure/mocked** — there is **no live-UI claim and no real template save/retrieve claim**; a live install and a real template save/retrieve have **NOT** been performed. The **7 logic functions belong to the new manifest only**; the installed main **0.1.6 still has 4**.
- **Still not accepted / not performed:** bulk sending (**NOT IMPLEMENTED — W15-B**), real-provider sending (**NOT PERFORMED**), W7 (**DISABLED / NOT ACCEPTED**). The `All ارتباطات` view title and SELECT option labels remain non-translatable (unchanged from W13).

- **W14 — professional SMS settings + the remaining Persian fixes.** A new **`SMS system`** tab was added to **Settings → Communication** (Persian **سامانه پیامکی**), with independent **Kavenegar** and **RazPayamak** sections, a separate default-provider choice, secret replace/clear, and native Persian/English copy. This task also fixed the Persian gaps W13 left: the command-menu app-name suffix, the composer panel title, the two untranslated timeline reasons, the English unknown-outcome warning, and the empty-state wording. Verified on **app2/apple** (HTTP mock, settings contract) and **observed on the main instance**.
- **Host change is limited and disclosed.** The SMS tab is a **host** component (`packages/twenty-front/src/pages/settings/communications/SettingsWorkspaceCommunicationsSmsTab.tsx`) plus the tab wiring and two small display fixes. **No business logic moved to the host**: provider selection, sending and persistence stay in the app. No SDK upgrade, no new provider, no orchestration change, no raw DB write.
- **The host exports no variable read/write for front components**, so the tab cannot be a front component; it reuses the host's **existing** `updateOneApplicationVariable` mutation and its real variable-input components. **No SDK mutation was invented.** The app is resolved by its **stable universal identifier** (`768bca20-…`), not an install UUID, display name or workspace; when absent the tab shows **«ماژول ارتباطات در نصب نشده است» / "The Communication module is not installed in this workspace."**
- **Security contract (verified on app2):** the server **masks** secrets (`fake-secret` reads back as `f********`), so only **presence** ("تنظیم شده/تنظیم نشده") is exposed — a secret value is **never** read into the form, response or log. An **empty secret input means "keep"**; clearing is a **separate explicit action**. A **masked value is never re-submitted**. Switching the default provider **preserved the other provider's settings**. Unauthenticated / invalid-token calls were **rejected server-side** (not merely hidden in the UI). All 9 `applicationVariables`, `serverVariables: {}` tombstone, keys, UUIDs and secret flags are unchanged; **no parallel storage, table, localStorage credential or bypass API** was added.
- **`SENT ≠ DELIVERED` preserved**; unknown and sent-but-unrecorded outcomes stay **warnings**, a definite provider failure stays an **error**; the provider's own reason is shown verbatim (only the app's own fallback wording is translated). Duplicate-submit guard, stale-response guard, durable send/persist and no-auto-retry are unchanged.
- **Checks:** app **228/228** tests (26 files, incl. a new translation-completeness test), app both typechecks exit 0, app lint 0/0; **twenty-front** and **twenty-server** typechecks exit 0; front lint clean on the changed files (the repo-wide `nx lint twenty-front` still reports the **pre-existing** formatting issues in 19 unrelated Jalali/metadata files). Linux package **0.1.4** built with the **fork's own `twenty-sdk`** (not the upstream tool): `sha256 347F491C30CCB8B93E38638F370B7BD473C85A9D78CC8A9907BBF763730130AA`, POSIX paths, native `fa-IR` banner (58 keys); container suite **228/228**, both typechecks exit 0, lint 0/0.
- **app2/apple (mock):** acceptance → **"Message sent."** (`3a480a0d-…` SENT/999001); rejection → **"mock rejection"** (`b5e2185a-…` FAILED); **exactly one mock request per click**, **one activity per record**. Variables restored exactly and the mock stopped (no listener). app2's frontend is upstream v2.41.0 and ships **no `fa-IR`**, so app2 rendered English — the **SMS tab is a host feature and renders only on the fork frontend (main instance)**.
- **Main instance (workspace 4D):** upgraded **0.1.3 → 0.1.4** via the native path; backup `pre-w14-20261008-060041` **restore-verified**; manifest diff **0 removals**, identical UIDs, 9 variables preserved. **Observed:** the **سامانه پیامکی** tab renders in Persian (both provider sections, labels, hints) and in English (LTR); the user's locale was **restored to `fa-IR`**. **0 Communication records** on the main instance; **no Send clicked**; **no real setting changed** (nothing was saved).
- **Still not accepted / not performed:** real-provider sending (**NOT PERFORMED**), W7 (**DISABLED / NOT ACCEPTED**), two-workspace isolation on v2.42.0 (only evidenced on app2 v2.41.0). The **"All ارتباطات"** view title remains **not translated**: custom objects have no standard-metadata label catalog, and no supported translation surface exists for a manifest view name — recorded as a real limitation, not worked around. **SELECT option labels** likewise remain non-translatable (unchanged from W13).
- **W14-R1 — the SMS tab's review corrections.** Secret intent is now **explicitly** `KEEP` / `REPLACE` / `CLEAR`: typing a new value after **Clear cancels** the clear, a **Cancel clear** action restores KEEP, and an **empty input alone never clears**. `LOADING` / `NOT_INSTALLED` / `ERROR` are now **three separate states** — a failed request shows a load error, **never** "not installed". Every write (default-provider selection and both saves) goes through **one shared synchronous lock**, so a fast double click cannot fire overlapping requests. A **partial** failure is reported honestly as **«بخشی از تنظیمات ذخیره شد؛ ذخیرهٔ بقیه ناموفق بود.»** (no "nothing changed" claim, since there is no rollback); the form is **re-read** afterwards. On app2 a caller **without** the Applications permission was exercised and was **DENIED** on both read and write — a message distinct from `UNAUTHENTICATED` (recorded separately below). The composer maps a **definite failure — including `FAILED_BUT_UNRECORDED` — to an ERROR**, while **unknown** and **sent-but-unrecorded** stay **WARNINGS**; the mapping lives in production code so the composer and its test share it.
- **Correction (W14-R2):** R1 claimed a field **edited while a save was in flight keeps its newer draft**, but that was **not yet true** — the cleanup compared the write result, not the draft's revision. **W14-R2 fixes it** by snapshotting the drafts at save start and dropping only keys whose draft is **unchanged** since then. R2 also reads the secret input **only** from the typed replacement (never a stored/masked value), wraps save/read-back in **catch/finally** so a failed re-read neither locks the UI nor raises an unhandled rejection, and applies the **shared severity to both** the in-form message and the toast.
- **Correction (W14-R3):** the R2 tests described as "deferred" are in fact **pure-function tests** — no deferred timer and no mutation call. R2's `readValue` also still keyed the secret branch on `secretPresenceByKey`, so a secret whose stored value was **empty** fell through to the stored-value branch; **W14-R3 keys it on `field.isSecret`** instead and adds a **real form-connection test** that renders the tab, types a fake secret into the real input, and asserts the **full** value reaches the mutation. **0.1.5 is BUILT ONLY and does NOT include the R2/R3 corrections — it must not be presented as the final package.** *(Historical: at W14-R3 the main instance was 0.1.4; it was later upgraded to **0.1.6** in W14-MAIN-CLOSURE.)*
- **W14-R3 checks:** twenty-front typecheck exit 0, changed files lint/format clean, **29** host tests (28 pure-function + 1 real form-connection). No new package was built.
- **W14-R2 checks:** app **235/235**, both app typechecks exit 0, app lint 0/0; twenty-front typecheck exit 0, changed files lint/format clean, **22** host state tests. **0.1.5 is BUILT ONLY.** *(Historical: the main instance was 0.1.4 at this point; it is now 0.1.6.)*
- **W14-R1 checks:** app **235/235** (27 files), both app typechecks exit 0, app lint 0/0; twenty-front typecheck exit 0 and its changed files lint/format clean; 18 focused host state tests. Linux package **0.1.5**: `sha256 1B7A6F9501BABDFC72E3BC4309A4797066731C4DDB4439943A0A7ECAB956B9C6`; container suite **235/235**, both typechecks exit 0, lint 0/0. No credentials were changed; only the created test API keys were revoked.
- **W14-MAIN-CLOSURE — package 0.1.6 built and installed on the main instance.** Version bumped to **0.1.6**; the tarball was built **on Linux with the fork's own `twenty-sdk` 2.42.0** (not the upstream tool) and **0.1.5 was not used**. Verified before upgrading: app UID unchanged (`768bca20-…`), the same 4 logic-function / 2 front-component / 1 command-menu-item / 1 view / 1 nav-item / 1 timeline-activity-type UIDs, `workflowActionTriggerSettings: null` ×4 (W7 disabled), the **9 variables** unchanged, and a **manifest diff of 0 removals**. A **fresh, restore-verified** backup was taken (`pre-w14mc-20261008-124820`, dump 1,363,409 B + storage 26,426,263 B; scratch row counts matched). The upgrade went through the **native path** (`uploadAppTarball` + `upgradeApplication`) into workspace **4D**: registration `050704a1-…` and application `7c7b25f9-…` are now **0.1.6**. **All 9 variables are byte-identical** (ciphertext compared against the backup), **no setting was saved**, and **0 Communication records** exist.
- **W14-MAIN-CLOSURE — read-only browser checks (no screenshots).** In **Settings → Communication → سامانه پیامکی**: the tab opens, `lang=fa-IR` / `dir=rtl`, headings **سرویسدهندهٔ پیامک / Kavenegar / RazPayamak**, both **secret inputs are EMPTY** (`type=password`, `value=""`, placeholder **پیکربندی نشده**) and no stored or masked value is displayed — consistent with the API reporting those secrets as **len 0** (they are genuinely unset). In the Person page the command menu shows **ارسال پیامک**, and the composer opens with title **ارسال پیامک**, channel `SMS` (RTL), phone **882261739** loaded and **LTR**, and buttons **انصراف / ارسال** — phone loading works. API `:3000` and frontend `:3001` both return **200**. **No Save, no Send.**
- **Checks (W14-MAIN-CLOSURE):** container suite **235/235**, both typechecks exit 0, lint 0/0; package `communication-0.1.6.tgz` `sha256 652D3DAA1804976D886B0FB8E6600E318F6D5A45A48E2FC477821F5095066EE2` (POSIX paths, native `fa-IR` banner, 58 keys).
- **"Phone numbers load" / mock PASS is NOT "a message was sent"** — provider settings on the main instance remain **empty**.

- **W13-UX-CLOSURE — the communication UX was completed in the main environment.** Package **0.1.3** (from 0.1.2) shipped: a **standard Twenty-styled send form**, **unified native Persian** (metadata *and* front-component copy), a **discoverable read-only records path**, and an explicit **separation of sending from hand-authoring a record**. Verified on **app2/apple** (HTTP mock, no real provider) and **observed on the main instance** (view-only, no Send).
- **No SDK UI kit exists to use.** The locked `twenty-sdk/front-component` exports only functions/hooks/`Trans`/command components — **no form primitives**. So the form is plain HTML **styled to match Twenty** (border/radius/typography, single primary action). **No `twenty-front`/`twenty-server` internals were imported and no host DOM was touched.** (`defineNavigationMenuItem`/`defineView` *are* exported and were used for the records path.)
- **Translation is 100% native.** Two real platform contracts, no parallel translator:
  - **Front-component copy** → the app catalog baked into the bundle (`loadFrontComponentTranslationCatalogs`).
  - **Metadata labels** → the app `locales/*.json` catalog, compiled to `manifest.translations` and applied server-side by `resolveEffectiveEntityProperty` for **objectMetadata** (`labelSingular`/`labelPlural`/`description`), **fieldMetadata** (`label`), **commandMenuItem** (`label`/`shortLabel`), **navigationMenuItem** (`name`), **timelineActivityType** (`label`), **view** (`name`). The catalog is keyed by **source string + context** (`generateMessageId(message, context)`), which is exactly how the runtime looks it up.
- **A real limitation, recorded (not worked around):** **SELECT option labels are NOT translatable** — `TRANSLATABLE_PROPERTIES_BY_METADATA_NAME` does not include option labels. So the channel/status/direction option values (`SMS`, `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `OUTBOUND`) remain **English technical tokens**, and the **application display name** is not a translatable metadata name either. No unsupported API was invented.
- **Send separated from manual create:** the Person command is now **`Send SMS`** (Persian **ارسال پیامک**), the SMS-only capability. The Communication object is **`isUICreatable: false` + `isUIEditable: false`**, so the generic "create a Communication" form is gone — no send can be mistaken for, or triggered by, hand-authoring a record. **No create/update trigger was added.**
- **Records are discoverable:** a manifest **`Communications` view** (Person, recipient, body, channel, provider, status, sent time) plus a **sidebar navigation item**, both native. The engine's default views are untouched (manifest views are additional). The Person→Communication relation and the timeline card are preserved.
- **Checks:** monorepo **223/223** tests (25 files, incl. 10 new W13 production tests), **both** typechecks exit 0, `oxlint` 0/0. Linux package built with the **fork's own `twenty-sdk`** (not the upstream tool) — `communication-0.1.3.tgz`, `sha256 7DA531B7A9D1C4F137749C0AE6DCC1C9726342F0EA21731CF4E8F6F42A1C8EBB`, POSIX paths, native `fa-IR` banner; container suite **223/223**, both typechecks exit 0, lint 0/0.
- **Persian browser render — VERIFIED on the main instance** (workspace 4D): sidebar **ارتباطات**, Communications page labels **نام/کانال/متن/موضوع/وضعیت/جهت/سرویسدهنده/گیرنده/…**, composer title **ارسال پیامک**, RTL form, phone **LTR**, buttons **انصراف/ارسال**, **no create affordance**.
- **app2/apple (mock acceptance + rejection, from real composer clicks):** acceptance → **"Message sent."** with record `db1cdbed-…` `SENT`/`999001`/`kavenegar`; rejection → **"mock rejection"** with record `6182b9b4-…` `FAILED`; **exactly one mock request per click**; **exactly one activity per record**. Variables restored exactly; mock stopped (no listener). app2's frontend is upstream v2.41.0 and ships **no `fa-IR`**, so app2 rendered **English** (its own locale was restored to `en`).
- **Upgrade safety:** a fresh main-instance backup (`pre-w13-20261007-205714`, dump 1,330,732 B + storage 25,902,661 B) was taken and **restore-verified**; the 0.1.2→0.1.3 manifest diff showed **0 removals**, all UIDs identical, and only **additions** (view + nav item). Main upgrade preserved the same application/registration rows and all **9 variables**; **0 Communication records** were created on the main instance and **no Send was clicked**.
- **Untouched:** core, server, SDK version (app and lockfile), providers, send/persist path, duplicate-submit guard, universal identifiers, Workflow (still disabled). No settings change.
- **"Phone numbers load" / mock PASS is NOT "a message was sent"** — provider settings on the main instance remain **empty** and real sending remains **NOT PERFORMED**.

**Historical corrections (superseded claims):** the W10-R3-era "front components do not render" and the W10-R4-era "timeline card still not rendering" findings were **wrong** (an expired session and a collapsed-by-default row respectively); the composer and timeline card **do render** (W10-R4/R5). Those sections are historical.

Earlier milestone: `CRM-COMMUNICATIONS-001-W11-MAIN-R4-VERIFY` — Windows symlink blocker resolved; main route PASS.

### 8b. R4-PREP / R4-VERIFY — the symlink blocker, characterized then resolved

**Exact call path** — `packages/twenty-server/src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/services/local-child-process-runner.service.ts`, `LocalChildProcessRunnerService.assembleNodeModules` (lines ~36–60):

```ts
const execNodeModules = join(sourceTemporaryDir, 'node_modules');
await fs.mkdir(execNodeModules, { recursive: true });
const entries = await fs.readdir(depsNodeModules, { withFileTypes: true });
await Promise.all(
  entries
    .filter((entry) => entry.name !== 'twenty-client-sdk')
    .map((entry) =>
      fs.symlink(
        join(depsNodeModules, entry.name),        // target  = deps layer entry
        join(execNodeModules, entry.name),        // link    = exec dir entry
        entry.isDirectory() ? 'dir' : 'file',     // type    = dir for folders, file otherwise
      ),
    ),
);
await fs.symlink(join(sdkNodeModules, 'twenty-client-sdk'), join(execNodeModules, 'twenty-client-sdk'), 'dir');
```

So the **target** is each entry inside `<depsLayer>/node_modules` (both files such as `.yarn-state.yml` and directories such as the dependency folders), the **link path** is `<executionDir>/node_modules/<name>`, and the **type** is `'dir'` for directory entries and `'file'` otherwise.

**Isolated capability test** (dedicated temp directory, same Node binary and same Windows user `User` that runs the API; artifacts of this test only were removed afterwards):

| Attempt | type | Result |
|---------|------|--------|
| symlink `.yarn-state.yml` | `file` | **EPERM** (`errno -4048`, `syscall symlink`) |
| symlink a plain `.txt` file | `file` | **EPERM** |
| symlink a directory | `dir` | **EPERM** |
| symlink without an explicit type | (auto) | **EPERM** |
| **junction** (dir) | `junction` | **OK** |
| **hard link** (file) | — | **OK** |

**Environment evidence (captured in R4-PREP, read-only):** the process ran as `desktop-kl07dfq\user` at **Medium** integrity, its token held **no `SeCreateSymbolicLinkPrivilege`**, and the **Developer Mode values were unset** — the exact combination that refuses ordinary symlinks while allowing `junction`/hard link. **After the user enabled Developer Mode, the same symlinks succeed (R4-VERIFY).**

**Status: RESOLVED by an environment change (Windows Developer Mode enabled by the user).** No Developer Mode, policy, registry value or privilege was changed by this work; the server was **not** run elevated; no core or dependency change was made; no restart and no message send occurred in R4.

**R4-VERIFY re-test (same Node binary, same normal user `User`; artifacts of this test only were removed):**

| Attempt | type | R4-PREP (before) | R4-VERIFY (after Developer Mode) |
|---------|------|------------------|-----------------------------------|
| symlink `.yarn-state.yml` | `file` | **EPERM** | **OK** (resolves to target) |
| symlink a directory | `dir` | **EPERM** | **OK** (resolves to target) |
| symlink a plain `.txt` file | `file` | **EPERM** | **OK** (resolves to target) |

**End-to-end confirmation after the fix:**

- `POST /s/communication/person-phones` (workspace **4D**, Person `7a93d1e5-…`) → **HTTP 200** `{"success":true,"phones":[{"id":"primary","value":"882261739","isPrimary":true}]}`
- Browser composer on that Person now shows **Phone number = `882261739`** (was "No phone number"). Evidence: `D:\twenty-main-backup\w11-main-evidence\r4-composer-with-phone.png`.
- API health remained **200** throughout; **no server restart** was needed in R4 (the running API already carried the privilege).

Commit SHAs (kept separate):
- **code fix (R1):** `00b69db9bb` — `fix(server): detect dist build path on Windows separators`
- **portable tests (R2):** `bff48ff4ca` — `test(server): make assets-path specs host-portable`
- **Recovery doc (R1):** `fb49f6bbc3`
- **Recovery doc (R2):** `10e8e9420c`
- **Recovery doc (R3):** `37140cc5b9`
- **Recovery doc (R4-PREP):** `38e6427fa0`
- **Recovery doc (R4-VERIFY):** this commit

R1/R2 **code acceptance** is separate from **R3 runtime verification** (applied the fix, confirmed the `yarn-engine` error gone), from **R4-PREP** (characterized the symlink permission blocker), and from **R4-VERIFY** (confirmed the blocker is resolved and main-instance execution passes end-to-end).

Earlier milestone: `CRM-COMMUNICATIONS-001-W11-MOCK-UI` — HTTP Mock integration on app2, browser-composer verified.

Earlier milestone: `CRM-COMMUNICATIONS-001-W10-R8-R2` — native tarball two-workspace distribution and execution-isolation evidence (install in `apple` + `Isolation Beta`; independent provider selection per workspace).

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
| W10-R2 | `526997b77e` | `526997b77e` (implementation + docs committed together) | **installed + live-verified (synthetic integration)**; registration/upload/sync **PASS**, all 8 runtime checks **PASS**, 3 app defects fixed *(historical: those runtime checks ran while the dependency layer was already cached and are **not reproducible** on a fresh instance — superseded by W10-R6's explicit registry fix; see the W10-R2 section)* |
| W10-R3 | `a791ca8762` (docs only — no app change) | `a791ca8762` | browser pass performed; its **"front-component rendering FAIL"** finding was **later proven wrong (session artifact)** — see W10-R4 |
| W10-R4 | `521000b709` (docs only — no app change) | `521000b709` | **runtime restored at image level** (fresh v2.41.0 instance, new volumes); **logic-function execution BLOCKED** (dependency layer cannot reach a package registry); **front components PROVEN to render** (Hello World on both images); **Communication composer renders**; its "timeline card still not rendering" finding was **later proven wrong (W10-R5)** |
| W10-R5 | `8c15ea8668` (docs only — no app change) | `8c15ea8668` | **timeline renderer isolated and VERIFIED**: the card was always rendering but is a **collapsed row by default**; status, QUEUED→FAILED via manual Refresh, single-activity and read-only-Refresh checks all **PASS** |
| W10-R6 | `ce3b9fb297` (docs + container config only — no app change) | `ce3b9fb297` | **logic-function execution RESTORED** on the isolated v2.41.0 instance via a container-scoped `--add-host` DNS override; routes, composer, safe-failure and zero-Workflow checks **PASS**; dependency install verified; per-workspace execution isolation **NOT PERFORMED** *(historical — superseded by W10-R8-R1/R2)* |
| W10-R7 | `aceb78f228` (docs + container config only — no app change) | `aceb78f228` | **workspace configuration isolation**: a second disposable workspace was created and activated; **data-model isolation PASS**; **execution-time configuration observed** (`providerId` follows `COMMUNICATION_PROVIDER`; invalid/empty creates no record); **true two-workspace execution isolation NOT PERFORMED** — a LOCAL app registration is owned by one workspace *(historical — the LOCAL-ownership blocker was superseded by W10-R8-R1/R2 via the native tarball path)* |
| W9-R2 | `b12a5c57f9` + `3654e15e1c` | `e8023c9b2e`, `a305247a1e`, `3654e15e1c` | **workspace-owned provider configuration** via native `applicationVariables` (9 vars, stable ids, secrets encrypted per workspace); native **Variables tab** verified with masked fake secret; registration `serverVariables` removed via an empty tombstone (0 registration rows on both instances); **runtime execution isolation NOT PERFORMED** (registry blocked) *(historical — superseded by W10-R6 execution restoration and W10-R8-R1/R2 isolation evidence)* |
| W10-R8-R1 | (docs only — no app change) | `348606e2e2` | **native tarball distribution PROVEN on app2**: the unchanged Communication package was built with the native `twenty dev:build --tarball` (CLI 2.41.0), uploaded with `apple` auth via the native `uploadAppTarball` mutation (registration `e71d0025-…` converted LOCAL → **TARBALL**, UID/ownership/`isListed=false` preserved), and **installed into Isolation Beta** with Beta auth via the native `installApplication` mutation (new app row `5c02bf29-…` v0.1.0). **Beta installation PASS**; two-workspace **configuration** isolation PASS (storage witness); provider-selection execution witness NOT yet evidenced in R1; **no real provider request was made** |
| W10-R8-R2 | (docs only — no app change) | `bbb1b5cb18` | **evidence gaps closed**: two-workspace **execution isolation PASS with an execution witness** — the real `/s/communication/send` executed in both workspaces in the same second, persisted `providerId` follows each workspace's own `COMMUNICATION_PROVIDER` (`kavenegar` vs `razpayamak`), two separate `LogicFunctionTriggerJob` runs observed; config re-test re-run in registered order with a third marker value; `workflowActionTriggerSettings` verified **null for all 4 functions in the manifest AND both installs' metadata** (W7 disabled at registration level, not merely workflow-row absence); upgrade-job state audited (no upgrade queue, `autoUpgrade=false`, TARBALL registration invisible to the NPM catalog sync); Recovery reconciled (install ≠ isolation, server JSON ≠ composer text, source/build evidence ≠ runtime evidence, `isListed=false` is a listing flag not privacy) |
| W11-MOCK | (docs only — no app change) | `f844cb334e` | **HTTP Mock integration PASS at the API level on app2/apple** — the path `authenticated send route → durable service → HTTP Mock` was exercised with a temporary in-network mock (no host port, no external call) via **direct route calls**: two sends gave **SENT** (`providerMessageId=999001`) and **FAILED** (`mock rejection`, provider's own reason), **exactly one mock request each**, **exactly one app activity per Communication**. Prior variables restored exactly, mock stopped. **Mock acceptance only — no real send, no delivery, Kavenegar path only; W7 disabled** (evidence-scope correction committed later as `9ecf0a70e1`) |
| W11-MOCK-UI | (docs only — no app change) | `fff3cee41f` | **browser-composer run PASS** — the same mock + W11-MOCK Person, but both scenarios driven **only by clicking Send in the real composer**: success toast **"Message sent."** and error **"mock rejection"**; records `c9ee6377-…` (SENT, id `999001`) and `6a37d3e9-…` (FAILED); **exactly one mock request each** (log 2→3→4); **exactly one activity each** (`fe89391e-…`, `78e05a2c-…`); timeline cards opened and captured (`s1-card-sent.png`, `s2-card-failed.png`); variables restored, mock stopped. **Closes the earlier browser gap.** Mock acceptance only; Refresh still NOT TESTED |
| W11-MAIN-R1 | `00b69db9bb` (**core change — the first CORE_CHANGE_COUNT exception**) | `fb49f6bbc3` | **main-instance install PASS + Windows assets-path fix prepared (architect review pending)**: Communication installed into the main workspace **4D** (`radiant-cyan-dragon`) on **v2.42.0** via the native tarball path (registration `050704a1-…`, app `7c7b25f9-…`, UID unchanged, 9 variables created empty, W7 disabled), after a **restore-verified** backup; main-instance **logic-function execution BLOCKED** by a Windows-only `assets-path` bug (`ENOENT … yarn-engine`); minimal fix committed + unit-verified, **NOT applied to the running server** (no restart, no dist edit); composer labels remain hardcoded English and the "No phone number" fallback is a separate unfixed UI defect |
| W11-MAIN-R2 | `bff48ff4ca` (test-only — no production change) | `10e8e9420c` | **portable assets-path specs**: removed the host-dependent helpers (path.sep folding, Windows strings passed to `path.resolve` on POSIX), replaced the silently-skipped compiled-case assertion with a module-directory comparison plus a shape check, and kept production logic untouched; **14/14 tests pass**, lint 0/0, format clean, typecheck exit 0 |
| W11-MAIN-R3 | (docs only — no code change) | `37140cc5b9` | **reviewed fix APPLIED to the running main server** via the standard watcher (`nest start --watch` rebuild + respawn); API health 200; the `yarn-engine` `ENOENT` is **resolved** (compiled `ASSET_PATH` → `dist\assets`, verified in a fresh process); at that point **execution was still BLOCKED by a new boundary** — `EPERM … symlink … .yarn-state.yml` at `LocalChildProcessRunnerService.assembleNodeModules` *(later RESOLVED in R4-VERIFY by enabling Developer Mode)*; real `person-phones` route was HTTP 500 then; composer showed "No phone number". No send, no reinstall, no migration, no data/config change |
| W11-MAIN-R4-PREP | (docs only — no code change) | `38e6427fa0` | **symlink blocker characterized**: exact call path recorded (target = deps-layer entry, link = exec `node_modules/<name>`, type = `dir`/`file`); isolated capability test (same Node/user) shows **file, dir and auto symlinks all EPERM** while **junction and hard link succeed**; environment evidence: Medium integrity, **no `SeCreateSymbolicLinkPrivilege`**, Developer Mode values unset. **Permission cause UNDER INVESTIGATION**; no policy/registry/privilege change, no elevated run, no restart |
| W11-MAIN-R4-VERIFY | (docs only — no code change) | `0bf47cba7f` | **symlink blocker RESOLVED by the user enabling Windows Developer Mode**: the isolated re-test now **PASSES for both file and directory symlinks** (each resolves to its target); the real `POST /s/communication/person-phones` in workspace **4D** returns **HTTP 200** with `882261739`; the browser composer now shows **Phone number = 882261739**. No permission/policy/registry/core/dependency/driver change by this work; no elevated server; **no restart**; no message send; provider settings untouched |
| W12-COMPOSER-UX | `f3db45b583` (app-only — no core change) | `93d3607d88` | **REVIEW PENDING — NOT an accepted milestone.** Persian composer + honest phone-load states. The composer uses the real `useTranslate` contract with an app `locales/fa-IR.json` catalog (baked into the bundle at build), is RTL for Persian and LTR for English, keeps phone values LTR, and maps person-phones to four distinct states (LOADING/READY/EMPTY/ERROR). **Verified on the test instance (app2, apple)**: English composer LTR with the loaded number; ERROR state (route blocked) shows the failure message and disables Send. **fa-IR host locale is NOT available on the upstream app2 frontend** (v2.41.0 ships no Persian) — **Persian browser rendering NOT VERIFIED**. **New Windows finding:** a Windows-built tarball embeds backslash handler paths and fails server resolution, so the deployable package is built on Linux. **Main-instance install NOT performed** |
| W12-R1 | `1a9c2805dd` (app-only — no core change) | `1a7dc81981` | **REVIEW PENDING — NOT an accepted milestone.** **EMPTY/ERROR correctness + first stale-response guard + SDK catalog findings**: (1) a **non-empty** `phones` list whose entries are all unusable is now **ERROR**, and EMPTY is reserved for a genuinely empty list — with direct tests for `[null]` and `[{}]`; (2) phone loading was guarded by a monotonic request id in the helper; (3) the **locked SDK 2.35** exports `useTranslate` at runtime but its **`APP_LOCALES` has no `fa-IR`** and its CLI has **no catalog-baking** step, while the **workspace build SDK is 2.42.0** and does bake `locales/*.json`. **Main-instance install NOT performed; architect review pending** |
| W12-R2 | `4e53e29f31` (app + docs) | (this docs commit) | **REVIEW PENDING — NOT an accepted milestone, but its behavior IS accepted as-is in R3.** **Real composer connection invalidation + runtime witness:** (1) the stale-response guard lives in the **actual production wiring** — the composer keeps **one** `createPhoneOptionsConnection` for its lifetime (shared request-id counter; the previous per-call loader had its own counter and could not guard across overlapping loads) and its effect cleanup calls `invalidate()`, so a **Person change or unmount silences the previous in-flight request** (its success **or** failure can no longer set state or `selectedPhone`); the deferred tests drive this exact `start`/`invalidate` connection, not a standalone helper; (2) the translation test drives the **real `t` from the built `twenty-sdk/front-component` runtime** against the app's own **build output** banner. `vitest run` → 215/215 at the time; both typechecks exit 0; oxlint 0/0. **No core/provider/send-persist/Workflow/identifier change; no main install, no setting change, no send** |
| W12-R3-BUILD-BOUNDARY | `8c27c95c6b` (test + docs) | `8c27c95c6b` | **REVIEW PENDING.** **Standalone build/translation boundary:** the app was copied **outside the monorepo** (tracked files only) and installed with its **own lockfile** (`yarn install --immutable` OK); the app's own SDK resolves to **2.35.0**. A **separate, exactly-pinned `twenty-sdk@2.42.0`** build tool was installed **outside the app**. The **hidden `twenty-shared` test dependency was removed**. **Boundary finding:** the upstream 2.42 CLI **skips `fa-IR`** (*"not a supported locale"*) and bakes **no** banner, because `fa-IR` exists only in the **fork's `twenty-shared`** (fork commit `6cf109d9ac`) while the published CLI bundles upstream `twenty-shared`. The witness **cannot skip silently**. **Standalone:** 209/213 (only the witness tests fail, by design). **App SDK/lockfile NOT upgraded** |
| W12-R4-APP-LOCAL-I18N | `61ecc50f31` (app + test + docs) | `61ecc50f31` | **SUPERSEDED / NOT ACCEPTED (W12-R5 decision).** **App-owned Persian translation** — a module `src/i18n/app-translate.ts` imported the app's own `locales/fa-IR.json` and applied it for `fa`/`fa-IR` (other locales deferred to the SDK `t`). The decision is to use the **native Twenty mechanism** instead, so this translator was **reverted**; **its package was NOT installed**. The Persian catalog, the EMPTY/ERROR fix, the stable phone-load connection and its cleanup/invalidate are **preserved** (R5) |
| W12-R5-NATIVE-I18N | `40e24a369c` (app revert + docs) | `40e24a369c` | **REVIEW PENDING.** **Native Twenty translation.** Only the R4 translator was reverted — the composer is back on `useTranslate`, and the catalog / EMPTY-ERROR fix / stable phone-load connection + cleanup are preserved. **The native path already exists in this fork (not reimplemented):** `fa-IR` is in `twenty-shared`'s `APP_LOCALES` (fork commit `6cf109d9ac`); `twenty-shared` is a **devDependency** of `twenty-sdk` and is **bundled** by its build, so the fork's `fa-IR` support ships inside `twenty-sdk`'s `dist/login-*.mjs`. **Build tool = the FORK's own `twenty-sdk` (packed via the project's `yarn pack`), NOT the official upstream tool** (source SHA `61ecc50f31`; `twenty-sdk` `sha256 885696F1…`, `twenty-client-sdk` `sha256 93C94D5A…`). **Linux build:** `dev:build --tarball` on `node:24-bookworm` produced `communication-0.1.2.tgz` with forward-slash paths and the **native** banner `globalThis["__twentySdkFrontComponentTranslations__"]={"fa-IR":{…}}`. **Checks:** monorepo **213/213**, both typechecks exit 0, lint 0/0; Linux container **213/213**, tarball `sha256 E051618531C733453B5BB93F94FE8DC1050075FA693C7ACF8A7302DE9BEB3F1D`. No core/server/SDK/provider/send-persist/Workflow/identifier change; no send |
| W12-MAIN-VERIFY | `ff925ebf27` (docs only — no code change) | `6027380646` | **ACCEPTED by the architect — SCOPED.** Scope: the composer renders in **Persian and English**, **phone loading works**, and a **load failure is shown as an error** (not "no number"). **Nothing else is covered.** **Main-instance upgrade + first observed Persian render.** Workspace **4D** (`radiant-cyan-dragon`), API `:3000` / frontend `:3001`, server v2.42.0 upgraded **0.1.0 → 0.1.2** via the native path. Package `sha256 E0516185…`. Persian composer (کانال/شماره تلفن/متن پیام/انصراف/ارسال, RTL, phone LTR, load PASS); ERROR state (**دریافت شماره‌ها ناموفق بود.** + Send disabled); English LTR then restored. Dev-stack restart + health recovery recorded (API 200, frontend 200). **Preserved:** same rows, **9 variables**, `workflowActionTriggerSettings: null ×4`, **0 records**, no Send. Backup `pre-w12mv-…`, restore-verified |
| W14-SMS-SETTINGS-AND-UX-FINAL | `b88e1539a9` (app + host + catalogs + test + docs) | `b88e1539a9` | **REVIEW PENDING — no acceptance claimed.** **SMS settings tab + remaining Persian fixes.** New **`SMS system`** tab in Settings → Communication (فا: **سامانه پیامکی**): independent **Kavenegar**/**RazPayamak** sections, separate default-provider choice, secret replace/clear, Persian+English copy. **Host change is limited and disclosed** — one host component + tab wiring + two display fixes; **no business logic moved to the host**, no SDK upgrade, no new provider, no orchestration change. Host exports no variable read/write for front components, so the tab reuses the host's **existing** `updateOneApplicationVariable` and native inputs (no invented SDK mutation); app resolved by **stable universal identifier**; absent app → clear "module is not installed" message. **Security:** secrets **masked** server-side (presence only), empty secret = **keep**, clearing is **explicit**, masked values never re-submitted, provider switch **preserves the other provider**, unauthorized calls **rejected server-side**; 9 variables / tombstone / keys / UUIDs / secret flags unchanged; no parallel storage. **Persian fixes:** command-menu app-name suffix, composer panel title, the two missing timeline reasons, unknown-outcome warning, empty-state wording; translation-completeness test covers fixed production messages. **Package 0.1.4:** `sha256 347F491C30CCB8B93E38638F370B7BD473C85A9D78CC8A9907BBF763730130AA`. **Checks:** app 228/228, app+front+server typechecks exit 0, app lint 0/0. **app2/apple mock:** acceptance "Message sent." (`3a480a0d-…`) + rejection "mock rejection" (`b5e2185a-…`), 1 request/click, 1 activity/record; variables restored, mock stopped. **Main 4D:** upgraded to 0.1.4; **سامانه پیامکی** tab observed in Persian and English; locale restored to fa-IR; **0 records, no Send, no real setting saved**. Backup restore-verified; diff 0 removals. **No core/SDK/provider/send-persist/Workflow/identifier change; real sending NOT PERFORMED; W7 disabled** |
| W14-R1-SETTINGS-CORRECTIONS | `68377199eb` (app + host + catalogs + tests + docs) | `68377199eb` | **REVIEW PENDING — no acceptance claimed.** **SMS tab review corrections.** (1) **Explicit secret intent** KEEP/REPLACE/CLEAR: typing after Clear **cancels** it, a **Cancel clear** action restores KEEP, and an **empty input alone never clears**. (2) **LOADING / NOT_INSTALLED / ERROR** are separate states — a failed request shows a load error, **never** "not installed". (3) **One shared synchronous lock** guards every write (provider selection + both saves), so a fast double click cannot double-submit. (4) **Honest partial failure**: `Promise.allSettled` + `summarizeSaveOutcome` report **«بخشی از تنظیمات ذخیره شد؛ ذخیرهٔ بقیه ناموفق بود.»**, the form is **re-read**, and no "nothing changed" claim is made (no rollback). (5) **No-permission caller on app2 DENIED** on read and write with `Entity performing the request does not have permission` — recorded **separately from `UNAUTHENTICATED`**; test keys revoked. (6) Composer: **definite failure (incl. `FAILED_BUT_UNRECORDED`) → error**, **unknown / sent-but-unrecorded → warning**, via a shared production mapping. **Package 0.1.5:** `sha256 1B7A6F9501BABDFC72E3BC4309A4797066731C4DDB4439943A0A7ECAB956B9C6`. **Checks:** app 235/235, app typechecks exit 0, app lint 0/0, twenty-front typecheck exit 0 + changed files clean, 18 host state tests; container 235/235. **No browser pass in this correction** (none requested); main instance not re-upgraded. **Correction (W14-R2):** the "edited during a save keeps its newer draft" claim was **not yet true** in R1 — see W14-R2. **No core/SDK/provider/send-persist/Workflow/identifier change; real sending NOT PERFORMED; W7 disabled** |
| W14-R2-FINAL-FIX | `883b977f79` (app + host + catalogs + tests + docs) | `883b977f79` | **REVIEW PENDING — no acceptance claimed.** **Final corrections to the SMS tab and composer.** (1) The secret input reads **only the typed replacement** (`resolveSecretInputValue`), so no stored/masked value can enter the field; a **multi-character** replacement is carried intact to the mutation. (2) Draft cleanup compares the **snapshot taken at save start** against the current draft, so a **newer edit on the same key — secret or normal — survives** (`dropUnchangedSucceededDrafts`). (3) Save and read-back are wrapped in **catch/finally**: a failed `refetch` neither locks the UI nor leaves an unhandled rejection, the honest message is **«ممکن است تنظیمات ذخیره شده باشد، اما بازخوانی ناموفق بود…»**, and **drafts are kept**; the provider-selection path got the same treatment. (4) The **shared severity drives both** the in-form message and the toast. **Checks:** app 235/235, app typechecks exit 0, app lint 0/0; twenty-front typecheck exit 0, changed files lint/format clean, **22** host state tests. **Correction (W14-R3):** the "deferred" wording was **wrong** — R2's draft-preservation tests are **pure-function** tests (no deferred timer, no mutation), not deferred or mutation tests. **No core/SDK/provider/send-persist/Workflow/identifier change; no real send, no credential change; real sending NOT PERFORMED; W7 disabled** |
| W14-R3-SECRET-INPUT-CLOSURE | `20939d2324` (host + tests + docs) | `20939d2324` | **ACCEPTED by the architect — SCOPED to the secret-input fix only** (the field-flag secret detection and the real form-connection test). **Secret-input closure.** (1) `readValue` decides from the **field's own `isSecret` flag**, not `secretPresenceByKey`, so a secret whose stored value is **empty** still reads only `secretFieldStateByKey[key].replacement` and cannot fall through to the stored-value branch. (2) A **real form-connection test** renders the actual tab, types a fake multi-character secret into the **real input** (stored value empty), asserts the input holds exactly that value, clicks **Save**, and asserts the mutation receives the **full** value — separate from the pure-function tests. **Checks:** twenty-front typecheck exit 0, changed files lint/format clean, **29** host tests (28 pure + 1 real form). **No package built**; the main instance was still **0.1.4** at that point. **No core/SDK/provider/send-persist/Workflow/identifier change** |
| W14-MAIN-CLOSURE | (this commit — app version + docs) | (this docs commit) | **REVIEW PENDING — no acceptance claimed.** **Package 0.1.6 built and installed on the main instance.** Version bumped to **0.1.6**; built **on Linux with the fork's own `twenty-sdk` 2.42.0** (not upstream); **0.1.5 not used**. Pre-upgrade checks: app UID unchanged, all other UIDs unchanged, **`workflowActionTriggerSettings: null` ×4** (W7 disabled), **9 variables** unchanged, **manifest diff 0 removals**. Backup `pre-w14mc-20261008-124820` **restore-verified**. Native upgrade of workspace **4D**: registration `050704a1-…` and application `7c7b25f9-…` now **0.1.6**; **all 9 variable values byte-identical** to the backup; **no setting saved**; **0 records**. Read-only browser: **سامانه پیامکی** tab opens, **fa-IR/RTL**, **secret inputs empty (no stored/masked value)**, command **ارسال پیامک**, composer title **ارسال پیامک** with phone **882261739** loaded and **LTR**; API/frontend **200**. **Checks:** container 235/235, both typechecks exit 0, lint 0/0. **Package 0.1.6:** `sha256 652D3DAA1804976D886B0FB8E6600E318F6D5A45A48E2FC477821F5095066EE2`. **No core/SDK/provider/send-persist/Workflow/identifier change; no send, no setting saved; real sending NOT PERFORMED; W7 disabled** |
| W15-A-BULK-PREVIEW-AND-TEMPLATES | `be0fc52089` (app + tests + docs) | `be0fc52089` | **REVIEW PENDING — no acceptance claimed. PREVIEW + TEMPLATES ONLY; bulk sending NOT implemented (W15-B).** **Selection contract:** the host already forwards every selected id via the **locked SDK** — `targetedRecordsRule.selectedRecordIds` → `selectedRecords` → `selectedRecordIds` in `FrontComponentExecutionContext`; the app reads them through `useSelectedRecordIds()` (**verified in the actually-locked `twenty-sdk@2.35.0`**, clean copy from the app's own lockfile). **No SDK API invented, no host/core change, no SDK upgrade.** Single record → unchanged single-person form; many → bulk preview form (recipient list, per-person number choice, remove, final count; unsendable shown as `NO_PHONE`/`NOT_ACCESSIBLE`; duplicate ids reported; shared numbers warned). **Templates** are a NATIVE workspace object `messageTemplate` (title/body/channel, `isUICreatable`/`isUIEditable`, + `Message templates` view) — **no parallel storage**. **Interpolation** is a closed catalog (`@name`,`@lastName`,`@fullName`,`@company`, aliases) with a **strict grammar, no eval/SQL/traversal**; empty/unknown tokens stay visible and are **never** ready to send. **Server** re-reads authorized Persons and builds each recipient's text. **Persian/English + RTL**; single-send/providers/durable/Timeline/settings untouched; **W7 still disabled** (`workflowActionTriggerSettings: null` ×7). **Checks:** app **289/289** (35 files), typecheck exit 0, lint 0/0; Linux package **0.1.7** built with the **fork's own `twenty-sdk` 2.42.0** — `sha256 0E8E29909B7C43CE3042E9772DFD2D386EE30B1899C05A3A598D27AF694BAE9A`, POSIX paths, native `fa-IR` banner (97 keys); container (locked 2.35.0 clean copy) **289/289**, typecheck exit 0, lint 0/0; manifest diff **0 removals** (only additions). **NOT installed anywhere; main instance remains 0.1.6 (4 functions; the 7 belong to this manifest only); live UI and real template save/retrieve NOT performed; no real SMS; real sending NOT PERFORMED** |
| W15-A-R1-PREVIEW-CLOSURE | `73b554cce1` (app + tests + docs) | `73b554cce1` | **REVIEW PENDING — no acceptance claimed. Still preview/templates only; bulk sending NOT started.** **Stale preview:** a change to text/template/number/recipients/selection immediately voids the preview and silences the in-flight request (`createPreviewConnection`, monotonic request id; stale success **and** failure dropped; unmount cleanup); verified with **deferred responses on the real production connection**. **Destination:** an invalid phone override is reported explicitly (`invalidOverrides`); shared-number warnings are computed from the **current numbers of the remaining recipients** on the client and **recomputed after overrides** on the server. **Validation:** templates `LOADING`/`EMPTY`/`ERROR` are separate; a failed preview shows a Persian error; an **empty/whitespace body is never ready**; the **200 cap applies to preview**; **duplicates are reported, not pre-removed** (`normalizePersonIds` no longer de-duplicates). **SDK:** `useSelectedRecordIds` verified in the **locked 2.35.0** (clean copy from the app's own lockfile, no borrowing); **no SDK upgrade**. **Evidence honesty:** selection/workspace/template suites are **pure/mocked** — no live-UI and no real template save/retrieve claim; package **0.1.7** `sha256 0E8E2990…` **BUILT ONLY**; main instance **0.1.6** with **4 functions**. **Checks:** app **315/315** (37 files), container **315/315**, both typechecks exit 0, lint 0/0. **No core/provider/send-persist/Workflow/identifier change; no send; no install; W7 disabled; bulk sending disabled.** *(Correction: R1 described the invalid override as "keeps the person's own number / no silent substitution", but the code actually FELL BACK to the primary — corrected in W15-A-R2.)* |
| W15-A-R2-DESTINATION-CLOSURE | `44d9634582` (app + tests + docs) | `44d9634582` | **REVIEW PENDING — no acceptance claimed. Still preview/templates only; bulk sending NOT started.** **Corrects a silent substitution:** an invalid phone override (a number the Person does not own, an explicit empty selection, or an invalid type) now sets `selectedPhone: null`, records `invalidOverrides: [{ personId, reason }]`, and the recipient is **not ready** and **excluded from `readyCount`** — the primary is **never** substituted. **Absent key vs explicit choice:** `readPhoneOverrides` preserves present empty/invalid-type values (no fallback), and `applyPhoneOverrides` distinguishes an absent key ("no choice" → keep the default) from a present invalid value (→ reported, no destination). **A valid recipient is untouched** by another's invalid override. **Tests:** production `previewTemplate` cases (not-owned, empty, invalid-type, absent-key, one-invalid-beside-one-valid) plus a `readPhoneOverrides` unit test; the earlier fallback-approving assertions were corrected. **Checks:** app **327/327** (37 files), **both** typechecks exit 0, lint 0/0. **Source-only correction — 0.1.7 remains BUILT ONLY; main instance 0.1.6 (4 functions); W15 REVIEW PENDING; no install/send/settings/core/SDK/provider change; W7 + bulk sending disabled** |

**Evidence levels (do not conflate them):**

1. **Registration / upload / sync — PASS.** 14/14 files, `Plan: 92 to add`, 1 object, 4 logic functions, 2 front components, 1 timeline type, 9 **workspace** application variables (re-verified on both the v2.41.0 and v2.42.6 instances).
2. **API / event execution — PASS on the isolated v2.41.0 instance (W10-R6).** After the container-scoped DNS fix, the dependency layer installed and the routes executed: `/communication/person-phones` → 200 with the real phone, `/communication/send` with incomplete config → a safe truthful failure with **0** records and **no** provider request. The earlier W10-R2 API results were obtained while the dependency layer was cached; the unchanged v2.42.6 instance still returns **HTTP 500**.
3. **Browser rendering — PASS for front components, the composer AND the timeline card (W10-R4/R5/R6).** Stock `Hello World` renders on both images; the composer renders and now shows **populated phone options** (W10-R6); the timeline card renders its persisted status — it is a **collapsed row by default**.
4. **Real sending — NOT PERFORMED.** No Kavenegar/RazPayamak request, no delivery receipt, no real credentials.

**Live verification: PASS for registration/upload/sync, browser rendering (front components, composer, timeline card), and API/event execution on the isolated v2.41.0 instance (W10-R6).** **Data-model isolation is verified and one workspace's execution-time configuration was observed live (W10-R7).** **Two-workspace distribution is PASS via the native tarball path (W10-R8-R1): the same app (unchanged universalIdentifier) is installed in both `apple` and `Isolation Beta` on app2 — installation and isolation are separate claims.** **Two-workspace execution isolation is PASS (W10-R8-R2) with an execution witness: each workspace's real send route independently selects its own configured provider (persisted `providerId` `kavenegar` vs `razpayamak`) — the observed failures occurred pre-HTTP at provider configuration resolution, without any real provider request.** **NOT PERFORMED:** real-provider sending. **No real provider request was ever made.**

Current Development State:
- Jalali Presentation Layer: COMPLETE / ACCEPTED / COMMITTED (Phases 1–5).
- Persian / RTL foundation, Data Model localization, Record Detail localization, Navigation RTL, Kanban/system-status localization: COMPLETE / COMMITTED.
- Settings / Experience Persian presentation: COMPLETE / COMMITTED.
- Enterprise / SSO / ClickHouse findings documented; NO Enterprise licence bypass is part of the desired architecture.
- Development startup reliability fixed (phased readiness); cold-start *performance* remains a separate, unstarted topic.
- Branding / white-label: PLANNED / NOT STARTED.
- Communications / Messaging: ACTIVE. W0–W9 implemented; **W9-R2** workspace-owned provider configuration (verified in the native Variables tab, secrets encrypted per workspace and masked); **W10-R4/R5** front components, composer and timeline card all render (the card is a collapsed row by default); **W10-R6** restored **logic-function execution** on the isolated v2.41.0 instance via a scoped container DNS override and verified the composer's real routes, with a safe truthful failure and zero records/provider requests; **W10-R8-R1** distributed the unchanged app to a second workspace via the native tarball path; **W10-R8-R2** evidenced two-workspace execution isolation — each workspace's real send route independently selects its own configured provider (the failures were pre-HTTP, so no real provider request was made). The Person send-message slice (command menu → composer front component → authenticated route logic function → certified durable orchestration) and the Person timeline integration both exist. SMS via Kavenegar or RazPayamak; architecture is multi-channel from day one.

## Communications — authoritative current behavior

- **Timeline data path:** `timelineActivityId` → activity (`GET /rest/timelineActivities/<id>`) → `activity.linkedRecordId` → Communication (`GET /rest/communications/<id>`). The renderer context's `recordId` is **null** for a timeline renderer and is never used as the linked record.
- **Activity label:** `communication` (outcome-neutral, so a QUEUED record never reads as sent).
- **Status source:** the persisted Communication record, read at render time — never the activity's creation-time snapshot.
- **Refresh:** **manual**, via a localized Refresh action shown on pending and unavailable cards. The card does **not** update automatically; no subscription or invalidation mechanism is exposed to the front-component sandbox.
- **Unavailable reasons:** `NO_ACTIVITY_ID`, `ACTIVITY_NOT_FOUND`, `NO_LINKED_RECORD`, `LINKED_RECORD_NOT_COMMUNICATION`, `ERROR`. None renders as QUEUED or as success.
- **One activity per Communication**, created on `communication.created` only; a status refresh renders the same card and never creates another activity or calls a provider.
- **Workflow entry point: DISABLED.** The `Send Communication` action is **no longer registered** (`workflowActionTriggerSettings` removed) and its production entry is a deterministic refusal returning `WORKFLOW_ACTION_DISABLED`. Reason: a failed/incomplete send cannot mark a Workflow step FAILED, and throwing would risk a duplicate send. The reusable adapter and its tests are retained but unreachable. See the W7 section.

Next Recommended Work:
No wave assigned. W7 is **IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED**. W8/W8-R1 and W9/W9-R1 are **accepted at code level**. **W10-R2** installed the app (registration → upload 14/14 → sync 92 entities) and its API/event checks passed **while the dependency layer was cached** (now historical). **W10-R3**'s browser pass was corrected by **W10-R4**, which proved front components and the composer **do render**. **W10-R4**'s two blockers are both resolved (W10-R6 execution, W10-R5 timeline card), **W10-R8-R1** resolved the two-workspace blocker via the native tarball path, and **W10-R8-R2** closed the evidence gaps (execution witness, per-install workflow-trigger verification, upgrade-job audit, Recovery reconciliation). Do not start another wave automatically.

**Current test runtimes:**
- `twenty-comm-test-app2` — **fresh `twentycrm/twenty-app-dev:v2.41.0`**, port **3101**, NEW volumes, workspaces `apple` and `Isolation Beta`, the Communication app installed in **both** (native tarball path, W10-R8-R1). This is the working front-end runtime.
- `twenty-comm-test-app` — `twentycrm/twenty-app-dev:v2.42.6`, port 3100, preserved for diagnosis (its DB was migrated and cannot be downgraded).

**Open blocker (environment/platform, not app):**
1. ~~**True two-workspace execution isolation (W10-R7)**~~ — **RESOLVED by W10-R8-R1 (distribution) + W10-R8-R2 (execution evidence).** The LOCAL-registration ownership limit blocked only the *LOCAL dev-sync path* (`twenty apply` → *"registered to another workspace"*; install runner logs *"Skipping install for LOCAL app 768bca20-…"*). The platform's **native packaged path does not have this limit**: `uploadAppTarball` (with the owner's auth) converts the same registration to `sourceType: TARBALL` preserving the universalIdentifier and ownership, and `installApplication` (with the second workspace's auth) then installs the app there. `ensureDepsLayer` is unrelated to this chain — it is a *runtime dependency-layer* step that already worked on app2 (W10-R6) and fired once per workspace on first execution. See the W10-R8-R1/R2 sections for the live two-workspace evidence (installation is a separate claim from execution isolation; each is evidenced on its own).
2. **Logic-function execution on the v2.42.6 instance** — `ensureDepsLayer` (Yarn 4.9.2) cannot resolve a package registry there; the host resolver returns loopback for `registry.yarnpkg.com`/`registry.npmjs.org`. **Restored on the isolated v2.41.0 instance by a container-scoped `--add-host` (W10-R6)**; the v2.42.6 instance was deliberately left unchanged as the control. This is **not** a global-DNS problem: egress works, only DNS is sinkholed, and the fix is scoped to one container.

**Resolved:** the **timeline card render** (W10-R5 — it is a **collapsed row by default**), **logic-function execution on the isolated v2.41.0 instance** (W10-R6), **two-workspace app distribution via the native tarball path** (W10-R8-R1 — installation), and **two-workspace execution isolation with a real execution witness** (W10-R8-R2 — a separate, later-evidenced claim).

**Registry IP pins are temporary test configuration** — they pin a CDN IP that can change, are **not** a production deployment recommendation and carry **no availability guarantee**. Reversal: recreate the container without the `--add-host` flags.

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
13. **CORE_CHANGE_COUNT is no longer zero.** One bounded core exception exists: `packages/twenty-server/src/constants/assets-path.ts` (`00b69db9bb`, W11-MAIN-R1). It only normalizes path separators before the `/dist/` check so the built `dist/assets` layout is found on Windows; it introduces no fixed path, no manual asset copy, no new dependency, and no Communication logic change, and it is behaviour-preserving on POSIX and for source/testing runs. It is a **build/runtime path-correctness fix**, not an architecture change. Any further core change requires its own explicit, recorded exception.

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
| Communications / Messaging | ACTIVE — W0–W9 implemented; **W9-R2 workspace-owned configuration VERIFIED**; front components + composer + timeline card render (W10-R4/R5); **logic-function execution RESTORED on the isolated v2.41.0 instance** (W10-R6, scoped container DNS); **two-workspace distribution PASS via native tarball** (W10-R8-R1: the same app installed in `apple` + `Isolation Beta`, `isListed=false` preserved — a listing flag, not a privacy guarantee); **two-workspace execution isolation PASS with an execution witness** (W10-R8-R2: independent provider selection per workspace through the real send route — failures pre-HTTP, no real provider request; foreign Person access rejected); **HTTP Mock integration PASS at API level then browser-composer level** (W11-MOCK/W11-MOCK-UI: mock acceptance only, Kavenegar only, no real send); **installed on the main instance (workspace 4D, v2.42.0) via the native tarball path, with main-instance logic-function execution now PASSING after the Windows symlink blocker was resolved** (W11-MAIN-R1..R4); **composer localized with NATIVE Twenty translation (the fork's `fa-IR` in `twenty-shared` bundled into `twenty-sdk`, baked via a fork-built SDK artifact) and honest LOADING/READY/EMPTY/ERROR phone states, with the stale-response guard in the real composer connection (shared loader + cleanup invalidation); a Linux package builds with the native `fa-IR` banner baked in, upgraded on the main instance (workspace 4D) to 0.1.2, with the Persian composer and its RTL/ERROR/English states observed in the browser, plus a standard Twenty-styled send form, unified native Persian metadata + front-component translation, a discoverable read-only Communications view + sidebar entry, and the object made non-creatable/non-editable so sending is separated from hand-authoring, plus a professional SMS settings tab (سامانه پیامکی) with independent Kavenegar/RazPayamak sections, a separate default-provider choice and masked-secret replace/clear with explicit KEEP/REPLACE/CLEAR intent, a shared save lock and honest partial-failure reporting, and the remaining Persian fixes** (**W12-COMPOSER-UX / W12-R1 / W12-R2 / W12-R3-BUILD-BOUNDARY / W12-R4-APP-LOCAL-I18N [SUPERSEDED] / W12-R5-NATIVE-I18N — REVIEW PENDING; W12-MAIN-VERIFY — ACCEPTED (scoped); W13-UX-CLOSURE, W14-SMS-SETTINGS-AND-UX-FINAL, W14-R1-SETTINGS-CORRECTIONS, W14-R2-FINAL-FIX, W14-MAIN-CLOSURE, W15-A-BULK-PREVIEW-AND-TEMPLATES, W15-A-R1-PREVIEW-CLOSURE, W15-A-R2-DESTINATION-CLOSURE — REVIEW PENDING**; package **0.1.6 installed on the main instance** (built on Linux with the fork tool) via the native path; **Persian browser render VERIFIED on the main instance**; build tool = the **fork's own** `twenty-sdk`, **not** the upstream tool; **W15-A/-R1/-R2 add a multi-selection preview form + workspace templates (package 0.1.7 BUILT ONLY, NOT installed; live UI + real template save/retrieve NOT performed; an invalid phone override leaves no destination — no silent substitution; bulk sending NOT implemented — W15-B)**); **W7 IMPLEMENTED BUT DISABLED — BLOCKED / NOT ACCEPTED** (`workflowActionTriggerSettings: null` on all 7 functions in the manifest); real-provider sending NOT verified | W0 `bbddd56c73`, W1 `cf4d176d60`, W2 `f951459e5a`, W3 `b69c4a2ade`, W4 `8c3866f5f5`+R1 `f1469f4fb7`, W5 `15ad660a64`+R1 `0853765a98`+R2 `defdc41e9d`+R3 `7b21608880`, W6 `b464171e2a`+R1 `fd9e0988c6`+R2 `10af7c560f`, W7 `d5a71d9232`+R1 `8b58018393`+R2 `ce2cc9e0d1` (disabled), W8 `8ecbd449d633ddd248dfc08f3526fc34b0788cc0`, W10-R2 `526997b77e`, W10-R3 `a791ca8762`, W10-R4 `521000b709`, W9-R2 `b12a5c57f9`+`3654e15e1c`, W10-R5 `8c15ea8668`, W10-R6 `ce3b9fb297`, W10-R7 `aceb78f228`, W10-R8-R1 `348606e2e2`, W10-R8-R2 `bbb1b5cb18`, W11-MOCK `f844cb334e` (+ `9ecf0a70e1`), W11-MOCK-UI `fff3cee41f`, W11-MAIN-R1 `00b69db9bb` (core fix) + `fb49f6bbc3` (docs), W11-MAIN-R2 `bff48ff4ca` (portable tests) + `10e8e9420c` (docs), W11-MAIN-R3 `37140cc5b9` (docs; runtime fix applied), W11-MAIN-R4-PREP `38e6427fa0` + R4-VERIFY `0bf47cba7f` (docs; blocker resolved), W12-COMPOSER-UX `f3db45b583` (app) + `93d3607d88` (docs), W12-R1 `1a9c2805dd` (app) + `1a7dc81981` (docs), W12-R2 `4e53e29f31` (app + docs), W12-R3-BUILD-BOUNDARY `8c27c95c6b` (test + docs), W12-R4-APP-LOCAL-I18N `61ecc50f31` (**superseded**), W12-R5-NATIVE-I18N `40e24a369c` (app revert + docs), W12-MAIN-VERIFY `ff925ebf27` (docs) + `6027380646` (docs), W13-UX-CLOSURE `a7adec646a` (app + test + docs), W14-SMS-SETTINGS-AND-UX-FINAL `b88e1539a9` (app + host + catalogs + test + docs), W14-R1-SETTINGS-CORRECTIONS `68377199eb` (app + host + catalogs + tests + docs), W14-R2-FINAL-FIX `883b977f79` (app + host + catalogs + tests + docs), W14-R3-SECRET-INPUT-CLOSURE `20939d2324` (host + tests + docs), W14-MAIN-CLOSURE `7697b2ae39` (app version + docs), W15-A-BULK-PREVIEW-AND-TEMPLATES `be0fc52089` (app + tests + docs), W15-A-R1-PREVIEW-CLOSURE `73b554cce1` (app + tests + docs), W15-A-R2-DESTINATION-CLOSURE `44d9634582` (app + tests + this docs commit); **last accepted milestone = W12-MAIN-VERIFY (scoped) + W14-R3-SECRET-INPUT-CLOSURE (scoped)**; no next wave assigned |
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
W10-R6/R7/R8-R1/R8-R2 (isolated execution, workspace isolation, native tarball two-workspace
distribution), W11-MOCK / W11-MOCK-UI (HTTP Mock integration, API then browser), W11-MAIN-R1..R4-VERIFY
(main-instance install + the one recorded core assets-path exception, applied in R3; the host symlink
blocker resolved in R4-VERIFY by enabling Developer Mode) are also recorded; see the milestone table.
The whole **W12 line** (W12-COMPOSER-UX, W12-R1, W12-R2, W12-R3-BUILD-BOUNDARY, W12-R4-APP-LOCAL-I18N
[superseded], W12-R5-NATIVE-I18N — Persian composer, honest phone-load states, the production-connection
stale-response guard, and **native Twenty Persian translation** via a fork-built SDK artifact) is
**REVIEW PENDING** and **NOT an accepted milestone**. **Exception: `W12-MAIN-VERIFY` is ACCEPTED (scoped)** —
only the Persian/English composer, phone loading, and the load-error display. See its sections.
Do NOT redo any of these waves.

INSTALLED VERIFICATION (W10-R2 — **historical**: superseded by W10-R6 execution restoration and
W10-R8-R1/R2; its "all 8 runtime checks PASS" ran while the dependency layer was cached): the app is
installed on the isolated instance: registration, upload (14/14 files) and metadata sync (92 entities)
all PASS at API/event level — native variables, secret masking (fake value), Person
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

CURRENT RUNTIME (W10-R6/R7/R8-R1): **logic-function execution is RESTORED** on the isolated v2.41.0 instance
(`twenty-comm-test-app2`, port 3101) via a **container-scoped DNS override** — two `--add-host`
entries pinning `registry.npmjs.org` and `registry.yarnpkg.com` to their real CDN IPs (**temporary test
configuration; not a production recommendation and no availability guarantee**). This is reversible by
recreating the container without those flags. No host DNS, core source, SDK version, generated
dependency code or cache marker was changed. The unchanged v2.42.6 instance still returns HTTP 500,
which is the control. Verified after the fix: the dependency layer installs
(`.twenty-layer-ready`), `/communication/person-phones` → 200 with the real phone, the composer shows
populated phone options, and submitting with incomplete config returns a safe truthful result with
**0** records and **no** provider request. **W10-R8-R1 addition:** the same app now also runs in
**Isolation Beta** on the same instance — installed through the native `uploadAppTarball` +
`installApplication` path (registration converted LOCAL → TARBALL, identity/ownership/`isListed=false`
preserved) — with independently-set non-secret configuration and per-workspace record scoping.

WORKSPACE ISOLATION (W10-R7 → W10-R8-R1/R2): a second disposable workspace (`isolation-beta`) was
created and activated natively. **Data-model isolation PASS** (variables keyed by `workspaceId`; 0 shared
registration variables). **Execution-time configuration observed**: the persisted record's
`providerId` follows the workspace's `COMMUNICATION_PROVIDER`. **Two distinct failure shapes — do not
conflate them:** an **invalid/empty provider** fails at `getConfiguredProviderId()` **before** `createQueued`,
so it creates **0 records** and contacts no provider; whereas **incomplete credentials with a valid
provider** pass `createQueued` (a record IS created) and then fail at the provider's `resolveConfig()`,
leaving a **FAILED** record whose reason is the orchestration constant `Unexpected send failure.` — so
"incomplete credentials" does **not** imply "no record". The W10-R7-era blocker ("a LOCAL app registration is owned by
one workspace") limited only the LOCAL dev-sync path: **W10-R8-R1** installed the same app into the
second workspace through the native tarball path, and **W10-R8-R2** provided the two-workspace
execution witness (per-workspace `providerId` through the real send route, no real provider request).

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
**Per-workspace execution isolation is VERIFIED (W10-R8-R2; the W10-R7-era "NOT PERFORMED" statement below was historical).** A second disposable workspace was created and activated (W10-R7); the W10-R7-era claim that "the app cannot be installed there" was **superseded by W10-R8-R1** (native tarball path), and **W10-R8-R2** evidenced the isolation: each workspace's real send route selects its own configured provider (persisted `providerId` `kavenegar` vs `razpayamak`; the observed failures occurred pre-HTTP at provider config resolution, so no real provider request was made). Data-model isolation (`workspaceId`-scoped rows, workspace-key encryption, workspace-only env map) is verified.

HTTP MOCK INTEGRATION (W11-MOCK API level `f844cb334e` → W11-MOCK-UI browser level `fff3cee41f`): the full
send path was exercised against a **temporary in-network Kavenegar mock** (no host port, no external call),
first by **direct route calls** (API level) and then **only by clicking Send in the real browser composer**.
Both runs are **mock acceptance only — NOT a real send, NOT delivery proof, and Kavenegar only**
(RazPayamak was not exercised). Browser run: success toast **"Message sent."** with record
`c9ee6377-…` (SENT, `providerMessageId=999001`) and error **"mock rejection"** with record `6a37d3e9-…`
(FAILED), **exactly one mock request each** and **exactly one activity each** (`fe89391e-…`, `78e05a2c-…`);
the SENT/FAILED timeline cards were opened and captured. The **Refresh action is NOT TESTED** (both cards
were terminal, so no Refresh button renders — that absence is a source-level fact, not a test result).
Variables were restored exactly and the mock stopped; test records/person were retained. W7 stays disabled.

MAIN INSTANCE (W11-MAIN-R1/R2/R3/R4 `00b69db9bb` + `bff48ff4ca`): Communication is **installed** in the main
workspace **4D** (`radiant-cyan-dragon`) on server **v2.42.0** via the native tarball path (registration
`050704a1-…`, app `7c7b25f9-…`, UID unchanged, 9 variables created empty, W7 disabled), after a
**restore-verified** backup at `D:\twenty-main-backup\pre-w11-20261007-113035\`. The reviewed `assets-path`
fix was **applied to the running server in R3** through the standard watcher (API health 200), removing the
earlier `yarn-engine` `ENOENT`. A second blocker then appeared — the local driver **symlinks** the
dependency layer and the host refused symlinks (`EPERM`, no `SeCreateSymbolicLinkPrivilege`) — and was
**RESOLVED in R4-VERIFY when the user enabled Windows Developer Mode** (environment-level fix, not code).
Main-instance execution now **PASSES**: `POST /s/communication/person-phones` returns **HTTP 200** with the
Person's phone, and the browser composer shows **Phone number = 882261739**. **This main install is NOT
two-workspace evidence on v2.42.0** — that remains the app2 v2.41.0 run (W10-R8-R1/R2). Still open: provider
settings are **empty** and **real sending is NOT PERFORMED**; W7 disabled.
Reviewed baseline for R3: `10e8e9420c`.

COMPOSER UX (W12-COMPOSER-UX / W12-R1 / W12-R2 / W12-R3-BUILD-BOUNDARY / W12-R4-APP-LOCAL-I18N [superseded] / W12-R5-NATIVE-I18N — **REVIEW PENDING, not accepted**; **W12-MAIN-VERIFY — ACCEPTED (scoped)**): the composer is **RTL for Persian and
LTR for English** with phone values kept LTR, and maps person-phones to **four distinct states** (LOADING /
READY / EMPTY / ERROR): only a **genuinely empty** successful list reads "no number"; a **non-empty** list
with no usable entry and any HTTP/network/JSON failure read "could not load" and **disable Send**. The
stale-response guard is in the **real composer connection**: one `createPhoneOptionsConnection` per
mount (shared request-id counter) whose effect cleanup calls `invalidate()`, so a **Person change or
unmount silences the previous in-flight request** (success **or** failure). Verified on the test
instance (app2, apple): English composer LTR with the loaded number, and the ERROR state (route blocked in
the browser only) with Send disabled. **Translation is NATIVE (W12-R5):** the composer uses the SDK's
`useTranslate`; `fa-IR` is in the fork's `twenty-shared` `APP_LOCALES` (fork commit `6cf109d9ac`) and the
SDK build **bundles** `twenty-shared`, so the fork's `fa-IR` support ships inside `twenty-sdk`'s own
`dist/login-*.mjs`. The build tool is the **FORK's own `twenty-sdk`** (packed with the project's `yarn pack`,
installed outside the monorepo) — it is **not** the official upstream tool. It bakes
`globalThis["__twentySdkFrontComponentTranslations__"]={"fa-IR":{…}}` into the front-component bundle on
Linux — **no** "Skipping translation file" message. **MAIN INSTANCE (W12-MAIN-VERIFY):** workspace **4D** was
upgraded **0.1.0 → 0.1.2** via `uploadAppTarball` + `upgradeApplication`, and the **Persian composer was
observed in the browser** — **کانال / شماره تلفن / متن پیام / انصراف / ارسال**, `direction: rtl`, phone
`882261739` LTR, phone load PASS; the ERROR state showed **دریافت شماره‌ها ناموفق بود.** with **Send disabled**;
English showed **Channel / Phone number / Message / Cancel / Send** LTR and the locale was restored to
`fa-IR`. **New Windows finding:** a Windows-built tarball embeds backslash handler paths and is rejected by
the server, so the deployable package is built on Linux. **W12 remains architect-review-pending. "Phone
numbers load" PASS is NOT "message sent" PASS** — provider settings are still empty and
real sending NOT PERFORMED; W7 disabled.

RUNTIME BLOCKER (W10-R2-era — **historical**: the v2.42.6 control instance is still blocked this way,
but the isolated v2.41.0 instance (app2) was RESTORED by W10-R6's container-scoped DNS override):
`ensureDepsLayer` installs the app dependency layer with Yarn 4.9.2 and cannot reach a package registry
(`RequestError: connect ECONNREFUSED 127.201.0.114:443`; a controlled request returns HTTP 500). The exact
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
- Per-workspace **execution** isolation (two live workspaces with distinct configuration and no cross-workspace inheritance): **RESOLVED by W10-R8-R1/R2** *(this W10-R4-era "NOT PERFORMED" note is historical — superseded once the native tarball path was exercised)*. The app is installed in both `apple` and `Isolation Beta` (W10-R8-R1), and W10-R8-R2 evidenced independent provider selection through the real send route (persisted `providerId` `kavenegar` vs `razpayamak`; pre-HTTP failures; no real provider request). Data-model isolation (`workspaceId`-scoped rows, workspace-key encryption, workspace-only env map) **is** verified.
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

## W10-R7 — workspace configuration isolation on the working test instance

Status: **data-model isolation VERIFIED; true two-workspace execution isolation NOT PERFORMED** — blocked by a native restriction (a LOCAL app registration is owned by one workspace). One workspace's **execution-time configuration** was observed live.

> **HISTORICAL — SUPERSEDED by W10-R8-R1/R2.** The blocker named below ("a LOCAL app registration is owned by one workspace") limited only the **LOCAL dev-sync path**; the native tarball path does not have it. W10-R8-R1 installed the same app into the second workspace without ownership transfer, and W10-R8-R2 evidenced two-workspace execution isolation (independent provider selection through the real send route). Read this section as the historical record of what was known before the tarball path was exercised.

### 1. Workspace creation and configuration (scoped to app2)

| Aspect | Value |
|--------|-------|
| Instance | `twenty-comm-test-app2` (isolated, v2.41.0, port 3101) |
| New workspace | **Isolation Beta** `67f6d395-ecf7-415e-9ba6-827a35fc2c35`, subdomain `isolation-beta` (ACTIVE, own schema) |
| Removed | **Isolation Gamma** `31b5b8db-…` — an accidental second workspace created while probing the token path; **suspended** with its Communication app never installed |
| Preserved | `apple`, the v2.42.6 instance, both volumes, all unrelated changes |

Creation used only native operations: `signUpInNewWorkspace` → `activateWorkspace` (native workspace activation, which provisions the schema and pre-installed apps). No raw DB writes.

### 2. Configuration — workspace ownership and independent editing

- **Native Variables surface:** each workspace's app-detail **Variables** tab reads that workspace's own `applicationVariables`.
- **Independent editing (PASS):** `updateOneApplicationVariable` set `COMMUNICATION_PROVIDER` in the `apple` workspace and the change was visible **only** there; `isolation-beta` reported its own (empty) values.
- **No shared Communication registration variables (PASS):** the app declares `serverVariables: {}` (removal tombstone), so `core."applicationRegistrationVariable"` for Communication is **0 rows** — there is nothing to inherit.
- **Data-model isolation (PASS):** `core."applicationVariable"` rows are keyed by `workspaceId`; the `apple` workspace has 9, and the beta workspace has none (its app is not installed — see §3).
- All credentials remain absent (every value empty); no real credential was used.

### 3. The blocker for true two-workspace execution isolation

**A LOCAL application registration is owned by one workspace.** Registering/installing the Communication app into a second workspace is refused by the platform:

```
twenty apply (remote = isolation-beta):
  "768bca20-0b81-4d33-a624-0a894a193ffd" is registered to another workspace.
  Change the universalIdentifier in your manifest, or transfer the registration
  from the owning workspace.
```

The same restriction appears through the native mutation path: `installApplication(universalIdentifier)` returns `APPLICATION_NOT_FOUND`, and the install runner logs **`Skipping install for LOCAL app 768bca20-…`** for the new workspace. `installMarketplaceApp` is not applicable either — the app is not listed in the marketplace.

Consequently the beta workspace has **no Communication app**, no Communication logic functions and no Communication variables, so the app's execution cannot be driven there. **The claim "changing A does not change B" and "empty configuration in B does not inherit A's values" cannot be established through the app's own execution**, because B cannot host the app. Marked **NOT VERIFIED**; the missing observation is *a second workspace able to execute the app*.

The observed production constraint is itself the relevant isolation evidence: there is **no cross-workspace fallback** — a workspace either owns the app (with its own configuration) or does not have it at all.

### 4. Observable execution-time configuration (one workspace)

Using only supported APIs and observable production behavior (no diagnostic route, no executor patch, no simulation):

| Probe | `COMMUNICATION_PROVIDER` | Result | Persisted record `providerId` |
|-------|--------------------------|--------|-------------------------------|
| 1 | `razpayamak` | `UNEXPECTED_FAILURE` (no credentials) | **`razpayamak`** |
| 2 | `kavenegar` | `UNEXPECTED_FAILURE` | **`kavenegar`** |
| 3 | `bogus` | `UNEXPECTED_FAILURE` | **no record created** |
| 4 | *(cleared)* | `UNEXPECTED_FAILURE` | **no record created** |

The persisted `providerId` is written by `CommunicationSendAndPersistService.createQueued` **before** the provider call, so it is a genuine execution-time observation of the workspace's configuration. Probes 3–4 show that an invalid or absent provider is rejected **before** a record is created, so **no record is fabricated and no provider is contacted**. `COMMUNICATION_PROVIDER` was restored to empty afterwards.

- **No provider request occurred:** the logs contain no `kavenegar`/`payamak` outbound attempt.
- **Person access stays workspace-scoped (PASS by data model):** Person rows live in each workspace's own schema (`workspace_1wgvd1injqtife6y4rvfbu3h5` vs `workspace_65ksfbjdat77zkiyuzx3gbrjp`), and the route resolves the workspace from the authenticated context.
- **Workflow:** **0** advertised actions (`core."logicFunction"` with non-null `workflowActionTriggerSettings` = 0); W7 remains disabled.

### 5. Evidence levels

| Level | Result |
|-------|--------|
| Network access (registry) | **PASS** (container-scoped `--add-host`, W10-R6) |
| Dependency installation | **PASS** (`.twenty-layer-ready`) |
| Route execution | **PASS** (one workspace) |
| Browser submission | **PASS** (W10-R6) |
| Provider sending | **NOT PERFORMED** (no credentials) |
| **Two-workspace execution isolation** | **NOT PERFORMED — blocked by LOCAL-registration ownership** |
| Data-model isolation | **PASS** |

### 6. Environment changes and reversal

| Aspect | Value |
|--------|-------|
| Container | `twenty-comm-test-app2` (isolated only) |
| Config added | `IS_MULTIWORKSPACE_ENABLED=true`, `FRONTEND_URL=http://localhost:3101` |
| Registry pins | `--add-host registry.npmjs.org:104.16.24.34`, `--add-host registry.yarnpkg.com:104.16.24.34` — **temporary test configuration**: they pin a CDN IP that can change, are **not** a production recommendation and carry **no availability guarantee** |
| Data | `apple` preserved; `isolation-beta` created (ACTIVE); `isolation-gamma` created then suspended |
| **Reversal** | recreate the container without the two `-e` flags and without the two `--add-host` flags (volumes keep the data); delete the `isolation-beta` workspace through `deleteCurrentWorkspace` if it is no longer wanted |
| Not changed | host DNS, core source, SDK versions, generated dependency code, the real stack |

**`FRONTEND_URL` note:** setting it to a hostname is what allows per-workspace subdomain origins (`<subdomain>.localhost:3101`) to resolve. With the bare-IP front URL the server cannot parse a subdomain origin at all (Node's `URL` rejects `<subdomain>.<ipv4>`), which blocks every workspace-scoped token path. This is a test-instance configuration detail, not a production recommendation.

## W10-R8-R1 — native tarball distribution on app2 (completed by W10-R8-R2 execution evidence)

Status: **PROVEN LIVE on the isolated v2.41.0 instance (app2).** The unchanged Communication app was distributed to a second workspace entirely through the platform's **native packaged path** — no npm publication, no ownership transfer, no universalIdentifier change, no direct `sourceType` DB edit, no core/SDK change, and no real provider request. **R1 proved the distribution (Beta install) and configuration-isolation storage witness; R2 added the execution witness and reconciled this document.** Source/build findings below are **static evidence**; runtime findings are labeled as such.

### 0. The contract (verified from the deployed v2.41.0 source before any action)

| Step | File (deployed dist) | Function / guard |
|------|---------------------|------------------|
| Package build | `twenty-sdk/dist/cli.cjs` (CLI 2.41.0) | `dev:build --tarball` → "Also pack into a .tgz tarball"; `app:publish` defaults to **npm** (rejected by task rules), its `--private` branch reuses the same tarball build then uploads to a server registry |
| Upload | `application-tarball.service.js` → `uploadTarball` | `extractAndValidateTarball` requires a valid UUID `universalIdentifier` + `engines.twenty` compatibility; `assertTarballCanReplaceRegistration` allows replacing **LOCAL** or **TARBALL** registrations (`SOURCE_CHANNEL_MISMATCH` otherwise), and refuses version downgrades |
| Attachment | same file → `storeTarballFile`, `updateFromManifest` | stores the tarball via `fileStorageService` (`FileFolder.AppTarball`), sets `sourceType: TARBALL`, `tarballFileId`, forces `isListed: false`, `isVetted: false`, and preserves `ownerWorkspaceId` |
| Install guard | `application-install.service.js` → `installApplication` | LOCAL/OAUTH_ONLY → *"Skipping install for LOCAL app … (files synced by CLI watcher in dev mode)"* + `return true` (dev-mode short-circuit); **TARBALL** proceeds to `doInstallApplication` → `resolveFromSource` → `resolveFromTarball(appRegistration.tarballFileId)` |
| Ownership guard | `application-registration.service.js` → `findOneOwnedByWorkspaceOrThrow` | the *"registered to another workspace"* refusal applies to the **LOCAL dev-sync path only** (`twenty apply` / `createApplicationRegistration`); `uploadAppTarball` + `installApplication` are the supported packaged alternatives |
| `ensureDepsLayer` | runtime dependency-layer installer | **not part of** package resolution/registration; it runs per workspace at first logic-function execution and already worked on app2 (W10-R6) |

### 1. Package preparation (native tooling, locked dependencies)

- Built in the `twenty-comm-cli` container (CLI **2.41.0** matching the server, per the W10-R2 CLI-version finding) from the unchanged app at `/work/app`: `twenty dev:build --tarball`.
- Output: `.twenty/output/communication-0.1.0.tgz` — **1,127,067 bytes**, `sha256 = 94649588360e3491d3426590a765b5bc0d5504c262b2e3608630eb0df11974c8`, 20 files.
- Package contents verified: `manifest.json` (UID `768bca20-0b81-4d33-a624-0a894a193ffd` **unchanged**, `serverVariables: {}` tombstone preserved, 9 `applicationVariables` with correct `isSecret`), `package.json` v0.1.0 (`engines.twenty >=2.35.0`), 4 logic functions, 2 front components (code + source maps).
- Credential scan over every packaged file: **no secret values** — only variable-key names and constant identifier declarations. No credentials or local sensitive files were packaged.

### 2. Upload with `apple` auth (native `uploadAppTarball`)

```
mutation UploadAppTarball($file: Upload!) { uploadAppTarball(file: $file) { … } }
```

Result (registration `e71d0025-ced0-4720-8ec8-71ac8e9ae9f0`, **same row** as before):

| Field | Before | After |
|-------|--------|-------|
| `sourceType` | `LOCAL` | **`TARBALL`** |
| `latestAvailableVersion` | `null` | **`0.1.0`** |
| `universalIdentifier` | `768bca20-0b81-4d33-a624-0a894a193ffd` | unchanged |
| `ownerWorkspaceId` (apple `20202020-1c25-4d02-bf25-6aeccf7ea419`) | apple | **apple (preserved)** |
| `isListed` / `isVetted` | `false` / `false` | **`false` / `false`** (forced by `uploadTarball` itself) |

**`isListed=false` is a marketplace-listing flag only** — it does **not** mean the app is private, and it is not relied on as an access control. The app was never published to any marketplace or npm; distribution happened only through the owner-authenticated upload plus an owner-workspace-scoped install.

### 3. Install into Isolation Beta (native `installApplication`, Beta auth)

```
mutation { installApplication(universalIdentifier: "768bca20-0b81-4d33-a624-0a894a193ffd") { id name universalIdentifier version } }
→ 200 {"id":"5c02bf29-eb11-4c99-8184-4ee5861b7484","name":"Communication","universalIdentifier":"768bca20-…","version":"0.1.0"}
```

- Beta (`67f6d395-ecf7-415e-9ba6-827a35fc2c35`) now has the app with its **own** application row; all 9 `applicationVariables` were created fresh with **empty** values (no inheritance from apple — the 2×9 row set is verified distinct in `core."applicationVariable"` with per-workspace `workspaceId`s and different ciphertext lengths).
- `apple`'s app row (`23121baf-…` v0.1.0) is **untouched**; `autoUpgrade` remains `false` on both workspaces, so no auto-upgrade job can move either install.

### 4. Two-workspace isolation (live, through the app's real routes — completed by W10-R8-R2)

Non-secret configuration set distinctly; all credentials left **empty**:

| Workspace | `COMMUNICATION_PROVIDER` | Probe route (`/s/communication/person-phones`, real logic-function execution) |
|-----------|--------------------------|----------------|
| apple | `kavenegar` | **200** `{"success":true,"phones":[{"value":"5552345678",…}]}` (own person) |
| Isolation Beta | `razpayamak` | **200** `{"success":true,"phones":[{"value":"882261739",…}]}` (own person) |

Isolation probes (all through authenticated API-key contexts). Config reads are the **storage witness**; the send route is the **execution witness**:

| Probe | Result |
|-------|--------|
| Registered order A=`kavenegar` / B=`razpayamak` (re-run W10-R8-R2, storage read-back) | both read back as set |
| Change **only** A → third marker `isolation-probe-a` (distinct from B), storage read-back | apple=`isolation-probe-a`, **beta stayed `razpayamak`** — A's change did not move B |
| Clear **only** B → `""`, storage read-back | **B empty**, apple unchanged — B does not inherit A's value |
| Beta auth → apple's Person (`20202020-b225-…`) via real route | **rejected**: HTTP 500 `Record not found` |
| Apple auth → Beta's Person (`7a93d1e5-…`) | **rejected**: HTTP 500 `Record not found` |
| Beta auth reading apple's app by id | **`APPLICATION_NOT_FOUND`** — the app row itself is workspace-scoped |

**Execution-time provider-selection witness (W10-R8-R2, no real provider contacted):** with each workspace's distinct non-secret `COMMUNICATION_PROVIDER` in place, the real `/s/communication/send` route was executed in both workspaces in the same second. The **runtime claim this evidences is exactly: each workspace's send path independently selects its own configured provider** — apple's executions persist `providerId=kavenegar` and Beta's persist `providerId=razpayamak` through the real execution path, and the server log shows two separate `LogicFunctionTriggerJob` runs, one per workspace, in that second:

| Evidence (W10-R8-R2) | apple | Isolation Beta |
|----------------------|-------|----------------|
| Persisted record `providerId` (execution witness) | **`kavenegar`** (record `91375b5d-…`, `2026-10-06T16:02:03.503Z`) | **`razpayamak`** (record `e85b48b9-…`, `2026-10-06T16:02:03.696Z`) |
| `LogicFunctionTriggerJob` in server log | job 8, `workspace=20202020-1c25-…` at 4:02:03 PM | job 9, `workspace=67f6d395-…` at 4:02:03 PM |
| DB rows (per-workspace schema) | `workspace_1wgvd1injqtife6y4rvfbu3h5._communication`: `kavenegar|FAILED|16:02:03.50` | `workspace_65ksfbjdat77zkiyuzx3gbrjp._communication`: `razpayamak|FAILED|16:02:03.69` |

**The witness does NOT extend to endpoint consumption.** The earlier R2 probe also set a distinct dead `KAVENEGAR_ENDPOINT` per workspace, but per the app source (`razpayamak.config.ts`: `RAZPAYAMAK_SMART_SEND_URL` is a **constant**, "the REST base is fixed by the document; only credentials vary") the RazPayamak provider never reads `KAVENEGAR_ENDPOINT` — so the Beta run cannot have consumed Beta's endpoint value. No endpoint-consumption claim is made for either workspace.

**Where the failure occurred (from source + observed output; no new sends were run):** the observed response is `{"success":false,"failureCode":"UNEXPECTED_FAILURE","isOutcomeKnown":false,"error":"The message could not be sent."}`, and the persisted records are `FAILED` with `failureReason: "Unexpected send failure."`. Per the deployed source this maps to the orchestration path in `communication-send-and-persist.service.ts`: `createQueued` persisted the record (so the record exists), then `sendService.send` → the provider's `resolveConfig()` threw — with all credentials empty, `readRequiredEnv` treats `''` as unset and `getKavenegarConfig`/`getRazpayamakConfig` return a missing-config error **before any HTTP call** — the catch block then **successfully** persisted the FAILED state with the orchestration constant `Unexpected send failure.` (the persisted `FAILED` records with exactly that reason are the evidence that this write succeeded), and finally the original error was **re-thrown** (`throw sendError`), landing in the handler's generic catch, which returns the safe `UNEXPECTED_FAILURE` response. (The `CommunicationUnexpectedSendFailureError` path — which reports "…its state could not be recorded." — would only apply if the FAILED write itself had failed; the observed response and the persisted reason show it did not.) The failure is therefore **pre-HTTP (provider configuration resolution), not an HTTP-time failure**; no request reached any provider transport.

**Server-response wording (kept distinct from the composer text):** the send route responds `{"success":false,"failureCode":"UNEXPECTED_FAILURE","isOutcomeKnown":false,"error":"The message could not be sent."}`. The composer front component renders its own user-facing localized wording; the raw route JSON above is a server API observation, not the UI text.

- **Missing configuration has two distinct paths:** an invalid/empty `COMMUNICATION_PROVIDER` is rejected by `getConfiguredProviderId()` before `createQueued`, so that attempt creates **0 records** and makes **no provider request**. A valid provider selection with missing provider credentials fails later in `resolveConfig()`, after `createQueued`; if the FAILED outcome write succeeds, the attempt leaves a persisted **FAILED** record with `failureReason: "Unexpected send failure."`, still with **no provider HTTP request**. The R2 records above demonstrate this second path. Earlier zero-record observations for incomplete configuration are observations of those particular attempts, not a guarantee for every missing-configuration case.
- **W7 remains disabled — verified in the manifest and the metadata of BOTH installs (W10-R8-R2):** the packaged manifest carries **4 logic functions, all with `workflowActionTriggerSettings: null`** — including `communication-send-workflow-action` (`e55f7b79-cf61-45b4-a1c4-259fa7089b28`), whose source declares the deterministic refusal (`WORKFLOW_ACTION_DISABLED`, "Communication sending from Workflow is unavailable.") with no trigger of any kind; the deployed `from-logic-function-manifest-to-universal-flat-logic-function.util.js` maps a missing setting to `null`; and the GraphQL metadata of both the apple and Beta installs reports `workflowActionTriggerSettings: null` on all 4 functions. Additionally `core.workflow` has 0 rows linked to either Communication app row (only the two stock sample workflows exist per workspace), and `WorkflowCronTriggerCronJob` logs `Cache rebuilt with 0 cron triggers`. The "Send message" **command menu item** is the W10-era composer entry (present and active in both workspaces, as designed) — workflow rows are absent **because the action registration is null in both installs**, not merely because no workflow was created.

### 5. Evidence levels after W10-R8-R1/R2

| Level | Result |
|-------|--------|
| Native tarball package build (CLI 2.41.0, locked deps) | **PASS** |
| Owner-authenticated `uploadAppTarball` (LOCAL → TARBALL, identity preserved) | **PASS** |
| Second-workspace `installApplication` | **PASS** (Beta) |
| Two-workspace **configuration** isolation (distinct storage values; change-A doesn't move B; clear-B doesn't inherit) | **PASS** (storage witness; W10-R8-R2 re-run in registered order with a third marker value) |
| Two-workspace **execution** isolation (independent provider selection through the real send route) | **PASS** (execution witness W10-R8-R2: per-workspace persisted `providerId` `kavenegar` vs `razpayamak`, two separate `LogicFunctionTriggerJob` runs; failure occurred **pre-HTTP** at provider config resolution) |
| Person access across workspaces | **REJECTED** both directions (HTTP 500 `Record not found`) |
| Provider sending | **NOT PERFORMED** (no credentials, no real provider HTTP request; the observed failures occurred **pre-HTTP** at provider configuration resolution) |
| Marketplace/npm publication | **NOT PERFORMED** (out of scope; `app:publish` npm path deliberately not run) |

### 6. Corrections to prior records

- **W10-R7 §3 correction:** the LOCAL-install refusal (`registered to another workspace` / `Skipping install for LOCAL app`) proves a limit of the **LOCAL dev-sync path only**, not the absence of a runtime fallback. The native **tarball path** installs the same app into a second workspace without ownership transfer — proven live above.
- **W10-R7 §2 correction:** "the beta workspace has no Communication app / its app is not installed" is now historical: Beta hosts the app since W10-R8-R1, with its own 9 variables.
- **Gamma status:** `Isolation Gamma` (`31b5b8db-571e-4fce-b2d8-99ff030036a9`) is **suspended** (deactivated via the native workspace-activation flow), **not deleted** — its workspace row and schema remain on app2 with 2 stock workflows and no Communication app (its schema `workspace_2xy1z2a8jfaqeofqunkf8c1ih` has no `_communication` table at all — the app was never installed there).

### 6b. Upgrade-job status and the no-rollback claim (W10-R8-R2)

- **Upgrade jobs:** `autoUpgrade` is `false` on both installs (apple `23121baf-…` v0.1.0 and Beta `5c02bf29-…` v0.1.0). The Redis audit of app2 shows **no upgrade queue at all** (queues present: ai, billing, calendar, campaign, contact-creation, cron, delayed-jobs, delete-cascade, email, entity-events-to-db, logic-function, messaging, task-assigned, trigger, webhook, workflow, workspace — no `application-upgrade`), and the registration's `latestAvailableVersion` equals the installed `0.1.0`, so no upgrade job is pending or enqueued for either workspace. `MarketplaceCatalogSyncCronJob` runs hourly but only syncs **NPM** catalog entries; the Communication registration is `sourceType: TARBALL`, which the catalog upsert skips (`Skipping catalog entry from package …: universal identifier … is registered from source TARBALL` — the deployed guard rejects any non-NPM existing registration for catalog updates).
- **"Rollback to LOCAL" claim scope:** the documented reversal — re-uploading via `uploadAppTarball` or re-registering — keeps the registration in the **native TARBALL channel**; `assertTarballCanReplaceRegistration` (deployed source) accepts only LOCAL and TARBALL as the existing source for a tarball upload, and there is **no observed native operation that converts TARBALL back to LOCAL**. The registration therefore stays TARBALL; no rollback, uninstall or re-registration was performed for testing, and the Beta install was preserved.

### 7. Environment changes and reversal

| Aspect | Value |
|--------|-------|
| Instance | `twenty-comm-test-app2` only (v2.41.0, port 3101); `twenty-comm-test-app` (v2.42.6) untouched; real stack untouched |
| Registration | `e71d0025-…` converted LOCAL → TARBALL by the supported upload mutation (reversible by re-uploading or re-registering; the tarball file remains stored under `FileFolder.AppTarball`) |
| New app row | `5c02bf29-…` in Beta (removable via the native `uninstallApplication` mutation) |
| Variables | apple `COMMUNICATION_PROVIDER=kavenegar`, Beta `razpayamak` (non-secret; restorable to `""` by the same native mutation) |
| Unchanged | host DNS, core source, SDK versions, generated dependency code, DB schema, `apple` data, both volumes |

### 8. Real-SMS test preparation (READY — NOT PERFORMED; app2 only, no auto-retry, W7 stays disabled)

Scope: **one manual send** from the native Person composer, then history/`providerMessageId`/single-timeline-card inspection. **`SENT` = the provider accepted the message; it is NOT delivery proof** (neither driver wires delivery receipts — both `supportsDeliveryReceipt: false`).

**Provider prerequisites (per the deployed provider source, pick ONE provider per workspace):**

| Provider | Required `applicationVariables` (per workspace) | Notes |
|----------|--------------------------------------------------|-------|
| `kavenegar` | `KAVENEGAR_API_KEY` (**secret** — path parameter), `KAVENEGAR_ENDPOINT` (e.g. `https://api.kavenegar.com/v1`), `KAVENEGAR_SENDER` (approved sender line) | `buildSendUrl` puts the key in the URL path; a transport error is deliberately **not** interpolated into history |
| `razpayamak` | `RAZPAYAMAK_USERNAME`, `RAZPAYAMAK_API_KEY` (**secret** — SmartSMS `password` field), `RAZPAYAMAK_SENDER` (primary line); optional `RAZPAYAMAK_BACKUP_SENDER_ONE/TWO` | REST base `RAZPAYAMAK_SMART_SEND_URL` is a **hardcoded constant** (`https://rest.payamak-panel.com/api/SmartSMS/Send`) — no endpoint variable exists for this provider |

**Workspace configuration (one of the two installs on app2):**

| Aspect | Requirement |
|--------|-------------|
| Workspace | `apple` (app `23121baf-…`) or `Isolation Beta` (app `5c02bf29-…`) — both installed and execution-verified |
| `COMMUNICATION_PROVIDER` | must match the chosen provider's variable set (`kavenegar` ↔ KAVENEGAR_*, `razpayamak` ↔ RAZPAYAMAK_*); invalid/empty → pre-HTTP failure, no record |
| Secrets entry | via the native **Variables** tab (Settings → Applications → Communication → Variables) so values are workspace-encrypted; **never committed to Git, never echoed into logs/history** |
| Recipient | a Person **owned by the same workspace** with a real phone number (route enforces recipient-ownership: "Selected phone number does not belong to this person."); an unowned foreign record is rejected (`Record not found`) |
| Network | outbound HTTPS from the app2 container to `api.kavenegar.com` / `rest.payamak-panel.com` (general egress is available; the `--add-host` pins are registry-only and irrelevant here) |

**Scenario (manual, no auto-retry):**

1. Sign in to the chosen workspace; open a Person record → command menu → **Send message** (composer front component).
2. Fill Channel/Phone/Message; **Send** once. Expected live path: composer → `/s/communication/send` route → `createQueued` (record `QUEUED`) → provider HTTP call → outcome write (`SENT`/`FAILED` + `failureReason`/`providerMessageId`).
3. **History check:** the Communication record's `status`/`providerMessageId`/`failureReason` (provider-accepted → `SENT`; provider-rejected → `FAILED` with the provider's own reason — that difference is itself evidence the HTTP call happened).
4. **Timeline check:** exactly **one** activity card on the Person timeline (created on `communication.created` only); the card shows the persisted status; the manual `Refresh` re-reads without extra writes/activities.
5. **Acceptance wording:** record `SENT` + `providerMessageId` = **provider acceptance**; delivery/`DELIVERED` is NOT claimed (receipts unwired). A retry/duplicate is never triggered automatically; the composer is not resubmitted.

**Explicitly out of scope for this preparation:** sending now, auto-retry, code/SDK changes, enabling W7, and any change to app1/v2.42.6.

## W11-MOCK — HTTP Mock integration on app2 (apple workspace)

Status: **PERFORMED and PASS — browser composer AND API levels.** The path `composer Send click → route → durable service → HTTP Mock` was exercised end-to-end with a temporary in-network mock; no real provider was contacted. **Two runs exist:** the earlier W11-MOCK run was **API-level only** (direct `POST /s/communication/send` calls); the **W11-MOCK-UI run (this section, §8)** drove the **real browser composer** with two Send clicks and captured form/result/card evidence. This is **mock acceptance only** — **not** a real send, **not** delivery proof, and it covers **Kavenegar only** (RazPayamak was not exercised; its provider never reads `KAVENEGAR_ENDPOINT`). W7 stays disabled. app1/v2.42.6 untouched.

> **Superseded note (kept for history):** the earlier revision of this section read "API level only — browser composer path NOT VERIFIED". That was accurate for the first run; the W11-MOCK-UI run (§8) closed the browser gap, and the API-level statements below still describe the first run's mechanics.

### 1. Prior state recorded before any change (presence only, no secret was read)

| Variable | Before |
|----------|--------|
| `COMMUNICATION_PROVIDER` | present (`kavenegar`) |
| `KAVENEGAR_API_KEY` (secret) | **empty** — no real secret existed, so nothing to extract/overwrite |
| `KAVENEGAR_ENDPOINT` | empty |
| `KAVENEGAR_SENDER` | empty |

### 2. Temporary mock (named, test network, no host port)

- A transient Node stub (`W11-MOCK`) ran **inside the existing `twenty-comm-cli` container** on `twenty-comm-test-net`, listening on `:18080` with **no `-p` publish, no redirect**, and no outbound call of any kind.
- It simulated the documented Kavenegar `sms/send.json` contract: success `{"return":{"status":200},"entries":[{"messageid":999001}]}`; rejection `HTTP 400 {"return":{"status":400,"message":"mock rejection"}}`.
- Reachability from app2 was verified (`http://twenty-comm-cli:18080`) — both containers share `twenty-comm-test-net`.

### 3. Configuration used (fake values only)

| Variable | Value |
|----------|-------|
| `COMMUNICATION_PROVIDER` | `kavenegar` |
| `KAVENEGAR_ENDPOINT` | `http://twenty-comm-cli:18080/v1` (points at the mock) |
| `KAVENEGAR_API_KEY` | `fake-mock-key` |
| `KAVENEGAR_SENDER` | `fake-sender` |

Dedicated Person created for the test: **`W11-MOCK Test`** (`8d3dd9dc-7438-4f28-a092-0ed3b1c18ed9`), fake phone `9120000000` (IR).

### 4. Two independent sends — **direct route calls** (`POST /s/communication/send`, API key), not composer clicks

| # | Body | Route result | Communication record | Provider id |
|---|------|--------------|----------------------|-------------|
| 1 | `تست اتصال پیامک CRM` | `{"success":true,"status":"SENT",…,"message":"Message sent."}` | `85715b96-a26b-4e40-8f86-15bd7c8e150b` — `status=SENT`, `providerMessageId=999001` | `kavenegar` |
| 2 | `تست اتصال پیامک CRM - رد` | `{"success":false,"status":"FAILED","failureCode":"PROVIDER_FAILED","isOutcomeKnown":true,"error":"mock rejection"}` | `a6a30c40-963c-41b6-b039-7a1a4a229cac` — `status=FAILED`, `failureReason="mock rejection"` | `kavenegar` |

**Invocation method (disclosed):** both sends were issued by **direct HTTP calls to the authenticated route** (`POST http://192.168.4.84:3101/s/communication/send` with the `apple` API key and a JSON body `{personId, channel:"SMS", recipient, body}`). They were **not** performed by clicking the Send button in the browser composer. The composer's own UI path therefore remains **NOT VERIFIED** (see §7).

**Mock received exactly one request per send** (retained log `/tmp/w11-mock-requests.jsonl`): two `GET /v1/fake-mock-key/sms/send.json` entries, with `receptor=9120000000`, `sender=fake-sender`, and `message` matching the submitted text exactly (Persian preserved verbatim). No third request. The `FAILED` record carries the **provider's own reason** (`mock rejection`), which is direct evidence the HTTP call actually happened (a pre-HTTP config failure would instead show the orchestration constant).

### 5. Timeline activities and Refresh

- **Exactly one app activity per Communication**, on the **Person** timeline, each `linkedRecordId` pointing at its own record:
  - `bd852f61-d36c-446b-baa9-cd74f8fb7bfe` → record `85715b96…` (status snapshot `QUEUED`)
  - `6a452a07-fa65-4ac7-8412-52ddd1d462d2` → record `a6a30c40…` (status snapshot `QUEUED`)
- **Note (correcting a reading pitfall):** each Communication *also* has **two generic Twenty audit activities** attached directly to the record (a create entry and an update entry, the latter with a `diff` property). Those are Twenty's own record history, **not** the app's timeline card; the app creates exactly one activity, on the Person, on `communication.created` only.
- **Refresh button — source-level finding, and a separate non-test.** Per the deployed front-component source (`communication-timeline-card.front-component.tsx`), the Refresh action renders **only** when the view is `PENDING` (QUEUED) or `UNAVAILABLE`; on terminal `SENT`/`FAILED` cards it does not render. This is a **source-reading observation**, distinct from any behavioral test: **the Refresh action was NOT exercised** (no PENDING/UNAVAILABLE card was opened in the browser, and no Refresh click was performed). The absence of a Refresh button on terminal cards is therefore **asserted from source, not verified live**.

### 6. Restore and teardown (finally)

- All four variables restored **exactly** to the recorded prior state (`KAVENEGAR_API_KEY`/`ENDPOINT`/`SENDER` → empty; `COMMUNICATION_PROVIDER` → `kavenegar`). Restore read-back (presence only, no secret printed): `COMMUNICATION_PROVIDER: PRESENT`; `KAVENEGAR_API_KEY: empty`; `KAVENEGAR_ENDPOINT: empty`; `KAVENEGAR_SENDER: empty`.
- Mock stopped; port `18080` confirmed free (`NO_LISTENER_18080`); its script removed.
- **Test artifacts intentionally retained (not deleted):** Person `8d3dd9dc-…`; records `85715b96-…` and `a6a30c40-…`; their two Person activities. No permanent deletion or general cleanup was performed.

### 7. Scope, verification status and limitations — **HISTORICAL (first API-level run only)**

> **This subsection describes the FIRST W11-MOCK run (API level, direct route calls) as it stood before the browser run.** Its "browser composer … NOT VERIFIED" row is **superseded** by §8 (W11-MOCK-UI), where the browser path was verified. Read §7 as the historical record of the API-only run; read §8 for the current browser-verified status.

| Item | Status (as of the first API-level run) |
|------|--------|
| Route → durable service → HTTP Mock (success) | **VERIFIED (API level)** |
| Route → durable service → HTTP Mock (rejection) | **VERIFIED (API level)** |
| Exactly one mock request per send; Persian text + recipient match | **VERIFIED (mock log)** |
| Persisted record `SENT` + `providerMessageId`; `FAILED` + provider reason | **VERIFIED (record read-back)** |
| Exactly one app activity per Communication on the Person timeline | **VERIFIED (record + activity read-back)** |
| Browser composer form / Send click / success-error toast / opened SENT-FAILED card | **NOT VERIFIED at the time — closed by §8 (W11-MOCK-UI)** |
| Refresh action behavior | **NOT TESTED** (asserted from source only; no PENDING/UNAVAILABLE card opened) |

- **Mock acceptance, not real sending.** The success `SENT` + `providerMessageId=999001` is a **simulated** provider response; no SMS was sent, no delivery occurred, and `DELIVERED` was never produced (the mock never returns that status, matching the real drivers which have `supportsDeliveryReceipt:false`).
- **Kavenegar path only.** RazPayamak was not exercised and is not claimed.
- No app/core/SDK change, no W7 activation, no app1/v2.42.6 change, no auto-retry.

### 8. W11-MOCK-UI — browser-composer run (closes the earlier browser gap)

Status: **PASS — the browser composer path is now VERIFIED.** Two scenarios were driven **only by clicking Send in the real composer** (no direct route call), signed in as the `apple` user in the `apple` workspace on app2. The same temporary Kavenegar mock and the dedicated **W11-MOCK Test** Person (`8d3dd9dc-7438-4f28-a092-0ed3b1c18ed9`, phone `9120000000`) were used.

| Scenario | Composer input | UI result | Mock received | Communication record | Activity |
|----------|----------------|-----------|---------------|----------------------|----------|
| 1 — acceptance | `تست اتصال پیامک CRM` | success toast **"Message sent."** | exactly one request (text/recipient match) | `c9ee6377-e717-4eff-9c66-1565dc2d660a` — `SENT`, `providerMessageId=999001` | `fe89391e-7182-40b7-a07f-c8d0c8d8f91e` (**1**) |
| 2 — rejection | `تست اتصال پیامک CRM - رد` | error shown in composer + toast: **"mock rejection"** | exactly one request (text/recipient match) | `6a37d3e9-5824-4538-ac7b-e4baa86e9fae` — `FAILED`, `failureReason="mock rejection"` | `78e05a2c-23bf-4505-8692-ad103b69e64c` (**1**) |

- **Composer path exercised:** Command Menu → *Send message · Communication* opened the composer (Channel `SMS`, Phone number `9120000000`, Message, Cancel, Send); Send was clicked once per scenario; the form stayed open on the error case and showed the provider reason inline.
- **Timeline cards opened in the browser:** SENT card rendered **"Message sent · SMS / 9120000000 / تست اتصال پیامک CRM"**; FAILED card rendered **"Message failed · SMS / 9120000000 / تست اتصال پیامک CRM - رد / mock rejection"**. (Cards are collapsed rows by default; each was expanded via its **Expand details** control.)
- **Exactly one mock request per scenario** (log count 2 → 3 → 4) and **exactly one app activity per new Communication** (verified by querying the Person timeline and grouping by `linkedRecordId`).
- **Evidence images** (outside Git, under `D:\twenty-comm-test\w11-mock-evidence\`): `s1-form.png`, `s1-form-filled.png`, `s1-card-sent.png`, `s2-form-filled.png`, `s2-error-ui.png`, `s2-card-failed.png`. **Secrets were never printed**; only fake values were used.
- **Restore/teardown:** the four variables were returned exactly to the prior state (`COMMUNICATION_PROVIDER=kavenegar`; the three Kavenegar values empty) and the mock was stopped (port `18080` free, app2 gets `Connection refused`). Test records/activities/person were retained, not deleted.
- **Scope:** still **mock acceptance only** (no real send, no delivery, Kavenegar only); the Refresh action remains **NOT TESTED** (both cards were terminal, so no Refresh button renders). No app/core/SDK change, no W7 activation, no app1/v2.42.6 change, no auto-retry.

## W11-MAIN-R1 / R2 / R3 — main-instance install of Communication + Windows assets-path fix

Status: **install PASS on the main instance. The reviewed `assets-path` fix is applied (R3) and removed the `yarn-engine` `ENOENT`; a second Windows symlink (`EPERM`) limitation appeared and was then RESOLVED in R4-VERIFY by the user enabling Developer Mode — main-instance execution now PASSES (route 200 + composer shows the phone).** R2 tightened the test suite for host portability (test-only; production untouched).

### 1. Environment verified before installing (main instance, port 3001)

| Aspect | Finding |
|--------|---------|
| Frontend / API | Vite frontend on `:3001`; API on `:3000` (repo source, `NODE_ENV=development`) |
| Database / Redis | docker `twenty-db-1` → `localhost:5432/default`; Redis `localhost:6379` |
| **Server version** | **v2.42.0** (latest instance command `2.42.0_AddIsRequiredToApplicationVariablesFastInstanceCommand`; local `twenty-sdk` also 2.42.0) — newer than app2's v2.41.0 |
| Target workspace | `radiant-cyan-dragon` (display name **4D**), ACTIVE, id `49d84129-4776-4917-8059-2649e836d492` |
| Pre-install state | Communication **not present** (0 rows in `core.applicationRegistration` and `core.application` for UID `768bca20-…`) |
| Package compatibility | same UID `768bca20-0b81-4d33-a624-0a894a193ffd`, `engines.twenty >=2.35.0`; the 2.42.0 install contract is equivalent (LOCAL → skip, TARBALL → install; `uploadAppTarball` / `installApplication` / manifest schema all present) |

### 2. Backup created and **restore-verified**

| Aspect | Value |
|--------|-------|
| Location | `D:\twenty-main-backup\pre-w11-20261007-113035\` (**outside the repo**) |
| Contents | `main-default.dump` (`pg_dump -Fc`, 1,295,608 bytes) + a copy of `packages/twenty-server/.local-storage` (23,143,654 bytes) |
| Restorability | `pg_restore -l` archive valid (1175 TOC entries) **and** a real restore into a scratch database succeeded; row counts matched live (1 workspace, 1 user, 35 registrations, 2 applications, 206 upgrade migrations). The scratch database was dropped afterwards. |

### 3. Install performed via the native packaged path

| Step | Result |
|------|--------|
| Package | `communication-0.1.0.tgz`, `sha256 94649588360e3491d3426590a765b5bc0d5504c262b2e3608630eb0df11974c8` (same verified package used on app2) |
| `uploadAppTarball` | registration **`050704a1-2694-43ab-bb46-ba0b9415bdaa`** — UID unchanged `768bca20-…`, `sourceType=tarball`, `latestAvailableVersion=0.1.0`, `isListed=false` |
| `installApplication` | application **`7c7b25f9-2044-44b1-82f2-d0a832fd132c`** v0.1.0 in `radiant-cyan-dragon` |
| Variables | 9 workspace `applicationVariable` rows created **empty** — no credentials were transferred; `applicationRegistrationVariable` = 0 rows |
| Metadata | 4 logic functions, 2 front components (`send-message-composer`, `communication-timeline-card`), command menu **`Send message`** (active), and **`workflowActionTriggerSettings: null` on all 4 functions** (W7 stays disabled) |
| Workspace schema | `workspace_4ddu4de0hmz1dxiq9o5mkdtw2` now contains the `_communication` table |

### 4. Browser verification (Persian / RTL)

- The CRM UI renders in **Persian** (افراد / خط زمانی / تنظیمات / اعلانها / «هر چیزی بنویسید…»), RTL.
- `Send message` is discoverable in the Person command menu and the **composer opens** (Channel / Phone number / Message / Cancel / Send) with `direction: rtl`.
- **Two separate UI gaps (both RESOLVED in W12-COMPOSER-UX/W12-R1 — historical):**
  1. The composer's own labels were **hardcoded English** inside an otherwise Persian UI — **fixed** by the app `locales/fa-IR.json` catalog (baked at build).
  2. When the phone-options route failed, the Phone number select displayed **"No phone number"** — **fixed**: a failure now shows "Unable to load phone numbers." and a non-empty unusable list is ERROR, never EMPTY.
- Evidence image (outside Git): `D:\twenty-main-backup\w11-main-evidence\composer-open.png`.

### 5. Blocking finding — logic-function execution fails on the main instance

`POST /s/communication/person-phones` → **HTTP 500 `ROUTE_TRIGGER_PLATFORM_ERROR`** (`Logic function execution failed for 71603d5c-…`). Server log (13 occurrences):

```
ENOENT: no such file or directory, lstat
'D:\CrmSource\twenty\packages\twenty-server\dist\engine\core-modules\application\application-package\constants\yarn-engine'
    at LocalLayerManagerService.ensureDepsLayer (...local-layer-manager.service.ts:49)
    at LocalDriver.execute (...local.driver.ts:129)
```

**Root cause (a core, Windows-only path bug, pre-existing and independent of the install):** `src/constants/assets-path.ts` decided the built-vs-source layout with `!__dirname.includes('/dist/')`. Windows `__dirname` uses `\`, so the marker never matched, `ASSET_PATH` resolved to `dist/` instead of `dist/assets/`, and the yarn-engine asset (which *is* present at `dist/assets/.../constants/yarn-engine/.yarn/releases/yarn-4.9.2.cjs`) became unreachable. `ensureDepsLayer` then fails for **every** logic function.

### 6. Prepared fix (commit `00b69db9bb`) — NOT yet applied to the running server

- File changed: `packages/twenty-server/src/constants/assets-path.ts` — normalize separators before the `/dist/` check and expose the decision as pure functions (`isBuiltThroughTestingModule`, `resolveAssetPath`). **No fixed path, no manual asset copy, no new dependency, no Communication logic change.**
- Tests: `packages/twenty-server/src/constants/__tests__/assets-path.spec.ts` — exercises the real exported functions. **R2 reworked them for host portability:** string-inspection cases keep literal Windows/POSIX inputs (meaningful on any host), `resolveAssetPath` cases use **host-native absolute directories** (never Windows strings passed to `path.resolve` on POSIX), and the `ASSET_PATH` cases assert against the module's own directory plus a shape check instead of a silently-skipped compiled-case branch. **PASS (14/14)**; production logic was not touched in R2.
- Checks: `oxlint --type-aware` → 0 warnings / 0 errors; `oxfmt --check` → clean; `tsgo --noEmit -p tsconfig.json` → exit 0.
- **Not verified on the running server:** the main server was **not restarted**, `dist` was **not** hand-edited, and no reinstall/migration/message send/Workflow activation was performed. Applying the fix requires a rebuild+restart, which is out of scope for this task.
- **Platform evidence split:** the production fix is **directly exercised on Windows** (this host) by the test suite and the observed `ENOENT`; the POSIX path is covered **only** by the host-independent string-inspection cases, so **Linux-specific runtime behaviour is NOT independently verified here** — that is a separate, unperformed check.

### 7. Evidence levels

| Item | Status |
|------|--------|
| Pre-flight environment/version/compat check | **PASS** |
| Backup created + restore-verified | **PASS** |
| Native tarball upload + install into `radiant-cyan-dragon` | **PASS** |
| Variables created empty (no credential transfer) | **PASS** |
| W7 disabled (`workflowActionTriggerSettings: null` ×4) | **PASS** |
| Browser: Persian/RTL UI, composer opens | **PASS** |
| Composer localization | **NOT DONE** (labels hardcoded English) |
| Main-instance logic-function execution | **BLOCKED** (Windows assets-path bug) |
| assets-path fix | **R1/R2 code acceptance PASS; R3 applied to the running server and verified to remove the `yarn-engine` ENOENT** |
| Main-instance logic-function execution (after R3) | **RESOLVED (R4-VERIFY)** — the R3 blocker was a host symlink-privilege limit (R4-PREP: file/dir/auto symlinks all EPERM; no `SeCreateSymbolicLinkPrivilege`, Developer Mode unset); after the **user enabled Developer Mode**, symlinks succeed and the route returns 200. **Environment-level fix, not a code change.** |
| Real `person-phones` route (after R4-VERIFY) | **HTTP 200** — `{"success":true,"phones":[{"id":"primary","value":"882261739","isPrimary":true}]}` |

**Scope note:** this main-instance install is **not** two-workspace evidence on v2.42.0. The only two-workspace evidence (same app in two workspaces with independent configuration) remains the app2 run on **v2.41.0** (W10-R8-R1/R2). No real provider request was made in this task, and no message was sent.

### 8. R3 — applying the fix on the running server (runtime verification)

**Build/start command (standard project path, no manual `dist` edit, no asset copy, no dependency change, no migration):**

```
# the project's own dev watcher was already running:
yarn start        # → nx run-many -t start -p twenty-server twenty-front
                  #   → twenty-server:start = rimraf dist && node ./scripts/copy-yarn-engine-asset.mjs && nest start --watch
# the API process was restarted by that watcher (source touch → swc rebuild → respawn dist/main)
```

- **API health after restart:** `GET /healthz` → **200**.
- **`yarn-engine` ENOENT:** **resolved.** The compiled `ASSET_PATH` now resolves to `…\dist\assets` (verified in a fresh Node process), the asset exists there, and no `yarn-engine` error appears after the restart.
- **New first failure boundary (captured from a foreground API run on `:3000`):**

```
ERROR [LogicFunctionExecutorService] Logic function execution failed:
  functionId=71603d5c-…, workspaceId=49d84129-…, driver=LocalDriver, mode=LIVE:
  EPERM: operation not permitted, symlink
  '…\Temp\logic-function-executor-tmpdir\deps\aadbef644d43748b2c797751af6ef5c5\node_modules\.yarn-state.yml'
  -> '…\Temp\logic-function-executor-tmpdir\lambda-build-141c5835-…\node_modules\.yarn-state.yml'
    at async LocalChildProcessRunnerService.assembleNodeModules (…local-child-process-runner.service.ts:53:5)
```

- **Root cause of the new boundary:** the local driver assembles the execution directory by **symlinking** the dependency layer. This Windows host cannot create symlinks — `fs.symlinkSync` returns `EPERM` (Windows **Developer Mode is off** and the process lacks `SeCreateSymbolicLinkPrivilege`). This is an **environment/platform** limitation, not the app and not the `assets-path` fix. It was **not auto-fixed** (out of scope); a separate decision is required.
- **Route result at R3 (real route, existing Person with phone `882261739`):** `POST /s/communication/person-phones` returned **HTTP 500** `ROUTE_TRIGGER_PLATFORM_ERROR` at that point — a consequence of the executor's layer failure, **not** an app defect. **This was resolved in R4-VERIFY (route now 200).**
- **Composer:** opens in the main workspace (Persian/RTL chrome) but shows Phone number = **"No phone number"** because the route fails. Evidence: `D:\twenty-main-backup\w11-main-evidence\r3-composer-no-phone.png`.
- **Not performed:** no message send, no reinstall, no SDK/server upgrade, no migration, no Workflow activation, no data/config change.

## W12-R1 — phone-load correctness, stale-response guard and the SDK translation boundary

Status: **REVIEW PENDING (not accepted); app-only; the main-instance install is NOT performed.**

### 1. EMPTY vs ERROR (corrected)

`resolvePhoneOptionsLoadState` reserved EMPTY for an empty list, but a **non-empty** list whose entries were all unusable also fell through to EMPTY. Fixed: a genuinely empty `phones` array is the **only** EMPTY; a non-empty array that yields no usable number is **ERROR**. Direct tests cover `[null]`, `[{}]`, a mixed unusable list, and that a non-empty unusable list never equals EMPTY.

### 2. Stale-response guard (added in R1; relocated to the real connection in R2)

R1 introduced `createPhoneOptionsLoader`, which stamps a **monotonic request id** and drops any result (success **or** failure) whose id is not the latest. R1 proved it with two **deferred** requests on the loader:
- newest success wins; the older success changes nothing and never sets `selectedPhone` to the stale number;
- a stale **failure** emits no ERROR and does not replace the fresh READY state;
- a fresh failure after an older success does publish ERROR (the guard is not "first wins").

**Superseded by R2:** the loader was constructed **inside** `loadPhones`, so each load had its **own** counter and the guard could not protect against overlapping loads (e.g. a Person change). R2 moves the guard into the real production wiring — see the W12-R2 section below.

### 3. SDK translation boundary (investigated)

| Item | Value |
|------|-------|
| App-declared SDK (`package.json`) | **2.35.0** |
| App locked resolution (`yarn.lock`) | **2.35.0** |
| Workspace / build SDK (bakes catalogs) | **2.42.0** |
| Locked 2.35 runtime | exports `useTranslate` and reads the translations global |
| Locked 2.35 `APP_LOCALES` | **no `fa-IR`** (Persian absent from its locale union) |
| Locked 2.35 CLI | **no** `locales/*.json` catalog baking |
| 2.42.0 CLI | **does** bake `locales/*.json` into the front-component banner |

R1 unit-tested Persian-key resolution and an English fallback against the app's shipped `locales/fa-IR.json` and the shared `generateMessageId` scheme (the id function the build and runtime both use). **A Persian file inside the package is NOT presented as proof of Persian rendering**; the Persian **host** render stays **NOT VERIFIED** because the app2 frontend offers no `fa-IR`. **R2 strengthens this**: the tests now drive the **real built runtime** and the app's **own build output** (see below).

### 4. Checks (R1)

`vitest run` → **207/207 pass** (24 files); both typechecks (`tsconfig.json`, `tsconfig.spec.json`) → exit 0; `oxlint` → 0/0; Linux build → success (`sha256 29120c770d8b4bde94095619af58672fd24aceed5563dc6aa6270d65718781da`; forward-slash handler paths + baked `fa-IR`). R2 re-runs these and reports its own counts below.

## W12-R2 — real composer connection invalidation, runtime witness, milestone reconciliation

Status: **REVIEW PENDING (not accepted); app + docs only; the main-instance install is NOT performed.**

### 1. The guard is now in the real composer connection (the R1 gap)

R1's `loadPhones` created a **fresh** `createPhoneOptionsLoader` on every call, so each request owned its own `latestRequestId` and the guard could not fire across two overlapping loads (the exact Person-change scenario). R2 fixes the production wiring:

- the composer holds **one** `createPhoneOptionsConnection` for its lifetime (`useRef`), so a **single** monotonic counter is shared by every load;
- the effect depends on `personId` and its **cleanup calls `connection.invalidate()`**, which bumps the counter without starting a request — so on **unmount** or **Person change** the previous request is silenced;
- the transport reads the current `personId` from the connection (updated by `start(personId)`), so the request always targets the Person it was started for.

The connection is `createPhoneOptionsConnection` in `phone-options-load-state.ts`; the component (`send-message-composer.front-component.tsx`) is a thin caller of it, so the tests exercise the **shipped wiring**, not a parallel helper.

### 2. Deferred tests cover that connection

`phone-options-load-state.test.ts` adds a `createPhoneOptionsConnection` block that replays the component's effect sequence (`start(a)` → `invalidate()` → `start(b)`):

- **Person change, stale success:** A resolves after B — only B's READY is published and `selectedPhone` is never set to A's number;
- **Person change, stale failure:** A rejects after B resolved — **no ERROR** is emitted and B's READY stands;
- **Unmount:** `invalidate()` with an in-flight request — only the initial LOADING is published; the late response changes nothing;
- **Out-of-order (a→b→c):** only the newest Person's number is selected.

### 3. Translation: runtime witness, not a rewritten helper

`sdk-translation-probe.test.ts` now:

- imports the **real `t`** from the built `twenty-sdk/front-component` runtime (the module a shipped app resolves) and drives it with the two globals the runtime reads: `__twentySdkExecutionContext__` (locale) and `__twentySdkFrontComponentTranslations__` (catalogs). It asserts real Persian values, the English source fallback, the `en` source locale, and a missing-catalog fallback;
- adds two **bundle-witness** tests that read the app's **own build output** (`.twenty/output/src/components/send-message-composer.front-component.mjs`, produced by `twenty dev:build`) and feed its baked `globalThis["__twentySdkFrontComponentTranslations__"]` banner to the same real runtime `t` (they skip if the bundle is absent, so the suite stays runnable on a clean checkout).

**Build dependency (recorded, not worked around):** baking a Persian catalog requires the **2.42 CLI** (`loadFrontComponentTranslationCatalogs` runs inside `build-application`). The locked app SDK **2.35.0** has **no** baking step and its `APP_LOCALES` has no `fa-IR`, so **2.35 cannot bake catalogs**; the locked SDK was **not** upgraded and **no reproducibility with 2.35 is claimed**. The local `dev:build` used the workspace SDK **2.42.0** and baked `fa-IR` into the shipped `.mjs`. This is a **build-time** witness only; the **Persian browser render remains NOT VERIFIED**.

### 4. Checks (R2)

`vitest run` → **215/215 pass** (24 files, including the two bundle-witness tests); both typechecks (`tsconfig.json`, `tsconfig.spec.json`) → exit 0; `oxlint` → 0 warnings / 0 errors; local SDK 2.42 `dev:build` → success (14 files, baked `fa-IR`).

### 5. Untouched

No core change, no SDK-version change, no provider change, no send/persist change, no Workflow change, no universal-identifier change. No main-instance install, no setting change, no message sent.

## W12-R3-BUILD-BOUNDARY — standalone build/translation boundary

Status: **REVIEW PENDING; test + docs only; R2's runtime behavior accepted as-is and NOT rewritten. No main-instance install.**

### 1. Clean copy outside the monorepo

The app was copied with `git archive HEAD:packages/twenty-apps/internal/communication` (tracked files only — no `.twenty`, `node_modules` or `dist`) to `%TEMP%\w12r3-standalone` and installed with its **own lockfile**:

- `yarn install --immutable` (Yarn **4.13.0**) → **OK** ("Resolution/Fetch/Link completed");
- the app's own resolved SDK is **`twenty-sdk@2.35.0`**, real path `C:\Users\User\AppData\Local\Temp\w12r3-standalone\node_modules\twenty-sdk`;
- the copy has **no `twenty-shared`** and **0 symlink/reparse points**; nothing was borrowed from `D:\CrmSource\twenty`.

### 2. Hidden test dependency removed

The R2 witness imported `generateMessageId` from **`twenty-shared`**, which is **not a dependency of the app** — in the clean copy that import failed with `Cannot find package 'twenty-shared/i18n'`. R3 **removes** that import: the witness now imports **only** the real `t` from `twenty-sdk/front-component` and reads the app's own produced bundle. It never reimplements the id scheme, the catalog format or the resolver — the runtime computes the ids internally, so a resolution succeeds only if the runtime's scheme and the baked banner agree.

### 3. Build tool — separate, exact, outside the app

A dedicated tool dir `%TEMP%\w12r3-buildtool` was created with **only** `"twenty-sdk": "2.42.0"` (installed with `--save-exact`):

| Item | Value |
|------|-------|
| Build tool | `twenty-sdk@2.42.0` |
| Tool path | `%TEMP%\w12r3-buildtool\node_modules\twenty-sdk` (outside the app) |
| Tool integrity | `sha512-Jl7s+aIekCdKTMDpFPXk6rTiVVa3tJAGrFiwPPsWFryaJng4xKOgg8+ifqi/YXBcuCfkSYLpiCdHp0TK0ubpYA==` |
| App SDK (locked) | `twenty-sdk@2.35.0` (`checksum 10c0/4cb27d3b…`) |
| App SDK path | `%TEMP%\w12r3-standalone\node_modules\twenty-sdk` |
| Borrowing | none — app copy and tool both self-contained |

The app's `package.json` and `yarn.lock` were **not** changed.

### 4. Fresh build, then the witness — and it does not skip

The standalone copy had **no** `.twenty` beforehand (stale bundle removed). A fresh build was run with the separate tool (`NODE_PATH` = tool `node_modules`):

- **Build:** `✓ Build succeeded (14 files)`, but with `Skipping translation file "fa-IR.json": "fa-IR" is not a supported locale.` and **no** `__twentySdkFrontComponentTranslations__` banner in the output (the first line is a `var …` bundle prelude, not the banner).
- **Witness:** run against that banner-less bundle, it **fails loudly** — the "has a built bundle" test **asserts** the file exists (no `it.skip`) and the banner tests fail at `expect(firstLine.startsWith(prefix)).toBe(true)`. The suite is **209/213**: the **only** failures are the **4 translation-witness tests**.
- **Typechecks:** `tsconfig.json` and `tsconfig.spec.json` both **exit 0** in the clean copy.

### 5. The boundary finding (recorded, not worked around)

`fa-IR` exists in the **fork's `twenty-shared`** (`packages/twenty-shared/src/translations/constants/AppLocales.ts`; added by fork commit `6cf109d9ac`, *"feat(i18n): add Persian locale foundation"*), but the **published `twenty-sdk@2.42.0` CLI bundles upstream `twenty-shared`**, whose `APP_LOCALES` has **no `fa-IR`**. The CLI therefore **skips** `locales/fa-IR.json` and bakes nothing. The monorepo build bakes `fa-IR` only because it resolves the **fork's** `twenty-shared` through the workspace (and `twenty-shared` is **not** an app dependency).

**Consequence:** baking a Persian catalog requires the **fork's `twenty-shared` at build time**; a published 2.42 CLI alone is **not sufficient**, and this is **not reproducible from the app's lockfile alone**. This is recorded as a **build-boundary limitation**, not repaired by upgrading the app SDK or the lockfile.

### 6. Checks

- **Monorepo:** `vitest run` → **213/213** (24 files); both typechecks → exit 0; `oxlint` → 0/0.
- **Standalone copy:** `yarn install --immutable` OK; **209/213** (only the 4 witness tests fail, by design); both typechecks → exit 0; `yarn build` succeeds but bakes no catalog.

### 7. Untouched

No core change, no SDK-version change (app or lockfile), no provider change, no send/persist change, no Workflow change, no universal-identifier change. R2's composer connection and tests are unchanged. No main-instance install, no setting change, no message sent.

## W12-R4-APP-LOCAL-I18N — app-owned Persian translation, independent of SDK `fa-IR`

Status: **SUPERSEDED / NOT ACCEPTED (W12-R5 decision). The R4 package was NOT installed. Historical record below.**

### 1. Why app-owned

R3 proved that the published build tool **cannot bake `fa-IR`** (it is not in the bundled `twenty-shared` locale list), and the app does not depend on the fork's `twenty-shared`. R4 removes that dependency entirely: the Persian catalog **ships with the app** and is applied by a small app module, so Persian no longer needs the build tool to understand `fa-IR`.

### 2. The module (`src/i18n/app-translate.ts`)

- imports the app's own **`locales/fa-IR.json`** (esbuild **inlines** it into the bundle);
- `isPersianLocale(locale)` is true for `fa` and any `fa-*`;
- `translateAppMessage({ locale, message, sdkTranslate })` is the pure core: Persian resolves against the app catalog (a **missing key falls back to the source string**); **every other locale defers to the SDK's `t`**;
- `useAppTranslate({ locale, sdkTranslate })` wraps the core with `useCallback`.

**No SDK global is written, no new translation framework is introduced, and the resolver is not reimplemented.**

### 3. The composer consumes the real module

`send-message-composer.front-component.tsx` now calls `useAppTranslate({ locale: useLocale(), sdkTranslate: useTranslate().t })` and derives the direction with `isPersianLocale`. **RTL for Persian, LTR for English, phone values LTR, the request guard, the send flow and the message meanings are unchanged** (the module only chooses which translator answers).

### 4. The SDK-banner witness was replaced

The R3 `.twenty`-bundle banner witness (`sdk-translation-probe.test.ts`) was **removed**. In its place, `src/i18n/__tests__/app-translate.test.ts` tests the **real app module**: real Persian keys, the bare `fa` locale, the missing-key source fallback, that the SDK `t` is **not** called for Persian, that English/other locales **defer** to the SDK, and that only `fa`/`fa-*` count as Persian (a lookalike like `farsi` does not).

### 5. Independent verification outside the monorepo (app's locked SDK 2.35)

A clean copy (own lockfile) was installed with `yarn install --immutable` in **two** independent environments — a Windows temp dir and a **Linux `node:24-bookworm`** container — each resolving **`twenty-sdk@2.35.0`** and **no `twenty-shared`**:

| Check | Windows clean copy | Linux container |
|-------|--------------------|-----------------|
| `yarn install --immutable` | OK | OK (Yarn 4.13.0) |
| `build` | `✓ 14 files` | `✓ 14 files` |
| tests | **214/214** | **214/214** |
| `tsconfig.json` typecheck | exit 0 | exit 0 |
| `tsconfig.spec.json` typecheck | exit 0 | exit 0 |
| `oxlint` | 0/0 | 0/0 |

Neither environment borrowed from the monorepo.

### 6. Installable Linux package (Persian inlined, no fork dependency)

`dev:build --tarball` in the Linux container (SDK **2.35.0**) produced **`communication-0.1.2.tgz`**:

- **forward-slash** handler paths (`package/src/logic-functions/…`) — Linux-correct;
- the composer bundle contains the **Persian catalog inlined** (`\u0627\u0631\u0633\u0627\u0644` = ارسال) with **no `fa-IR` SDK banner** — i.e. Persian ships via the **app-owned** path;
- `sha256 2FF4748E378B607D472204939BA6BF9517F3F40319EE1E37C737D6DA27F572DA` (1,132,674 bytes).

This is the key difference from R3: **the app now ships Persian without the fork's `twenty-shared`**. The `fa-IR` *"not a supported locale"* message still appears at build time, but it is **off the Persian path** (the app catalog is used instead). The package was **not installed** anywhere.

### 7. Untouched

No core change, no SDK-version change (app or lockfile), no provider change, no send/persist change, no Workflow change, no universal-identifier change. No main-instance install, no setting change, no message sent. **Persian browser render remains NOT VERIFIED.**

## W12-R5-NATIVE-I18N — native Twenty translation via a fork-built SDK artifact

Status: **REVIEW PENDING; the R4 translator was reverted and R4 is SUPERSEDED / NOT ACCEPTED; no main-instance install.**

### 1. The decision and the minimal revert

Translation is done with the **native Twenty mechanism**. Only the R4 *translator* was removed:

- `send-message-composer.front-component.tsx` is back on `useTranslate()` and its local `getTextDirection` (RTL/LTR) helper;
- `src/i18n/app-translate.ts` and `src/i18n/__tests__/app-translate.test.ts` were **deleted**;
- `tsconfig.spec.json` and the R3 `sdk-translation-probe.test.ts` were **restored** to their R3 state.

**Preserved:** the Persian catalog `locales/fa-IR.json`, the EMPTY/ERROR fix, the stable phone-load connection (`createPhoneOptionsConnection`) and its cleanup/invalidate, and the send flow. No unrelated change was touched.

### 2. The native path already exists in this fork (not reimplemented)

The fork adds `fa-IR` to `twenty-shared`'s `APP_LOCALES` (`packages/twenty-shared/src/translations/constants/AppLocales.ts`, fork commit `6cf109d9ac`). `twenty-shared` is a **devDependency** of `twenty-sdk` (not a runtime dependency), and the SDK build **bundles** it — the fork's `fa-IR` support ships inside `twenty-sdk`'s own `dist/login-*.mjs` chunk, which contains **both** `fa-IR` **and** the `Skipping translation file` message. The CLI's `loadFrontComponentTranslationCatalogs` therefore **accepts** `fa-IR` and bakes it into the front-component banner. No new capability was implemented.

### 3. Build tool — the fork, packaged independently

| Item | Value |
|------|-------|
| Source SHA | `61ecc50f31` |
| Packaging method | the project's own `yarn pack` on each workspace package |
| `twenty-sdk-2.42.0.tgz` | `sha256 885696F1C3C802234F058F4FF975920A19CB9FE985FAE182D5FE525AFA65503F` (6,630,341 bytes) |
| `twenty-client-sdk-2.42.0.tgz` | `sha256 93C94D5A6C7C2F8D3AB4095A31FD2EFA1746970506A3D123DFD6D8CBA5F1314F` (244,120 bytes) |
| Install | `npm install <tarballs>` in a clean dir **outside the monorepo** |
| Dependencies | **no `twenty-shared`**; nothing borrowed from the monorepo |

### 4. Communication built on Linux with that tool

In a `node:24-bookworm` container, the app was installed from its **own lockfile** (`--immutable`) and built with the fork tool via `NODE_PATH`:

- `dev:build --tarball` → `✓ Build succeeded (14 files)`; **no** "Skipping translation file" message;
- the composer bundle's first line is the **native** banner:
  `globalThis["__twentySdkFrontComponentTranslations__"]={"fa-IR":{"pi1oME":"ارسال پیام",…}}`;
- the produced `communication-0.1.2.tgz` has **forward-slash paths** (`package/src/…`);
- tarball `sha256 E051618531C733453B5BB93F94FE8DC1050075FA693C7ACF8A7302DE9BEB3F1D` (1,132,674 bytes).

The catalog enters the bundle **through the SDK's native mechanism**, unlike R4.

### 5. Runtime translation witness (real `t`)

The R3 `sdk-translation-probe.test.ts` drives the **real `t`** from `twenty-sdk/front-component` against the produced bundle's baked banner and **passes** (real Persian keys + English fallback). The suite is **213/213** in both the monorepo and the Linux container; both typechecks exit 0 and `oxlint` is 0/0 in both.

### 6. Untouched / not verified

No core, server, SDK-version (app or lockfile), provider, send/persist, Workflow or universal-identifier change. No main-instance install, no setting change, no message sent. **The package was NOT installed anywhere, and the Persian browser render remains NOT VERIFIED.**

## W12-MAIN-VERIFY — main-instance upgrade and the first observed Persian render

Status: **ACCEPTED by the architect — SCOPED to the Persian/English composer, phone loading and the load-error display. Docs only; no code change.** The Persian composer was finally SEEN in the main CRM. **Not covered by the acceptance:** real-provider sending (NOT PERFORMED), W7 (still disabled), two-workspace isolation on v2.42.0.

### 1. Pre-flight state and backup

- Main instance: API `:3000`, frontend `:3001` (`radiant-cyan-dragon.localhost:3001`), server **v2.42.0**; Docker DB `twenty-db-1`.
- Workspace **4D** = `radiant-cyan-dragon` (`49d84129-4776-4917-8059-2649e836d492`), ACTIVE. Installed Communication was **0.1.0** (registration `050704a1-…`, application `7c7b25f9-…`).
- **Backup before the upgrade:** `D:\twenty-main-backup\pre-w12mv-20261007-185424\` — `main-default.dump` (`pg_dump -Fc`, 1,329,051 B, 1205 TOC entries) + `local-storage` (25,892,341 B). **Restore-verified** into a scratch DB: 1 workspace / 36 registrations / 3 applications / 9 variables — matched live; scratch dropped.

### 2. Upgrade plan check (stop-on-destructive rule)

The 0.1.0 and 0.1.2 manifests were diffed **before** upgrading: **every** UID matched (application, object, 4 fields, 4 logic functions, 2 front components, 1 command menu item, 1 timeline activity type, 1 role); **0 removals**; the **only** addition was `translations.fa-IR`. No field, object or data removal and no unrelated rename — so the upgrade was safe to proceed.

### 3. Package verified

| Item | Value |
|------|-------|
| File | `communication-0.1.2.tgz` |
| SHA-256 | `E051618531C733453B5BB93F94FE8DC1050075FA693C7ACF8A7302DE9BEB3F1D` |
| Application UID | `768bca20-0b81-4d33-a624-0a894a193ffd` |
| Handler paths | forward-slash (`package/src/…`) |
| Banner | `globalThis["__twentySdkFrontComponentTranslations__"]={"fa-IR":{…}}` (native, 14 keys) |
| `workflowActionTriggerSettings` | `null` ×4 (W7 disabled) |

### 4. Upgrade performed via the native path

- `uploadAppTarball` → registration `050704a1-2694-43ab-bb46-ba0b9415bdaa`, `sourceType=tarball`, `latestAvailableVersion=0.1.2`.
- `upgradeApplication(appRegistrationId, targetVersion:"0.1.2")` → `true`; application `7c7b25f9-2044-44b1-82f2-d0a832fd132c` now **`version=0.1.2`**.
- The installed bundle (`…/built-front-component/src/components/send-message-composer.front-component.mjs`) now begins with the **native** banner.

### 5. Browser verification (the point of this task)

The host language was driven by the **workspace member** locale (`fa-IR`), then `en`, then restored.

| Check | Result |
|-------|--------|
| Persian composer labels | **PASS** — کانال / شماره تلفن / متن پیام / انصراف / ارسال |
| Persian direction | **PASS** — `direction: rtl` |
| Phone value | **PASS** — `882261739`, `direction: ltr`, `unicode-bidi: plaintext` |
| Phone load | **PASS** — the number loaded (route 200) |
| ERROR state (block `person-phones` in that browser only, then removed) | **PASS** — select showed **دریافت شماره‌ها ناموفق بود.** and **Send disabled** — **not** "no number" |
| English | **PASS** — Channel / Phone number / Message / Cancel / Send, `direction: ltr` |
| Locale restored | **PASS** — workspace member locale back to `fa-IR` |

Evidence images (outside Git): `D:\twenty-main-backup\w12mv-evidence\composer-fa.png`, `composer-fa-error.png`, `composer-en.png`.

### 6. Safety and preservation

- **No Send was clicked**; **0 Communication records** exist; no provider request; provider settings untouched.
- Same application and registration rows; **9 workspace variables** preserved (secret flags intact, **no values printed**); `workflowActionTriggerSettings: null` ×4.
- No core/server/SDK/provider/send-persist/Workflow/universal-identifier change; no server upgrade.

### 6b. Dev-stack restart and health recovery (recorded)

During the verification the local dev stack stopped (the detached restart did not survive its wrapper). It was **restarted** with the larger readiness window (`TWENTY_DEV_COMPILE_TIMEOUT_MS` / `TWENTY_DEV_READY_TIMEOUT_MS` = 900000) and recovered:

| Check | Result |
|-------|--------|
| `yarn start` (server + frontend + worker) | **restarted** |
| API `:3000` `/healthz` | **HTTP 200** |
| Frontend `:3001` | **HTTP 200** |

This was a **local runtime restart only** — no source change, no setting change, no server upgrade.

### 7. Build tool clarification

The package was built with the **fork's own** `twenty-sdk` (packed with the project's `yarn pack`), **not** the official upstream `twenty-sdk`. This must not be described as the upstream tool.

### 8. Architect acceptance (scoped) and what remains not done

**ACCEPTED by the architect — scope:** the composer renders in **Persian and English**, **phone loading works**, and a **load failure is shown as an error** (not "no number"). **Nothing else is covered.** `W12-R4-APP-LOCAL-I18N` remains **SUPERSEDED / NOT ACCEPTED**.

Still **NOT done / not verified**:

- Real-provider sending — **NOT PERFORMED** (provider settings empty).
- W7 (Workflow action) — still **DISABLED / NOT ACCEPTED**.
- Two-workspace execution isolation on **v2.42.0** — still only evidenced on app2 v2.41.0 (W10-R8-R1/R2).
- A Persian **host UI** is available here (the fork adds `fa-IR`); the earlier "app2 offers no fa-IR" note applies to the isolated upstream v2.41.0 image only.

## W13-UX-CLOSURE — standard form, unified native Persian, discoverable records, send ≠ manual create

Status: **REVIEW PENDING; app + test + docs; no acceptance claimed. Verified on app2 with an HTTP mock and observed on the main instance (view-only).**

### 1. What the SDK actually offers (checked first)

The locked `twenty-sdk/front-component` exports **no form UI kit** — only functions, hooks, `Trans`, and the command components (`Command`, `CommandModal`, `CommandLink`, `CommandOpenSidePanelPage`). `defineNavigationMenuItem` and `defineView` **are** exported and were used for the records path. **No `twenty-front`/`twenty-server` internals were imported and no host DOM was accessed.**

### 2. Standard send form

The composer is plain HTML **styled to match Twenty** (border/radius/typography, a single primary action, secondary cancel), because no kit exists to use. **Behavior is unchanged:** duplicate-submit guard, stale-response protection (`createPhoneOptionsConnection` + cleanup `invalidate()`), LOADING/READY/EMPTY/ERROR states, and the truthful SENT/DELIVERED/FAILED/unknown wording. Persian RTL, English LTR, phone/identifiers LTR.

### 3. Unified native translation (no parallel translator)

| Surface | Mechanism |
|---------|-----------|
| Front-component copy (form, timeline card) | app `locales/fa-IR.json` → baked into the bundle (`loadFrontComponentTranslationCatalogs`) |
| Metadata labels | same app catalog → compiled to `manifest.translations` (`compileApplicationTranslations`) → server `resolveEffectiveEntityProperty` |

Translatable metadata (proven from `TRANSLATABLE_PROPERTIES_BY_METADATA_NAME`): **objectMetadata** (`labelSingular`/`labelPlural`/`description`), **fieldMetadata** (`label`), **commandMenuItem** (`label`/`shortLabel`), **navigationMenuItem** (`name`), **timelineActivityType** (`label`), **view** (`name`). Keys are `generateMessageId(source, context)` — e.g. the Persian object singular lives under `"objectMetadata.labelSingular": { "Communication": "ارتباط" }`.

**Recorded limitation:** **SELECT option labels are NOT translatable** (absent from the list), so `SMS`/`QUEUED`/`SENT`/`DELIVERED`/`FAILED`/`OUTBOUND` stay English technical tokens; the **application display name** is not a translatable metadata name either. No unsupported API was invented. Field names, API routes and universal identifiers are unchanged.

### 4. Send separated from manual create

- Person command renamed **`Send SMS`** (Persian **ارسال پیامک**) — names the real capability; SMS only.
- Communication object is **`isUICreatable: false` + `isUIEditable: false`**, so the generic create/edit form is gone and no send can be mistaken for hand-authoring a record. **No create/update trigger was added.** (The engine gates the standard "create record" command on `objectMetadataItem.isUICreatable`.)
- Hiding the UI is **not** presented as a security control.

### 5. Discoverable records

A native manifest **`Communications` view** (Person, recipient, body, channel, provider, status, sent time) plus a **sidebar navigation item**. Manifest views are additional — the engine default views are untouched. The Person→Communication relation and the timeline card are preserved; the card shows the current status, a specific safe reason when unavailable, and manual Refresh for pending/unavailable (no automatic-update claim).

### 6. Settings

Unchanged: the **native Variables tab stays authoritative** (the app still registers no custom settings component — a locked decision). The app variables were **not read, printed or transferred** beyond presence checks; secrets were never displayed.

### 7. Checks

- **Monorepo:** `vitest run` **223/223** (25 files; 10 new W13 tests on the real production modules), both typechecks exit 0, `oxlint` 0/0.
- **Linux package (fork tool, not upstream):** `communication-0.1.3.tgz`, `sha256 7DA531B7A9D1C4F137749C0AE6DCC1C9726342F0EA21731CF4E8F6F42A1C8EBB`, POSIX paths, native `fa-IR` banner, 52 fa-IR keys; container suite **223/223**, both typechecks exit 0, lint 0/0.
- **`appVersion` bumped 0.1.2 → 0.1.3** so the upgrade path recognizes the new artifact.

### 8. app2 / apple — mock acceptance and rejection (real composer clicks)

Temporary in-network Kavenegar HTTP mock (no host port, no outbound call) in `twenty-comm-cli`; apple's variables were **all empty** before the mock, so nothing real could be overwritten.

| Scenario | Composer result | Record | Mock requests |
|----------|-----------------|--------|---------------|
| Acceptance | **"Message sent."** | `db1cdbed-80b4-479b-b505-da3320b9e414` `SENT`, `999001`, `kavenegar` | **1** |
| Rejection | **"mock rejection"** | `6182b9b4-e16a-4bf2-9203-687c36c1449b` `FAILED` | **1** |

**Exactly one activity per record** (`ddddcdc1-…`, `138fa2e0-…`). Variables were restored **exactly** (all Kavenegar vars empty, `COMMUNICATION_PROVIDER=kavenegar`) and the mock was stopped (port `18080` has no listener; script removed). app2's frontend is upstream v2.41.0 and ships **no `fa-IR`**, so app2 rendered **English**; its member locale was restored to `en`. **Mock acceptance only — no real provider, no delivery proof.**

### 9. Main instance — upgrade and Persian observation (view-only)

- Backup `pre-w13-20261007-205714` (dump 1,330,732 B + storage 25,902,661 B), **restore-verified**; 0.1.2→0.1.3 manifest diff: **0 removals**, identical UIDs, only additions (view + nav item).
- Native upgrade of workspace **4D**: registration `050704a1-…` → 0.1.3, application `7c7b25f9-…` → 0.1.3; same rows and **9 variables** preserved.
- **Persian observed:** sidebar **ارتباطات**; Communications page with Persian field labels (نام/کانال/متن/وضعیت/جهت/سرویسدهنده/گیرنده/…) and **no create affordance**; composer title **ارسال پیامک**, RTL, phone LTR, buttons **انصراف/ارسال**.
- **0 Communication records** were created on the main instance and **no Send was clicked**. Evidence (outside Git): `D:\twenty-main-backup\w13-evidence\` (`main-communications-fa.png`, `main-composer-fa.png`, `app2-communications-list.png`, `app2-composer-form.png`, `app2-acceptance-sent.png`, `app2-rejection.png`, `communication-0.1.3.tgz`).

### 10. Untouched / not verified

No core, server, SDK-version (app or lockfile), provider, send/persist, Workflow or universal-identifier change; no settings change. **Real-provider sending remains NOT PERFORMED** (main provider settings empty). **W7 remains DISABLED / NOT ACCEPTED.** Two-workspace isolation on v2.42.0 still only evidenced on app2 v2.41.0.

## W14-SMS-SETTINGS-AND-UX-FINAL — professional SMS settings + remaining Persian fixes

Status: **REVIEW PENDING; app + a limited, disclosed host change + catalogs + test + docs. Verified on app2 (mock) and observed on the main instance (view-only).**

### 1. The SMS settings tab

A new **`SMS system`** tab (Persian **سامانه پیامکی**) was added to **Settings → Communication**, alongside the untouched **Emails** / **Whatsapp (Soon)** / **Calls (Soon)** tabs. It shows only the **implemented** providers (**Kavenegar**, **RazPayamak**), each in its own section with description, its own fields and its own **Save**; the **default provider** is a separate, explicit choice. **Only the selected provider is used when sending**, read from the existing `COMMUNICATION_PROVIDER` variable. RazPayamak's fixed REST base is deliberately **not** a settings field. **No real "connection verified"/"ready to send" claim** and **no real test-SMS button** were added.

### 2. Host change (limited and disclosed)

| File | Change |
|------|--------|
| `packages/twenty-front/src/pages/settings/communications/SettingsWorkspaceCommunicationsSmsTab.tsx` | **new** — the tab component |
| `packages/twenty-front/src/pages/settings/communications/SettingsWorkspaceCommunications.tsx` | tab added + tab-content switch |
| `packages/twenty-front/src/modules/object-record/record-table/empty-state/utils/getEmptyStateSubTitle.ts` | Communication empty state now guides to sending from the Person page |
| `packages/twenty-front/src/locales/{en,fa-IR}.po` + `locales/generated/*` | the new strings, compiled |

**Business logic did not move to the host**: provider selection, sending and persistence stay in the app. The host's front-component API exposes **no variable read/write**, so the tab cannot be a front component and instead reuses the host's **existing** `updateOneApplicationVariable` mutation and its real variable-input components — **no SDK mutation was invented**. The app is resolved by its **stable universal identifier** (`768bca20-…`), never an install UUID, display name or workspace; when the app is absent the tab states **«ماژول ارتباطات نصب نشده است»**.

### 3. Ownership and security (verified on app2)

| Check | Result |
|-------|--------|
| Non-secret save | **PASS** — `KAVENEGAR_SENDER` written and read back |
| Secret replace | **PASS** — stored; reads back **masked** (`f********`), never plaintext |
| Presence signal only | **PASS** — the form receives only "set/not set"; a secret value is never read into the form, response or log |
| Empty secret input | **keep** (no write submitted) |
| Explicit clear | **PASS** — separate action empties the secret |
| Masked value re-submitted | **never** — the secret input always starts empty |
| Default-provider switch | **PASS** — switching to `razpayamak` left the Kavenegar/RazPayamak values intact |
| Unauthorized access | **PASS** — no token → `UNAUTHENTICATED`; invalid token → `Token invalid` (server-side, not UI hiding) |

The only source of settings remains the **9 existing workspace `applicationVariables`**; `serverVariables: {}` tombstone, keys, UUIDs and secret flags are unchanged. **No parallel storage, new settings table, localStorage credential or bypass API** was added; the native **Applications** permission governs read/edit.

### 4. Persian fixes

- **Command-menu app-name suffix** and the **composer panel title** — the host showed `Communication · Send SMS` / `Send SMS`; the composer now titles itself **ارسال پیامک** and the command is translated through the app metadata catalog.
- **Two previously untranslated timeline reasons** (`This activity could not be found.`, `The related record is not a communication.`) added to the app catalog.
- **Unknown-outcome warning** now shows the Persian sentence **«ممکن است پیام ارسال شده باشد یا نشده باشد. پیش از تلاش مجدد، سابقهٔ ارتباطات را بررسی کنید.»**; the provider's own reason is still shown verbatim (only the app's own fallback wording is translated).
- **Empty state** now says **«برای ثبت اینجا، از صفحهٔ شخص پیامک بفرستید.»** instead of inviting manual record creation.
- A **translation-completeness test** asserts every fixed production message is translated (extracted from source), not merely that existing keys are non-empty.
- **Still not translated (real limitation):** the **`All ارتباطات` view title** — a custom object has no standard-metadata label catalog, and there is no supported translation surface for a manifest view name. **SELECT option labels** likewise remain non-translatable (unchanged from W13). No unsupported API was invented.

### 5. Checks

- **App:** `vitest run` **228/228** (26 files), both typechecks exit 0, `oxlint` 0/0.
- **Host:** twenty-front and twenty-server typechecks exit 0; changed files lint/format clean. The repo-wide `nx lint twenty-front` still fails on the **pre-existing** formatting issues in 19 unrelated Jalali/metadata files.
- **Linux package 0.1.4** (fork's own `twenty-sdk`, **not** upstream): `sha256 347F491C30CCB8B93E38638F370B7BD473C85A9D78CC8A9907BBF763730130AA`, POSIX paths, native `fa-IR` banner (58 keys); container suite **228/228**, both typechecks exit 0, lint 0/0.

### 6. app2 / apple — mock acceptance and rejection

| Scenario | Composer result | Record | Mock requests |
|----------|-----------------|--------|---------------|
| Acceptance | **"Message sent."** | `3a480a0d-d0ff-47f4-8cff-9c69cc838c7c` SENT, `999001` | **1** |
| Rejection | **"mock rejection"** | `b5e2185a-efaf-4e78-8158-7e32a414d6e0` FAILED | **1** |

**Exactly one activity per record.** Variables were restored **exactly** (all empty, `COMMUNICATION_PROVIDER=kavenegar`) and the mock was stopped (no listener). app2's frontend is upstream v2.41.0 with **no `fa-IR`**, so it rendered English — the **SMS tab is a host feature and renders only on the fork frontend**. **Mock acceptance only — no real provider.**

### 7. Main instance (workspace 4D) — view only

- Backup `pre-w14-20261008-060041` (dump + storage), **restore-verified**; 0.1.3→0.1.4 manifest diff: **0 removals**, identical UIDs, 9 variables preserved.
- Upgraded **0.1.3 → 0.1.4** via the native path; application `7c7b25f9-…` now 0.1.4.
- **Observed:** the **سامانه پیامکی** tab renders in **Persian** (both provider sections, labels, descriptions, hints) and in **English (LTR)**; the user's locale was **restored to `fa-IR`**.
- **0 Communication records** on the main instance, **no Send clicked**, **no real setting saved**. Evidence (outside Git): `D:\twenty-main-backup\w14-evidence\` (`main-sms-tab-fa.png`, `app2-acceptance-sent.png`, `app2-rejection.png`, `communication-0.1.4.tgz`).

### 8. Untouched / not verified

No core, server, SDK-version (app or lockfile), provider, send/persist, Workflow or universal-identifier change. **Real-provider sending remains NOT PERFORMED.** **W7 remains DISABLED / NOT ACCEPTED.** Two-workspace isolation on v2.42.0 still only evidenced on app2 v2.41.0.

## W14-R1-SETTINGS-CORRECTIONS — secret intent, load states, save lock, honest partial failure

Status: **REVIEW PENDING; app + host + catalogs + tests + docs. No architect acceptance claimed.**

### 1. Explicit secret intent — KEEP / REPLACE / CLEAR

| Intent | When | Write |
|--------|------|-------|
| **KEEP** | the input is empty and no clear was requested (the default) | **nothing** — the stored secret is untouched |
| **REPLACE** | a non-empty value is typed | the typed value |
| **CLEAR** | only after the explicit **Clear** action | an empty string |

- Typing a value after **Clear** **cancels** the clear and turns the intent into **REPLACE**.
- A **Cancel clear** action restores **KEEP**.
- An **empty input alone never clears** an existing secret; the pending-clear state is shown in the field's hint.

### 2. Load states are separate

`resolveCommunicationSmsLoadState` returns **LOADING**, **NOT_INSTALLED** or **ERROR**, with **READY** when the app is present. A network, permission or server failure renders **ERROR** — never "the module is not installed" — so a permission problem is not disguised as a missing app. Only a **successful** query that returns `null` is **NOT_INSTALLED**.

### 3. Shared save lock and concurrency safety

One synchronous lock (`isWriteInFlightRef`) guards **every** write: the default-provider selection **and** both provider saves. A fast double click cannot start a second request; the provider radios are disabled while a write is in flight. On success, only the keys whose write **succeeded** are dropped from the drafts — via `dropSucceededDrafts` applied to the **latest** draft map — so a field **edited while saving keeps its newer value** and a **failed** field keeps its draft for retry.

### 4. Honest partial-failure reporting

Writes are issued with `Promise.allSettled`, so **every** write is attempted and the outcome is classified by how many landed (`summarizeSaveOutcome`):

| Outcome | Message |
|---------|---------|
| all | «تنظیمات ذخیره شد.» |
| **partial** | **«بخشی از تنظیمات ذخیره شد؛ ذخیرهٔ بقیه ناموفق بود.»** |
| none | «تنظیمات ذخیره نشد.» |

The form is **re-read** (`refetch`) before any draft is cleared, so what is shown matches what was stored. There is **no rollback**, so the copy never claims "nothing changed" — it says which writes failed and to reload for the saved values.

### 5. No-permission caller (app2) — recorded separately from UNAUTHENTICATED

An API key bound to a role with **no permission flags** was minted on app2 and used against the same endpoints the tab calls:

| Caller | Read | Write |
|--------|------|-------|
| valid Admin-role key | **ALLOWED** | **ALLOWED** |
| key with **no permission flags** | **DENIED** — `Entity performing the request does not have permission` | **DENIED** — same |
| no token | `UNAUTHENTICATED` (`Missing authentication token`) | same |
| invalid token | `UNAUTHENTICATED` (`Token invalid`) | same |

The **permission** denial is a **distinct** outcome from the **authentication** denial: hiding the tab in the UI is not the control — the server rejects the read and the write. The three test API keys were **revoked** afterwards; no credentials were changed.

### 6. Outcome severity in the composer

`resolveSubmitOutcomePresentation` (production code, shared with the test) maps every truthful outcome: **SENT / DELIVERED → success**; **PROVIDER_FAILED / INVALID_INPUT / FAILED_BUT_UNRECORDED → error**; **SENT_BUT_UNRECORDED / OUTCOME_UNKNOWN → warning**; **DUPLICATE_IGNORED → not rendered**. The unknown-outcome and sent-but-unrecorded wording and the send path are unchanged from W14.

### 7. Checks

- **App:** `vitest run` **235/235** (27 files), both typechecks exit 0, `oxlint` 0/0.
- **Host:** twenty-front typecheck exit 0; changed files lint/format clean; **18** focused state tests (secret intent, load states, save summary, draft preservation).
- **Linux package 0.1.5** (fork tool): `sha256 1B7A6F9501BABDFC72E3BC4309A4797066731C4DDB4439943A0A7ECAB956B9C6`; container suite **235/235**, both typechecks exit 0, lint 0/0.

### 8. Not performed / not verified

**No new browser pass was taken in this correction** (the reviewed task asked for none), so the corrected states are evidenced by tests, not by screenshots. **Real-provider sending remains NOT PERFORMED**; **W7 remains DISABLED / NOT ACCEPTED**; the `All ارتباطات` view title and SELECT option labels remain non-translatable. The main instance was **not** re-upgraded in this correction.

## W14-R2-FINAL-FIX — secret input, revision-aware cleanup, robust save/read-back

Status: **REVIEW PENDING; app + host + catalogs + tests + docs. No architect acceptance claimed. 0.1.5 is built only; the main instance is still 0.1.4.**

### 1. The secret input shows only what was typed

`resolveSecretInputValue` returns `state.replacement` (or `''`), and the field reads its value through it — never `storedValueByKey`, so a **stored or masked secret can never enter the input**. A **multi-character** replacement is carried intact: the test asserts both the input value and the exact value sent to the mutation (`a-long-secret-key-123`).

### 2. Draft cleanup compares revisions, not just the write result

R1's claim that "a field edited while saving keeps its newer draft" was **not true** — the cleanup dropped every key whose write succeeded. R2 snapshots the drafts **at save start** and drops only keys whose draft is **unchanged since then** (`dropUnchangedSucceededDrafts`):

| Case | Result |
|------|--------|
| key written, draft unchanged | dropped (the form now shows the saved value) |
| key written, **edited again during the save** (normal) | **newer draft kept** (pure-function test) |
| key written, **edited again during the save** (secret) | **newer draft kept** (pure-function test) |
| key whose write failed | draft kept for retry |

> **Correction (W14-R3):** these are **pure-function tests** over `dropUnchangedSucceededDrafts` — there is **no deferred timer and no mutation call**, so they are **not** deferred or mutation tests. The **form-connection** evidence is the separate W14-R3 test that renders the real tab.

### 3. Save and read-back are handled

The provider save runs inside `try/finally`, so the lock is **always** released and the form can never freeze. Writes use `Promise.allSettled` (every write attempted, per-write accounting). The `refetch` is wrapped in its own `try/catch`: a failed re-read does **not** lock the UI, does **not** raise an unhandled rejection, **keeps every draft**, and reports honestly — **«ممکن است تنظیمات ذخیره شده باشد، اما بازخوانی ناموفق بود. برای دیدن مقادیر ذخیرهشده، صفحه را دوباره بارگذاری کنید.»** The default-provider selection got the same treatment (its own warning when the write landed but the re-read failed), and a click the lock drops now says **«یک ذخیرهٔ دیگر در جریان است…»** instead of being silently ignored.

### 4. One severity for the form and the toast

`resolveSubmitOutcomePresentation` (production code) decides the variant; the composer now applies it to **both** the in-form message (a warning-styled box for uncertain results, an error-styled box for definite failures) **and** the toast. A definite failure — including `FAILED_BUT_UNRECORDED` — is an **error**; `OUTCOME_UNKNOWN` and `SENT_BUT_UNRECORDED` are **warnings**.

### 5. Checks

- **App:** `vitest run` **235/235** (27 files), both typechecks exit 0, `oxlint` 0/0.
- **Host:** twenty-front typecheck exit 0; changed files lint/format clean; **22** host state tests.
- **Package 0.1.5** (built in W14-R1): `sha256 1B7A6F9501BABDFC72E3BC4309A4797066731C4DDB4439943A0A7ECAB956B9C6`. **Built only — not installed on the main instance (still 0.1.4), and it does NOT include the R2/R3 corrections. Do not present it as the final package.**

### 6. Not performed / not verified

**No browser pass, no send, no real credentials, no main-instance upgrade** in this correction. **Real-provider sending remains NOT PERFORMED**; **W7 remains DISABLED / NOT ACCEPTED**. The `All ارتباطات` view title and SELECT option labels remain non-translatable.

## W14-R3-SECRET-INPUT-CLOSURE — secret detection from the field flag, and a real form test

Status: **ACCEPTED by the architect — SCOPED to the secret-input fix only** (the field-flag secret detection and the real form-connection test). The other R3 content (the Recovery corrections) is documentation, not part of the accepted scope.

### 1. Secret detection comes from the field, not from presence

`readValue` branched on `secretPresenceByKey[key] === true`, so a secret whose stored value was **empty** fell through to the **stored-value** branch. It now branches on the **field's own `isSecret` flag** (`resolveSmsFieldInputValue`): a secret field reads **only** `secretFieldStateByKey[key].replacement` — whether the stored secret is set or empty — so no stored or masked value can ever enter the input.

### 2. Real form-connection test (distinct from the pure-function tests)

`SettingsWorkspaceCommunicationsSmsTab.test.tsx` renders the **actual tab** with Apollo mocks for the query and the mutation, and drives the **real input**:

| Step | Assertion |
|------|-----------|
| stored `KAVENEGAR_API_KEY` is **empty** | the password input exists and starts empty |
| type a fake multi-character secret | the **input holds exactly that value** |
| click the Kavenegar **Save** | the mutation is called with the key and the **full** value |

This is **form-connection evidence**. The `dropUnchangedSucceededDrafts` / `resolveSecretWriteValue` / `buildSmsProviderPendingWrites` tests are **pure-function evidence** — they call the functions directly with **no deferred timer and no mutation**. The two kinds of evidence are recorded separately.

### 3. Checks

- **Host:** twenty-front typecheck exit 0; changed files lint/format clean; **29** host tests (**28 pure-function** + **1 real form-connection**).
- **No package was built or installed in this correction.** **0.1.5 (built in W14-R1) does NOT include the R2/R3 corrections and must not be presented as the final package.** The main instance remains **0.1.4**.

### 4. Not performed / not verified

**No screenshot, no send, no real setting, no credential change, no main-instance upgrade, no architecture/SDK change.** **Real-provider sending remains NOT PERFORMED**; **W7 remains DISABLED / NOT ACCEPTED**.

## W14-MAIN-CLOSURE — 0.1.6 built on Linux and installed on the main instance

Status: **REVIEW PENDING; app version + docs. No architect acceptance claimed.**

### 1. Package built with the fork tool (0.1.5 not used)

Version bumped to **0.1.6** and the tarball built **on Linux** (`node:24-bookworm`) with the **fork's own `twenty-sdk` 2.42.0** — the same artifact verified at `sha256 885696F1…` — **not** the upstream tool. **0.1.5 was not used.**

| Item | Value |
|------|-------|
| File | `communication-0.1.6.tgz` |
| SHA-256 | `652D3DAA1804976D886B0FB8E6600E318F6D5A45A48E2FC477821F5095066EE2` |
| App UID | `768bca20-0b81-4d33-a624-0a894a193ffd` (unchanged) |
| `workflowActionTriggerSettings` | **null ×4** (W7 disabled) |
| Variables | the same **9** keys |
| Paths / banner | POSIX paths; native `fa-IR` banner (58 keys) |
| Container checks | suite **235/235**, both typechecks exit 0, lint 0/0 |

### 2. Pre-upgrade backup and manifest diff

- Backup `pre-w14mc-20261008-124820`: dump **1,363,409 B** + storage **26,426,263 B**, **restore-verified** (scratch row counts matched live: 1 workspace / 38 registrations / 3 applications / 9 variables).
- **Manifest diff (installed 0.1.4 → 0.1.6): 0 removals**; object, field, logic-function, front-component, command-menu-item, view, nav-item, timeline-activity-type and role UIDs all unchanged; app UID unchanged; the same 9 variable keys. **No metadata deletion and no UID change was observed**, so the upgrade proceeded.

### 3. Native upgrade of workspace 4D

`uploadAppTarball` → registration `050704a1-2694-43ab-bb46-ba0b9415bdaa` (`latestAvailableVersion=0.1.6`); `upgradeApplication` → `true`. Application `7c7b25f9-2044-44b1-82f2-d0a832fd132c` is now **0.1.6**.

**All 9 variables are byte-identical** before/after — the `enc:v2:…` ciphertext was compared against the restored backup and matches exactly for the 7 non-secret and the 2 secret variables. **No setting was saved**; **0 Communication records** exist.

### 4. Read-only browser checks (no screenshots, no Save, no Send)

| Check | Result |
|-------|--------|
| SMS tab opens | **PASS** — Settings → Communication → **سامانه پیامکی**, `lang=fa-IR`, `dir=rtl` |
| Persian copy | **PASS** — headings **سرویسدهندهٔ پیامک / Kavenegar / RazPayamak**, labels and hints in Persian |
| Secret inputs | **PASS** — both are `type=password` with `value=""` and placeholder **پیکربندی نشده**; **no stored or masked value is shown** (the API reports those secrets as len 0 — they are genuinely unset) |
| Command menu | **PASS** — **ارسال پیامک** |
| Composer | **PASS** — title **ارسال پیامک**, channel `SMS` (RTL), phone **882261739** loaded and **LTR**, buttons **انصراف / ارسال**; phone loading works |
| API / frontend | **PASS** — `:3000` healthz **200**, `:3001` **200** |

### 5. Untouched / not performed

No core, server, SDK-version, provider, send/persist, Workflow or universal-identifier change; no setting saved; no Send; no screenshot. **Real-provider sending remains NOT PERFORMED**; **W7 remains DISABLED / NOT ACCEPTED**. The `All ارتباطات` view title and SELECT option labels remain non-translatable.

## W15-A-BULK-PREVIEW-AND-TEMPLATES — multi-selection preview + workspace templates

Status: **REVIEW PENDING; app-only (code + tests + package). No architect acceptance claimed. PREVIEW + TEMPLATES ONLY — bulk sending is NOT implemented (that is W15-B). The package 0.1.7 was NOT installed anywhere; the main instance remains 0.1.6 (still 4 logic functions; the 7 functions belong to the new manifest only).**

**W15-A-R1 corrections are folded in (see the W15-A-R1 section): stale-preview invalidation on the real production connection, explicit invalid-override reporting, shared-number warnings recomputed from current numbers/remaining recipients (server recomputes after overrides), templates `LOADING`/`EMPTY`/`ERROR` split, an empty/whitespace body never ready, the 200 cap on preview, and duplicates reported instead of pre-removed.**

### 1. Multi-record selection contract (checked first; nothing invented)

The selection is delivered through the **locked SDK hook `useSelectedRecordIds()`** — the host already forwards the ids. The exact call path, read in this task, is:

1. The command menu item is `availabilityType: 'RECORD_SELECTION'` on the **Person** object (`src/command-menu-items/send-message.command-menu-item.ts`, unchanged in W15-A). The host shows it when ≥1 record is selected (`doesCommandMenuItemMatchSelectionState`).
2. `HeadlessFrontComponentRendererEngineCommand.tsx` computes `context.selectedRecords.map((record) => record.id)` and passes it as `selectedRecordIds` to `FrontComponentRenderer`.
3. `FrontComponentRenderer.tsx` forwards `selectedRecordIds` into `useFrontComponentExecutionContext`.
4. `useFrontComponentExecutionContext.ts` sets `recordId: ids.length === 1 ? ids[0] : null` **and** `selectedRecordIds: ids ?? []` on the `FrontComponentExecutionContext`.
5. The SDK exposes both `useRecordId()` (deprecated) and `useSelectedRecordIds(): string[]`. **The export was verified in the ACTUALLY-LOCKED version `twenty-sdk@2.35.0`** — a clean copy installed from the app's own `yarn.lock` (`--immutable`, no borrowing, no `twenty-shared`) resolves `twenty-sdk@2.35.0`, and its `dist/front-component/index.d.ts` declares `declare const useSelectedRecordIds: () => string[]` and exports it. (Observing the export in `2.42.0` alone was NOT proof of `2.35` compatibility; the 2.35.0 check is.) **No SDK upgrade was performed.**

`selectedRecords` is populated from `targetedRecordsRule.mode === 'selection'` → `selectedRecordIds` (`buildHeadlessCommandContextApi.ts`). **Conclusion: the SDK DOES forward every selected id.** No SDK API was invented, no host/core file was changed, and the app reads the ids solely through the supported hook. The single-record id is derived as `ids.length === 1 ? ids[0] : null`, matching the platform's own deprecation guidance.

### 2. Single vs bulk UX

`src/components/send-message-composer.front-component.tsx` is now the branch point: `resolveComposerMode(ids)` returns `NONE` / `SINGLE` / `BULK`. `SINGLE` renders `single-person-composer.tsx` — the **unchanged W5 single-send form** (only the shared styles/`callAppRoute` were extracted to `composer-shared.ts`; behavior is byte-for-byte the same, including the duplicate-submit guard and the phone-load connection). `BULK` renders `bulk-composer.tsx`.

The bulk form shows each recipient with their name and number(s), a **per-recipient number selector** when several exist, a **Remove** action, and a **final count** (`Sendable` / `Unsendable`). Unsendable recipients (no number, or not accessible) are shown with a badge, never hidden. Duplicate ids and shared numbers are surfaced as warnings. **The bulk send button is rendered disabled** (`Bulk sending is not available yet.`) — no bulk execution path exists in W15-A.

### 3. Workspace-owned templates (native object, no parallel storage)

A new object `messageTemplate` (`src/objects/message-template.object.ts`) with fields `title`, `body`, `channel` (open SELECT, SMS), `isUICreatable: true`, `isUIEditable: true`, and a `Message templates` view (`src/views/message-templates.view.ts`). Create/edit/list/select all go through the platform's own object + permissions; the app reads them only through the workspace API client (`findMessageTemplates`). **No local file, no out-of-band table, no cross-workspace source.**

### 4. Variable picker + safe interpolation

`src/templates/template-variable-catalog.ts` is the single, closed catalog: `@name` (first name), `@lastName`, `@fullName`, `@company` (company name), with `@firstName`/`@companyName` aliases. Each entry carries a typed `read(recipient)` accessor — **no dynamic property lookup, no eval, no SQL, no traversal**. `src/templates/interpolate-template.ts` walks the body with a strict `@[A-Za-z][A-Za-z0-9_]*` grammar: a catalog token with a value is substituted; an empty field is `EMPTY_FIELD`; an unknown token is `UNKNOWN_VARIABLE`; **both are left visible in the text and set `hasUnresolvedVariables`**, so the recipient is never presented as ready. Extending the catalog = appending one definition.

### 5. Server-authoritative preview

`src/logic-functions/preview-template.ts` → `previewTemplate` re-reads the authorized Person records via `findPersonsForBulk` (`people(filter: { id: { in: ids } })`, so the server applies the caller's permissions) and returns each recipient's interpolated text with `hasUnresolvedVariables` / `issues` / `isReadyToSend`, plus `invalidOverrides` (person id + reason) and shared-number warnings recomputed after overrides. An override is accepted **only** when it is a number that actually belongs to that Person; an invalid one leaves the recipient with **no destination** (see W15-A-R2). `src/logic-functions/list-bulk-recipients.ts` and `list-message-templates.ts` are the other two read-only routes. **The frontend is not the authority for recipient access or template evaluation.**

### 6. Verified behavior (tests — evidence level stated honestly)

These are **pure / mocked** suites (no live workspace, no real UI). They exercise the real production modules but with injected fakes; they do **NOT** constitute a live-UI or a real save/retrieve claim.

New suites: `interpolate-template.test.ts` (aliases, same template → different text for two people, empty field, unknown token, injection-safety), `resolve-bulk-recipients.test.ts` (all ids shown, dedup, no phone, not accessible, multiple numbers, shared-number warning, `applyPhoneOverrides`, `recomputeSharedPhoneWarnings`), `bulk-recipients.service.test.ts` (scoped read, not-accessible, per-recipient preview, invalid override reported, shared-number recomputed after override, empty body never ready, 200 cap, duplicates reported), `build-template-preview.test.ts` (empty/whitespace body never ready), `preview-connection.test.ts` (**deferred-response** stale-drop on the real `createPreviewConnection` — text change, stale failure, unmount), `find-message-templates.test.ts` (workspace read, no recipient value on the template), `preview-template.workspace.test.ts` (foreign id never resolved; read scoped to requested ids), `composer-selection-mode.test.ts`, `bulk-composer-state.test.ts`, and `w15-templates-contract.test.ts`.

### 7. Package + checks (evidence level)

| Item | Value |
|------|-------|
| Version | `0.1.7` (from `0.1.6`) — **BUILT ONLY, not installed** |
| Build tool | the **fork's own `twenty-sdk` 2.42.0** (`sha256 885696F1…`) on Linux `node:24-bookworm`; **not** the upstream tool |
| File | `communication-0.1.7.tgz` |
| SHA-256 | `0E8E29909B7C43CE3042E9772DFD2D386EE30B1899C05A3A598D27AF694BAE9A` (1,189,746 B) |
| App UID | `768bca20-0b81-4d33-a624-0a894a193ffd` (unchanged) |
| Paths / banner | POSIX paths (0 backslashes); native `fa-IR` banner, **97** keys |
| Routes | 5 authenticated (`send`, `person-phones`, `bulk-recipients`, `message-templates`, `preview-template`) — **this manifest has 7 logic functions; the installed main 0.1.6 has only 4** |
| `workflowActionTriggerSettings` | **null ×7** (W7 disabled) |
| Variables | the same **9** keys; `serverVariables: {}` tombstone preserved |
| Manifest diff 0.1.6 → 0.1.7 | **0 removals**; app UID unchanged; **only additions** (template object + 4 fields incl. the engine's base `name` + 3 logic functions + 1 view) |
| App checks | **327/327** tests (37 files), both typechecks exit 0, lint 0/0 (after W15-A-R2) |
| Container checks (locked 2.35.0 clean copy) | **315/315**, typecheck exit 0, lint 0/0 (at 0.1.7 build time, before R2) |

### 8. Untouched / not performed

No core, server, host, SDK-version, provider, send/persist, Timeline, settings or universal-identifier change; single-send behavior preserved. **No real SMS, no credentials, no screenshot, no main-instance install, no acceptance claimed.** The **live UI and a real template save/retrieve have NOT been performed** — the template tests are pure/mocked, so no native save/retrieve claim is made here. **Bulk sending is NOT implemented** (W15-B); **real-provider sending remains NOT PERFORMED**; **W7 remains DISABLED / NOT ACCEPTED**. SELECT option labels and the `All ارتباطات` view title remain non-translatable (unchanged from W13).

## W15-A-R1-PREVIEW-CLOSURE — preview invalidation, destination correctness, validation

Status: **REVIEW PENDING; app + tests + package (0.1.7 rebuilt, BUILT ONLY). No acceptance claimed. Still preview/templates only — bulk sending NOT started. Main instance remains 0.1.6.**

### 1. Stale preview is invalidated

A change to the message body, the selected template, any number, the recipient set or the selection **immediately voids the preview** (state returns to `IDLE`) and **silences any in-flight preview**, so an older response can never reappear. This is owned by `src/components/preview-connection.ts` (`createPreviewConnection`), the same object the composer creates and calls: every `invalidate()` bumps a monotonic request id and only the latest request may publish state — a stale **success or failure** is dropped. The composer calls `invalidate()` from an effect keyed on `[body, selectedTemplateId, phoneSelections, removedPersonIds, personIdsKey]` and again from the unmount cleanup. Verified with **deferred responses on the real production connection** in `preview-connection.test.ts` (text change, stale failure, unmount).

### 2. Destination correctness

- An **invalid phone override is reported explicitly** (`invalidOverrides`, with the person id **and the reason**) and the recipient is left with **NO destination** (`selectedPhone: null`) — the primary is **never** substituted for an invalid choice. *(Correction, W15-A-R2: the W15-A-R1 build described this as "keeps its own number / never silently substituted", but the code actually FELL BACK to the primary — a silent substitution. R2 makes the claim true by setting `selectedPhone: null` and excluding the recipient from `readyCount`.)* Shared by client and server through `applyPhoneOverrides` (`src/bulk/resolve-bulk-recipients.ts`).
- **Absent key vs explicit invalid choice are distinct** (`readPhoneOverrides`): a key the caller did not send means "no choice" (keep the Person's own number); a key that IS present — even empty or of an invalid type — is an explicit choice that is validated and, if invalid, **reported** (never silently dropped into a fallback).
- **Shared-number warnings are computed from the CURRENT numbers of the REMAINING recipients** (client: `recomputeVisibleSharedPhoneWarnings`, live as recipients are removed or numbers switched). The **server recomputes the same rule AFTER applying overrides** (`recomputeSharedPhoneWarnings`), so its response reflects an override that creates or removes a shared number.
- The composer sends **every sendable recipient's current selection** as an override (an explicitly empty selection is sent as an empty string), so the server evaluates exactly what the user sees.

### 3. Errors and validation

- **Templates have three separate states**: `LOADING`, `EMPTY` (a successful empty workspace), `ERROR` (a failed request) — an empty workspace is never shown as a failure and vice versa.
- A **failed preview response shows a Persian error** (`«ساخت پیشنمایش ناموفق بود.»`), distinct from the `EMPTY`/unresolved-variable messaging.
- An **empty or whitespace-only body is never ready** (`isBodyEmpty`; `readyCount` 0 for every recipient).
- The **200-person cap applies to preview too** (shared `MAX_BULK_PERSON_IDS`).
- **Duplicates are reported, not pre-removed**: `normalizePersonIds` no longer de-duplicates (that silently erased the report), so `duplicatePersonIds` is populated on both routes.

### 4. SDK lock (verified in the actually-locked version)

The hook is verified in the **locked `twenty-sdk@2.35.0`**, not by observing `2.42.0`. A **clean copy** installed from the app's own `yarn.lock` (`--immutable`, no borrowing, no `twenty-shared`) resolves `twenty-sdk@2.35.0`, whose `dist/front-component/index.d.ts` declares and exports `useSelectedRecordIds`. **No SDK upgrade was performed.**

### 5. Evidence level (honest)

The selection, workspace and template-read suites are **pure / mocked**; there is **no live-UI claim and no real template save/retrieve claim**. A **live install and a real template save/retrieve have NOT been performed**. The package `0.1.7` (`sha256 0E8E2990…`) is **BUILT ONLY**; the main instance is still **0.1.6** with **4 logic functions** (the 7 belong to the new manifest only). Checks (after the W15-A-R2 correction): app **327/327** (37 files), **both** typechecks exit 0, lint 0/0; the container run at 0.1.7 build time was **315/315** with the locked 2.35.0 clean copy.

## W15-A-R2-DESTINATION-CLOSURE — invalid override leaves no destination

Status: **REVIEW PENDING; app + tests + docs (no package rebuild needed beyond 0.1.7). No acceptance claimed. Still preview/templates only — bulk sending NOT started. Main instance remains 0.1.6.**

### 1. The defect and the fix

The W15-A-R1 build claimed an invalid phone override was "never silently substituted", but `applyPhoneOverrides` actually returned the recipient **unchanged**, i.e. it **fell back to the primary number** — the exact silent substitution the task forbids. R2 fixes the code:

- An override that is **not owned by the Person**, an **explicitly empty** selection, or an **invalid type** now sets `selectedPhone: null` and records `invalidOverrides: [{ personId, reason }]` with the reason (`NOT_OWNED_BY_PERSON` / `EMPTY_SELECTION` / `INVALID_TYPE`).
- Because `selectedPhone` is `null`, the recipient is **not ready** (`isReadyToSend: false`) and is **excluded from `readyCount`** (and from the shared-number computation).
- **A valid recipient is untouched** by another recipient's invalid override (verified in tests).

### 2. Absent key vs explicit invalid choice

`readPhoneOverrides` no longer drops an explicit empty/invalid-type value (which let a fallback slip in). It **preserves every present key** with its original value; `applyPhoneOverrides` distinguishes an **absent key** ("no choice" → keep the Person's own number) from a **present invalid value** (→ reported, no destination). The composer sends every sendable recipient's current selection, including an explicitly empty one, so the server sees the explicit choice.

### 3. Tests (production `previewTemplate` path)

Corrected the earlier fallback-approving assertions and added: a number that does **not belong** to the Person (→ `selectedPhone: null`, not ready); an **explicit empty** override; an **invalid-type** override; an **absent key** keeping the primary; and **one invalid recipient beside one valid recipient** (the valid one stays ready, `readyCount` reflects only it). A direct `readPhoneOverrides` unit test locks the absent-vs-present distinction.

### 4. Checks (real results)

App **327/327** tests (37 files), **both** typechecks (`tsconfig.json` and `tsconfig.spec.json`) exit 0, `oxlint` **0/0**. The 0.1.7 package is **BUILT ONLY** and was not rebuilt in R2 (source-only correction); the main instance remains **0.1.6** with **4 logic functions**; **W15 remains REVIEW PENDING**. No install, no send, no screenshot, no settings/core/SDK/provider change; bulk sending and W7 remain disabled.

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

The registry fix restores **execution** for the single `apple` workspace on app2. It does **not** by itself demonstrate per-workspace execution isolation — that was closed later by **W10-R8-R1/R2** (tarball install into a second workspace + the provider-selection execution witness); this W10-R6-era note is historical.

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

Status: **IMPLEMENTED / VERIFIED at source + build + UI level**. Provider credentials, sender identities and the default-provider selection are now **workspace-owned** native application variables. **Runtime execution (logic functions) remains BLOCKED**, so per-workspace *execution* isolation is **NOT PERFORMED**. *(Historical — superseded by W10-R6 execution restoration and W10-R8-R1/R2 isolation evidence; see the W10-R8-R1 section.)*

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

**Runtime execution is VERIFIED per workspace (updated by W10-R6 and W10-R8-R2).** Logic-function execution was first restored on the v2.41.0 instance via the W10-R6 registry fix; as of W10-R8-R1/R2 the app is installed in **both** `apple` and `Isolation Beta`, executes with independently-set non-secret configuration in each, and cross-workspace record access is rejected through the app's real routes. The W10-R8-R2 execution witness: the real send route in each workspace **independently selected its own configured provider** — persisted `providerId` `kavenegar` in apple vs `razpayamak` in Beta, with two separate `LogicFunctionTriggerJob` runs in the server log. The observed failures occurred **pre-HTTP** at provider configuration resolution, so no endpoint-level (HTTP-time) consumption is claimed. The variables are physically scoped by `workspaceId` in the DB (distinct rows and ciphertexts per workspace), encrypted with the workspace key, and the executor reads only the running workspace's map. Real-provider sending remains **NOT PERFORMED**.

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

