# Designer brief 02 — produce the revised screen (Superdesign)

You are the same product designer who wrote the attached diagnosis. Now design the
actual screen that satisfies your own acceptance criteria. Do not hand the decision to
engineering; the row concept, the action treatment, the hierarchy and the responsive
behaviour are yours.

## The screen

A settings page inside Twenty for a Persian RTL CRM. Its title is "مالیات و عوارض".
The operator manages tax policies. One policy has two rate components — مالیات (tax)
and عوارض (duty) — and a computed total that is never typed. Exactly one policy is the
active default. A policy used by any quotation cannot be deleted, only deactivated.
Deleting the default is refused. The last active policy cannot be deactivated.
Historical quotations keep the rate they were priced with.

The page must support: creating a policy, editing a policy, choosing the default,
deactivating, reactivating, deleting an unused policy, and showing how many documents
use a policy.

## What you already decided, and what you must now honour

Follow your own diagnosis and acceptance criteria:

- every clickable action has a visible bounding box; no text-only links,
- Total leads, visually separated from the Tax plus Duty calculation, in accent,
- document count is contextual, next to the name, not a peer of the rates,
- inactive rows are greyscale with an explicit badge, not a subtle opacity change,
- destructive actions use the danger token, utility actions use the default token,
- the editor appears in place of the row so the operator keeps context,
- mobile at 390 px stacks vertically with actions below the data and no horizontal
  scrolling, tap targets at least 32 px.

## What you must produce

TWO frames of the same design in ONE page, stacked with a clear divider:

1. **Desktop list state** — four policies that between them show every case: the
   active default, an active non-default policy used by documents, an active unused
   policy that may be deleted, and an inactive policy. Include the page header with the
   add action, and the inline editor open on one row so the editing state is visible.
2. **Mobile 390 px state** — render the same policies inside a 390 px wide frame so the
   stacked layout can be judged.

Use realistic Persian content and Persian digits with the Persian percent sign. Keep it
plain, dense and operational — this is an internal finance setting, not a landing page.
Twenty's light palette: background #ffffff, surface #fcfcfc, row #f1f1f1, border
#d6d6d6, primary text #333333, secondary #666666, accent #4c6ef5, danger #d3453f,
radius 4 or 8, control height 32 px, spacing multiples of 4.
