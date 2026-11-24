# DESIGN-DECISION — Tax and duty settings panel (CRM-129 / TAX-PANEL-016)

Owner of the design judgment: the Superdesign designer agent. This file records what the
designer decided, in its own words where possible. Implementation notes are marked as
such; they are not design decisions.

## Provenance

| Artifact | Superdesign draft id | Model | Command |
|---|---|---|---|
| Independent diagnosis | `971bcdae-827c-458f-a799-311780c6b9c5` | `gemini-3.1-pro` | `create-design-draft` (`docs/design/crm-129-tax-panel-016/designer-diagnosis-01.html`) |
| Revised screen design | `41dea32c-f4e4-41d5-b5e9-41dc4045ef71` | `gemini-3.1-pro` | `create-design-draft` (`docs/design/crm-129-tax-panel-016/designer-revised-design.html`) |
| Project | `cff68fa9-107a-4e63-882f-2b7c66c121a6` | — | same project as drafts A and B |

Earlier drafts in the same project: A `f5faac68-33dc-4a48-ba39-d3a650827a21` (compact
table), B `ae04fced-16d2-4e22-b39e-68b68b03088b` (card grid).

Inputs given to the designer: the operator's verbatim rejection, draft A and B markup,
the shipped component's row markup and control styles, the Twenty light tokens, and the
business rules. The designer was explicitly not given a CSS remedy.

## Designer's verdict (verbatim from the diagnosis draft)

> Verdict: Rejected. Actions are camouflaged among text; critical hierarchy is inverted.

Findings it recorded, each with the operator-visible symptom:

1. **Action camouflage** — `ghostButton` uses transparent background and label-like
   typography, so "ویرایش" and "حذف" read as text; in RTL the action column blends into
   the metrics before it.
2. **Hierarchy inversion** — every row action has identical weight, and the primary
   action (add policy) is disconnected from the list it manipulates.
3. **Metric density and RTL** — four numbers compete; the total sits mid-scan; document
   count is given peer prominence; percent rendering is inconsistent.
4. **State recognisability** — `opacity: 0.72` alone does not distinguish inactive rows;
   only the default badge reads clearly.

## Designer's direction (verbatim)

> Abandon the grid and the dense table. Adopt a Structured List where data and actions
> are physically isolated. Metrics are collapsed into a primary reading (Total) with
> sub-components (Tax + Duty) secondary. Actions are moved to a distinct, bounded action
> zone, utilising Twenty's solid buttons for clear affordance.

Named concept: **The Action-Isolated Row**.

## Non-negotiable acceptance criteria (designer-authored)

1. **Action affordance** — every clickable action (edit, default, toggle state, delete,
   save, cancel) has a visible bounding box; text-only links are prohibited.
2. **Metric reading order (RTL)** — the total leads and is visually separated from the
   tax-plus-duty calculation; the total uses accent `#4c6ef5`.
3. **Mobile 390 px** — vertical stack, actions below the data, no horizontal scroll,
   tap targets at least 32 px.
4. **Destructive safety** — delete and deactivate use danger `#d3453f`; utility actions
   (edit, default) use default `#333333`.
5. **Editor proximity** — the add/edit state replaces the row in place so the operator
   keeps context.

## Committed visual specification (from the designer's revised frames)

Desktop list, one card per policy on surface `#fcfcfc`, border `#d6d6d6`, radius 8,
padding 16:

- identity: 16 px semibold name, a `پیش‌فرض` pill, and the document count as a contextual
  line under the name ("در ۱۲۸ سند استفاده شده") — not a peer of the rates;
- metrics behind a divider: `جمع کل` (12 px caption) over the total at 18 px bold in
  accent, beside a `#f1f1f1` chip reading `مالیات: ۶٪ | عوارض: ۳٪`;
- actions in a bounded cluster: 32 px tall, 1 px `#d6d6d6` border, 8 px radius, 14 px
  medium label; danger variants use a `#d3453f` border and label;
- inactive rows are greyed and desaturated with an explicit `غیرفعال` badge;
- inline editor: 2 px accent border, action pair in its header (cancel bordered, save
  solid `#333`), a four-column field grid with the name spanning two, and a footer bar
  carrying the usage line and `جمع محاسباتی` with the computed total.

Mobile, 390 px frame: page header keeps the title with a 32 px square add control and the
subtitle beneath; each policy becomes a card with name and badge on one line, a
`#f1f1f1` bar holding the abbreviated components (`م: ۶٪ | ع: ۳٪`) on one side and
`جمع` on the other, then full-width 32 px actions below; the editor stacks the same
fields with tax and duty side by side and cancel/save in a row.

## Implementation notes (not design decisions)

- The designer's controls use Tailwind utilities; the component implements the same
  computed presentation with Linaria-free inline styles plus one scoped `<style>` block
  for `:hover`, `:focus-visible` and the 767 px breakpoint. The measured values match the
  specification above.
- **Gap closed by derivation, not by the designer.** The revised frames show the active,
  unused, non-default row only in its editing state, so its resting action set was never
  drawn. Business rules require that row to be deletable. Implementation therefore shows
  `حذف` as a danger-bordered control with the existing two-step confirmation, which
  applies the designer's own criteria 1 and 4 rather than inventing a treatment. This
  point was put back to the designer but could not be regenerated: the Superdesign team
  credits were exhausted (`insufficient_credits`, remaining `-15.5`) at that step. It is
  recorded here as an open question for the designer, not as a designer decision.
- The shipped per-row footnote is dropped for normal states, following the designer's
  density finding; refusal messages still render in the row that caused them, because
  they are the server's answer to an action the operator actually took.
