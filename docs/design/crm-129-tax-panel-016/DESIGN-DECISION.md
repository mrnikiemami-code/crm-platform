# DESIGN-DECISION — «مالیات و عوارض» (CRM-129 / TAX-PANEL-016)

Owner of the design judgment: **Impeccable** (skill `impeccable` 4.5.1, mode `Operate`).
This file records what that designer decided, with the measurement behind each call.
Implementation notes are marked as such and are not design decisions.

## Why the authority changed

The previous rounds of this panel were decided by a Superdesign draft. On 2026-11-24 the
human architect removed Superdesign from this task: its team balance is exhausted, so it
cannot answer a revision request at all, and a gate that depends on a tool which cannot
be invoked is not a gate. Impeccable is free, runs locally, and — importantly — is the
same assessor whose measurements produced the findings in `IMPECCABLE-REPORT.md`, so the
design and the evidence come from one coherent reading of the product.

The Superdesign artifacts are retained under `archive-superdesign/` as history. They are
no longer a design of record and nothing in this task waits on them.

## Inputs

`packages/twenty-apps/PRODUCT.md` (the binding contract: ≥4.5:1 text contrast, 44 px touch
targets, Twenty `--t-*` tokens only, Persian RTL, keyboard operation with visible focus),
the measured audit in `IMPECCABLE-REPORT.md`, the live panel on Dev `:3002`, and the
incumbent structure — which is **refinement, not redesign**: the action-isolated row,
its four facts, and the inline editor all survive.

## Decisions

### D1 — The accent and the danger colour were the wrong steps of the right ramp

The incumbent painted `#4c6ef5` and `#d3453f`, which are close to but not equal to
Twenty's `blue9` and `red9`. Measured against the card surface: accent 4.22, danger 4.36,
white-on-danger 4.47 — all under the 4.5 the product contracts for.

Twenty's ramp already contains steps that pass. Measured (display-p3 → sRGB → WCAG 2.1,
script `scripts/_contrast.cjs`):

| Pair | Ratio |
|---|---|
| `blue9` on `gray2` (card) | 5.08 |
| `blue9` on `gray4` (chip, hover) | 4.61 |
| `blue11` on `blue3` (default pill) | 5.34 |
| `red11` on `gray2` | 5.07 |
| `red11` on `red3` (error tint) | 4.55 |
| `red11` on `gray4` | 4.61 |
| `white` on `red11` (solid confirm) | 5.21 |
| `white` on `red12` (its hover) | 12.43 |
| `gray11` on `gray5` (off pill) | 4.82 |
| `gray12` on `gray1` (primary label) | 12.63 |

**Decision: the total is `--t-color-blue9`; danger label and border are `--t-color-red11`;
the solid confirm is `red11` with white text, hovering to `red12`.** No hex literal
survives anywhere in the panel. This closes the contrast finding and the "tokens only"
finding with one change, and the panel now follows the shell theme.

### D2 — `جمع کل` claimed to be money

It reads as a monetary total next to a currency-shaped figure. **Decision: `نرخ کل`** —
the caption says the figure is a rate, which is what it is.

### D3 — The mobile abbreviations were the two words the operator came to compare

`م:` and `ع:` at 390 px saved about 40 px and cost the comparison. **Decision: delete the
abbreviated branch.** Both labels stay whole and wrap inside the metric bar.

### D4 — A zero rate and an exempt rate were the same picture

`۰٪` in accent said nothing about intent. **Decision: when the policy is exempt, the total
reads `معاف` instead of a figure.** The number is then not a measurement of nothing; it is
a statement about the policy.

### D5 — A disappearing control is not a permission change

On a used row `حذف` vanished and `غیرفعالسازی` appeared; on an inactive unused row there
was no way to delete at all, so cleaning it up meant reactivating it first, which made it
eligible for new quotations until deleted.

**Decision: every non-default row carries the same four controls — `پیشفرض`, `ویرایش`,
`غیرفعالسازی`/`فعالسازی`, `حذف` — and only their enablement changes.** `حذف` is present
but `disabled` when the policy is referenced, and it is bound by `aria-describedby` to the
usage line that explains why («در ۵ سند استفاده شده»). An inactive, unused policy is
deletable in one write. The default row shows `حذف` disabled for the same reason.

### D6 — A refused action needs a role, and a row needs a name

The confirm prompt `«{name}» حذف شود؟` was a bare `<span>`, so a screen reader user heard
nothing after pressing `حذف`; and every row's controls shared one accessible name, so three
`ویرایش` entries were indistinguishable. **Decision: the prompt is `role="status"`, and
each row control's accessible name ends with the policy it acts on** — «ویرایش — مالیات
۹٪». The visible label stays short; the name is what a rotor reads.

### D7 — Losing typed numbers is worse than an interruption

Any other row's `ویرایش`, or the header add, replaced the open editor and threw away what
was typed, with the other rows' clusters still live one click away.

**Decision: the editor is never replaced while it holds unsaved changes.** Pressing another
row's action is refused, and the editor states the reason inline («تغییرات ذخیرهنشده
دارید؛ ابتدا ذخیره یا انصراف کنید.»). No modal: this task needs neither interruption nor
protected focus, and a dialog for it would be the category default. A `ذخیرهنشده` marker
appears in the editor header so the state is visible before it is tested.

### D8 — A dead end is not a state

A failed list load said "reopen the page". **Decision: the error is followed by a
`تلاش مجدد` control** that reruns the same read. Every screen states the one next action.

### D9 — Focus must land where the operator is looking

Entering the editor drops focus on `<body>`; saving or cancelling drops it there too, so a
keyboard operator restarts at the top of the panel. **Decision: entering the editor focuses
`نام سیاست`; leaving it returns focus to that row's `ویرایش`.** Focus is moved with real
element ids and `document.getElementById`, not with a stylesheet selector, because the
front-component host does not reliably expose `CSS.escape`.

### D10 — 44 px on a phone

Already applied: 32 px on desktop, 44 px below 767 px. The product contract and this
designer's floor agree.

## What did not change

Money domain, tax/duty arithmetic, the default-policy rule, historical rates on issued
documents, revision/snapshot, PDF, the accounting adapter, permissions and workspace
isolation. The panel's structure — one card per policy, contextual usage count, computed
total against a formula chip, inline editor — is preserved deliberately.
