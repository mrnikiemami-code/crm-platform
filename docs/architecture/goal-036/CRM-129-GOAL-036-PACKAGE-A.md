# CRM-129-GOAL-036 — Package A evidence

**Status:** TECHNICALLY_VERIFIED (not USER_ACCEPTED)  
**App:** `quotation@0.1.66` on Dev `:3002`  
**Page:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d  
**Parent:** Goal 023 ACTIVE

## Initial issue

DE-035 (`0.1.65`) made tax/rounding register rows global click targets (`role="button"` + `onClick` → edit). Opening the ⋯ menu could fire the parent edit path. Operator-facing copy still exposed internal design language (`ساختار ثبت با ریل زمینه`, `فاز ۱`, `bootstrap`, `۰٫۰۰۱` future currencies).

## Root cause

Row-as-control conflicted with nested independent controls (Edit / RowMenu). Microcopy was transferred from design notes instead of operator vocabulary.

## Domain owner

Financial settings UI composers (`TaxPolicySettingsPanel` + currency/rounding sections). Money Domain / Nest authority unchanged.

## Changes

| File | Change |
| --- | --- |
| `financial-settings/tax-ledger.tsx` | Non-interactive rows; dedicated Edit; clearer delete guards |
| `financial-settings/rounding-list.tsx` | Same isolation pattern + operator copy |
| `financial-settings/row-menu.tsx` | `stopPropagation` on root/trigger; mobile 44px hit target |
| `financial-settings/currency-hero.tsx` | Remove phase/bootstrap jargon |
| `financial-settings/settings-shell.tsx` | Wider content (`1080px`); denser stats |
| `tax-policy-settings-panel.tsx` | Subtitle/help/lock microcopy cleanup |
| `tax-policy-settings-panel.test.tsx` | Edit-button flow + more-menu isolation regression |
| `package.json` | `0.1.65` → `0.1.66` |

## Contracts preserved

- C1–C7 / F7 ownership not redefined here
- No Money Domain / schema / Nest mutation
- Host `SettingsDialog` + destructive confirm unchanged
- IRR-only; no multi-currency activation

## Tests

| Suite | Result |
| --- | --- |
| `npx vitest run src/components/__tests__/tax-policy-settings-panel.test.tsx` | **32 PASS** (includes more-menu isolation) |

## Browser (real Dev)

| Check | Result |
| --- | --- |
| Dedicated `ویرایش — …` controls present | PASS |
| Click policy name → no dialog | PASS |
| Open ⋯ menu → menu only, no dialog | PASS (a11y + CDP) |
| Click Edit → dialog opens | PASS (`[role=dialog]=1`, `#tax-policy-name` present) |
| Subtitle without «ریل زمینه» | PASS |
| Help note operator language | PASS |

Screenshot: `docs/architecture/goal-036/pkg-a-tax-menu-isolation.png`

## Deploy

```
npx twenty dev:build
node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force
```

Plan: `0 add / 2 change / 0 destroy` (frontComponent checksums).

## Remaining (out of Package A)

- WS5 ownership / mapping catalog pickers
- WS6 Mock/Asan shared capability UI
- WS7-B integrated path polish
- Full responsive matrix widths formally logged in Package E
