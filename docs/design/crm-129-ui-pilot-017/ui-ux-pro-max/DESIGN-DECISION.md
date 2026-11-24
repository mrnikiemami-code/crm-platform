# DESIGN DECISION — why this shape, for this operator

`DESIGN-SYSTEM.md` says *what* the system is; `DIAGNOSIS.md` says *what is wrong today*.
This file is the argument between them: one decision per measured defect, and the reason it
serves a merchant operator rather than a designer's taste.

Thesis: **the panel is a rate catalogue, so it must behave like a table** — fixed columns
you can compare down, an edge that marks the live rate, actions ranked by consequence, and
an editor that stays inside the row it edits. Everything below follows from that.

---

## C1 — Fixed column tracks replace content-sized ones  ·  answers D1

**Before.** `minmax(0,1fr) auto auto`. `auto` is measured per row, so every row was its own
layout: rate figures sat at x=721, 631, 721 and the metrics block moved by up to 90 px.

**After.** `minmax(0,1fr) 96px 96px 104px 132px 312px`, one template shared by the header
strip, every row, and the editor.

Measured after the build, all five rows:

```
296px 96px 96px 104px 132px 312px     (identical ×5)
tax cell  x=1110 · duty x=998 · total x=878   (identical ×5)
```

**Why it is better for the operator.** The only reason to show three rates side by side is
comparison. Comparison is a vertical eye movement; a column that moves by 90 px turns one
glance into five re-fixations. This is not aesthetics — it is the difference between
answering "which of these costs more" in one pass or in five.

Note the actions track had to be fixed too (`312px`, not `auto`): a row whose toggle reads
«فعال‌سازی» is 16 px narrower than one reading «غیرفعال‌سازی», which would have shifted that
whole row's numbers. That bug appeared in the first build of this preview and is fixed; it
is recorded here because it is exactly the failure mode being designed out.

## C2 — Actions ranked by consequence, not by being present  ·  answers D2

**Before.** Four controls, one weight: 32 px, `gray6` border, transparent fill, `gray11`
ink. `حذف` sat 8 px from `غیرفعال‌سازی`, and its red appeared only on hover.

**After.**

| Control | At rest | Why |
|---|---|---|
| ویرایش | `gray12` ink, `gray7` border | The row's primary action; the darkest boundary reads first |
| پیش‌فرض | `gray11`, or `blue11` on `blue3` when it *is* the default | A state control, so its selected state is visible without hovering |
| غیرفعال‌سازی / فعال‌سازی | `gray11`, `gray6` border | Reversible, routine |
| حذف | `red11` ink at rest, behind a 1 px rule and 12 px of air | The only irreversible action, identifiable before the pointer moves |

**Why.** An operator scanning a table decides *which* control to press from the shape and
ink of the control, not from its label. Four identical outlined boxes put "edit the rate"
and "destroy the rate" in the same visual class and 8 px apart — the classic
mis-click. Grouping by consequence and colouring the destructive one at rest costs nothing
in density and removes the whole class of error.

`disabled` was deliberately kept as a *state*, never a disappearance: a control that
vanishes reads as "I no longer have permission", while a dead control with a reason reads
as a business rule. The reason is bound to `حذف` with `aria-describedby` pointing at the
usage cell — so "why is this dead" is answered by the same element that made it dead.

## C3 — The add button moves to the content edge  ·  answers D3

**Before.** `justify-content: space-between` across 1679 px put `افزودن سیاست` at **x=35**
while the list lived at x=301…1401. The primary action shared no edge with anything.

**After.** Header and list are both inside one 1200 px container; the button sits on the
container's inline-start edge, on the same vertical axis as the toolbar and the table, and
`افزودن سیاست` also exists where the content is (the empty state, and at 390 px it becomes
a full-width 44 px target under the title).

