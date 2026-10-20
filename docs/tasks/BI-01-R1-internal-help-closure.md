# BI-01-R1 — بستن نقص‌های مشخص Help داخلی

Status: READY_FOR_CURSOR  
Parent: BI-01  
Executor: Cursor — Reviewer: Codex  
Submitted code: `ecda1c02bf1c6d65b15dc2c7ec18e60877b86d39`  
Submitted tip: `2c5295dd8dd0a71307b4192c2d0b7a8cc55cafd1`  
Review: [BI-01-review.md](../reviews/BI-01-review.md)

## هدف

همان BI-01 را اصلاح و تکمیل کن؛ این یک مرحلهٔ جدید محصول نیست. جست‌وجوی محلی و مقاله‌های فعلی حفظ شوند. چهار مورد R1–R4 در گزارش Codex مرجع دقیق اصلاح است. اسکرین‌شات لازم نیست.

## شروع

1. شاخهٔ `bi-01-internal-help` و worktree مستقل را حفظ کن؛ وضعیت جاری/HEAD و تغییرهای ناتمام را ثبت کن.
2. آخرین `crm-platform` و شاخهٔ تسک را fetch کن. نسخهٔ جدید recovery/review و این task را بخوان. شاخهٔ تو از قبل از handoff جدید جدا شده؛ با merge معمول و حل تعارض محدود مستندات، هم سابقهٔ نتیجهٔ اجرا و هم handoff و نظر Codex را نگه دار. reset/rebase اجباری/force/stash خودکار نکن.
3. Base SHA واقعی اصلاح را گزارش کن. هیچ Code SHA جدید را قبل از build و آزمون ادعا نکن. BI-02 را شروع نکن.

## اصلاح‌های الزامی

### R1 — لینک‌های داخل متن توضیحات اپ‌ها

- Getting Started و Building Apps در `getStandardApplicationDescription.ts` و `getCustomApplicationDescription.ts` هنوز به Twenty اشاره دارند. این متن از `useResolvedApplicationDescription` به صفحهٔ About می‌رسد؛ فقط دکمهٔ جداگانه را تغییر نده.
- لینک Help برنامه‌ساخته و ترجمهٔ قابل‌عرضهٔ آن باید داخلی باشد. متنِ متعلق به مشتری را با replace عمومی بازنویسی نکن.
- تست واقعیِ خروجی توضیحات/Markdown برای هر دو نوع اپ بنویس؛ نبود href خارجی مرتبط با Help را بررسی کن. موضوعی که راهنمای داخلی ندارد با مقالهٔ نامرتبط معرفی نشود؛ صفحهٔ راهنمای داخلی با توضیح صریح یا حذف لینکِ بی‌مقصد قابل قبول است.

### R2 — Help ایمیل باید URL مطلق درست داشته باشد

- origin معتبر همین نصب/workspace را تا BaseEmail/Footer همهٔ ایمیل‌های production عبور بده؛ reset password، verify email و password update حتماً پوشش داده شوند. سایر callerها را هم کامل فهرست کن.
- از origin معتبر تولیدشده در سرور استفاده کن؛ Host header، body و دامنهٔ دلخواه گیرنده منبع اعتماد نیستند. CTA/token فعلی تغییر نکند.
- fallback نسبی `/help` در ایمیل واقعی پذیرفته نیست. نبود/خرابی تنظیم باید رفتار امن و صریح داشته باشد؛ لینک خراب، `null/help`، URL با protocol غیر HTTP(S) یا لینک خارجی جایگزین تولید نشود. سیاست حالت بدون origin را تست کن، بدون شکستن ارسال ایمیل‌های ضروری.
- HTML ایمیل‌های واقعی را در تست render کن و hrefهای Help را با origin مورد انتظار مقایسه کن؛ بررسی فقط Footer یا preview props کافی نیست. ایمیل واقعی ارسال نکن.

### R3 — origin درست برای Help در API catalog

