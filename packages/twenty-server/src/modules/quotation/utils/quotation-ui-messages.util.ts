// Persian operator-facing copy for quotation lifecycle / PDF UI responses.
// Server exception messages stay English for logs; this map is what the UI shows.

const MESSAGE_BY_CODE: Record<string, string> = {
  QUOTATION_IMMUTABLE:
    'محتوای این پیش‌فاکتور قفل است. برای تغییر، نسخهٔ جدید صادر کنید.',
  QUOTATION_ALREADY_TERMINAL: 'این پیش‌فاکتور در وضعیت پایانی است و قابل تغییر نیست.',
  QUOTATION_VERSION_REQUIRED:
    'نسخهٔ پیش‌فاکتور لازم است. صفحه را تازه کنید و دوباره تلاش کنید.',
  QUOTATION_VERSION_CONFLICT:
    'پیش‌فاکتور هم‌زمان تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
  QUOTATION_LINES_FROZEN:
    'ردیف‌های این پیش‌فاکتور قفل هستند. برای تغییر، نسخهٔ جدید صادر کنید.',
  TRANSITION_NOT_ALLOWED: 'این تغییر وضعیت مجاز نیست.',
  PERMISSION_MISSING: 'مجوز لازم برای این عملیات را ندارید.',
  QUOTATION_NOT_FOUND: 'پیش‌فاکتور یافت نشد.',
  INVALID_INPUT: 'درخواست نامعتبر است.',
  AUTH_REQUIRED: 'برای این عملیات باید وارد حساب کاربری شوید.',
  CUSTOMER_LINK_STATUS_FORBIDDEN:
    'فقط برای پیش‌فاکتورهای آماده ارسال یا ارسال‌شده می‌توان لینک ساخت.',
  CUSTOMER_LINK_NOT_FOUND: 'لینک مشتری یافت نشد.',
  CUSTOMER_LINK_QUOTATION_MISMATCH: 'این لینک متعلق به این پیش‌فاکتور نیست.',
  CUSTOMER_LINK_CREATE_FAILED: 'صدور لینک مشتری انجام نشد.',
  API_URL_MISSING: 'آدرس عمومی سامانه برای ساخت لینک تنظیم نشده است.',
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

  if (message.includes('QUOTATION_IMMUTABLE') || message.includes('immutable')) {
    return 'QUOTATION_IMMUTABLE';
  }

  if (message.includes('VERSION_CONFLICT') || message.includes('concurrently')) {
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
