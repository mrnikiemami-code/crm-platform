# theme.md — Twenty design tokens (transcribed for the iframe)

Part 1 is the digest to pass as context. Part 2 is the raw source.

## Part 1 — token summary (light theme, `display-p3`)

| Role | Token | Value |
|---|---|---|
| Page background | `background.primary` | `#ffffff` |
| Subtle surface | `background.secondary` | `#fcfcfc` |
| Row / hover surface | `background.tertiary` | `#f1f1f1` |
| Border strong | `border.color.strong` | `#d6d6d6` |
| Border medium | `border.color.medium` | `#ebebeb` |
| Border light | `border.color.light` | `#f1f1f1` |
| Primary text | `font.color.primary` | `#333333` |
| Secondary text | `font.color.secondary` | `#666666` |
| Tertiary text | `font.color.tertiary` | `#999999` |
| Accent (primary blue) | `accent.accent9` | `#3b5bdb`-ish P3 blue; hex `#4c6ef5` |
| Accent text on light | `accent.accent11` | `#2b3a8f` |
| Success bg | `background.transparent.success` | `#00a43319` |
| Success text | `snackBar.success.color` | `#4ca298` |
| Danger bg | `background.transparent.danger` | `#f3000d14` |
| Danger text | `color.red` | `#d3453f` |
| Radius sm | `border.radius.sm` | `4px` |
| Radius md | `border.radius.md` | `8px` |
| Radius lg | `border.radius.lg` | `16px` |
| Radius pill | `border.radius.pill` | `999px` |
| Shadow light | `boxShadow.light` | `0 2px 4px rgba(0,0,0,.04), 0 0 4px rgba(0,0,0,.08)` |
| Shadow strong | `boxShadow.strong` | `2px 4px 16px rgba(0,0,0,.16), 0 2px 4px rgba(0,0,0,.08)` |

Spacing follows a 4px multiplicator (`spacingMultiplicator: 4`), so use 4 / 8 / 12 /
16 / 20 / 24. Type scale used across Twenty's settings surfaces: 20px semibold title,
13px body, 12px secondary, 11px caption. Buttons are 32px tall with 8px radius; inputs
are 32px tall with 4px radius. Table rows are 32-40px tall with a 1px divider and no
card per row. `--t-font-family` (Inter + Vazirmatn fallback for Persian) is the
inherited family and must stay `inherit`/`var(--t-font-family)`.

## Part 2 — raw source

### `packages/twenty-ui/src/theme/constants/ThemeLight.ts` (excerpt)

```ts
export const THEME_LIGHT = {
  text: { lineHeight: { lg: 1.5, md: 1.1 } },
  spacingMultiplicator: 4,
  spacing: themeSpacing,
  betweenSiblingsGap: '2px',
  table: {
    horizontalCellMargin: '8px',
    checkboxColumnWidth: '32px',
    horizontalCellPadding: '8px',
  },
  clickableElementBackgroundTransition: 'background 0.1s ease',
  buttons: { secondaryTextColor: 'color(display-p3 0.63 0.69 1)' },
  accent: {
    accent1: 'color(display-p3 0.992 0.992 0.996)',
    accent2: 'color(display-p3 0.971 0.977 0.998)',
    accent3: 'color(display-p3 0.933 0.948 0.992)',
    accent4: 'color(display-p3 0.885 0.914 1)',
    accent5: 'color(display-p3 0.831 0.87 1)',
    accent6: 'color(display-p3 0.767 0.814 0.995)',
    accent9: 'color(display-p3 0.569 0.639 0.916)',
    accent11: 'color(display-p3 0.133 0.175 0.348)',
    accent12: 'color(display-p3 0.133 0.175 0.348)',
  },
  background: {
    primary: 'color(display-p3 1 1 1)',
    secondary: 'color(display-p3 0.988 0.988 0.988)',
    tertiary: 'color(display-p3 0.945 0.945 0.945)',
    quaternary: 'color(display-p3 0.922 0.922 0.922)',
    danger: 'color(display-p3 0.985 0.925 0.925)',
    transparent: {
      strong: 'color(display-p3 0 0 0 / 0.161)',
      medium: 'color(display-p3 0 0 0 / 0.078)',
      light: 'color(display-p3 0 0 0 / 0.039)',
      danger: '#f3000d14',
      blue: '#0047f112',
      orange: '#ff9c0029',
      success: '#00a43319',
    },
  },
  border: {
    color: {
      strong: 'color(display-p3 0.839 0.839 0.839)',
      medium: 'color(display-p3 0.922 0.922 0.922)',
      light: 'color(display-p3 0.945 0.945 0.945)',
      danger: 'color(display-p3 0.984 0.812 0.811)',
      blue: 'color(display-p3 0.685 0.74 0.957)',
    },
    radius: {
      xs: '2px', sm: '4px', md: '8px', lg: '16px', xl: '20px',
      xxl: '40px', pill: '999px', rounded: '100%',
    },
  },
  boxShadow: {
    light:
      '0px 2px 4px 0px color(display-p3 0 0 0 / 0.039), 0px 0px 4px 0px color(display-p3 0 0 0 / 0.078)',
    strong:
      '2px 4px 16px 0px color(display-p3 0 0 0 / 0.161), 0px 2px 4px 0px color(display-p3 0 0 0 / 0.078)',
  },
  font: {
    color: {
      primary: 'color(display-p3 0.2 0.2 0.2)',
      secondary: 'color(display-p3 0.4 0.4 0.4)',
    },
  },
  snackBar: { success: { color: 'color(display-p3 0.297 0.637 0.581)', backgroundColor: '#00a43319' } },
  color: { red: 'color(display-p3 0.83 0.329 0.324)' },
};
```

### Panel-local palette currently in use (`tax-policy-settings-panel.tsx`)

`#1a1a1a` text, `#666` hint, `#e2e8f0` border, `#f8fafc` row, `#f1f5f9` inactive row,
`#cbd5e1` dashed border, `#1d4ed8` rate, `#475569` caption, `#e2e8f0` badge bg,
`#dcfce7`/`#14532d` default badge, `#fee2e2`/`#7f1d1d` inactive badge, `#b42318`
danger.
