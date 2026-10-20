# Brand Independence — Execution Recovery

## Current checkpoint — 2026-10-20 — BI-01-R1 SUBMITTED_FOR_CODEX

- Owner/reviewer: Codex. Executor: Cursor. Final independent program acceptance: Codex.
- Main implementation baseline audited: `acb99294fe49f29d90a4064eef9546a7842f4bbf`. Planning/task commit: `d31537cafcce6d41fdfe45e4cdbb03de69625093`.
- Correction base (required): `d31537cafcce6d41fdfe45e4cdbb03de69625093`. Merge of `origin/crm-platform` (review docs `49b1db287d6ab7c1fe1a2a4bbe5b9baf94a966df`) into the task branch: `473d2bbacc`.
- Cursor submission branch: `bi-01-internal-help`; R1 code SHA `3ad58bacb94e5925497cec33cf550629bbb48d85`; docs SHA is the docs commit pushed after this file (recorded in the final report).
- Codex review of BI-01: **PARTIAL / CHANGES_REQUESTED** ([BI-01-review](../reviews/BI-01-review.md)). BI-01-R1 corrections implemented; main-branch review/task handoff preserved by normal merge, no rebase/force/reset.
- Active task: [BI-01-R1](../tasks/BI-01-R1-internal-help-closure.md). Original task: [BI-01](../tasks/BI-01-internal-help.md). Plan: [brand-independence](../plans/brand-independence.md).
- No merge to `crm-platform`, no BI-02, no data/provider/auth/role change, no real email/SMS/LLM/provider call, no screenshots.
- Explicit user rules: zero communication with Twenty; help content internal/same-origin with no external fallback; preserve customer data/worktrees; technical scope only.
- Next: Codex re-review of R1–R4 evidence below. Do not treat this docs commit as code acceptance.

### BI-01-R1 — executor report (R1–R4)

| Item | Correction | Evidence |
|---|---|---|
| R1 | Standards/custom application descriptions (`getStandardApplicationDescription.ts`, `getCustomApplicationDescription.ts`) no longer link to `twenty.com`; shipped `src/locales/*.po` and `src/locales/generated/*.ts` dev-guide strings point to the in-app `/help` pages. Customer-authored descriptions are untouched. | `applicationDescriptions.spec.ts` renders both resolved descriptions and asserts zero external `href`; grep of the two utils and all 44 shipped locale bundles returns no app-help `twenty.com/developers/extend/apps` URL. |
| R2 | `Footer.buildAbsoluteHelpUrl` accepts only absolute `http:`/`https:` URLs with host and no embedded credentials; invalid/absent origin omits the Help link instead of emitting `/help`. Every production email template now accepts `serverUrl` and forwards it to `BaseEmail → Footer`. All server callers pipeline validated `FRONTEND_URL`/`SERVER_URL` through `getPublishedHelpOriginFromConfig(twentyConfigService)` (auth, reset-password, email-verification, password-update notify, billing reminders, suspended-workspace warnings, workspace invitation, approved-access-domain, admin panel, cleaner). CTA tokens/expiry untouched. | `email-help-links.spec.ts` renders real email HTML for password-reset, verify-email, password-update, billing, suspended-workspace, invite and approved-domain emails: absolute `https://crm.example/help` per template; absent origin → no Help href; `javascript:`/protocol-relative origin → no Help href. |
| R3 | `getApiCatalog` resolves `service-doc` from `resolvePublishedHelpUrl(frontendUrl, serverUrl)` (config only), never from the request. Canonical API/MCP anchors and service description unchanged; `build-api-catalog.util` takes the help URL explicitly and omits `service-doc` when no valid origin exists. | `well-known.controller.spec.ts` + `build-api-catalog.util.spec.ts`: hostile `Host: arbitrary-host.example` does not leak into `service-doc`; split front (`https://ui.example`) / API (`https://api.example`) yields `https://ui.example/help`; no origin → no `service-doc`. |
| R4 | Full typecheck/build executed on this checkout; DOM/navigation tests added; legacy dashboard links rewritten at read time only. | Commands and results below; live-browser UI remains UNVERIFIED for an environment reason documented below. |

### R4 — commands actually run (worktree `D:\CrmSource\twenty-bi01`, Node 24.16.0)

