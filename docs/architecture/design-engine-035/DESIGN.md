# DESIGN.md — تنظیمات مالی Twenty (CRM-129)

Design source of truth: `preview/index.html`. This document records the information
architecture, the reasoning behind it, and how it maps onto React files for transfer
into `packages/twenty-apps/internal/quotation`.

---

## 1. Goal and constraints

A single existing settings page (no new route) with three tabs —
**مالیات و عوارض | ارزها | قواعد رُند کردن** — redesigned with a materially different
information architecture. Prior deliveries (033 / 034 / 034-R2) were rejected as
cosmetic reshuffles of a dense table + black CTA + gray cards. This version keeps
every domain contract but changes the structure itself.

Immutable contracts preserved:

| Area | Contract |
|---|---|
| Tax | list, create/edit, independent tax + duty rates, accounting code, set default, activate/deactivate, delete with guards (no delete of default or used), code lock after snapshot, exemption when both rates are zero |
| Currency | IRR only in phase-1, accounting code edit, **no bootstrap button**, real save/error feedback |
| Rounding | named rules, positive integer IRR step, edit / set default / activate / delete with guards, snapshot on documents, `0.001` future non-IRR only |
| Shared | delete uses host ConfirmationDialog (danger); create/edit use in-tree SettingsDialog; row menus anchor absolute under their relative trigger; focus trap, Escape, Cancel, focus restore |

Visual constraints: RTL Persian UI, Twenty `--t-color-*` tokens only, no purple AI
gradients, no parallel design system, dense operational / calm enterprise quality,
desktop width used purposefully, mobile keeps every operation reachable with no
horizontal overflow.

---

## 2. The structural idea: "register with a context rail"

The page is not a table and not a grid of cards. It is a **ledger page**:

```
┌──────────────────────────────────────────────────────┐
│ back  عنوان صفحه                                      │
│ tabs: مالیات و عوارض · ارزها · قواعد رُند کردن        │
├──────────────┬───────────────────────────────────────┤
│  ریل زمینه    │  محتوا (اسکرول)                        │
│  آمار ۲×۲    │                                       │
│  اکشن اصلی   │   ساختار هر تب متفاوت است:             │
│  فیلترها     │   tax → ردیف‌های ثبت (register)         │
│  راهنمای     │   currency → پرونده تک‌رکورد (dossier)  │
│  قواعد حذف   │   rounding → نردبان گام‌ها (ladder)     │
└──────────────┴───────────────────────────────────────┘
```

Why this structure:

1. **Context rail instead of a top toolbar.** Counts, filters, the primary action,
   and the delete rules live in one persistent column. The user reads *state* and
   *what I can do* in one glance, and the main area stays purely about records.
   This removes the rejected pattern of a black CTA floating over a table.
2. **Three tabs, three structures.** The rejected versions rendered the same dense
   table three times. Here each domain's shape drives its own layout (below), so
   the page cannot read as a reshuffle.
3. **Hairlines, not cards.** Rows are separated by 1px rules inside one bordered
   register. There are no gray card boxes, so the eye follows the numerals, not
   the chrome.
4. **Numerals carry the hierarchy.** Oversized tabular Persian numerals (rates,
   step sizes, counts) are the visual anchor. A rate is read before its label.

### Per-tab structures

**مالیات و عوارض — TaxLedger (register rows)**
Wide rows on a four-column grid: identity (name + badges + policy code) · rates
(مالیات / عوارض / مجموع as three numeral stats, or a single «معاف» block when both
are zero) · accounting code chip (padlocked when `quotationCount > 0`) + usage line ·
anchored ⋯ menu. The default policy gets a turquoise edge marker on the row's start
side — a marker, not a card border. A header rule labels the columns like a ledger.

**ارزها — CurrencyHero (single-record dossier)**
Phase-1 has exactly one operational currency, so a list would be theater. The tab
renders one dossier: large identity (نام + IRR mark + پیش‌فرض / فاز ۱ / فعال badges),
a three-cell fact strip where **کد حسابداری is the editable centerpiece**, an honest
auto-bootstrap note (explicitly no button), and a dashed "next currency" row that
states IRR-only instead of faking more data.

