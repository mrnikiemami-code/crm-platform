// What the operator reads must be Persian and actionable. Route handlers already
// translate their own codes, but a transport error, a GraphQL message, or a
// provider stack can still reach the panel; those go to the console, not a toast.

const PERSIAN_TEXT = /[\u0600-\u06FF]/;
// Server exceptions keep `CODE: detail` so logs stay greppable; the operator
// must not read that prefix in a toast.
const MACHINE_CODE_PREFIX = /^[A-Z][A-Z0-9_]+:\s*/;

export const toPersianUiMessage = (
  message: unknown,
  fallback: string,
): string => {
  if (typeof message !== 'string') {
    return fallback;
  }

  const trimmed = message.trim();

  if (trimmed === '' || !PERSIAN_TEXT.test(trimmed)) {
    // A raw transport/GraphQL/provider message is evidence for whoever debugs the
    // failure, never something to show an operator. Keep it in the log only.
    if (trimmed !== '') {
      console.error('[quotation] non-localized message', trimmed);
    }

    return fallback;
  }

  const withoutCode = trimmed.replace(MACHINE_CODE_PREFIX, '').trim();

  return withoutCode === '' ? fallback : withoutCode;
};

const PERMISSION_LABELS: Record<string, string> = {
  'quotation.edit': 'ویرایش پیش‌فاکتور',
  'quotation.submitForApproval': 'ارسال برای تأیید',
  'quotation.approve': 'تأیید پیش‌فاکتور',
  'quotation.send': 'ارسال به مشتری',
  'quotation.recordCustomerDecision': 'ثبت تصمیم مشتری',
  'quotation.cancel': 'لغو پیش‌فاکتور',
  'quotation.convertToInvoice': 'تبدیل به سند حسابداری',
  'quotation.expire': 'منقضی کردن',
};

export const permissionLabel = (permission: string): string =>
  PERMISSION_LABELS[permission] ?? 'عملیات مدیریتی';
