# DESIGN SYSTEM — Persian RTL administrative settings panel

Derived for this panel only, and deliberately **not** a new product theme: the panel lives
inside the Twenty shell, so every colour, radius and control height here is mapped onto
Twenty's existing `--t-*` tokens. The preview file declares those tokens with the sRGB
hex equivalents of Twenty's `display-p3` values (converted through CIELAB → sRGB in
`ThemeLight.ts` / `ThemeDark.ts`), so the preview can be opened without the app running
while still showing the same pigment the shell shows.

## 1. Why this is a settings panel and not a page

`UI UX Pro Max` was invoked for this screen (see `EVIDENCE.md`) and its `--design-system`
response proposed a *Real-Time / Operations Landing* pattern with a dark tech palette
(`#0F172A`) and Fira Code/Fira Sans. **That output was rejected for three recorded
reasons**, and only the parts that fit the product were adopted:

| Proposed | Decision | Reason |
|---|---|---|
| Landing pattern (hero → metrics → how it works → CTA) | **Rejected** | This is an admin settings panel reached from the sidebar with a known single task. A hero or a marketing CTA would be decoration over a form. |
| Dark tech palette + green CTA `#22C55E` | **Rejected** | The Twenty shell's theme owns the palette and the user can switch light/dark; a per-screen palette would either fight the shell or be invisible. PRODUCT.md binds the panel to `--t-*` tokens only. |
| Fira Code / Fira Sans | **Rejected** | A second font family inside the shell is a consistency regression; Persian body text must match the surrounding app. |
| `Minimalism & Swiss Style` — *"best for enterprise apps, dashboards, professional tools"*, grid-based, high contrast, essential | **Adopted** | Exactly the shape of the task: a small, high-contrast, grid-aligned catalogue. |
| `Data-Dense Dashboard` (style domain) — 8–12 px padding, 12–14 px type, sticky headers, 36 px row height, hover row highlight | **Adopted** | The catalogue is data, not prose; density is what makes three rows comparable and a growing list bearable. |
| UX guidelines: inline field errors via `aria-describedby`, `role="alert"`, error summary focus, empty states with an action, `prefers-reduced-motion`, 4/8 px rhythm | **Adopted** | These are already partly satisfied by the incumbent and are the floor for this screen. |
| Confirmation before destructive action | **Adopted, in-row** | The panel needs a second press, not a modal: nothing here is irreversible enough to justify stealing focus. |

The skill's own contract says to verify whether a result "fits the user's product and
platform" and to retry with a narrower query rather than persist unverified output. The
retry produced the same landing pattern, so the fit was decided here and is recorded
above rather than silently applied.

## 2. Grid — the part that fixes the screen

One set of column tracks is shared by the header strip, every row, and the editor. This is
the direct answer to diagnosis **D1** (rows whose numbers moved by up to 90 px).

```
[ policy ]  [ tax ]  [ duty ]  [ total ]  [ usage ]  [ actions ]
 minmax(0,1fr)   96px     96px    104px      132px      auto
```

- Numeric tracks are **fixed**, so every rate in the list sits on one vertical line and
  `tabular-nums` makes the decimal separators stack.
- `minmax(0, 1fr)` on the identity track takes all the slack, so a long policy name
  absorbs width instead of pushing the numbers sideways.
- 16 px column gap (8 px rhythm, doubled).
- Breakpoints: full grid ≥ 1024; the `usage` track folds into the identity cell at
  ≤ 1023; below 768 the row becomes a stacked card with the same reading order.

## 3. Type scale

Four sizes, no more. Persian body text at 14 px is the shell's own reading size.

| Role | Size | Weight | Colour |
|---|---|---|---|
| Panel title | 20 | 700 | `gray12` |
| Panel description | 14 | 400 | `gray11` |
| Row name / policy | 15 | 600 | `gray12` |
| Column header | 12 | 500 | `gray11` |
| Cell number (total) | 15 | 700 | `gray12` |
| Cell number (tax/duty) | 14 | 500 | `gray11` |
| Secondary line (usage) | 12 | 400 | `gray11` |
| Button label | 13 | 500 | per variant |

- One family: `Inter, 'Segoe UI', Tahoma` — the shell's stack, so Persian falls back to
  exactly what the user already reads in the rest of the CRM. No web font is introduced.
- Persian digits everywhere, `٪` after the number, `٫` (U+066B) as the decimal
  separator — the same characters `display-format.ts` already produces.
- `font-variant-numeric: tabular-nums` on every figure that can be compared.

## 4. Measured colour decisions

Every pair below was computed from Twenty's own token values (CIELAB → sRGB → WCAG 2.1)
before it was used. Ratios are contrast against the surface named.

