// Every accounting failure becomes one stable code plus one Persian sentence. The code is
// what a log, a test and the sync-operation record store; the sentence is what a person
// reads. Keeping them apart is what lets a vendor's numeric answer (-10, -369, 0) never be
// shown to a user as "خطای 0".
const PERSIAN_MESSAGES: Record<string, string> = {
  INVALID_INPUT: 'اطلاعات ارسالی نامعتبر است.',
  APP_NOT_INSTALLED: 'اپ پیش‌فاکتور روی این فضای کاری نصب نشده است.',
  FORBIDDEN: 'برای این عملیات دسترسی کافی ندارید.',
  QUERY_ERROR: 'خواندن یا نوشتن اطلاعات حسابداری انجام نشد.',

  CONNECTION_NOT_FOUND: 'اتصال حسابداری پیدا نشد.',
  ACCOUNTING_CONNECTION_NOT_FOUND: 'اتصال حسابداری پیدا نشد.',
  ACCOUNTING_DESTINATION_REQUIRED:
    'مقصد پیش‌فرض حسابداری برای این فضای کاری تعیین نشده است؛ ابتدا در تنظیمات حسابداری یک اتصال را به‌عنوان پیش‌فرض انتخاب کنید.',
  ACCOUNTING_CONNECTION_DEFAULT_MUST_BE_ACTIVE:
    'اتصال غیرفعال را نمی‌توان به‌عنوان پیش‌فرض فضای کاری تنظیم کرد.',
  ACCOUNTING_CONNECTION_RETIRED:
    'این اتصال غیرفعال است؛ برای عملیات جدید ابتدا آن را فعال کنید.',
  ACCOUNTING_SETTINGS_FORBIDDEN:
    'تغییر تنظیمات حسابداری برای این کاربر مجاز نیست.',
  CONNECTION_INACTIVE:
    'این اتصال حسابداری غیرفعال است و عملیات جدید نمی‌پذیرد؛ سوابق قبلی خواندنی می‌مانند.',
  CONNECTION_BASE_URL_REQUIRED: 'آدرس سرویس نرم‌افزار حسابداری را وارد کنید.',
  CONNECTION_BASE_URL_INVALID:
    'آدرس سرویس حسابداری معتبر نیست؛ باید با http:// یا https:// شروع شود.',
  CONNECTION_BASE_URL_HAS_CREDENTIALS:
    'نام کاربری یا گذرواژه را داخل آدرس سرویس نگذارید؛ اطلاعات ورود جای امن جداگانه دارد.',
  CONNECTION_REMOTE_USER_INVALID: 'شناسهٔ کاربر نرم‌افزار حسابداری باید عدد صحیح باشد.',
  CONNECTION_STORAGE_INVALID: 'شناسهٔ انبار باید عدد صحیح باشد.',
  ADAPTER_UNKNOWN: 'نوع نرم‌افزار حسابداری انتخاب‌شده پشتیبانی نمی‌شود.',
  ADAPTER_NOT_CONFIGURED: 'تنظیمات این نوع اتصال کامل نیست.',
  ADAPTER_CONTRACT_INCOMPLETE:
    'این اتصال وعدهٔ دریافت صفحه‌به‌صفحه داده است اما امکان خواندن صفحه را ندارد؛ برای جلوگیری از بارگذاری کامل فهرست، عملیات متوقف شد. نوع اتصال را اصلاح یا پشتیبانی صفحه‌بندی را کامل کنید.',

  TRANSPORT_NOT_APPROVED:
    'ارتباط امن این سرویس تأیید نشده است؛ آدرس سرویس یا تونل باید HTTPS باشد.',
  ASAN_FISCAL_READBACK_REQUIRED:
    'شماره سند در آسان مشاهده شد؛ تطبیق مالی سند هنوز لازم است. دوباره ارسال نکنید.',
  ASAN_DOCUMENT_READBACK_REQUIRED:
    'شماره پاسخ آسان نگهداری شد؛ سند باید در حسابداری بررسی شود. دوباره ارسال نکنید.',
  ASAN_LIVE_WRITE_NOT_APPROVED:
    'مسیر فعلی آسان فقط برای خواندن اطلاعات است؛ ثبت یا تغییر اطلاعات مجاز نیست.',
  ASAN_TRANSPORT_UNAVAILABLE:
    'مسیر امن ارتباط با آسان هنوز آماده و تأیید نشده است؛ هیچ اطلاعاتی ارسال نشد.',
  ACCOUNTING_DATASET_REBIND_REQUIRED:
    'این اتصال دارای سوابق است؛ برای تغییر مقصد یا واحد پول، اتصال جدید ایجاد کنید.',
  ACCOUNTING_CONNECTION_CHANGED:
    'تنظیمات اتصال هنگام آزمایش تغییر کرد؛ آزمایش را دوباره انجام دهید.',
  MONEY_UNIT_UNCONFIRMED:
    'واحد پول نرم‌افزار حسابداری (ریال یا تومان) تأیید نشده است؛ انتقال مبلغ تا تأیید آن ممنوع است.',
  CREDENTIALS_NOT_CONFIGURED:
    'اطلاعات ورود این اتصال در متغیرهای امن فضای کاری تنظیم نشده است.',
  CREDENTIALS_REJECTED: 'اطلاعات ورود توسط نرم‌افزار حسابداری رد شد.',

  TRANSPORT_ERROR: 'ارتباط با نرم‌افزار حسابداری برقرار نشد.',
  TIMEOUT: 'نرم‌افزار حسابداری در زمان مجاز پاسخ نداد.',
  INVALID_RESPONSE:
    'پاسخ نرم‌افزار حسابداری قابل خواندن نبود؛ ممکن است آدرس یا نسخهٔ سرویس اشتباه باشد.',
  // A destination that answers its whole list in one response can hand over more than this
  // process may hold. This is an explicit refusal, not a silent truncation: a list that shows
  // "the first 100 000" of a million customers must never look like the whole customer book.
  REMOTE_DATASET_TOO_LARGE:
    'فهرست نرم‌افزار حسابداری از سقف قابل نگهداری بزرگ‌تر است و برای جلوگیری از بارگذاری نامحدود در حافظه بارگذاری نشد؛ دامنهٔ دریافت را محدود کنید یا از سرویس صفحه‌بندی‌شده استفاده کنید.',
  VENDOR_REFUSED: 'نرم‌افزار حسابداری این عملیات را نپذیرفت.',
  VENDOR_UNDOCUMENTED:
    'نرم‌افزار حسابداری کدی برگرداند که در مستندات آن تعریف نشده است؛ نتیجه نامشخص است.',

  OUTBOUND_DISABLED:
    'ارسال اطلاعات از CRM به حسابداری در تنظیمات فضای کاری خاموش است.',
  DOCUMENT_EXPORT_DISABLED:
    'ثبت سند در حسابداری بدون مجوز جداگانه فعال نشده است؛ هیچ سندی ارسال نشد.',
  DUPLICATE_OPERATION:
    'این عملیات قبلاً ثبت شده است؛ برای جلوگیری از تکرار، دوباره ارسال نمی‌شود.',
  OPERATION_IN_PROGRESS: 'این عملیات در حال ارسال است؛ تا پایان آن دوباره تلاش نکنید.',
  ALREADY_SUCCEEDED: 'این عملیات قبلاً با موفقیت انجام شده است.',
  RECONCILIATION_REQUIRED:
    'نتیجهٔ ارسال قبلی نامشخص است؛ پیش از تلاش دوباره باید در نرم‌افزار حسابداری بررسی شود.',
  RETRY_NOT_ALLOWED: 'این عملیات قابل تلاش دوباره نیست.',
  CONFLICT_REMOTE_CHANGED:
    'رکورد در نرم‌افزار حسابداری پس از آخرین همگام‌سازی تغییر کرده است؛ ابتدا تعارض را بررسی کنید.',
  TARGET_NOT_LINKED:
    'رکورد مقابل این آیتم در نرم‌افزار حسابداری وجود ندارد؛ ابتدا آن را متصل کنید.',
  FIELD_SCOPE_EXCLUDES_FIELDS:
    'این نرم‌افزار تنها اجازهٔ تغییر قیمت را می‌دهد؛ نام یا مشخصات دیگر را باید دستی در حسابداری تغییر دهید.',
  CAPABILITY_MISSING: 'نرم‌افزار حسابداری این قابلیت را ندارد؛ خروجی دستی لازم است.',
  MANUAL_EXPORT_REQUIRED: 'این مورد باید به‌صورت دستی در حسابداری ثبت شود.',

  QUOTATION_NOT_FOUND: 'پیش‌فاکتور پیدا نشد.',
  ITEM_NOT_FOUND: 'کالا یا خدمت انتخاب‌شده پیدا نشد.',
  PRICE_NOT_SET: 'برای این کالا قیمتی ثبت نشده است؛ بدون قیمت چیزی ارسال نمی‌شود.',
  QUOTATION_NOT_APPROVED:
    'فقط پیش‌فاکتور تأییدشده قابل ثبت در حسابداری است؛ پیش‌نویس هرگز ارسال نمی‌شود.',
  REVISION_NOT_FOUND:
    'نسخهٔ صادرشدهٔ این پیش‌فاکتور پیدا نشد؛ ثبت سند به نسخهٔ تأییدشده نیاز دارد.',
  REVISION_MISMATCH:
    'نسخهٔ پیش‌فاکتور با نسخهٔ تأییدشده هم‌خوان نیست؛ ابتدا وضعیت را بررسی کنید.',
  CURRENCY_NOT_IRR: 'انتقال سند فقط برای مبالغ ریالی مجاز است.',
  CURRENCY_UNSUPPORTED:
    'قرارداد ارزی این نرم‌افزار حسابداری مشخص نیست؛ برای جلوگیری از ثبت مبلغ در واحد اشتباه، سند ارسال نمی‌شود.',
  CURRENCY_BASE_UNCONFIRMED:
    'ارز پایهٔ این مقصد تأیید نشده است؛ ابتدا ارز پایه و واحد مبلغ را در تنظیمات اتصال مشخص کنید.',
  CURRENCY_BASE_INVALID: 'ارز پایه باید یک کد سه‌حرفی مانند IRR باشد.',
  CURRENCY_CODE_MAPPING_REQUIRED:
    'کد ارز این سند در مقصد تعریف نشده است؛ در تنظیمات اتصال، ارز CRM را به کد همان نرم‌افزار حسابداری نگاشت کنید.',
  CURRENCY_NAME_MAPPING_REQUIRED:
    'نام ارز این سند در مقصد تعریف نشده است؛ در تنظیمات اتصال، نام ارز مورد انتظار نرم‌افزار حسابداری را وارد کنید.',
  CURRENCY_CODE_INVALID: 'کد ارز یا مقدار نگاشت ارز معتبر نیست؛ کد سه‌حرفی مانند IRR وارد کنید.',
  CURRENCY_RATE_REQUIRED:
    'برای تبدیل این ارز، نرخ تبدیل معتبر در تنظیمات اتصال لازم است؛ بدون نرخ تأییدشده سندی ارسال نمی‌شود.',
  CURRENCY_RATE_INVALID:
    'نرخ تبدیل باید عددی مثبت و دقیق با حداکثر شش رقم اعشار باشد؛ نرخ گردشده پذیرفته نمی‌شود.',
  TAX_UNSUPPORTED:
    'قرارداد فعلی این نرم‌افزار حسابداری امکان ثبت مالیات را ندارد؛ سند مشمول مالیات به‌جای ارسال بدون مالیات متوقف شد.',
  MOCK_PROFILE_NOT_ALLOWED: 'حالت آزمایشی فقط برای اتصال آزمایشی قابل انتخاب است.',
  MOCK_PROFILE_UNKNOWN: 'حالت آزمایشی انتخاب‌شده وجود ندارد.',
  LINE_HAS_NO_PRODUCT_LINK:
    'یک یا چند ردیف پیش‌فاکتور به کالای حسابداری متصل نیستند.',
  CUSTOMER_NOT_LINKED:
    'مشتری این پیش‌فاکتور در نرم‌افزار حسابداری شناسه ندارد.',
  SPECIAL_CODE_NOT_CONFIGURED:
    'برای ثبت تخفیف یا مالیات، کدهای ویژهٔ نرم‌افزار حسابداری باید تنظیم شوند.',

  AMOUNT_NOT_A_DECIMAL: 'مبلغ ذخیره‌شده قابل تبدیل به عدد صحیح نیست.',
  AMOUNT_NOT_WHOLE_UNIT:
    'مبلغ رقمی اعشاری دارد و بدون گرد کردن قابل ارسال نیست؛ گرد کردن مبلغ مجاز نیست.',
  AMOUNT_OUT_OF_RANGE: 'مبلغ از محدودهٔ قابل انتقال دقیق خارج است.',
  QUANTITY_OUT_OF_RANGE: 'مقدار از محدودهٔ قابل انتقال دقیق خارج است.',

  ASAN_CUSTOMER_NAME_MISSING: 'نام مشتری برای ثبت در حسابداری لازم است.',
  ASAN_CUSTOMER_NAME_TOO_LONG: 'نام مشتری از حد مجاز نرم‌افزار حسابداری بلندتر است.',
  ASAN_UPDATE_NEEDS_PERSON_CODE:
    'برای ویرایش مشتری، کد حسابداری موجود آن لازم است.',
  ASAN_PERSON_CODE_TOO_SMALL:
    'کد مشتری کمتر از حد مجاز نرم‌افزار حسابداری است.',
  ASAN_PRODUCT_CODE_INVALID: 'کد کالا برای ثبت در حسابداری معتبر نیست.',
  ASAN_PRODUCT_NAME_MISSING: 'نام کالا برای ثبت در حسابداری لازم است.',
  ASAN_SELL_PRICE_INVALID: 'قیمت فروش باید عددی مثبت به واحد کامل باشد.',

  UNEXPECTED: 'خطای پیش‌بینی‌نشده در همگام‌سازی حسابداری رخ داد.',
};

export const persianAccountingMessage = (code: string | null | undefined): string => {
  if (typeof code === 'string' && code in PERSIAN_MESSAGES) {
    return PERSIAN_MESSAGES[code];
  }

  return PERSIAN_MESSAGES.UNEXPECTED;
};

export const toPersianAccountingMessage = (
  code: unknown,
  fallback: string,
): string => {
  if (typeof code === 'string' && code.trim() !== '' && code in PERSIAN_MESSAGES) {
    return PERSIAN_MESSAGES[code];
  }

  return fallback;
};

// Short labels for the connection panel's status rows, separate from failure sentences.
export const accountingSyncStateLabel = (state: string): string => {
  switch (state) {
    case 'PENDING':
      return 'در انتظار';
    case 'IN_FLIGHT':
      return 'در حال ارسال';
    case 'SUCCEEDED':
      return 'موفق';
    case 'FAILED_RETRYABLE':
      return 'خطای قابل تکرار';
    case 'FAILED_FINAL':
      return 'خطای قطعی';
    case 'MANUAL_EXPORT_REQUIRED':
      return 'نیازمند اقدام دستی';
    case 'CANCELLED':
      return 'لغو شده';
    default:
      return state;
  }
};