**قواعد رُند کردن — RoundingList (step ladder)**
Each rule is a rung on a vertical timeline: ordinal circle on a connector line,
then the **step size as the hero numeral** («۱٬۰۰۰ ریال»), name/code/badges, and a
per-rule snapshot line («در ۵۷ سند ذخیره شده»). The ladder metaphor matches what
rounding rules actually do — ordered granularity — and looks nothing like the tax
register even though both are lists.

---

## 3. Primary vs secondary actions

| Action | Rank | Placement |
|---|---|---|
| سیاست جدید / قاعده جدید | **Primary** (one per tab) | Rail, full-width blue button — position gives prominence, not size |
| ویرایش (create/edit) | Primary inside its flow | Row click, name button, menu «ویرایش», or the currency dossier's edit button → SettingsDialog |
| بازخوانی | Secondary | Rail ghost button |
| فیلتر همه/فعال/پیش‌فرض | Secondary | Rail chips with counts |
| پیش‌فرض کردن / فعال‌سازی | Row-level | ⋯ menu, anchored under the trigger |
| حذف | **Danger, guarded** | ⋯ menu (disabled with an inline reason when default/used) → host ConfirmationDialog |
| ارز: ویرایش کد | Primary for its tab | Inline in the dossier; **no create/bootstrap button exists** |

Rule applied: exactly one blue primary per viewport; danger red only on delete
paths; every disabled control states its reason in place (menu note, lock hint).

---

## 4. Mobile strategy (~390)

The same DOM restyles under a `mobile` shell (no separate page):

- **Rail collapses to a control block** above content: stats become a horizontally
  scrollable chip strip, the primary and refresh buttons sit side-by-side at full
  height, filters scroll horizontally. Nothing is hidden.
- **Register rows re-stack**: identity + ⋯ on line 1, badges with the name, the rate
  trio moves into its own tinted mini-panel (three equal columns still fit at 390),
  accounting code + usage on the last line.
- **Ladder rows re-stack**: ordinal stays on the connector at the start edge, step
  numeral + name in the middle, status line below; the menu button stays top-left
  of the row (RTL) — still anchored to its trigger.
- **Dossier** goes single-column; fact cells stack with hairline separators.
- **Tabs and chips scroll horizontally** with hidden scrollbars; `min-width: 0`
  everywhere prevents overflow; no element scrolls the page sideways.
- **Dialogs become bottom sheets** (rounded top, slide-up) so fields and footer
  actions stay reachable one-handed; focus trap and Escape behavior are unchanged.
- Tap targets are ≥ 32px for icon buttons and 36–44px for text buttons with ≥ 8px
  separation.

Desktop uses its width on purpose: rail (264px) + register columns sized by content
priority (rates get the widest track), max content width 960px so lines stay readable.

---

## 5. Interaction states

| State | Treatment |
|---|---|
| Loading | Skeleton rows shaped like the real structure (register rows / ladder rungs / dossier block) with a Persian progress line — never a bare spinner |
| Empty | Composed per tab: icon, honest title, explanation of the consequence, and the primary action (currency empty = auto-bootstrap progress, no button) |
| Error | Red band with `role="alert"`, cause in Persian, inline «تلاش مجدد» that runs loading → normal |
| Dialog open | In-tree panel, initial focus on first field, Tab trap, Escape = Cancel, focus returns to trigger on close |
| Field validation | On blur; message states cause + remedy; error clears when the field becomes valid; save re-validates and focuses the first bad field |
| Dirty close | Closing an edited dialog raises a «تغییرات ذخیره نشده» confirm (ادامه ویرایش / رها کردن) |
| Saving | Footer switches to «در حال ذخیره…», controls disabled, then success toast |
| Duplicate code | Accounting-code field error: «این کد حسابداری برای سیاست دیگری ثبت شده است» |
| Menu | Absolute inside the row's relative anchor (never fixed/top-left), flips upward near the frame edge, outside-click and Escape close, arrow keys move, focus returns to the ⋯ trigger |
| Delete guard | Menu item disabled with an inline reason (پیش‌فرض / در N سند); allowed deletes confirm in a danger dialog; success toast confirms the removal |
| Code lock | Edit dialog shows the accounting field disabled with an orange lock note when the record has been snapshotted into documents |
| Toast | Bottom-center, `aria-live="polite"`, auto-dismiss ~3s |
| Focus | Visible blue focus ring on every interactive element; rows are keyboard-activatable (`role="button"`, Enter/Space) |
| Reduced motion | All transitions/animations collapse under `prefers-reduced-motion` |