**Why.** Fitts's law is the mechanical reason, but the operator-facing reason is simpler:
an action should look like it belongs to the thing it acts on. Floating at the far edge of
a 1920 px canvas, next to nothing, it reads as global chrome — the operator has to learn
that the button in the corner belongs to the list in the middle.

## C4 — The list gets a header, a count, and a way to find a row  ·  answers D4

**Before.** No column headers, no total, no search, no filter.

**After.** A six-column header strip, a summary line (`۵ سیاست · ۱ پیش‌فرض · ۵۰ سند`), a
search field, and an فعال/غیرفعال filter.

**Why.** With three rows all of that is invisible; with thirty it is the difference between
a screen and a scroll. The counts are not decoration either — "how many policies do we
have, how many active, how many documents touched" is the question an admin actually asks
before editing anything, and it was previously answerable only by counting rows.

The header strip is `aria-hidden="true"` on purpose: each numeric cell already carries its
own label in the accessibility tree, and announcing both would double every figure. Below
900 px the strip disappears and those same labels become visible — one source of truth,
two renderings.

## C5 — The 390 px action bar stops clipping  ·  answers D5

**Before.** `.tax-btn { padding: 0 4px }` in a 3-up grid: «غیرفعال‌سازی» had
`clientWidth 59 / scrollWidth 68`, i.e. the label bled 9 px over its neighbour's gap.

**After.** Measured in the 390 px frame: three controls at **107 × 44 px** with
`clientWidth === scrollWidth` (105/105) and `white-space: normal`, and `حذف` on its **own
full-width line at 40 px**.

**Why.** The old design solved "three labels in one row" by shrinking padding until the
text no longer fit — the constraint was moved into the text, which is where it becomes a
bug you can only see in Persian. Keeping 44 px targets and letting the labels wrap inside
their slot, then isolating the destructive control on its own line, fixes the cause rather
than the symptom: the thumb that means "deactivate" can no longer land on "delete".

## C6 — "Which rate will a new quotation use" is answered by an edge  ·  answers D6

**Before.** `پیش‌فرض` was a 12 px pill, the same size and weight as `غیرفعال`.

**After.** Three signals, in order of how fast they are read:
1. a **3 px accent bar** down the inline-start edge of the default row (measured
   `rgb(62,99,221)`, 3 px, inset 0);
2. the `پیش‌فرض` pill in `blue11` on `blue3` (5.34:1);
3. the `پیش‌فرض` control rendered as *selected* (`aria-pressed="true"`), not removed.

**Why.** This is the one fact that changes money on every new document. It deserves a
signal you cannot miss while scrolling — a vertical mark down one row — rather than a word
the same size as a status. And because the control stays present-but-selected instead of
disappearing, the four-control pattern holds on every row and the operator learns one
layout, not two.

## C7 — The editor grows inside the row's columns  ·  answers D7

**Before.** A card 1052 px wide holding a 720 px form, leaving 332 px of void, with fields
at x=823/1011 that matched no column above them.

**After.** The editor is a full-width section in the same surface, ordered
`name → tax → duty → total`, with the **computed total occupying the total column's
position**, and the live sum repeated in a footer strip next to the usage fact.

Measured: editor 1148 px inside a 1148 px content box (zero void), fields
688 / 132 / 132 px.

**Why.** Opening "edit" should not make the operator re-learn where the numbers are. The
editor keeps the catalogue's reading order, so the tax input appears below the tax column
and the resulting total appears where the row's total was — the eye never changes
direction. The fields are wider than the table tracks on purpose: a 96 px input is not
typeable, and pretending otherwise would be false alignment. What is preserved is the
*sequence and the rhythm*, not a pixel match.

## C8 — Usage and deletability stop sharing one sentence  ·  answers D8

**Before.** `در ۵ سند استفاده شده است؛ حذف‌شدنی نیست.` — two facts, one 12 px line,
repeated on every used row.

**After.** The usage column is two lines: `۵ سند` (13 px, `gray12`) and `حذف‌شدنی نیست`
(11 px, `gray11`), and the second line is what `حذف` points at with `aria-describedby`.
The default pill already says «پیش‌فرض», so the note never repeats it.