| Use | Token pair | Ratio | Verdict |
|---|---|---|---|
| Primary label | `gray12` on `gray2` | 12.31 | use |
| Secondary label | `gray11` on `gray2` | 5.59 | use |
| Secondary on washed row | `gray11` on `gray4` | 5.08 | use |
| Default-state ink | `blue11` on `blue3` | 5.34 | use |
| Accent (focus, total) | `blue9` on `gray1` | 5.21 | use |
| Danger label | `red11` on `gray1` | 5.21 | use |
| Danger on tint | `red11` on `red3` | **4.55** | use, and nothing lighter |
| Exempt-state ink | `amber12` on `amber3` | 10.47 | use |
| Exempt-state ink (naive) | `amber11` on `amber3` | **4.25** | **rejected — fails 4.5** |
| Muted meta | `gray10` on `gray2` | **3.69** | **rejected — fails 4.5** |
| Disabled label | `gray9` on `gray1` | **2.85** | allowed only on `disabled` (WCAG 1.4.3 exemption), never on live text |

Dark mode was measured separately rather than assumed:

| Use | Token pair | Ratio |
|---|---|---|
| Primary label | `gray12` on `gray1` | 15.06 |
| Secondary label | `gray11` on `gray2` | 8.21 |
| Accent ink | `blue11` on `blue3` | 7.29 |
| Accent ink, naive | `blue9` on `gray1` | **3.44 — rejected for text in dark** |
| Danger label | `red11` on `gray2` | 7.58 |
| Exempt label | `amber11` on `amber3` | 10.24 |

So the accent *ink* switches token by theme (`blue9` light, `blue11` dark) while the
accent *fill* stays `blue9`. That is the only theme-conditional colour rule in the panel.

## 5. Status language

Status is never colour-only; each state is a word plus a shape.

| State | Rendering | Where |
|---|---|---|
| پیش‌فرض | 3 px inline-start accent bar on the row + tinted surface + `blue11` pill | row edge and identity cell |
| فعال | no pill — the absence of a state pill means "in service" | identity cell |
| غیرفعال | `gray11` pill with a `gray6` hairline; row drops to `gray1` | identity cell |
| معاف | `معاف` chip in the total column, `amber12` on `amber3` | total column |
| در حال استفاده | `۵ سند` + `حذف‌شدنی نیست` as the two lines of the usage cell | usage column |

The default row's accent bar is the answer to "which rate will a new quotation start
with" without reading any text: one vertical mark down the start edge of one row.

## 6. Action hierarchy

Four controls per row, always present, grouped by consequence, and separated by a 1 px
rule — the answer to **D2**.

| Control | Variant | Height | Ink | Border |
|---|---|---|---|---|
| ویرایش | `btn` — the row's primary | 32 | `gray12` | `gray7` |
| پیش‌فرض | `btn-quiet` (selected when already default) | 32 | `gray11`, or `blue11` selected | `gray6`, or `blue9` when selected |
| غیرفعال‌سازی / فعال‌سازی | `btn-quiet` | 32 | `gray11` | `gray6` |
| حذف | `btn-danger` | 32 | `red11` | `gray6`, `red11` on hover |

- Every one of them is a bounded control at rest (not text, not a hover reveal).
- `حذف` is set apart by a divider and 12 px of air, and its label is `red11` at rest, so
  the irreversible one is identifiable before the pointer moves.
- `disabled` is a state, not a removal: the control stays in place, at 32 px, with
  `gray9` ink and `not-allowed`. The *reason* is bound with `aria-describedby` to the
  usage line in the same row.
- A "make default" on the row that *is* default renders as selected (`aria-pressed`),
  not as a disappearance.
- 44 px minimum height below 768 px, never by shrinking padding below 8 px.

## 7. Editor

The editor is a **row-shaped section**, not a card with a form inside it (answers **D7**).

- It occupies the full row width and repeats the catalogue's reading order:
  `name | tax | duty | total`, so the operator's eye keeps its place between the row and
  the form.
- Fields are widened relative to the table tracks (a 96 px input is not typeable) but keep
  the same sequence and gap, and the **computed total appears in the total column's
  position**, where the row's total was.
- Header: title + unsaved marker on one side, `انصراف` / `ذخیره تغییرات` on the other.
- Footer strip: usage and deletability on one side, the live sum on the other.
- Validation: each field owns its message, wired by `aria-describedby`; the pair-level
  rule (sum > 100 %) is a separate line below the pair; a field that the operator has not
  typed in is never pre-marked red.

## 8. Motion

Settings panels do not animate to entertain. Only three transitions exist, all ≤ 160 ms:
hover fill, focus ring, and the toast. `prefers-reduced-motion: reduce` removes all three.
No skeleton shimmer; the loading state is three static placeholder rows with `aria-busy`.

## 9. What the system forbids on this screen

- No modal dialogs (the delete confirm is in-row; the unsaved-changes notice is inline).
- No toast as the only place an error appears.
- No colour-only state, no icon-only control, no hover-only affordance.
- No new hex literal in the component: only `--t-*` tokens.
- No second font family.
- No horizontal scroll at 320 px.
