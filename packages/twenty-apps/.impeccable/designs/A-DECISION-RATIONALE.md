# Design decision — accounting page (CRM-129-ACCOUNTING-013-FINAL-UX-AND-INTEGRITY)

## S0 tool status

- **Impeccable:** available and used. Local CLI `impeccable detect … --no-advisory`
  (skill script in the plugin cache) produced `_detect.json` from the first run and
  `_detect-after-fix.json` from the second; the summary is `IMPECCABLE-AUDIT.txt`.
- **Superdesign:** installed (`0.14.0`) but **BLOCKED**. `superdesign list-models`
  exits 4 with `API Error: Not authenticated. Run 'superdesign login' first.` A second
  attempt (`superdesign login`, device code `VAAU-1071`) opened
  `https://superdesign.dev/auth/cli?code=VAAU-1071`, which redirected to
  `https://superdesign.dev/auth/login?redirect=%2Fauth%2Fcli%3Fcode%3DVAAU-1071` — an
  email/Google sign-in. There is no account session in this environment, so no
  Superdesign render was produced and no claim of one is made. The two prototypes below
  were authored directly as static HTML and then put through the Impeccable checks; the
  same decisions were re-validated in a real browser DOM on the Dev build.

## Options

**A — `a-cartable.html`.** A single card with a horizontal tab strip at the top; the
five sections are tabs inside the card, and inner views (connection form, CRM picker)
replace the card body.

**B — `b-rail.html`.** A persistent left rail that names all five sections at all
times, with inner views taking over the content column under an explicit back bar.
Below 860px the rail becomes a bottom bar reachable by thumb.

## Criteria and result

| Criterion | A | B |
| --- | --- | --- |
| Five sections reachable from an inner view | tabs are hidden by the inner view | rail stays mounted, always visible |
| Back path from connection form / picker | none by construction | dedicated back bar, 44px on phones |
| Active-section signal | tab styling only | `aria-current` + filled rail item |
| RTL reading order | tabs right-aligned but the eye starts in the card body | rail starts at the reading edge, content at the natural start |
| Mobile reach | tabs scroll horizontally, easy to miss | bottom bar pinned in thumb reach |
| Contrast (Impeccable) | 3 anti-patterns then 0 after token fix | 0 on first run |

## Decision

**B — persistent rail** was selected and implemented in `accounting-settings-panel.tsx`
(`Rail` / mobile `SectionBar` / `SubViewBar`). Reason: the rejection was about
orientation and dead ends, not about density. Tab-in-card layouts cannot keep the
primary navigation visible while an inner view is open, which is exactly the failure
the user reported. The rail also gives the mobile bottom bar for free, so desktop and
phone share one navigation model instead of two.

The contrast fix from run 1 (`--green #2f7d55 → #2b7048`, `--orange #b5651d → #8a4a12`)
was carried into the panel's tokens rather than only into the prototype.

## What only a browser could settle

Impeccable `detect` is a deterministic static pass (contrast, anti-patterns, copy
advisories); it cannot prove navigation. Section switching with a half-typed
connection form, back from the CRM candidate picker, search retention across sections,
and 390px tap targets were therefore verified as DOM assertions on
`http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`, not from the
prototypes.
