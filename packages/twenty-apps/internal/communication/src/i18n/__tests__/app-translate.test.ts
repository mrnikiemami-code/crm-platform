import { describe, expect, it, vi } from 'vitest';

import { isPersianLocale, translateAppMessage } from 'src/i18n/app-translate';

// The composer's real translation module: Persian resolves against the
// app-owned `locales/fa-IR.json` (inlined at build time), every other locale
// defers to the SDK's `t`. No SDK globals are touched and no resolver is
// reimplemented — this is the exact function the composer calls.
describe('translateAppMessage (app-owned Persian catalog)', () => {
  const unusedSdkTranslate = (message: string) => `sdk:${message}`;

  it('resolves real Persian keys from the shipped catalog', () => {
    const translate = (message: string) =>
      translateAppMessage({
        locale: 'fa-IR',
        message,
        sdkTranslate: unusedSdkTranslate,
      });

    expect(translate('Send')).toBe('ارسال');
    expect(translate('Phone number')).toBe('شماره تلفن');
    expect(translate('Channel')).toBe('کانال');
    expect(translate('Message')).toBe('متن پیام');
    expect(translate('Cancel')).toBe('انصراف');
    expect(translate('Unable to load phone numbers.')).toBe(
      'دریافت شماره‌ها ناموفق بود.',
    );
    expect(translate('No phone number is recorded for this person.')).toBe(
      'شماره‌ای برای این شخص ثبت نشده است.',
    );
  });

  it('treats the bare `fa` locale as Persian too', () => {
    expect(
      translateAppMessage({
        locale: 'fa',
        message: 'Send',
        sdkTranslate: unusedSdkTranslate,
      }),
    ).toBe('ارسال');
  });

  it('falls back to the source string for a key missing from the catalog', () => {
    expect(
      translateAppMessage({
        locale: 'fa-IR',
        message: 'A key that was never translated',
        sdkTranslate: unusedSdkTranslate,
      }),
    ).toBe('A key that was never translated');
  });

  it('does not call the SDK translate for Persian', () => {
    const sdkTranslate = vi.fn((message: string) => `sdk:${message}`);

    translateAppMessage({ locale: 'fa-IR', message: 'Send', sdkTranslate });

    expect(sdkTranslate).not.toHaveBeenCalled();
  });

  it('defers to the SDK translate for English and other locales', () => {
    for (const locale of ['en', 'en-US', 'de-DE', 'ar-SA']) {
      expect(
        translateAppMessage({
          locale,
          message: 'Send',
          sdkTranslate: unusedSdkTranslate,
        }),
      ).toBe('sdk:Send');
    }
  });

  it('only treats fa / fa-* as Persian', () => {
    expect(isPersianLocale('fa')).toBe(true);
    expect(isPersianLocale('fa-IR')).toBe(true);
    expect(isPersianLocale('FA-ir')).toBe(true);
    expect(isPersianLocale('en')).toBe(false);
    expect(isPersianLocale('ar-SA')).toBe(false);
    // A lookalike prefix must not be mistaken for Persian.
    expect(isPersianLocale('farsi')).toBe(false);
  });
});
