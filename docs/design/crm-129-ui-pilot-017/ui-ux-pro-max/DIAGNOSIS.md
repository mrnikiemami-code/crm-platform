# DIAGNOSIS — «مالیات و عوارض» (CRM-129 / PILOT-017)

Recorded **before** any new proposal, from the live panel on Dev `:3002`
(`/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`) and the incumbent
`packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx`.
All numbers below are `getComputedStyle` / `getBoundingClientRect` readings taken from the
running page, not estimates.

Viewport for desktop readings: 1920×1080 (`innerWidth` 1920, panel content 1679 wide).
Viewport for phone readings: 390×844 (CDP device metrics override, cleared afterwards).

## What the panel is for

An organisation admin answers three questions in this screen:

1. Which rate will a **new** pre-invoice start with?
2. Which rates exist, and what do they actually add up to?
3. Can I retire or delete a policy without breaking documents already issued?

Everything below is judged against those three questions, for a Persian RTL merchant
operator who keeps this catalogue short today and will grow it.

---

## D1 — The rows do not line up, so the list cannot be scanned

The row is `grid-template-columns: minmax(0, 1fr) auto auto`. The two `auto` tracks are
sized by their own content, so **every row places its numbers and its buttons at a
different x**. Measured on three adjacent rows:

| Row | Computed tracks |
|---|---|
| مالیات ۹.۴ | `332.203px 274.359px 347.438px` |
| مالیات بر ارزش افزوده ۹٪ | `441.031px 255.656px 257.312px` |
| مالیات ۱۰٪ ۰۰۷ | `352.078px 254.484px 347.438px` |

The metrics block starts at x=721, x=631, x=721 and the action cluster at x=342, x=342,
x=342 — the buttons happen to align, but the **rate figures jump by up to 90 px** between
rows. A column of numbers that moves is not a column; the eye has to re-find the rate on
every line, which is the single most expensive thing an operator does in a rate catalogue.

**Cause:** content-sized tracks. **Consequence:** no vertical comparison, so "does this
policy cost more than that one" cannot be answered by looking.

## D2 — Four actions per row carry exactly one visual weight

Sampled row buttons on the live page:

| Label | height | font-size | border | background | ink |
|---|---|---|---|---|---|
| پیش‌فرض | 32 | 14 | `gray6` | transparent | `gray11` |
| ویرایش | 32 | 14 | `gray6` | transparent | `gray11` |
| غیرفعال‌سازی | 32 | 14 | `gray6` | transparent | `gray11` |
| حذف | 32 | 14 | `gray6` | transparent | `gray11` |

`حذف` differs from `ویرایش` only after hover, and it sits **8 px** from `غیرفعال‌سازی`
(the whole cluster is one `gap: 8px` flex row). Reversible edit and irreversible delete
are the same object with the same adjacency. The previous gate already recorded a
USER_UAT_REJECTED for actions reading as text; the current build passes the "bordered
button" bar but still fails **differentiation** — this is the same failure one step later.

## D3 — The primary action is outside the content it creates

At 1920 the header is `justify-content: space-between` across the full 1679 px:

- `<h2>` at x=188, width 1478
- `افزودن سیاست` at **x=35, width 137** (viewport-left edge)
- the list is centred at x=301…1401

So the one action that creates a policy sits 266 px outside the list's edge and over a
thousand pixels from the title it belongs to, alone in empty space. Nothing else on the
screen lives at x=35. A primary action that shares no edge with anything reads as
detached chrome, and on a wide monitor it is the farthest point from where the operator
is reading.

## D4 — No column headers, no count, no way to find a row

The list has no header strip, no total count, no search and no filter. With three rows
that is invisible; with the "growing list" this catalogue is expected to become, the only
navigation is scrolling. There is no visible statement of how many policies exist or how
many are inactive.

## D5 — The 390 px action bar clips its own labels

At 390 px the main action cluster is a 3-column grid and `.tax-btn` is forced to
`padding: 0 4px` so three labels fit:

| Label | client width | scroll width |
|---|---|---|
| پیش‌فرض | 59 | 59 |
| غیرفعال‌سازی | **59** | **68** |
| حذف | 37 | 37 |

`غیرفعال‌سازی` is 9 px wider than its cell with `overflow: visible`, so the label bleeds
over the neighbour's 8 px gap. The design paid for the 3-up grid by shrinking the padding
to 4 px, which is why the label no longer fits — the constraint was never resolved, it was
moved into the text.

## D6 — Status is a pill, and the default is buried

`پیش‌فرض` is a 12 px pill in the identity cell; `غیرفعال` is a second pill of the same
size and weight. The one fact that decides what a **new** quotation will be priced with is
therefore the same size as "this row is inactive", and it disappears in a 12 px line
above a 12 px sentence. Colour is the only difference between the two pills
(`blue11/blue3` vs `gray11/gray5`), which also makes the state colour-only.

## D7 — The editor is a card with a void, and its fields sit under no column

Measured with the editor open on row 1:

- editor card: x=325, width **1052**
- `<form>`: x=635, width **720** (`max-width: 720px`), so **332 px of the card is empty**
  and the form is pushed to the start edge, leaving the void between the form and the
  card's other edge.
- field widths: name **344**, tax **172**, duty **172**

Nothing in the editor aligns with the row it replaces: the name input starts at x=1011
while the row's name starts at x=1287, the tax input at x=823 while the row's rate sits at
x≈721. Opening "edit" re-lays-out the same three facts in three new positions, so the
operator cannot carry their reading position from row to form.

## D8 — Two facts are fused into one 12 px sentence

`در ۵ سند استفاده شده است؛ حذف‌شدنی نیست.` is one string carrying (a) usage count and
(b) deletability. It is set at 12 px in `gray11` and repeated verbatim on every used row,
so the row's quietest line is also its longest. `حذف` is `disabled` with no
`aria-describedby` to that sentence, so the reason a control is dead is only adjacent, not
attached.

## D9 — "A rate of zero" and "this policy is exempt" were told apart by nothing

`isExempt` renders the word `معاف` in the total slot, which is the right call, but it is
painted in the same `blue9` as every other total (measured `blue9` on `gray2` = 5.08, so
it passes contrast but carries no state meaning). An exempt policy and a 0 % policy look
like the same kind of statement.

## D10 — What already works and must survive

Not everything here is wrong. These measurements are the parts a redesign must not throw
away:

- Touch targets are **44 px** at 390 (measured on all row buttons, `.tax-add`, inputs).
- Desktop ink passes contrast: `gray12` on `gray2` = 12.31, `gray11` on `gray2` = 5.59,
  `blue9` on `gray2` = 5.08, `red11` on `gray3` = 4.55.
- Every control has a per-row accessible name (`ویرایش — مالیات ۹.۴`).
- The editor is a real `<form>` with inline field errors wired by `aria-describedby`.
- Inactive rows step to the page surface instead of fading to illegibility.
- No hex literals; the panel is fully on `--t-*` tokens.

---

## Summary of the design problem

The panel is built as **three unrelated islands per row** (identity, a numbers block, an
action block) whose widths are decided by content, and as **one modal-ish card per edit**
that re-flows the same facts into new positions. The operator's job — compare rates, know
which one is live, retire one safely — is served by none of those three shapes.

The answer is not a prettier card. It is a **table-shaped catalogue with fixed column
tracks**, a **header strip and a count**, a **status that lives in the row's own edge**,
**actions grouped and ranked by consequence**, and an **editor that grows inside the row's
own columns** instead of replacing them. That is what `PILOT-017` proposes; the rationale
and the measurements behind each decision are in `DESIGN-DECISION.md`.