**Why.** "How many documents use this" is data an operator compares between rows; "can I
delete it" is a constraint about one control. Fusing them made the row's quietest line also
its longest, and made the disabled button's reason merely *adjacent* to it rather than
attached. Splitting them shortened every row (uniform 56–57 px) and made the constraint
programmatically reachable.

## C9 — "Exempt" is a state, not a zero  ·  answers D9

**Before.** `معاف` was painted in the same `blue9` as every total.

**After.** An `معاف` chip, `amber12` on `amber3`.

**Measured.** `amber11` on `amber3` = **4.25:1 — rejected**, so one step darker
(`amber12`, 10.47:1) is used. `gray10` on `gray2` (3.69:1) was also rejected for any live
text; `gray9` is allowed only on `disabled`, which WCAG 1.4.3 exempts.

**Why.** "Tax is 0 %" and "this line is exempt by law" are different facts with the same
number. Only one of them can be argued with an auditor, so only one gets a state marker.

## C10 — What was deliberately not touched  ·  answers S5

- No change to `tax-policy-settings-panel.tsx` or any other file under
  `packages/twenty-apps/`. `git status` for the branch shows only this documentation folder.
- No call to the backend, no write to the database, no restart of the worker, no deploy.
- The information model is unchanged: same three rate facts, same four actions, same
  server-side rules (the default policy cannot be deactivated or deleted; a policy used by
  documents cannot be deleted). The preview *shows* those rules as disabled states with a
  reason; it does not invent or relax them.
- No new colour, font, radius or control height: every value maps to a `--t-*` token, and
  the dark values are Twenty's `ThemeDark` values, not a hand-picked inversion.

---

## Where this could be wrong — for the user to judge

Being explicit about the disagreements is part of the gate, not a hedge:

1. **A single bordered surface instead of separate cards.** Cards are friendlier for
   touch and for a 3-row list; a table wins as the list grows. If the catalogue is expected
   to stay at three or four rows forever, the card version of this design would be
   defensible and I would build it.
2. **Search and filter at three rows.** They are inert today. They are here because the
   brief says the list will grow; if it will not, they are two controls of noise.
3. **The editor's fields are wider than the table's columns.** Exact alignment would mean
   96 px inputs. I chose typeability; a reviewer may prefer the stricter grid.
4. **`پیش‌فرض` stays visible-but-selected on the default row.** Removing it would be
   cleaner per row, but then the control set differs by row and the layout has to be
   re-learned.
5. **Persian digits with `٪`.** Taken from what the current panel already produces
   (`display-format.ts`). If the house style for this app is Latin digits in numeric
   tables, this is a one-line change and should be decided by the user, not by me.

## Verification recorded against this build

| Check | Result |
|---|---|
| Column x-position, 5 rows | identical (1110 / 998 / 878) |
| Grid template, 5 rows | identical `296px 96px 96px 104px 132px 312px` |
| Action button x, 5 rows | identical (640 / 573 / 474 / 401) |
| Row heights | 56–57 px, uniform |
| Text overflow inside `.app` | none (`scrollWidth ≤ clientWidth` on every node) |
| Element overlap | none (pairwise rect intersection over rows/cells/buttons) |
| 390 px controls | 107 × 44, `clientWidth === scrollWidth` |
| Horizontal page scroll at 1920 | none |
| Editor void | 0 px (1148 in 1148) |
| Inline validation | error shown, `aria-invalid="true"`, focus returned to field |
| Unsaved guard | second editor refused, notice with `role="status"` |
| Delete | two-step confirm with `role="status"`; used/default rows stay disabled |
| Toast | `role="status" aria-live="polite"`, auto-clears at 4 s |
| Dark mode | `#171717` surface, `#ebebeb` ink, pill `#9db1ff` on `#182449` (7.29:1) |
