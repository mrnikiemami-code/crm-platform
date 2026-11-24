# extractable-components.md — reusable Superdesign DraftComponents

## TaxPolicyRow
- Source: `src/components/tax-policy-settings-panel.tsx`
- Category: basic
- Description: one catalog row — name, total %, tax/duty split, default & usage badges,
  legal actions
- Extractable props: `name`, `taxPercent`, `dutyPercent`, `totalPercent`, `isDefault`,
  `isActive`, `quotationCount`, `isConfirmingDelete`
- Hardcoded: badge labels «پیش‌فرض» / «غیرفعال» / «در N سند», action labels, all CSS

## TaxPolicyEditor
- Source: same file
- Category: basic
- Description: create/edit form — name, tax %, duty %, computed total, save & cancel
- Extractable props: `mode` (`create` | `edit`), `initialName`, `initialTax`,
  `initialDuty`, `saving`, `fieldErrors`
- Hardcoded: labels «نام سیاست» / «درصد مالیات» / «درصد عوارض» / «جمع», placeholders

## PanelHeader
- Source: same file
- Category: layout
- Description: title «مالیات و عوارض» with one short explanatory line and the primary
  «افزودن سیاست مالیات» action
- Extractable props: `title`, `subtitle`, `onAdd`
- Hardcoded: typography, spacing

## StatusBadge
- Source: same file
- Category: basic
- Description: pill used for default / inactive / usage
- Extractable props: `tone` (`success` | `neutral` | `danger`), `label`
- Hardcoded: colors, radius, padding
