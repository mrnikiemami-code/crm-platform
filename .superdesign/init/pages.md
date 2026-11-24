# pages.md — dependency trees

## /page/3eb639f7… — «مالیات و عوارض» (redesign target)

Entry: `src/components/tax-policy-settings-page.front-component.tsx`
Dependencies:
- `src/components/tax-policy-settings-panel.tsx`  ← the whole page
  - `src/components/quotation-api.ts` (`TAX_POLICIES_ROUTE`, `callAppRoute`)
  - `src/domain/money/display-format.ts` (`toPersianDigits`)
  - `src/domain/money/tax-policy.ts` (`formatBasisPointsAsPercent`, `parsePercentToBasisPoints`)
  - `src/domain/quotation/ui-message.ts` (`toPersianUiMessage`)
  - `twenty-sdk/front-component` (`enqueueSnackbar`)

State the page owns: `rows`, `loading`, `busy`, `error`, `editor`, `editorError`,
`rowIssue`, `confirmingDeleteId`. Every list mutation replaces `rows` with the server's
response — there is no optimistic write.

## Settings → Applications → پیش‌فاکتور

Entry: `src/components/tax-policy-settings.front-component.tsx`
Dependencies:
- `src/components/tax-policy-settings-panel.tsx` (identical tree, narrower column)

## /page/20c28688… — «تنظیمات حسابداری» (must not change)

Entry: `src/components/accounting-settings-panel.front-component.tsx`
Dependencies:
- `src/components/accounting-settings-panel.tsx`
  - `src/components/accounting-connection-panel.tsx`
    - `src/components/accounting-connection-form.tsx`
  - `src/components/quotation-api.ts`

## Quotation draft form (must not change)

Entry: `src/components/quotation-draft-form.front-component.tsx`
Dependencies:
- `src/components/quotation-draft-form.tsx`
  - `src/components/money-amount-input.tsx`
  - `src/components/catalog-item-combobox.tsx`
  - `src/components/customer-picker.tsx`
  - `src/domain/money/*` (totals, currency, tax policy selection)
