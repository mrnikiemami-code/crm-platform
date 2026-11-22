// Persian operator-facing copy for quotation lifecycle / PDF UI responses.
// Server exception messages stay English for logs; this map is what the UI shows.

const MESSAGE_BY_CODE: Record<string, string> = {
  QUOTATION_IMMUTABLE:
    'محتوای این پیش‌فاکتور قفل است. برای تغییر، نسخهٔ جدید صادر کنید.',
  QUOTATION_ALREADY_TERMINAL:
    'این پیش‌فاکتور در وضعیت پایانی است و قابل تغییر نیست.',
  QUOTATION_VERSION_REQUIRED:
    'نسخهٔ پیش‌فاکتور لازم است. صفحه را تازه کنید و دوباره تلاش کنید.',
  QUOTATION_VERSION_CONFLICT:
    'پیش‌فاکتور هم‌زمان تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
  QUOTATION_LINES_FROZEN:
    'ردیف‌های این پیش‌فاکتور قفل هستند. برای تغییر، نسخهٔ جدید صادر کنید.',
  REVISION_IMMUTABLE:
    'نسخهٔ صادرشدهٔ پیش‌فاکتور مهروموم شده و قابل ویرایش، حذف یا بازسازی نیست.',
  TRANSITION_NOT_ALLOWED: 'این تغییر وضعیت مجاز نیست.',
  PERMISSION_MISSING: 'مجوز لازم برای این عملیات را ندارید.',
  QUOTATION_NOT_FOUND: 'پیش‌فاکتور یافت نشد.',
  CUSTOMER_NOT_FOUND: 'مشتری انتخاب‌شده پیدا نشد. یک مشتری واقعی انتخاب کنید.',
  TOTALS_INCONSISTENT:
    'جمع مبالغ سند با ردیف‌ها هم‌خوان نیست؛ صفحه را تازه کنید و دوباره تلاش کنید.',
  DOCUMENT_HAS_NO_LINES: 'حداقل یک ردیف کالا یا خدمت لازم است.',
  LINE_INVALID: 'یکی از ردیف‌های سند کامل نیست.',
  INVALID_EXACT_AMOUNT: 'قالب یکی از مبالغ معتبر نیست.',
  CUSTOMER_INVALID: 'مشتری سند باید دقیقاً یک شخص یا یک شرکت باشد.',
  TAX_POLICY_REQUIRED:
    'برای سند دارای مالیات باید یک سیاست مالیات معتبر انتخاب شود.',
  TAX_POLICY_UNKNOWN:
    'سیاست مالیات انتخاب‌شده در تنظیمات این فضای کاری تعریف نشده است.',
  TAX_POLICY_INACTIVE:
    'این سیاست مالیات غیرفعال است؛ برای پیش‌فاکتور جدید سیاست فعال انتخاب کنید.',
  TAX_POLICY_RATE_MISMATCH:
    'نرخ اعلام‌شده با سیاست مالیات انتخاب‌شده هم‌خوان نیست.',
  TAX_RATE_REQUIRED:
    'نرخ مالیات اعمال‌شده همراه سند اعلام نشده است؛ صفحه را تازه کنید.',
  TAX_RATE_OUT_OF_RANGE: 'درصد مالیات باید بین ۰ و ۱۰۰ باشد.',
  TAX_POLICY_UNAVAILABLE:
    'سیاست‌های مالیات این فضای کاری در دسترس نیست؛ با مدیر سامانه تماس بگیرید.',
  TAX_POLICY_UNREADABLE:
    'نرخ ذخیره‌شدهٔ سیاست مالیات خوانده نشد؛ تنظیمات مالیات را بررسی کنید.',
  TAX_SETTINGS_FORBIDDEN:
    'تغییر تنظیمات مالیات فقط برای مدیر فضای کاری مجاز است.',
  TAX_POLICY_WRITE_FORBIDDEN:
    'سیاست مالیات فقط از صفحهٔ تنظیمات مالیات قابل تغییر است.',
  ACCOUNTING_SETTINGS_FORBIDDEN:
    'تغییر تنظیمات حسابداری فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز انجام می‌شود.',
  ACCOUNTING_CONNECTION_WRITE_FORBIDDEN:
    'اتصال حسابداری فقط از صفحهٔ تنظیمات حسابداری قابل تغییر است.',
  ACCOUNTING_CONNECTION_NOT_FOUND: 'اتصال حسابداری انتخاب‌شده یافت نشد.',
  ACCOUNTING_ADAPTER_UNAVAILABLE:
    'برای این نرم‌افزار آداپتور عملیاتی فعال نیست؛ اتصال آمادهٔ ارسال محسوب نمی‌شود.',
  ACCOUNTING_CURRENCY_UNCONFIRMED:
    'واحد پول تأیید نشده است؛ ارسال سند مالی تا تعیین ریال یا تومان مسدود است.',
  ACCOUNTING_DISPATCH_LOCKED:
    'ارسال سند مالی به مقصد در این نسخه غیرفعال است.',
  PERSISTENCE_FAILED: 'ذخیره پیش‌فاکتور انجام نشد.',
  INVALID_INPUT: 'درخواست نامعتبر است.',
  AUTH_REQUIRED: 'برای این عملیات باید وارد حساب کاربری شوید.',
  CUSTOMER_LINK_STATUS_FORBIDDEN:
    'فقط برای پیش‌فاکتورهای آماده ارسال یا ارسال‌شده می‌توان لینک ساخت.',
  CUSTOMER_LINK_NOT_FOUND: 'لینک مشتری یافت نشد.',
  CUSTOMER_LINK_QUOTATION_MISMATCH: 'این لینک متعلق به این پیش‌فاکتور نیست.',
  CUSTOMER_LINK_CREATE_FAILED: 'صدور لینک مشتری انجام نشد.',
  API_URL_MISSING: 'آدرس عمومی سامانه برای ساخت لینک تنظیم نشده است.',
  DUPLICATE_SHARE: 'این پیش‌فاکتور قبلاً از همین کانال با موفقیت ارسال شده است.',
};

export const persianMessageForQuotationCode = (
  code: string,
  fallback?: string,
): string => MESSAGE_BY_CODE[code] ?? fallback ?? 'عملیات انجام نشد.';

export const extractQuotationErrorCode = (message: string): string | null => {
  const match = /^([A-Z][A-Z0-9_]+):/.exec(message);

  if (match !== null) {
    return match[1];
  }

  if (
    message.includes('QUOTATION_IMMUTABLE') ||
    message.includes('immutable')
  ) {
    return 'QUOTATION_IMMUTABLE';
  }

  if (
    message.includes('VERSION_CONFLICT') ||
    message.includes('concurrently')
  ) {
    return 'QUOTATION_VERSION_CONFLICT';
  }

  if (message.includes('VERSION_REQUIRED')) {
    return 'QUOTATION_VERSION_REQUIRED';
  }

  if (message.includes('PERMISSION_MISSING') || message.includes('requires')) {
    return 'PERMISSION_MISSING';
  }

  if (message.includes('not a legal transition')) {
    return 'TRANSITION_NOT_ALLOWED';
  }

  if (message.includes('terminal')) {
    return 'QUOTATION_ALREADY_TERMINAL';
  }

  return null;
};
