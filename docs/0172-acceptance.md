# 0.1.72 safe upgrade — install and browser acceptance (2026-10-17)

Independent worktree `D:\CrmSource\twenty-0172`, branch `crm-platform-0172`.
The original checkout `D:\CrmSource\twenty` was read only; no reset, stash, checkout, clean or
branch change was performed there.

## Provenance

| Item | Value |
| --- | --- |
| Source HEAD (build) | `acb99294fe49f29d90a4064eef9546a7842f4bbf` |
| Required commit in ancestry | yes |
| App version built | 0.1.72 |
| Package | `communication-0.1.72.tgz` — **2,940,226 bytes**, SHA256 `5f73f5c712f89eaa679de70f97fc2414a25aaf224891b55da0fc102e647f75fd` |
| Built with | this fork's SDK 2.42.0 (`/tool`), `twenty dev:build --tarball`, 32 output files |
| Persian catalog in the build | `fa-IR`, **278 keys** (0.1.71 had 268) |
| Installed / uploaded | Communication **0.1.72**, `sourceType: tarball` — installed by upgrade, not reinstall |
| Backup | `D:\twenty-main-backup\pre-0172-20261017-1840\main-default.dump`, 1,434,700 bytes, restore-verified (226 TABLE DATA entries) |

### The loaded bundle was verified, not assumed

`package.json` is not evidence. The on-disk artifact the server actually serves was inspected:

```
built-front-component/src/components/create-template.front-component.mjs   346254 bytes, 15:12
  aria-invalid      = 4
  RecordIndexPage   = 2
  messageTemplates  = 1
  «عنوان الگو را وارد کنید» = 1
```

The 0.1.72 markers are present in the loaded file, so the new code is what runs.

## Acceptance

| Row | Result |
| --- | --- |
| A — empty form → Create | **PASS** — «عنوان الگو را وارد کنید.» and «متن پیام را وارد کنید.» beside the fields, native toast raised, still on the form; row count unchanged (12 \| 3) |
| B — whitespace-only title + valid body | **PASS** — «عنوان الگو را وارد کنید.» shown, body preserved verbatim, still on the form; row count unchanged (12 \| 3) |
| C — valid title/body + source | **PASS** — `@source.name` inserted exactly once, preview «منبع: Platform Migration» |
| D — successful create | **PASS** — exactly ONE record created; navigated to `/objects/messageTemplates` (the LIST), not the record editor; editor closed |
| E — list and reload | **PASS** — fixture visible in the list, 4 live rows; stored title/body/`sourceObjectUid`/`recipientRelationUid` all correct |
| F — edit, clear title, save | **PASS** — «عنوان الگو را وارد کنید.» shown, body kept, and the server value was **not** corrupted (title `FIXTURE172-CREATE` and body unchanged after the rejected save) |

The 0.1.72 headline behaviour is confirmed: the Create button is now **enabled** on an incomplete
form (0.1.71 disabled it, which made validation unreachable), and it reports each missing field.

### Behavioural tests, not claimed as browser acceptance

The existing network/CONFLICT behaviour tests were **not executed** in this environment and are
**UNVERIFIED** here. No live service was disconnected to manufacture an error, as instructed.

## Data

| Item | Value |
| --- | --- |
| Fixture created by this run | `46c67463-52f4-4742-a836-303241bf04a0` (`FIXTURE172-CREATE`) |
| Cleanup | **soft-deleted by exact id**; verified `deletedAt` set, row still present |
| Final counts | 14 total / 4 live — exactly the 4 rows that were live before this run |
| User templates | untouched |

Two live rows appeared during the session **created by the user**, not by this run:
«تست» (14:15 UTC) and «تست نهایی» (16:08 UTC). They are recorded so they are not mistaken for
fixture leaks, and nothing was done to them.

## Original checkout preservation

| Check | Before | After |
| --- | --- | --- |
| HEAD | `43b29264b3` | `43b29264b3` |
| status entries | 100 | 100 |
| tracked modified | 68 | 68 |
| stashes | 1 | 1 |

Identical. The 68 modified files were **not** examined, not reverted, and not included in any
commit. This run used a separate worktree for all build and verification work, and the 0.1.71
report remains on `docs/0171-acceptance` (`43b29264b3`) untouched.

## Not done / not claimed

- Behavioural network/CONFLICT tests: **UNVERIFIED** (not executed).
- Host (`twenty-front`) and server were not restarted or rebuilt; 0.1.72 has no host change.
