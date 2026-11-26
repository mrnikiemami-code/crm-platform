# TRANSFER-MAP — انتقال مؤلفه‌ها به host

منبع طراحی: `preview/index.html` + `DESIGN.md`
مقصد: `packages/twenty-apps/internal/quotation/src/components/**`

همه مؤلفه‌ها named export هستند، React تابعی خالص (TypeScript)، بدون Tailwind/Next،
رنگ‌ها فقط با `var(--t-color-*, fallback)` — بدون مقدار baked شده.

## ۱. فایل‌های جدید (transfer/components → مقصد)

| فایل مبدأ | مقصد | نقش |
|---|---|---|
| `SettingsShell.tsx` | `financial-settings/SettingsShell.tsx` | اسکلیوت تنظیمات: هدر + زبانه‌ها + ریل بافتاری (آمار، اکشن‌ها، فیلترها، راهنما) + اسلات محتوا. `dir="rtl"` ذاتی. زبانه‌ها keyboard arrow navigation دارند. |
| `TaxLedger.tsx` | `financial-settings/tax/TaxLedger.tsx` | رجیستر مالیات: سطرهای «سیاست/نرخ‌ها/حسابداری»، وضعیت‌ها، empty/skeleton/error، منوی سطری. فیلترها در shell؛ ردیف‌های نمایش‌داده‌شده را والد می‌دهد. |
| `CurrencyHero.tsx` | `financial-settings/currency/CurrencyHero.tsx` | داشبورد تک‌رکورده «ریال»: آکادنت بزرگ، شناسه‌ها، کد حسابداری + ویرایش، note فاز ۱، ردیف «ارز بعدی» خاکستری، empty/loading/error. |
| `RoundingList.tsx` | `financial-settings/rounding/RoundingList.tsx` | نردبان پله‌ها: سطرهای شماره‌دار، پیش‌فرض با marker فیروزه‌ای، empty/skeleton/error، منوی سطری. |
| `RecordDialog.tsx` | `financial-settings/shared/RecordDialog.tsx` | دیالوگ استاندارد CRUD: فیلدهای اعلامی (text/number/switch)، اعتبارسنجی درون‌خطی، خلاصه زنده (slot)، focus trap، Escape، dirty-guard با پنل «رها کردن»، حالت busy. |
| `RowMenu.tsx` | `financial-settings/shared/RowMenu.tsx` | منوی نقطه‌چین anchor-relative: flip نزدیک لبه، outside click، Escape، Arrow navigation، itemهای غیرفعال با `disabledReason` به‌صورت یادداشت. |

`index.ts` barrel اختیاری است؛ host طبق الگوی موجود import مستقیم می‌کند.

## ۲. تارگت‌های موجود (تغییر / جایگزینی)

| تارگت host | تغییر |
|---|---|
| `financial-settings/tax-policy-settings-panel.tsx` | به **composer** تبدیل می‌شود: state (loading/error/filter/dialog) را نگه می‌دارد، fetch/mutation از `quotation-api` می‌آید، خروجی `<SettingsShell>` + `<TaxLedger>` + `<RecordDialog>` است. JSX جدولی/سیاه‌کتی قدیمی حذف می‌شود. |
| `financial-settings/quotation-currency-settings-section.tsx` | به **composer** تبدیل می‌شود: `<SettingsShell>` (ریل = به‌روزرسانی + راهنما) + `<CurrencyHero>` + `<RecordDialog>` برای ویرایش کد حسابداری. |
| `financial-settings/rounding-rule-settings-section.tsx` | به **composer** تبدیل می‌شود: `<SettingsShell>` + `<RoundingList>` + `<RecordDialog>`. |
| `financial-settings/shared/settings-dialog.tsx` | حذف نمی‌شود؛ **جایگزین** از نظر UX = `RecordDialog`. اگر جای دیگری استفاده می‌شود، دست نزنید — فقط مصرف مالی را روی RecordDialog ببرید. |
| `financial-settings/shared/row-actions-menu.tsx` | همین‌طور: مصرف مالی (TaxLedger/RoundingList) به `RowMenu` می‌رود؛ فایل میزبان دست‌نخورده بماند مگر فقط همین‌جا مصرف شود. |
| `financial-settings/shared/run-destructive-confirm.tsx` | **بدون تغییر** — حذف سیاست/قاعده از طریق همین (با `ConfirmationDialog` داخلی) انجام می‌شود. مؤلفه‌های transfer فقط `onDelete` را emit می‌کنند؛ فراخوانی confirm در والد می‌ماند. |

## ۳. یکپارچه‌سی (والد‌ها)

```text
tax-policy-settings-panel.tsx
  ├─ fetch: quotationApi.getTaxPolicies / upsert / remove / makeDefault
  ├─ filter: 'all' | 'active' | 'default'   ← ریل SettingsShell
  ├─ <SettingsShell stats=[تعداد، پیش‌فرض، میانگین مجموع نرخ]>
  │    └─ <TaxLedger rows={filtered} onEdit={openDialog} onDelete={confirmDelete} …>
  ├─ <RecordDialog fields={code,name,tax,duty,accounting,active}>
  │    ├─ validation: نام، code (regex)، نرخ‌ها ≥ 0 و ≤ 100
  │    ├─ accountingCode locked (disabled + rd-lock hint) وقتی quotationCount > 0
  │    └─ live summary: مجموع مالیات+عوارض
  └─ delete → run-destructive-confirm (نه دیالوگ transfer)
```

- **Back button** (`onBack`) والد = `useNavigate` به تنظیمات قبلی.
- **Dirty-guard** داخل `RecordDialog` است؛ والد فقط `dirty` و `onClose` می‌دهد.
- **Snackbar** موفقیت با `enqueueSnackbar` والد، بعد از resolve شدن mutation.
- **Retry** = صدا زدن دوباره‌ی همان query/mutation والد (`onRetry` prop).

## ۴. قراردادهای دامنه (دست‌نخورده)

| قرارداد | محل اجرا |
|---|---|
| مالیات و عوارض مستقل | فیلدهای جدا در RecordDialog؛ summary زنده فقط نمایش است |
| code بعد از snapshot قفل (`used > 0`) | `field.disabled` + hint قفل نارنجی |
| حذف default/used ممنوع | `RowMenu` disabled + `disabledReason`؛ والد هم در سمت سرور guard دارد |
| IRR-only فاز ۱، بدون دکمه bootstrap | `CurrencyHero` خودکار + note؛ هیچ دکمه «ساخت ارز» ندارد |
| step مثبت صحیح ریال؛ 0.001 فقط آینده non-IRR | validation در والد؛ hint در RecordDialog |
| RTL / Persian digits / Twenty tokens | داخل خود مؤلفه‌ها (`dir="rtl"`، `faDigits`، `var(--t-color-*)`) |

## ۵. چک‌لیست انتقال

1. کپی ۶ فایل به مقصد بالا؛ نام فایل‌ها را حفظ کنید.
2. composerهای سه‌بخشی را بازنویسی کنید (state/host protocols دست‌نخورده).
3. تأیید: `npm run lint` و `npm run typecheck` (یا معادل داخل host).
4. دستی: RTL، Escape در دیالوگ و منو، flip منو، dirty-guard، skeleton/error/empty.
5. تصویری از هر سه زبانه در ۱۲۸۰ و ۳۹۰؛ تضاد با 033/034 (بدون جدول سراسری، بدون CTA سیاه سراسری، بدون کارت‌های هم‌شکل).