| Command | Result |
|---|---|
| `nx build twenty-shared` | SUCCESS |
| `nx build twenty-emails` | SUCCESS |
| `nx typecheck twenty-shared` | SUCCESS |
| `nx typecheck twenty-emails` | SUCCESS |
| `nx typecheck twenty-server` | SUCCESS |
| `nx typecheck twenty-front` | SUCCESS |
| `nx build twenty-front --excludeTaskDependencies` | SUCCESS (clean production rebuild, `--skip-nx-cache`, 1066 JS chunks) |
| `jest` (twenty-server): `well-known`, `email/__tests__`, `search-help-center-tool` | 10 suites / 87 tests PASS |
| `jest` (twenty-front): `pages/help`, `useSettingsNavigationItems.docs`, `applicationDescriptions.spec`, `support/utils`, `standalone-rich-text/utils` | 6 suites / 31 tests PASS |
| `git diff --check d31537ca HEAD` | Only pre-existing trailing whitespace in Codex-owned docs; BI-01 EOF whitespace removed |

`^build` dependency chain (barrel generation for every linked package) hung on this host; prerequisites were built individually with `--excludeTaskDependencies` after linking the local `twenty-front-component-renderer` / `twenty-sdk` junctions. No dist artifact is committed.

### R4 — runtime, dashboard, DOM and network evidence

- Serving: `vite preview` on `127.0.0.1:3102` from this worktree's `packages/twenty-front/build`.
- HTTP: `/help`, `/help/create-template`, `/help/edit-and-save`, `/help/this-slug-does-not-exist` → `200` with the SPA `#root` container (deep-link/refresh served by the app shell, not a 404).
- DOM/navigation: `HelpCenter.dom.test.tsx` (React Router + Testing Library) executes topic index render, search filtering, topic click → article route, unknown slug → not-found, deep link and back-to-index; `useSettingsNavigationItems.docs.test.tsx` executes Settings → Documentation navigation to `/help`. These are jsdom DOM tests, not a browser capture.
- **Live browser render: UNVERIFIED — pre-existing build-infrastructure defect, not a BI-01 regression.** Headless Chrome against the served artifact fails on *every* route (including `/`) with `TypeError: (0, c.jsxDEV) is not a function`: the `@wyw-in-js` transform in this worktree emits development-JSX calls while `react/jsx-runtime` only exports `jsx`/`jsxs`. Reproduced after a cache-skipped `NODE_ENV=production` rebuild. Therefore no browser network capture of the help UI can honestly be claimed; server-side local search is proven separately (tool tests: `fetch` spy never called).
- Client bundles are built from source with zero network fetches to any help/docs origin; Help pages import only `twenty-shared/constants` content.
- Old dashboards: `internalizeProductOwnedHelpLinks` rewrites only product-owned legacy `docs.twenty.com` blocknote links to `/help` at render time in `StandaloneRichTextEditorContent` (read-only mode). It is pure traversal — no DB write, no migration, no customer-content rewrite; unknown/customer URLs pass through unchanged. Unit tests cover legacy product link, mixed trees, nested nodes and customer-owned links. Live dashboard rendering in this runtime: UNVERIFIED (browser blocker above); no live/customer dashboard was touched.
- No live service on port 3001 was restarted or interrupted; no data, role, provider or SMTP setting changed.

### Acceptance A–J (executor, BI-01-R1 scope)

