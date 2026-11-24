# Brief 03 — revision request from Impeccable

Sent to the Superdesign designer against draft `41dea32c-f4e4-41d5-b5e9-41dc4045ef71`
(project `cff68fa9-107a-4e63-882f-2b7c66c121a6`, model `gemini-3.1-pro`).
This file is the input we gave. It records problems and constraints only; it contains no
remedy, no colour values and no markup from the executor.

## What the operator said

They rejected the screen a second time after seeing it built. Their words were about the
same thing the first time: they cannot tell, without pointing at it, which part of a row
they are allowed to press.

## What the independent review measured

`docs/design/crm-129-tax-panel-016/IMPECCABLE-REPORT.md` holds the full audit. The
measured facts:

1. Three colour pairs used for the most load-bearing strings fall below this product's own
   4.5:1 floor: the computed total on its card surface (4.22), the danger labels (4.36),
   and white on the solid destructive confirm (4.47). The same panel already paints a
   danger red that passes in both roles (5.03 / 5.75).
2. Every control is 32 px tall, including at 390 px where the operator is on a phone; the
   product brief commits to 44 px there. Your own criterion 3 says "at least 32 px", so
   the floor you set is satisfied — the product's is not.
3. The panel paints 17 distinct literal hex values and consumes zero `--t-*` tokens, so it
   does not follow the shell theme. The brief that came with this task says tokens only.
4. Keyboard focus falls to `<body>` after «ویرایش», after the confirm swap and after save,
   so a keyboard operator restarts at the top of the panel. The confirm prompt
   `«{name}» حذف شود؟` has no role and is not announced.
5. Each row's controls share the same accessible names («ویرایش», «حذف», «پیش‌فرض»,
   «غیرفعال‌سازی») with nothing tying them to the policy they act on.
6. Unsaved edits in the inline editor are discarded without a word when another row's
   «ویرایش» or the header add is pressed.
7. A load failure leaves a message that only says to reopen the page; there is no retry.
8. `جمع کل` reads to operators as a money total, not a combined rate. At 390 px the two
   components abbreviate to `م:` and `ع:` — the two words the operator came to compare.
   A zero-rated policy shows `۰٪` with nothing distinguishing "exempt by design" from
   "never filled in".
9. On a used row «حذف» disappears and «غیرفعال‌سازی» takes its place with no explanation,
   which one reader interpreted as "my permissions changed". A deactivated, never-used
   policy exposes only «فعال‌سازی» and «ویرایش», so cleaning it up means reactivating it
   first, which makes it eligible for new quotations.
10. There is still no designer-authored resting state for an active, unused, non-default
    row. The previous round could not be regenerated, so implementation derived the
    resting `حذف` from your own criteria 1 and 4. That derivation is still open.

## Constraints the design must hold

- Persian, right-to-left; the operators are Iranian accountants, not developers.
- Twenty's existing design system only — the token excerpt beside this brief is the
  palette. No new colour family.
- One policy carries two rates, tax and duty; the total is computed, never typed; exactly
  one policy is the active default; the quoted-document count is what decides whether a
  policy may be deleted or only deactivated.
- Desktop and 390 px mobile, both with no horizontal scroll.
- This is a settings surface inside a larger CRM shell, not a standalone page.

## What we are asking for

Your own diagnosis of which of the above are symptoms of one deeper problem and which are
separate, and a revised screen that resolves them in your terms. Decide the resting action
set for the active-unused row. If you change a value you previously committed to, say so
and say why. Reply with the design, not with a list of options for us to choose from.
