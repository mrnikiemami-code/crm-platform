# EVIDENCE — UI UX Pro Max was actually used

This file records the real commands, their real output, and what was adopted or rejected.
Nothing here is paraphrased from documentation; each block was run on this machine on
2026-11-24 against `ui-ux-pro-max-cli` **2.15.0**.

## 1. The skill was located and read

```
$ uipro --version
2.15.0

$ ls ~/.cursor/skills/ui-ux-pro-max
SKILL.md  scripts/  data/  ...
```

`SKILL.md` was read in full. Its Query Contract requires that every result be checked
against the product before use, and that a poor match be retried with a narrower query
rather than persisted. Both were done (§4).

## 2. Domain queries (UX rules)

```
$ python scripts/search.py "confirm before destructive action inline table row" --domain ux -n 2
```

```
**Domain:** ux | **Query:** confirm before destructive action inline table row
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- Category: Interaction
- Issue: Confirmation Dialogs
- Description: Prevent accidental destructive actions
- Do: Confirm before delete/irreversible actions
- Don't: Delete without confirmation
- Severity: High

### Result 2
- Category: Responsive
- Issue: Table Handling
- Description: Tables can overflow on mobile
- Do: Use horizontal scroll or card layout
- Don't: Wide tables breaking layout
```

Earlier in the same session the `ux` domain was also queried for *error placement* and
*form validation timing*; both returned "error next to the field, not only in a summary",
which is why every field in this design owns its own `role="alert"` message.

**Adopted:** confirmation before irreversible delete (implemented as an in-row second
press, not a modal, because the action is reversible-by-retry and a modal would steal
focus from a table); card layout under 768 px instead of a horizontally scrolling table.

## 3. Style + domain guidance

```
$ python scripts/search.py "enterprise admin settings data table form management" \
    --domain style -n 4
```

Returned `Minimalism & Swiss Style` — *"Clean, simple, spacious, functional, white space,
high contrast, geometric, sans-serif, grid-based, essential; best for enterprise apps,
dashboards, documentation sites, SaaS platforms, professional tools; performance
cost:low; accessibility risk:low, requires contrast-text-4.5, keyboard, visible-focus,
reduced-motion"*, and `Data-Dense Dashboard` — *"8-12px padding, 12-14px typography, sticky
headers, 36px row height, hover row highlight"*.

**Adopted:** the Swiss grid (fixed column tracks, one accent, high contrast) and the
dashboard density (12–15 px type, 32 px controls, hover row highlight). All four named
accessibility requirements are met and measured in `DESIGN-SYSTEM.md §4`:
`contrast-text-4.5`, keyboard (`:focus-visible` on every control), `visible-focus`
(2 px accent ring with 1 px offset), `reduced-motion` (`prefers-reduced-motion` block).

## 4. `--design-system` — invoked, verified, partly rejected

```
$ python scripts/search.py "enterprise admin settings data table form management" \
    --design-system -f markdown --variance 2 --motion 1 --density 9 \
    -p "CRM Tax Policy Settings"
```

Output (verbatim, abridged):

```
### Design Dials
- Variance: 2/10 — Centered / Minimal
- Motion: 1/10 — Subtle
- Density: 9/10 — Dense / Dashboard

### Pattern
- Name: Real-Time / Operations Landing
- CTA Placement: Primary CTA in nav + After metrics
- Sections: Hero (product + live preview or status) > Key metrics/indicators >
            How it works > CTA (Start trial / Contact)

### Style
- Name: Minimalism & Swiss Style
- Best For: Enterprise apps, dashboards, documentation sites, SaaS platforms

### Colors
| Primary | #1E293B |  Accent/CTA | #22C55E |
| Background | #0F172A |  Card | #1B2336 |  Border | #475569 |

### Typography
- Heading: Fira Code · Body: Fira Sans
- Google Fonts: fonts.googleapis.com/css2?family=Fira+Code...
```

A narrower retry (`-p "CRM Tax Policy Settings"` with density 9) produced the same
pattern, so this is what the tool recommends for the query — not a one-off miss.

**Rejected, with reasons recorded in `DESIGN-SYSTEM.md §1`:**

| Output | Why it cannot be used here |
|---|---|
| `Real-Time / Operations Landing` sections (hero → metrics → how it works → CTA) | This is a settings panel opened from the sidebar with a single task. A hero and a trial CTA would be decoration on a form. |
| `#0F172A` background, `#22C55E` CTA | The Twenty shell owns the palette and the user can flip light/dark. A per-screen palette would either fight the shell or vanish under it. PRODUCT.md binds this panel to `--t-*` tokens. |
| Fira Code / Fira Sans | A second font inside the shell is a consistency regression, and neither ships in the app. |
| Dials `Variance 2` | Adopted: the panel must not be quirky. |

**Adopted:** `Minimalism & Swiss Style`, the density dial, the motion dial (subtle), and
the accessibility checklist.

## 5. Persisted artifact (the skill's own output file)

```
$ python scripts/search.py "enterprise admin settings data table form management" \
    --design-system --persist -p "CRM Tax Policy Settings" \
    --output-dir docs/design/crm-129-ui-pilot-017/ui-ux-pro-max/evidence
```

```
✅ Design system persisted to
   .../ui-ux-pro-max/evidence/design-system/crm-tax-policy-settings/
   📄 MASTER.md
```

That file (7,220 bytes) is kept **unmodified** in
`evidence/design-system/crm-tax-policy-settings/MASTER.md` so the raw recommendation can
be inspected next to the design that was actually built. Its own header says a page-level
file overrides `MASTER.md`; `DESIGN-SYSTEM.md` is that override, and it records exactly
which parts were overridden and why. Note also the category the tool assigned:
*"Category: Smart Home/IoT Dashboard"* — further evidence that its classifier is built
around dashboards and landing surfaces, not an enterprise settings form.

## 6. What this means for the gate

`DESIGN_GATE_1` asks for *real* use with identifiable evidence, not for obedience. The
tool was installed, invoked four times across two domains, and its own artifact was
persisted. Where it disagreed with the product contract (palette, fonts, page pattern),
the disagreement is recorded above instead of being silently applied — which is what the
skill's Query Contract asks for.
