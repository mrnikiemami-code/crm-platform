# BI-01 — راهنمای کاملاً داخلی و حذف Help خارجی

Status: READY_FOR_CURSOR — implementation not started  
Program: BRAND-INDEPENDENCE  
Owner/reviewer: Codex  
Executor: Cursor  
Audited source baseline: `acb99294fe49f29d90a4064eef9546a7842f4bbf`  
Required baseline: commit adding this task must be an ancestor of the implementation branch. Record its exact SHA before coding.  
Plan: [brand-independence.md](../plans/brand-independence.md)  
Recovery: [brand-independence.md](../recovery/brand-independence.md)

## هدف و نتیجهٔ قابل لمس

کاربر در همین برنامه روی Help/راهنما می‌زند؛ صفحهٔ فارسی دارای محتوای واقعی و جست‌وجوی محلی باز می‌شود، با reload مستقیم هم باقی می‌ماند و هیچ سایت یا موتور جست‌وجوی خارجی برای Help صدا زده نمی‌شود. پنهان‌کردن دکمه، صفحهٔ خالی یا گذاشتن لینک به یک سایت خارجی قبول نیست.

این تسک فقط Help را کامل می‌کند؛ حذف تمام برندها و صفرکردن همهٔ ترافیک محصول ادعای این تسک نیست.

## شروع بدون تداخل

1. مسیر اصلی معمولاً `D:\CrmSource\twenty` است. ابتدا HEAD، branch و `git status --short` را ثبت کن؛ محتوای کارهای نامرتبط را تغییر نده.
2. `git fetch origin crm-platform`؛ با شاخه/worktree جدا از آخرین baseline سازگار کار کن. reset/clean/force-push، stash خودکار و commit کردن تغییرهای دیگر ممنوع. اگر worktree اصلی dirty است همان را حفظ کن؛ آن تغییرات نباید وارد build این تسک شوند.
3. وجود commit این برنامه در ancestry را کنترل کن. اگر remote جلو رفته، تغییرها را بخوان و baseline سازگار را ثبت کن؛ هیچ downgrade به audited SHA انجام نده.
4. برنامه و recovery را بخوان. فقط این تسک را اجرا کن؛ بعدی را شروع نکن.

## شواهد و نقطه‌های شروع کد

- `packages/twenty-front/src/modules/support/utils/getDocumentationUrl.ts`: فعلاً URLهای زبان‌دار خارجی می‌سازد.
- `packages/twenty-shared/src/constants/DocumentationBaseUrl.ts`: مقدار `https://docs.twenty.com`.
- `packages/twenty-front/src/modules/app/hooks/useCreateRootAppRouter.tsx`، `useCreateWorkspaceAppRouter.tsx` و routingهای فعلی: الگوی route و layout را از این‌ها بردار؛ router موازی نساز.
- `packages/twenty-front/src/modules/support/hooks/useInstantiateSupportChat.ts` و `components/SupportChatEffect.tsx`: راه‌اندازی chat خارجی مرتبط با پشتیبانی نیز بررسی شود.
- `packages/twenty-server/src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.ts`: فعلاً به `twenty-help-search.com` یا Mintlify POST می‌کند.
- `tool.module.ts` و `tool-provider/providers/action-tool.provider.ts`: قرارداد و registration ابزار `search_help_center` حفظ شود، پیاده‌سازی جست‌وجو داخلی شود.
- `packages/twenty-server/src/engine/core-modules/well-known/utils/build-api-catalog.util.ts`: مصرف‌کنندهٔ مستندات؛ URLهای تولیدی بررسی شوند.
- `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/page-layout-widget/compute-my-first-dashboard-widgets.util.ts`: لینک مستندات در dashboard اولیه.
- `packages/twenty-front/src/pages/settings/community/SettingsCommunity.tsx`، calloutهای workflow و Helpهای فرم/تنظیمات: لینک‌های راهنمای برنامه‌ساخته را پیدا کن.
- `packages/twenty-emails/src/components/Footer.tsx`: پیوند User guide/Developers خارجی. فقط پیوند Help در این تسک اصلاح می‌شود؛ تغییر عمومی برند ایمیل در مرحلهٔ خودش است.

این فهرست مجوز توقف جست‌وجو نیست. با `rg` تمام مصرف‌کننده‌های documentation helper و URLهای Help را در source قابل اجرا و artifact مرتبط پیدا و در گزارش طبقه‌بندی کن؛ fixture/test/story را تماس فعال گزارش نکن.

## پیاده‌سازی مورد انتظار

### ۱. route و محتوای داخلی