| Row | Result | Evidence |
|---|---|---|
| A | PASS (DOM test) / live browser UNVERIFIED | Help index renders four topics and search input; Settings → Documentation navigation asserted in jsdom. Browser capture blocked by `jsxDEV` defect on all routes. |
| B | PASS (DOM test) / live reload UNVERIFIED in browser | Known slug renders article, unknown slug renders not-found with back link, deep link via `MemoryRouter`/`Routes`; HTTP reload of `/help/:slug` returns the app shell. |
| C | PASS | Search tests: Persian/Arabic fold, ZWNJ, empty query → full list, no-match → `[]`. |
| D | PASS (tool/unit) | `SearchHelpCenterTool` executes against shared content; `fetch` spy never called. Browser network capture not possible (see R4 blocker). |
| E | PASS (tool/unit) | Tool result equals `searchHelpArticles`; no HTTP client, Mintlify config or external provider imported. |
| F | PASS (code + rendered HTML tests) | R1 descriptions/translations internal; R2 real email HTML has absolute `https://crm.example/help` and omits Help when origin missing/invalid; R3 catalog `service-doc` from config only. Legacy dashboards rewritten read-time, no DB mutation; live dashboard UNVERIFIED. |
| G | PASS (code) | `useInstantiateSupportChat` returns `{ isFrontChatLoaded: false }`; Support menu items removed; Documentation/support opens stay same-origin. |
| H | PASS (scope) | Diff limited to help links/content, email origin plumbing, catalog origin and tests; no auth/role/provider/template-behavior change. Runtime template smoke on this artifact UNVERIFIED (browser blocker). |
| I | PASS | Builds/typechecks and focused suites above; `git diff --check` clean for BI-01 files. |
| J | PASS (honest ledger) | This section: live browser and live dashboard rows explicitly UNVERIFIED. No screenshots. |

## تحویل BI-01 (تاریخی؛ توسط Codex رد و با BI-01-R1 جایگزین شد)

| Field | Value |
|---|---|
| Base SHA | `d31537cafcce6d41fdfe45e4cdbb03de69625093` |
| Branch | `bi-01-internal-help` |
| Code SHA | `ecda1c02bf1c6d65b15dc2c7ec18e60877b86d39` |
| Docs SHA | recorded in this docs commit after push |
| Worktree | `D:\CrmSource\twenty-bi01` |
| Route | `/help`, `/help/:helpArticleSlug` |
| Topics | `create-template`, `edit-and-save`, `source-and-variables`, `preview-and-save-errors` |
| Shared content | `packages/twenty-shared/src/constants/HelpCenter.ts` (browser + `search_help_center`) |
| Data/settings touched | none |
| Live SMS | not sent |
| Live service interrupted | no |

### Acceptance A–J (executor)

| Row | Result | Evidence |
|---|---|---|
| A | PASS (unit/DOM attrs) | Four Persian topics in `HELP_ARTICLES`; HelpIndex renders `data-help-page="index"`; Settings → Documentation uses `window.location.assign('/help')`. Live UI against bi01 artifact: UNVERIFIED (live 3001 still serves main worktree). |
| B | PASS (logic) | `findHelpArticle` known slug / null for unknown; HelpArticlePage `data-help-page="not-found"` + back link. Direct URL in live runtime: UNVERIFIED until bi01 front is loaded. |
| C | PASS | `HelpCenter.test.ts`: Arabic/Persian fold, ZWNJ, empty → full list, no-match → `[]`. |
| D | PASS (tool/unit) | `SearchHelpCenterTool` tests: `fetch` spy never called. Front help pages import only shared constants (no network). Full browser network block on live: UNVERIFIED. |
| E | PASS | Direct tool execute matches `searchHelpArticles`; zero HTTP; Mintlify unused. |
| F | PASS (code) | Email Footer → same-origin `/help` (absolute when `serverUrl` set); API catalog `service-doc` → `{baseUrl}/help`; new-dashboard seed link `/help`. Existing product dashboards in DB: UNVERIFIED (no live rewrite; product-owned only for new seed). |
| G | PASS (code) | `useInstantiateSupportChat` returns `{ isFrontChatLoaded: false }` — no Front SDK; Support menu items removed; Documentation navigates internally. |
| H | PASS (scope) | No template/preview/provider/auth/role changes in this task. Regression risk limited to Help routing. Live template smoke on bi01 artifact: UNVERIFIED. |
| I | PASS (focused) | `nx test twenty-shared` (incl. HelpCenter); jest `search-help-center-tool.spec`, `build-api-catalog.util.spec`, `getDocumentationUrl.test`; `nx typecheck twenty-shared`. Full front/server nx typecheck via `^build` hung on this host — not claimed green. |
| J | PASS | This ledger. No screenshots. |

### Changed files (rationale)

- `twenty-shared/.../HelpCenter.ts` (+ tests, exports, `AppPath.Help*`): single content + search module.
- `twenty-front/.../pages/help/*` + route objects: internal RTL help UI.
- `getDocumentationUrl`, settings nav, apps/billing/AI docs buttons, workflow callout: same-origin `/help`.
- `useInstantiateSupportChat` + MultiWorkspaceDropdown: no external support chat.
- `search-help-center-tool`: local search only.
- `build-api-catalog`, dashboard seed widget, email Footer/`serverUrl`: product Help links internalized.