Status is never color-only: every badge carries a Persian label (پیش‌فرض، فعال،
غیرفعال، معاف، فاز ۱), and lock/guard states pair an icon with text.

---

## 6. Visual system

- **Tokens:** Twenty light-theme values baked into the preview as `--t-color-gray1..12`,
  `blue*`, `red*`, `turquoise*`, `orange*` plus semantic `--t-background-*` /
  `--t-border-*` aliases. Transfer components reference the same variable names and
  rely on the host theme at runtime — no parallel palette.
- **Type:** Vazirmatn (400/500/600/700) with Tahoma/Segoe UI fallback; body 16px,
  meta 12.5–13px, badges 11.5px, numerals 22–28px with `tabular-nums`; accounting
  codes and policy codes in a monospace stack, LTR-isolated inside RTL text.
  Persian digits everywhere user-facing (counts, rates, steps).
- **Color roles:** blue9 = the single primary action; turquoise = default/active
  semantics (edge marker, default badge, switch); orange = lock/snapshot/exempt
  warnings; red = danger only; grays carry all structure.
- **Geometry:** 4/8 rhythm; 6–8px radii on controls/registers, 12px on frames and
  dialogs; 1px hairlines (`gray4/gray5`); shadows only on overlays (menus, dialogs,
  toasts) — lists and cards have none.
- **Icons:** one inline SVG family, 24-grid, 1.8 stroke, round caps (plus, refresh,
  dots, lock, pencil, x, alert, info, check, star, bolt, inbox, back). No emoji.
- **Motion:** 150ms state transitions, 300ms dialog/sheet entrance with
  `cubic-bezier(.16,1,.3,1)`, menu 150ms fade+shift, transform/opacity only.
- **Imagery:** none — this is an operational settings surface; all graphics are
  code (icons, skeleton shapes, the ladder connector). No stock photos, no gradients.

---

## 7. Sample data (honest, non-placeholder)

Tax: مالیات بر ارزش افزوده ۹٪ (پیش‌فرض، ۱۴۲ سند) · ورود کالا ۱۰٪+۲٪ (۱۷ سند) ·
صادرات کالا — معاف · عوارض شهرداری ۷٪+۵٪ · مالیات شرکت‌ها ۲۵٪ (غیرفعال).
Rounding: ۱۰۰ / ۱٬۰۰۰ (پیش‌فرض، ۵۷ سند) / ۱۰٬۰۰۰ ریال.
Currency: ریال ایران (IRR)، کد حسابداری ۱۱۰۱، فاز ۱.

---

## 8. Mapping to React files

| Preview region | React component (named export) | Target (see TRANSFER-MAP.md) |
|---|---|---|
| Header + tabs + rail + content slot | `SettingsShell` | `src/components/financial-settings/settings-shell.tsx` |
| Tax register (rows, header rule, states) | `TaxLedger` | `src/components/financial-settings/tax-ledger.tsx` |
| Currency dossier | `CurrencyHero` | `src/components/financial-settings/currency-hero.tsx` |
| Rounding ladder | `RoundingList` | `src/components/financial-settings/rounding-list.tsx` |
| Create/edit dialog (focus trap, dirty guard, field errors) | `RecordDialog` | `src/components/financial-settings/record-dialog.tsx` |
| Anchored row menu (flip, keyboard, guards) | `RowMenu` | `src/components/financial-settings/row-menu.tsx` |

Delete confirmation stays on the host `ConfirmationDialog` via the existing
`runDestructiveConfirm` helper; toasts stay on `enqueueSnackbar`; API calls stay on
the existing `quotation-api` nest actions. The transfer components are presentation
plus local UI state — they do not invent a data layer.

---

## 9. Assumptions

- Preview bakes Twenty's documented light-theme token values so it runs standalone;
  in the host, the same `--t-color-*` names resolve from the real theme.
- Vazirmatn loads from Google Fonts with a system Persian fallback; offline the
  layout holds on Tahoma/Segoe UI.
- The prototype toolbar (viewport + state switcher) sits **outside** the app frame
  purely to expose the required loading/empty/error showcases; it is not product UI.
- Dark mode is out of scope for this phase; light tokens only.