- مسیر داخلی ثابت `/help` و مسیرهای موضوعی مطابق قرارداد router موجود؛ صفحات باید با refresh/direct URL در build واقعی هم باز شوند. اگر معماری prefix خاصی دارد، نگاشت هم‌مبدأِ ثابت را صریح مستند کن.
- الگوی واقعی layout، typography، input، feedback و navigation موجود؛ فارسی RTL و استفاده از همان نظام ترجمهٔ محصول. dependency یا UI kit تازه اضافه نکن.
- دست‌کم چهار موضوع دارای متن عملی و درست: «ساخت الگوی پیام»، «ویرایش و ذخیره»، «موجودیت منبع و متغیرها»، «پیش‌نمایش و خطاهای ذخیره». متن بر رفتار همین نسخه مبتنی باشد، نه وعدهٔ قابلیت آینده.
- فهرست موضوع‌ها، بازگشت به فهرست، جست‌وجوی عنوان/متن و پیام روشن برای نتیجهٔ خالی. محتوای جست‌وجو و مقاله در بسته باشد؛ CDN، iframe بیرونی یا جست‌وجوی اینترنتی لازم نباشد.
- Help دادهٔ مشتری یا token را نمایش ندهد. برای topic ناشناخته، صفحهٔ داخلیِ «موضوع پیدا نشد» با راه برگشت نشان بده؛ مقالهٔ نامرتبط را جای موضوع درخواست‌شده جا نزن.

### ۲. یک منبع محتوا و دو مصرف‌کننده

- محتوای راهنما و جست‌وجوی deterministic آن از یک ماژول خالص مشترک/قرارداد موجود مصرف شوند؛ browser و ابزار server دو فهرست ناسازگار نداشته باشند. از مرز export و build واقعی packageها پیروی کن؛ کد Node یا secret وارد front نشود.
- normalization جست‌وجوی فارسی: ی/ي، ک/ك، فاصله و نیم‌فاصله با رفتار روشن؛ ورودی خالی فهرست کنترل‌شده یا نتیجهٔ خالی تعریف‌شده بدهد، ورودی بی‌نتیجه خروجی موفقِ خالی داشته باشد. ورودی کاربر با `dangerouslySetInnerHTML` یا HTML خام render نشود.
- `SearchHelpCenterTool.execute` همین محتوای محلی را بخواند؛ قرارداد موفقیت/خطا و شکل نتایج مصرف‌کننده حفظ شود. عنوان، excerpt و لینک همان موضوع داخلی را برگرداند.
- هیچ fallback به Twenty، Mintlify یا سرویس AI/جست‌وجوی دیگر نباشد؛ حتی اگر کلیدهای قدیمی Mintlify در تنظیمات هستند. برای آزمون، tool را مستقیم اجرا کن؛ لازم نیست LLM واقعی را صدا بزنی.
- import/DI و registration را طوری اصلاح کن که ساخت Nest و action provider سالم بمانند؛ وابستگی HTTP بی‌مصرف در این tool باقی نماند.

### ۳. تمام ورودی‌های Help و لینک‌های تولیدی

- Help/Documentation در menu، تنظیمات، callout، صفحهٔ اپ‌ها و ایمیل به مسیر هم‌مبدأ هدایت شوند. هر جایی که URL مطلق لازم دارد، origin از تنظیم معتبر همان نصب ساخته شود؛ Host header یا body دلخواه مبنای اعتماد نباشد.
- تغییر کور `DOCUMENTATION_BASE_URL` از URL مطلق به رشتهٔ نسبی بدون بررسی تمام مصرف‌کننده‌ها ممنوع؛ `new URL`، زبان‌ها، pathها، hashها و catalog سرور باید رفتار درست داشته باشند.
- chat پشتیبانی خارجی به‌عنوان مسیر Help در این محصول bootstrap نشود؛ Help داخلی قابل دسترسی بماند. خاموش‌کردن همهٔ ابزارهای unrelated یا غیرفعال‌کردن امنیت برای این هدف ممنوع.
- لینک dashboard برای workspace جدید داخلی باشد. مسیر محصولی dashboard موجود را هم بررسی کن: حذف لینک در seed فقط برای نصب جدید کافی نیست. راه‌حل سازگارِ محدود به widget/لینک برنامه‌ساخته ارائه بده؛ متن و URLهای دلخواه مشتری و دادهٔ DB را با جایگزینی عمومی دستکاری نکن. اگر اصلاح دادهٔ موجود واقعاً ضروری شد، طرح id-scoped/product-owned، dry-run، پشتیبان و rollback را بنویس؛ بدون مجوز کاربر روی live اعمال نکن و این ردیف را UNVERIFIED گزارش کن.
- Help غیرموجود یا زبان پشتیبانی‌نشده به سایت خارجی برنگردد؛ fallback درون همان راهنما باشد. همهٔ مسیرهای جدید local navigation و refresh درست داشته باشند.

## مرز کار