## Supervision protocol

1. Cursor checks baseline ancestry and preserves dirty worktrees; implements only active task on a separate branch.
2. Cursor records code SHA, changed files, commands/results and row-by-row acceptance. No automatic next task or main-branch merge.
3. Codex inspects actual diff and relevant tests/artifact evidence, checks scope and accepts/rejects specific rows. A worker's PASS is not the review result.
4. Codex issues a bounded correction only for failed rows, or the next stage after acceptance. Unavailable live evidence stays UNVERIFIED.
5. After implementation stages, Codex performs the separate whole-program review: appearance, email, links, browser/API/worker/DNS, installation/update, upgrade/cache and regression/restore. No final PASS until those checks have evidence.

## Acceptance ledger

| Delivery | Executor result | Codex review | Remaining |
|---|---|---|---|
| BI-01 internal Help | R1 SUBMITTED `3ad58bac` / docs pending | CHANGES_REQUESTED (BI-01), R1 re-review pending | Codex re-review of R1–R4; live browser row UNVERIFIED |
| Brand/assets | NOT STARTED | PENDING | Full plan stage 2 |
| Remaining links/social/email branding | NOT STARTED | PENDING | Full plan stage 3 |
| Remaining runtime egress/data references | NOT STARTED | PENDING | Full plan stage 4 |
| Independent packaging/install/update | NOT STARTED | PENDING | Full plan stage 5 |
| Whole-program independent acceptance | NOT STARTED | PENDING | Full plan stage 6 |

## Evidence record for each task

Record: exact baseline and code/docs SHAs; branch; files and rationale; runtime loaded; test commands/exit codes; route/DOM/network text; each acceptance row; deployment and rollback state; touched data/settings; limitations. No screenshots required. Do not record tokens, credentials or customer content.

## تحویل قبلی — ۱۸ اکتبر ۲۰۲۶ (تاریخی؛ وضعیت جاری در ابتدای همین فایل است)

### هدف و تصمیم‌های قطعی کاربر

- حذف همهٔ برند و هدایت‌های Twenty از محصول: لوگو، نام قابل‌نمایش، آیکون نصب، شبکه‌های اجتماعی، لینک، تصویر، ایمیل، راهنما، نصب و به‌روزرسانی.
- ارتباط با Twenty مطلقاً مجاز نیست: نه API، نه درخواست تصویر/آیکون، نه worker/cron، نه DNS بیرونی برای آن مقصد، نه بازکردن سایت آن با کلیک Help یا لینک محصول.
- Help باید داخل همین نصب و هم‌مبدأ باشد؛ محتوای واقعی و جست‌وجوی داخلی، بدون fallback بیرونی. صرف حذف دکمه یا صفحهٔ خالی پذیرفته نیست.
- مسئول هماهنگی و بازبینی: Codex؛ اجراکننده: Cursor؛ بررسی مستقل کل برنامه در پایان با Codex است. هیچ تسک بعدی پیش از بررسی نتیجهٔ فعلی شروع نشود.
- اسکرین‌شات و ویدئو نخواهید. شواهد متنیِ route/DOM/network، diff، تست رفتاری و SHA کافی و لازم‌اند.
- این برنامه صرفاً فنی است. لایسنس زمان‌دار محصول بعداً در برنامهٔ مستقل پیاده می‌شود؛ فعلاً تمرکز تغییر نکند.

### دقیقاً چه کاری انجام و چه چیزی تأیید شده است؟