- `getApiCatalog` هنوز `getRequestBaseUrl(request)` می‌دهد. آن را برای service-doc Help از origin منتشرشده و معتبر UI/workspace تأمین کن؛ در حالت جدا بودن front و API، Help به origin رابط کاربری برود.
- شکل anchor، service-desc، MCP و REST metadata را بی‌جهت عوض نکن؛ اگر origin کمک جدا لازم است، قراردادش صریح باشد. helper سراسری درخواست یا تنظیم trust proxy را برای این کار بازنویسی نکن.
- تست ورودی Host ساختگی و front/API متفاوت اضافه کن؛ href Help از تنظیم معتبر باشد و route واقعاً در همان نصب موجود باشد. ادعای عدم استفاده از Host در comment با جریان واقعی کد یکسان باشد.

### R4 — قبولی واقعی و وضعیت‌های درست

- برای Help index، بازکردن مقاله، ناشناخته، جست‌وجو و ورودی واقعی menu تست DOM/navigation اجرا کن. وجود data attribute در source به معنی تست DOM نیست.
- typecheck/build بسته‌های تغییرکردهٔ front/server/shared/emails با targetهای همان checkout موفق شوند. علت گیرکردن `^build` را مشخص و پیش‌نیاز لازم را درست بساز؛ green شدن روی کد یا dist قدیمی مجاز نیست. تست مرتبط و lint/diff-check را کامل کن؛ تست‌های نامرتبط را بی‌دلیل تکرار نکن.
- artifact اصلاح‌شده را در runtime آزمایشی مستقل بارگذاری و نسخه/commit آن را اثبات کن. main روی 3001 را شاهد شاخهٔ bi01 ندان. سرویس live را برای ایجاد خطا قطع یا بی‌دلیل restart نکن.
- در همان runtime، Help را با تمام خروجی‌های خارجیِ مرورگرِ آزمون مسدودشده باز و جست‌وجو کن؛ گزارش متنی مسیر، نتیجه و درخواست‌های Help بده. frontend، route refresh و tool سرور را جدا بررسی کن. هیچ SMS/LLM/provider واقعی فراخوانی نشود.
- dashboard موجود: لینک برنامه‌ساختهٔ قدیمی را روی fixture/کپی آزمونِ dashboard قبلی هم بررسی کن؛ فقط seed جدید کافی نیست. اصلاح را در مرز widget/لینک متعلق به محصول با شناسایی روشن انجام بده. دادهٔ live یا dashboard دلخواه مشتری را بازنویسی نکن. نیاز واقعی به migration را با طرح محدود و rollback ثبت کن؛ اگر بدون آن قبول نمی‌شود، صریحاً باز گزارش کن.
- smoke جدول، جدید/ویرایش و preview را روی runtime اصلاح‌شده اجرا کن؛ fixture خودت و cleanup فقط با شناسهٔ دقیق. H را صرفاً با «فایلش تغییر نکرد» PASS نکن.
- ریکاوری و A–J را با دامنهٔ شاهد درست به‌روز کن. نبود امکان آزمون به معنی UNVERIFIED است، نه PASS. تمام ترافیک باقیماندهٔ غیرHelp در برنامهٔ مراحل بعد همچنان باز است.

## محدودیت و خروجی

- همین چهار اصلاح؛ نام/لوگوی عمومی، social، telemetry، icons، marketplace، provider، auth/role و لایسنس اینجا دستکاری نشوند.
- هیچ hard delete، cleanup شرطی، تغییر دادهٔ مشتری یا کلید/متغیر provider انجام نشود. APPLE/app2 و worktree اصلی دست‌نخورده بمانند.
- Base/Code/Docs SHA، branch، فایل‌ها، فرمان و exit code بررسی‌ها، runtime و artifact بارگذاری‌شده، نتایج A–J و R1–R4، وضعیت dashboard قدیمی و هر مورد باز را گزارش کن.
- commit/push به همان شاخهٔ تسک یا شاخهٔ اصلاح با ancestry روشن؛ merge کد به `crm-platform` انجام نده. ثبت docs را با پذیرش کد یکی ندان.

پایان: `STOP_FOR_ARCHITECT`. پس از این خروجی، Codex دوباره بررسی می‌کند؛ خودکار به مرحلهٔ بعد نرو.
