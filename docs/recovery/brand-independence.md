# Brand Independence — Execution Recovery

## Current checkpoint — 2026-10-18

- Program: BRAND-INDEPENDENCE; scope is technical brand/network/packaging independence.
- Owner/reviewer: Codex. Executor: Cursor. Final independent program review: Codex.
- Source baseline audited: `acb99294fe49f29d90a4064eef9546a7842f4bbf`.
- Planning/task commit: `d31537cafcce6d41fdfe45e4cdbb03de69625093` on `crm-platform`; verified present remotely.
- Canonical plan: [../plans/brand-independence.md](../plans/brand-independence.md).
- Active task: [BI-01](../tasks/BI-01-internal-help.md), ISSUED_TO_USER_FOR_CURSOR. No execution report/code SHA received yet; actual executor activity is UNKNOWN, not independently observed.
- Explicit requirement: every product Help path and search must be internal/same-origin. No outbound help/search/chat fallback. User does not require screenshots.
- Existing product changes and deployments are not superseded by this documentation. No application code, live data, settings or infrastructure changed by this planning commit.

## Supervision protocol

1. Cursor checks baseline ancestry and preserves dirty worktrees; implements only active task on a separate branch.
2. Cursor records code SHA, changed files, commands/results and row-by-row acceptance. No automatic next task or main-branch merge.
3. Codex inspects actual diff and relevant tests/artifact evidence, checks scope and accepts/rejects specific rows. A worker's PASS is not the review result.
4. Codex issues a bounded correction only for failed rows, or the next stage after acceptance. Unavailable live evidence stays UNVERIFIED.
5. After implementation stages, Codex performs the separate whole-program review: appearance, email, links, browser/API/worker/DNS, installation/update, upgrade/cache and regression/restore. No final PASS until those checks have evidence.

## Acceptance ledger

| Delivery | Executor result | Codex review | Remaining |
|---|---|---|---|
| BI-01 internal Help | ISSUED; no result received | PENDING | Code SHA, diff and A–J evidence |
| Brand/assets | NOT STARTED | PENDING | Full plan stage 2 |
| Remaining links/social/email branding | NOT STARTED | PENDING | Full plan stage 3 |
| Remaining runtime egress/data references | NOT STARTED | PENDING | Full plan stage 4 |
| Independent packaging/install/update | NOT STARTED | PENDING | Full plan stage 5 |
| Whole-program independent acceptance | NOT STARTED | PENDING | Full plan stage 6 |

## Evidence record for each task

Record: exact baseline and code/docs SHAs; branch; files and rationale; runtime loaded; test commands/exit codes; route/DOM/network text; each acceptance row; deployment and rollback state; touched data/settings; limitations. No screenshots required. Do not record tokens, credentials or customer content.

## تحویل به چت جدید — ۱۸ اکتبر ۲۰۲۶

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