- تغییر مجاز: help routing/components، helperها و exports مرتبط، محتوای مشترک، Help tool و wiring لازم، لینک‌های Help برنامه‌ساخته، آزمون‌های مرتبط و این اسناد.
- تغییر عمومی نام/لوگو، social، telemetry، icons، marketplace، providerها و سامانهٔ لایسنس در این تسک انجام نشود؛ یافته‌ها در recovery برای مراحل بعد ثبت شوند.
- هیچ تغییر در role، auth، workspace permissions، شناسهٔ app/metadata، schema مشتری، کلید/متغیر provider و منطق ارسال پیامک انجام نشود.
- دادهٔ واقعی، template مشتری، trash و fixture دیگران دست‌نخورده؛ no hard-delete و no predicate cleanup. این تسک ذاتاً نیازمند ایجاد رکورد CRM نیست.
- اسکرین‌شات، ویدئو و ثبت شواهد تصویری لازم نیست. از متن route/DOM، تست رفتاری و شمارش درخواست استفاده کن.

## پذیرش A–J

| مورد | معیار |
|---|---|
| A | Help از ورودی واقعی UI، صفحهٔ داخلی دارای چهار موضوع واقعی باز کند؛ origin همان برنامه بماند. |
| B | direct URL/reload یک موضوع همان مقاله را باز کند؛ مسیر ناشناخته پیام داخلی و راه برگشت داشته باشد. |
| C | جست‌وجوی فارسی، اصلاح حروف عربی/فارسی، ورودی خالی و بدون نتیجه رفتار مشخص و تست‌شده داشته باشند. |
| D | با انکار تمام network خارجی در آزمون Help، صفحه/مقاله/جست‌وجو کار کنند؛ صفر درخواست خارجیِ Help/asset/chat ثبت شود. برای این تست، سرویس live را قطع نکن. |
| E | فراخوانی مستقیم `search_help_center` عنوان/متن/لینک همان catalog را بدهد؛ HTTP mock فراخوانی صفر، حتی با تنظیمات قدیمی Mintlify. |
| F | لینک‌های Help در UI، خروجی ایمیل آزمایشی، API catalog و dashboard جدید هم‌مبدأ باشند؛ وضعیت dashboard موجود جدا با شواهد گزارش شود. |
| G | bootstrap یا کلیک Support/Help هیچ SDK/chat خارجی را راه نیندازد؛ navigation داخلی جایگزین واقعاً کار کند. |
| H | ورود، جدول، جدید/ویرایش الگو، source variables و preview روی محیط آزمون سالم بمانند؛ ارسال واقعی SMS لازم و مجاز نیست. |
| I | typecheck/build/lint بسته‌های تغییرکرده و تست رفتاری مرتبط موفق؛ source SHA و artifact/ماژول واقعاً سرو‌شده مشخص باشد. |
| J | نتیجهٔ هر ردیف با PASS/FAIL/UNVERIFIED، فرمان و شاهد متنی ثبت شود؛ screenshot شرط نیست. صرف green شدن تست واحد به معنی قبولی زنده نیست. |

## استقرار و گزارش

- در محیط توسعهٔ main/4D طبق runtime واقعی و دسترسی موجود اعتبارسنجی کن. پیش از هر تغییر استقرار، process/port و روش صحیح بارگذاری را تشخیص بده؛ پورت و restart حدس زده نشود.
- تغییر host/server/shared لزوماً با بالا بردن نسخهٔ Communication نصب نمی‌شود. فقط بخش‌های تغییرکرده را با build صحیح خودشان deploy کن؛ صرف tarball اپ کافی نیست. نیازی به افزایش بی‌دلیل نسخهٔ اپ نیست.
- migration یا تغییر سرویس پایدار نیازمند پشتیبان و امکان برگشت است. اگر تست فقط در محیط آزمون انجام شد، production acceptance را ادعا نکن. APPLE/app2 و محیط غیرمجاز دست‌نخورده بمانند.
- کد و مستندات commitهای روشن داشته باشند؛ به شاخهٔ همین تسک push کن، بدون force و بدون merge به شاخهٔ اصلی. Codex پس از بازبینی دربارهٔ ادغام تصمیم می‌گیرد.
- گزارش: Base SHA، Code SHA، docs SHA، شاخه، فایل‌های تغییرکرده و دلیل، route نهایی، موضوع‌ها، نتایج A–J، وضعیت runtime/artifact، موارد باز و تغییر داده/سرویس (حتی اگر صفر) را بده.
- در `docs/recovery/brand-independence.md` نتیجه و شواهد را ثبت کن؛ وضعیت هر ردیف را بدون تعمیم به سایر مراحل بنویس. برای task 1 کل برنامه را PASS نکن.

پایان: `STOP_FOR_ARCHITECT` — منتظر بررسی Codex؛ تسک بعدی شروع نشود.
