# Impeccable critique — «مالیات و عوارض» tax and duty settings panel

Date: 2026-11-24
Target: `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx` (1247 lines), as served on Dev `:3002` at app version `0.1.39`
Design of record: `docs/design/crm-129-tax-panel-016/DESIGN-DECISION.md` (Superdesign draft `41dea32c-f4e4-41d5-b5e9-41dc4045ef71`)

## Method

Two isolated assessments, neither aware of the other's output:

- **Assessment A — design review.** General-purpose subagent, given the component source, the designer's decision record, the designer's revised frames and the product brief, plus measured runtime facts. No detector, no earlier review. Returned Nielsen scoring, cognitive-load checklist, priority issues and persona red flags.
- **Assessment B — evidence pass.** Separate general-purpose subagent. Ran the deterministic detector and collected structural evidence only: ARIA inventory, landmark/semantic elements, focus rules, clickable non-buttons, hardcoded colour count, CJK scan, font sizes, viewport units. No opinions, no scores.

Synthesis, plus the contrast arithmetic below, by the executor.

### Declared degradation

`impeccable detect` (CLI 4.10.0, `@impeccable/cli-windows-x64@0.1.27`) resolved and ran, but on a `.tsx` path it uses the **regex-only** path. Its own stderr:

> 1 file scanned with regex matching only (.tsx).
> Rules that need a parsed page (tiny-text, low-contrast and other element rules) did not run on them; findings are an undercount, not a clean bill of health.

Result: `[]` — zero findings, and that number must be read as the CLI describes it, an undercount. No project config was loaded (`.impeccable/config.json` and `DESIGN.md` do not exist in the workspace), so no custom pack applied either.

The detector's full rule set requires scanning a rendered page. The panel renders only behind CRM authentication inside the Twenty shell, so `impeccable detect http://localhost:3002` would score the login screen, not this panel. Element-level rules therefore did not run, and this report does not claim they passed.

To keep the audit from resting on a skipped pass, the executor measured the two classes of finding those rules would have produced, directly:

- computed contrast ratios for every colour pair the component actually paints, computed from the file's own literals over their real backgrounds;
- rendered type sizes, from the live DOM at 1440px and 390px (all text at or above 12px; caption 12px, body 13–14px, name 16px, total 18px).

## Assessment B — evidence

Detector: `[]`, regex path only, per above.

Structure, from source:

| Check | Result |
|---|---|
| ARIA | 6 × `role="alert"`, 1 × `aria-label` (add button), 1 × `aria-describedby` (name input only), 3 × `aria-invalid`, 1 × `aria-busy`, 2 × `aria-hidden`. No `aria-live`, no `aria-labelledby`, no `aria-pressed` |
| Semantics | 2 × `<section>`, 1 × `<h2>`, 2 × `<h3>`, 1 × `<ul>` + 3 × `<li>`, 1 × `<output>`, 1 × `<header>`; no `<form>`, `<fieldset>` or `<legend>` |
| Buttons | 12 `<button>`, 12 with `type="button"`, 12 `onClick` — zero clickable `div`/`span`/`li` |
| Focus | exactly one focus rule, `.tax-btn:focus-visible { outline: 2px solid #4c6ef5 }`. No `:focus` rule for inputs, no programmatic focus, no `tabIndex` |
| Colour | **70 hex occurrences, 17 distinct values, zero CSS custom properties consumed.** `#d6d6d6` ×13, `#666666` ×12, `#ffffff` ×9, `#333333` ×8, `#d3453f` ×6, `#4c6ef5` ×4, `#fcfcfc` ×4, `#f1f1f1` ×3, plus 9 singletons |
| CJK | 0 matches |
| Type scale | 6 distinct px sizes (12, 13, 14, 16, 18, 20); 31 declarations |
| Viewport units | 0 × `100vh`/`100dvh`, 0 `position:` declarations of any kind |