| مورد | وضعیت دقیق | حدود تأیید |
|---|---|---|
| بررسی اولیهٔ کد | انجام‌شده | commit مبنا acb99294؛ مسیرهای مهم برند و تماس از کد خوانده شدند، نه از شنود زنده. |
| برنامهٔ شش‌مرحله‌ای | ثبت‌شده و مأمور به اجرا | plan و task و ledger در commit d31537ca روی crm-platform؛ فایل تسک پس از انتشار از شاخهٔ remote دوباره خوانده شد. |
| تعیین Help داخلی به‌عنوان اولین تحویل | تأیید کاربر و ثبت‌شده | BI-01 با پذیرش A–J؛ نتیجه باید برای کاربر قابل استفاده باشد. |
| ارسال دستور BI-01 به کاربر برای Cursor | انجام‌شده | هنوز هیچ گزارش اجرایی، شاخهٔ کد یا Code SHA از Cursor به Codex نرسیده است. |
| کد جدید حذف Twenty | هیچ تحویل تأییدشده‌ای نداریم | commitهای این برنامه تا این checkpoint فقط مستندات‌اند؛ وضعیت فعالیت محلی Cursor از این گفتگو قابل مشاهده نیست. |
| استقرار جدید این برنامه | انجام نشده توسط Codex | هیچ سرویس، داده یا تنظیم live در این مراحل دستکاری نشده است. |
| صفر ارتباط کل محصول | UNVERIFIED / تأیید نشده | نیازمند اجرای باقی مراحل و بررسی شبکهٔ artifact واقعی است؛ با تصویب برنامه یا تست Help تأیید نمی‌شود. |
| پذیرش مستقل نهایی | انجام نشده | مرحلهٔ ۶؛ بعد از تحویل مراحل قبلی. |

تأیید برنامه را با تأیید اجرا یکی نگیرید. PASS کرسر فقط نتیجهٔ اجراکننده است تا Codex diff و شواهد را بررسی کند. هیچ نتیجه‌ای برای A–J فعلاً PASS نیست.

### چه چیزهایی هنوز باقی مانده‌اند؟

1. دریافت و بررسی BI-01: Help داخلی، چهار مقالهٔ فارسی، جست‌وجوی مشترک front/server، route و refresh، تمام ورودی‌های برنامه‌ساخته و عدم راه‌اندازی chat خارجی.
2. برند و assetها: نام نهایی، لوگو، themeها، favicon/PWA، آیکون‌ها، title/metadata و حالت بدون لوگوی workspace.
3. باقی لینک‌های سایت/شبکه‌های اجتماعی و برند کامل ایمیل‌ها؛ بدون پیوند upstream.
4. باقی تماس‌های runtime شامل telemetry، twenty-icons، version check، وابستگی‌های vendor و تنظیمات DB/cache/env؛ کنترل egress و مرورگر و URLهای قدیمیِ متعلق به محصول.
5. image/installer/registry/marketplace/updater مستقل و آزمون نصب مشتری و کلاد.
6. بررسی مستقل همهٔ مراحل روی artifact نهایی، نصب تازه و ارتقای نصب قبلی، cache، auth و editor و preview و restore.

نام نهایی محصول، لوگو، دامنه و social/support مقصدها هنوز توسط کاربر در این گفتگو ارائه نشده‌اند. این ورودی‌ها BI-01 را متوقف نمی‌کنند؛ مقادیر جعلی یا خارجی را جایگزین نکنید. شبکهٔ اجتماعی بدون مقصد حذف شود.

### نقطهٔ شروع چت جدید؛ بدون تکرار بررسی‌های قبلی

1. ابتدا همین فایل، سپس plan و فایل BI-01 را از نسخهٔ جاری مخزن بخوانید. مبنای فعلی را با fetch مشخص کنید؛ تغییرهای بعدی remote را با این checkpoint مقایسه کنید.
2. اگر کاربر گزارش Cursor را داده است، شاخه و Code SHA را پیدا کنید، ancestry را کنترل و diff واقعی را بخوانید. بر مبنای خلاصهٔ شفاهی یا شمارهٔ نسخه، PASS ندهید.
3. اگر گزارش هنوز نرسیده، وضعیت «نتیجه دریافت نشده» حفظ شود. BI-01 جدید یا کار موازی صادر نکنید؛ بدون شاهد، آن را انجام‌شده یا قطعاً شروع‌نشده ننامید.
4. شواهد A–J را جدا بسنجید؛ تست‌های ضروری مرتبط را در محیط موجود اجرا کنید. موردی که به محیط نصب‌شده دسترسی ندارد UNVERIFIED بماند. برای گرفتن شاهد سرویس live را قطع نکنید.
5. پس از بررسی، همین ledger را با Code SHA، نتیجهٔ هر ردیف، محدودیت و قدم بعد به‌روز کنید. اصلاح محدود یا تسک بعدی فقط بر اساس یافتهٔ واقعی صادر شود.
6. هنگام تحویل مجدد چت، task فعال، آخرین commit پذیرفته‌شده، branch اجرایی، وضعیت استقرار و دقیقاً موارد باز را همین‌جا ثبت کنید؛ توضیح دوبارهٔ کاربر لازم نباشد.

