# components.md — quotation app front components (actual source)

Front components of `packages/twenty-apps/internal/quotation` render inside a Twenty
iframe. They are **not** twenty-front routes: no Linaria, no twenty-ui imports — plain
React with `CSSProperties` objects and inline styles. The iframe does not inherit
twenty-front CSS variables, so tokens from `theme.md` are transcribed literally.

## MoneyAmountInput (`src/components/money-amount-input.tsx`)
Thousand-separated, Persian/ASCII tolerant numeric field with caret preservation.
Key props: `value`, `onChange`, `ariaLabel`, `placeholder`, `readOnly`.

```tsx
import { type CSSProperties, useMemo, useRef } from 'react';

import { toPersianDigits } from 'src/domain/money/display-format';

type MoneyAmountInputProps = {
  value: string;
  onChange?: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  readOnly?: boolean;
};

export const MoneyAmountInput = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  readOnly = false,
}: MoneyAmountInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const display = useMemo(() => toPersianDigits(value), [value]);

  return (
    <input
      ref={inputRef}
      style={styles.input}
      value={display}
      aria-label={ariaLabel}
      placeholder={placeholder}
      readOnly={readOnly}
      inputMode="decimal"
      dir="ltr"
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    />
  );
};

const styles: Record<string, CSSProperties> = {
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #d0d0d0',
    fontSize: 13,
    background: '#fff',
  },
};
```

## Percent field pattern (`src/components/tax-policy-settings-panel.tsx`)
Percent inputs are plain text fields with `inputMode="decimal"`, a Persian placeholder
and an inline `role="alert"` message directly below the field. Persian (`۴٫۵`), ASCII
(`4.5`) and an empty duty field are all accepted.

```tsx
<label style={styles.label}>
  درصد مالیات
  <input
    style={styles.input}
    value={editor.ratePercentText}
    inputMode="decimal"
    aria-invalid={rateDisplayIssue !== null}
    placeholder="۶ یا ۶٫۵ — صفر یعنی بدون مالیات"
    onChange={(event) => updateEditor({ ...editor, ratePercentText: event.target.value })}
  />
  {rateDisplayIssue === null ? null : (
    <span role="alert" style={styles.error}>
      {rateDisplayIssue}
    </span>
  )}
</label>
```

## Badge primitives (same file)
`badge` (neutral), `badgeDefault` (green), `badgeOff` (red) — 11px text, 6px radius,
`2px 8px` padding. Exactly one `badgeDefault` is rendered per catalog.

## Buttons
- `primaryButton`: white on `#1d4ed8`, radius 8, `6px 12px`, 13px.
- `secondaryButton`: white on `#fff`, `1px solid #cbd5e1`, same geometry.
- `linkButton` / `linkButtonNeutral`: borderless 12px text actions.
- `dangerButton`: white on `#b42318`, radius 8, `6px 10px`, 12px.

## CatalogItemCombobox (`src/components/catalog-item-combobox.tsx`)
Searchable product picker with paging. Not part of the tax page; kept for context on
how this app builds list + search affordances.