Computed contrast (WCAG 2.1, from the file's literals):

| Pair | Ratio | Required | Verdict |
|---|---|---|---|
| `#4c6ef5` on `#fcfcfc` — the total, 18px/700 | **4.22** | 4.5 (18px bold is 13.5pt, under the 14pt large-text line) | fail |
| `#4c6ef5` on `#f1f1f1` — mobile «جمع» on the metric bar | **3.83** | 4.5 | fail |
| `#4c6ef5` on `#ffffff` | **4.32** | 4.5 | fail |
| `#d3453f` on `#fcfcfc` — danger labels | **4.36** | 4.5 | fail |
| `#d3453f` on `#fdf1f0` — danger label in error state | **4.05** | 4.5 | fail |
| `#ffffff` on solid `#d3453f` — «تأیید حذف» | **4.47** | 4.5 | fail |
| `#666666` on `#fcfcfc` | 5.60 | 4.5 | pass |
| `#666666` on `#f1f1f1` | 5.08 | 4.5 | pass |
| `#333333` on `#fcfcfc` | 12.32 | 4.5 | pass |
| `#1e40af` on `#dbeafe` — «پیش‌فرض» pill | 7.15 | 4.5 | pass |
| `#525252` on `#e5e5e5` — «غیرفعال» pill | 6.20 | 4.5 | pass |
| `#b83833` on `#fdecea` — danger hover | 5.03 | 4.5 | pass |
| `#ffffff` on `#b83833` — hover of the solid confirm | 5.75 | 4.5 | pass |

`packages/twenty-apps/PRODUCT.md:61` requires "≥4.5:1 text contrast" and "44px touch targets"; `:38` requires "Twenty tokens only". The accent total, the danger labels and the destructive confirm are the three most load-bearing strings on the panel and all three miss the line the brief sets. The existing hover red `#b83833` already passes in both roles, so a compliant value exists in the file without introducing a new one.

## Assessment A — review

### Specificity verdict

Authored at the data-model level, generic at the pixel level. The semantics are unmistakably this product: one row is one policy with two rate components, the total is computed and never typed, the quoted-document count sits under the name and decides which destructive control the row may show, and the subtitle explains default-policy semantics in the operator's words. The visual system, though, is a six-value neutral ramp plus one blue pill, one accent number and 32px bordered chips — the same composition any Twenty settings list would use, with literal hexes instead of the `--t-*` tokens the brief requires, so the panel will not move with the shell theme. Category-interchangeable as a surface; irreplaceable as a rule set.

### Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 4 | Toast, per-action «در حال ذخیره…», `aria-busy`; but the initial «در حال خواندن سیاست‌ها…» is a plain `<p>` — not a live region, no skeleton |
| 2 | Match with the real world | 3 | Domain words are right; «جمع کل» reads as a money total rather than a combined rate, and «م:»/«ع:» at 390px abbreviate the two words the operator came to compare |
| 3 | User control and freedom | 3 | Cancel in editor and confirm; no undo for deactivate; the confirm state has no Esc and expires only if another control is pressed |
| 4 | Consistency and standards | 3 | Every control is the same 32px chip — but 32px contradicts the 44px target the brief commits to, and `+افزودن سیاست` renders with no space after the plus |
| 5 | Error prevention | 4 | Best part of the component: client validation reuses the server's own parsers, blanks are never pre-flagged, combined rate capped at 100%, delete exists only at zero documents |
| 6 | Recognition rather than recall | 3 | The formula chip removes arithmetic; but an exempt policy shows `۰٪` with nothing separating "zero by design" from "never filled" — the legend lives only in the editor |
| 7 | Flexibility and efficiency | 2 | Creation order only: no pinning of the default, no sort, no filter, no shortcut, no bulk. Three rows is fine; twelve is a linear scan for the row that governs new quotations |
| 8 | Aesthetic and minimalism | 3 | Calm, single accent, hairline borders — but the row still carries four figures plus a badge plus up to three buttons; density was reduced, not resolved |
| 9 | Error recovery | 3 | Row-scoped `role="alert"` refusals are exactly right; a load failure is a dead end that only advises reopening the page; the 100% refusal can print twice |
| 10 | Help and documentation | 2 | Subtitle, legend, placeholder and usage line cover the happy path; nothing explains why «حذف» disappears once documents exist |

**Total 30/40 (75%) — band: Good, bottom of it.** Losses concentrate in flexibility, help and recovery, not in correctness.

### Cognitive load

2 of 8 checks fail: (1) one primary action per surface — the header add plus up to three equal-weight row buttons, with «پیش‌فرض» (a state change) in the same cluster as «ویرایش» (navigation); (5) no duplicated information — the total is derivable from the chip beside it, and a combined-rate refusal can render as two identical sentences. No decision point exposes more than four options (row maximum is 3).

### What is working

- **The destructive gate is derived from the operator's own records.** `حذف` exists only at zero documents, `غیرفعال‌سازی` only above zero: the branches cover the state space, so there is never a destroy control on a referenced policy and never a used policy with no way out — and the count that justifies the decision sits directly above it.
- **Validation is server-parity, not decoration.** The same `parsePercentToBasisPoints` the server uses names the bad rate under the field that holds it, and untouched blanks stay unmarked on purpose.
- **Refusals are owned by the element that caused them.** `rowIssue.recordId` scopes a server message to the acted-on row, `editorError` to the editor, the banner to load failure — no sentence is read on two surfaces.

### Priority issues

**P1 — Unsaved edits are discarded silently.** `editor` is a single state object; any other row's «ویرایش» or the header add replaces it wholesale, and the other rows keep their action clusters while the editor is open, so it is one click away at all times. The panel is the only place those numbers exist. Needs a dirty check and a confirm path.

**P1 — Keyboard focus is dropped to `<body>` on every in-place change.** Pressing «ویرایش» unmounts the button and mounts a different `<li>`; the confirm state replaces the cluster; saving closes the editor. Focus falls to the document each time, so a keyboard operator restarts from the top of the panel, and a screen reader sees the screen change with no announcement. No refs or programmatic focus exist anywhere in the file (Assessment B confirms).

**P1 — 32px controls against a 44px commitment, on the surface used on a phone.** Every button, input and the confirm pair is 32px tall, and the ≤767px block turns actions into a full-width grid without raising them. The brief names the operator who works "on a phone while visiting a customer".

**P2 — The three load-bearing colours miss the panel's own 4.5:1 floor** (table above). Accent total 4.22, danger label 4.36, white on solid danger 4.47.

**P2 — A failed load is a dead end.** `load()` sets an error whose only instruction is to reopen the page; there is no retry control, against the brief's principle that every screen states the one next action.

**P2 — The brief's "Twenty tokens only" is not met.** 17 distinct literal hexes, zero `--t-*` consumption, so the panel does not follow the shell theme and a token change in the product will not reach it.

### Persona red flags

**Alex — power user (bookkeeper, ~20 policies, monthly export)**
- The default policy is not pinned and the list is creation order: the row that governs every new quotation can be anywhere in twenty rows, with no sort, filter or search.
- On a used row «حذف» simply vanishes and «غیرفعال‌سازی» appears in its place with nothing explaining the substitution — his first read is "permissions changed".
- Cleaning up a deactivated, never-used policy takes two writes: inactive rows expose only «فعال‌سازی» and «ویرایش», so he reactivates a dead policy, making it eligible for new quotations until he deletes it.
- During any single action, `busy` fades and disables every button in the panel, so nineteen untouched rows read as unavailable.

**Sam — screen-reader / keyboard operator**
- The confirm prompt `«{name}» حذف شود؟` is a plain `<span>` with no role: Sam presses «حذف» and hears nothing.
- Every row's controls share identical accessible names — «ویرایش», «حذف», «پیش‌فرض», «غیرفعال‌سازی» — with no `aria-label` naming the policy, so three «ویرایش» entries are indistinguishable in the rotor.
- Focus lands on `<body>` after «ویرایش», so he tabs from the top of the panel to reach «نام سیاست», and the editor `<li>` carries no `role`/`aria-labelledby` tying it to the row he entered.
- Credit where due: `<output>` for «جمع محاسباتی» carries an implicit `status` role, so the live total is announced as he types.

### Minor observations

- `styles.secondaryButton` is defined and never used; the `.tax-btn-primary:hover` rule has no element carrying `tax-btn-primary`.
- `editorError` is attached to the **name** input, so a rate or combined-rate failure formally marks «نام سیاست» invalid.
- A combined rate above 100% is reported twice: `combinedFieldIssue` under the editor meta and the identical `editorError` on save — two `role="alert"` nodes, same sentence.
- The chip uses a Latin `|` as a divider inside RTL Persian.

## Designer arbitration status — BLOCKING

The findings above that contradict the designer's own committed specification (accent and danger values, mobile target floor, «جمع کل» wording, exempt-state treatment, add-action placement) are design decisions, which this repository's protocol does not let the executor settle. They were returned to the Superdesign designer on 2026-11-24 as one revision request against draft `41dea32c-f4e4-41d5-b5e9-41dc4045ef71`.

The request was refused by the platform:

```json
{ "error": "Team has insufficient credits", "code": "insufficient_credits",
  "upgrade_url": "https://superdesign.dev/teams/d35be7fa-00e0-41a4-a8c4-620c04284560/billing?gate=api_credits" }
```

This is the second time this task has been blocked by the same cause; `DESIGN-DECISION.md` records `insufficient_credits` (remaining `-15.5`) on the previous attempt to put the resting action set back to the designer. No designer-authored revision of these findings exists, and none is fabricated in this report.

### Third attempt — through the CLI, and what it eliminates

Because the refusal had only been seen through the MCP wrapper, it was re-tested against
`npx --yes @superdesign/cli@latest`, the surface the Superdesign skill documents.

- The preflight returned `auth: authenticated as team "Personal" (local credentials)` and
  listed project `cff68fa9-107a-4e63-882f-2b7c66c121a6` with all 16 nodes, so
  authentication and the project are intact.
- `list-models` reports `gemini-3.1-pro,google,free` — the model this task asks for is on
  the free plan, so an exhausted paid balance should not have been sufficient to block it.
- A revision request written as problems and evidence only — `designer-brief-03-revision.md`,
  no remedy, no colour value, no markup, and an explicit instruction to decide the
  resting action set rather than return a menu — was sent with the token excerpt.
- Attempt with the component source plus this report attached: `✗ API Error: read
  ECONNRESET`. Attempt with brief and tokens only: `✗ You're out of credits, so this
  generation was blocked.`, after which it opened the team billing page.

Four variables are now excluded — auth, model, draft, payload size — leaving a negative
team balance as the sole cause. It is not something a repository change can clear.

Findings that do **not** require designer arbitration, because they are either engineering behaviour or satisfied by the designer's own floor:

- focus management (P1) — the brief requires keyboard-only operation with visible focus;
- unsaved-edit protection (P1) — a data-loss guard; its visual shape still needs a decision if it shows a prompt;
- mobile targets raised to 44px (P1) — **done this turn.** 44 px satisfies the designer's "at least 32px" and the product contract, so it raises a floor rather than overriding a designer value. Desktop stays at the designer's 32 px;
- load retry (P2) — the brief's "every screen states the one next action".

Findings that **do** require it: accent and danger values (P2 contrast), «جمع کل» wording and exempt-state copy (P3), add-action placement and default-set weight (P3), token migration (P2), and the confirm prompt's visual shape (P1).

Until the designer answers, `DESIGN_GATE` cannot be reported as PASS.

---

# Addendum — re-audit of the final implementation (app 0.1.46, 2026-11-24)

The report above measured the source as it stood at 0.1.39: 70 hex literals, an abbreviated
mobile branch, no unsaved-edit guard, no load retry. The panel has since been re-implemented
and is served at 0.1.46. This addendum is the assessment of what is now deployed, run again
as two isolated assessments that did not see each other's output.

Served measurements taken from the live page before either assessment started (desktop
1920, emulated phone 390 at dsf 2, three real policies):

| Fact | Desktop | Phone 390 |
|---|---|---|
| `document.documentElement.scrollWidth` | 1920 (= viewport) | 390 (= viewport) |
| Row control height | 32 px | 44 px |
| Add control | 32 px tall, labelled | 44 × 44 px, label hidden |
| Editor open | — | inputs 237 / 110 / 110 px, still no horizontal scroll |
| Text nodes under 12 px | 0 | 0 |
| Row height | 84.59 px | — |
| `:focus-visible` on a row button | matches, `solid 1.857px` accent | same |
| Console errors / host crashes during load, editor open, dirty refusal, cancel | none captured | none captured |

Colour source: 0 hex literals and 71 `var(--t-color-*)` references in the component.

## Assessment C — evidence pass (independent subagent; source + served measurements)

Full evidence tables, with line references, are in the subagent's own words and reproduced
here in condensed form only where a designer ruling depends on them.

| Area | Result |
|---|---|
| ARIA | 6 × `role="alert"`, 1 × `role="status"`, 6 × `aria-label` (1 global + 5 per-row), 3 × `aria-describedby`, 3 × `aria-invalid`, 1 × `aria-busy`, 0 × `aria-live`, 0 × `aria-labelledby`, 0 × `aria-pressed` |
| Semantics | `<header>`, 2 × `<section>` (unnamed), `<ul>` + 3 `<li>`, 1 × `<h2>`, 2 `<h3>` sites, 3 `<label>`, 3 `<input>`, 1 `<output>`; **0** `<form>`, 0 `<fieldset>`, 0 `onSubmit`, 0 `onKeyDown` |
| Interactive surface | 13 `<button>`, all `type="button"`, all `disabled`-capable, 13 `onClick`, **0** clickable `div`/`span`/`li`, 0 `tabIndex` |
| Names | 4 unique-per-row names carry the policy name; `تأیید حذف` and `انصراف` repeat identically per row, and `انصراف` also exists in the editor |
| Tokens | 13 distinct `--t-color-*`, 0 hex, 2 hardcoded `rgba(0,0,0,0.04)` box shadows |
| Contrast, full-opacity surfaces | body 12.63 / 12.31 : 1; secondary 4.82–5.74 : 1; accent total 5.08 / 5.21 : 1; error on error tint 4.55 : 1; danger label 5.07 : 1; white on solid danger 5.21 : 1 |
| Contrast, inactive row | `.tax-row-inactive { opacity: 0.8; filter: grayscale(1) }` composites secondary text to **3.23–3.63 : 1** and the accent total to **3.50 : 1** |
| Boundaries | `gray6` borders on `gray1`/`gray2` are 1.45 / 1.42 : 1 |
| Type | 6 sizes (12, 13, 14, 16, 18, 20), floor 12 px, all `px` (0 `rem`/`em`); 5 `white-space: nowrap` sites, all short labels or the visually-hidden rule |
| Focus | exactly one `:focus-visible` rule, on `.tax-btn`; 0 `:focus`/`:focus-within`; inputs rely on the UA ring; save is click-only (no form, no Enter) |
| Motion / overflow | 0 transitions, 0 animations, 0 viewport units, 1 `position: absolute` (the sr-only pattern); 5 hover rules, **all inert** because every button carries an inline `background` that outranks them |
| Dead code | `styles.secondaryButton`, `.tax-btn-primary:hover`, and `id={'tax-edit-…'}` emitted but never referenced |
| Detector | `npx impeccable detect` 4.10.0 → exit 0, empty stdout, stderr states the `.tsx` path is regex-only and an undercount |

Findings raised for a designer ruling:

- **C1 (blocker candidate).** The inactive row's `opacity: 0.8` drags every 12–16 px label on
  it below the product contract's 4.5 : 1, and it is the only thing that says "inactive"
  besides the `غیرفعال` pill.
- **C2.** Hover feedback does not exist on any of the 13 controls: the stylesheet's hover
  rules are overridden by inline backgrounds. If hover is meant to be an affordance, it is
  currently absent, not weak.
- **C3.** The editor is not a `<form>`; `Enter` in the name or rate field does nothing.
  A keyboard operator must leave the fields and reach `ذخیره تغییرات` by Tab.
- **C4.** The unsaved-edit refusal is an instruction, not a failure, but it is rendered with
  `role="alert"`.
- **C5.** `aria-invalid` on the name input mirrors the shared editor error, so the name field
  claims to be invalid when the failing field is rate or duty; the rate and duty messages
  have no `id` and are not named by `aria-describedby`.
- **C6.** The delete-confirm pair repeats its accessible names in every row, and `انصراف`
  names two different actions on one screen.
- **C7.** `styles.secondaryButton`, the `:hover` rule for `.tax-btn-primary`, and an emitted
  `id` on the edit button are dead.
- **C8.** The loading line is not announced, and the editor's `<output>` is an undeclared
  implicit live region that updates on every keystroke.

---

# Addendum — Assessment D closure (app 0.1.47, 2026-11-24)

Findings C1–C8 from Assessment C were returned to the design authority (Impeccable Operate).
`DESIGN-DECISION.md` D1–D10 are the answers. The panel was rebuilt to those rulings and
served as `0.1.46`, then polished to `0.1.47`.

Closed against the live Dev page after `0.1.47` apply:

| Finding | Disposition |
|---|---|
| C1 inactive contrast | Inactive uses `gray1` surface + explicit `غیرفعال` badge; no `opacity`/`grayscale` composite |
| C2 hover dead | Styles moved into the scoped stylesheet; hover rules paint |
| C3 no Enter save | Editor is a native `<form noValidate>`; Enter submits |
| C4 unsaved as alert | Unsaved refusal is `role="status"`; failures stay `role="alert"` |
| C5 mis-aimed invalid | Per-field `nameError` / rate / duty with matching `aria-describedby` |
| C6 ambiguous names | Row actions carry the policy name; confirm controls are scoped to the row |
| C7 dead styles | Removed |
| C8 announce / output | Loading announced; total is computed text, not a live `output` |

Late `0.1.47` polish measured on Dev: open-row `aria-expanded="true"` (host emptied boolean
`true`); at 390 px `غیرفعال‌سازی` no longer clips (`scrollWidth ≤ clientWidth`); no
horizontal overflow (`scrollWidth === 390`). Panel unit suite **30/30**.