### سابقهٔ محصول برای جلوگیری از بازگشت به فرض‌های منسوخ

در گزارش قبلی ارائه‌شده توسط کاربر، Communication 0.1.72 نصب و اعتبارسنجی فرم/بازگشت پس از ایجاد به لیست پذیرفته شده بود؛ کد پایهٔ acb99294 شامل همین اصلاح است. ویرایشگر جدید و ویرایش، مشترک و inline هستند. کوئری workspace جای client محدود قدیمی را گرفته و کاربر قبلاً صحت فیلدهای پنج منبع را گزارش کرده است. این سوابق به معنی بازآزمایی مستقل در برنامهٔ حاضر نیستند؛ هنگام تغییر محصول regression مرتبط لازم است. مشکل قدیمی «فرم جدید فقط عنوان/متن/نام» یا «event objects ذاتاً غیرقابل‌خواندن‌اند» را بدون شاهد تازه، مشکل جاری فرض نکنید.

### حفاظت از محیط و داده

- مخزن: mrnikiemami-code/crm-platform؛ شاخهٔ اصلی crm-platform؛ مسیر معمول مشتری D:\\CrmSource\\twenty. وضعیت checkout اصلی ممکن است dirty باشد؛ هرگز clean فرض نکنید.
- از worktree مستقل استفاده کنید. reset/clean/force و stash خودکار، ادغام کار نامرتبط و بازنویسی شناسه‌ها/نام packageها به‌صورت سراسری ممنوع.
- templateهای مشتری، trash، provider variables، نقش‌ها و APPLE/app2 دست‌نخورده. هیچ SMS واقعی برای آزمون ارسال نشود؛ W7 به خاطر این برنامه فعال نشود.
- cleanup فقط fixture خود تسک با شناسهٔ دقیق و روش مجاز؛ هیچ hard delete یا cleanup بر اساس deletedAt انجام نشود.
- سرور، front dev و worker را یک فرایند فرض نکنید؛ پورت/روش build و بارگذاری را از محیط واقعی تشخیص دهید. قبلاً front روی 3001 و API روی 3002 گزارش شده بود؛ این‌ها در این checkpoint مجدداً بررسی نشده‌اند.
- متن ریکاوری شامل credential یا دادهٔ محتوایی مشتری نباشد. نوشتن تغییر remote با expected head و بدون force انجام شود تا کار هم‌زمان Cursor از بین نرود.

### عبارت تحویل کوتاه برای چت جدید

«ریکاوری CRM Brand Independence را از docs/recovery/brand-independence.md در شاخهٔ crm-platform بخوان. تو ناظر و پذیرندهٔ نهایی هستی، Cursor اجراکننده است. BI-01 Help داخلی تسک فعال است؛ گزارش آن را بررسی کن و پیش از تأیید، مرحلهٔ بعد را شروع نکن. اسکرین‌شات نمی‌خواهیم. صفر ارتباط با Twenty شرط قطعی است.»


## عبارت تحویل فعلی به چت جدید — ۲۰ اکتبر ۲۰۲۶

«ریکاوری CRM را از docs/recovery/brand-independence.md در شاخهٔ crm-platform بخوان. BI-01 با Code SHA ecda1c02 بررسی شده و CHANGES_REQUESTED است. تسک فعال BI-01-R1 است؛ گزارش docs/reviews/BI-01-review.md و چهار اصلاح را بخوان. ۱۸ تست جست‌وجو پاس شده، اما لینک خارجی، لینک ایمیل، origin و شواهد runtime/build باز هستند. فقط اصلاح همین تسک را هدایت و بررسی کن؛ BI-02 یا ادغام کد تا پذیرش شروع نشود. صفر ارتباط با Twenty و بدون screenshot شرط قطعی است.»
