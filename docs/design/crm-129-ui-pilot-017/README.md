# CRM-129-UI-DESIGN-SKILLS-PILOT-017

Design-only pilot on the «مالیات و عوارض» panel. **No application source was modified.**
Gate status: **`STOP_FOR_USER_APPROVAL`** — nothing is implemented or deployed before the
user's decision.

- Repository: `D:\CrmSource\twenty`
- Branch: `feat/crm-129-quotation` @ `b23e35e927` (upstream `origin/feat/crm-129-quotation`)
- Live page this design targets:
  `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`
- Component in question: `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx`

---

## 1. INSTALL_GATE — both skills installed, identified by Cursor

| | UI UX Pro Max (designer #1) | Taste Skill (fallback only) |
|---|---|---|
| Source | `github.com/nextlevelbuilder/ui-ux-pro-max-skill` | `github.com/Leonxlnx/taste-skill` |
| Command | `npm install -g ui-ux-pro-max-cli` then `uipro init --ai cursor --global` | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| Version | `uipro 2.15.0` | tasteskill **2.5.1** (SKILL.md front matter) |
| Installed at | `C:\Users\User\.cursor\skills\ui-ux-pro-max\` | `C:\Users\User\.agents\skills\design-taste-frontend\` |
| Agents declared | Cursor (only) | Cursor, OpenCode (`skills list -g`) |
| `SKILL.md` read | yes | yes |

Detection proof:

```
$ npx -y skills@1.9.0 list -g

Taste Skill
  design-taste-frontend  ~\.agents\skills\design-taste-frontend
    Agents: Cursor, OpenCode   Source: Leonxlnx/taste-skill
General
  ui-ux-pro-max          ~\.cursor\skills\ui-ux-pro-max
    Agents: Cursor             Source: untracked
```

Both roots are directories this session already loads skills from (`~/.cursor/skills`,
`~/.agents/skills`), so no session restart was needed. **Cost: zero.** No paid tier, credit
or account was created; `uipro` runs entirely from local CSV datasets.

`Taste Skill` was installed and **not used**. It is the fallback for S4 only if you reject
design #1.

## 2. DESIGN_GATE_1 — what is in this folder

| File | What it is |
|---|---|
| `ui-ux-pro-max/index.html` | **The deliverable.** Standalone RTL preview, no build step, no network, sample data only. |
| `ui-ux-pro-max/DIAGNOSIS.md` | Ten measured defects in the shipping panel, recorded before any proposal. |
| `ui-ux-pro-max/DESIGN-SYSTEM.md` | Tokens, type scale, grid, status language, action hierarchy, measured contrast. |
| `ui-ux-pro-max/DESIGN-DECISION.md` | One decision per defect, the reason it serves the operator, and five disagreements left for you. |
| `ui-ux-pro-max/EVIDENCE.md` | The real `uipro` commands, their real output, what was adopted and what was rejected. |
| `ui-ux-pro-max/evidence/…/MASTER.md` | The skill's own persisted design-system file, unmodified. |

### Open the preview

```powershell
cd D:\CrmSource\twenty\docs\design\crm-129-ui-pilot-017\ui-ux-pro-max
start index.html
```

`index.html` is fully self-contained (inline CSS/JS, system fonts), so double-clicking works
with no server. If you prefer a URL:

```powershell
cd D:\CrmSource\twenty\docs\design
python -m http.server 4180 --bind 127.0.0.1
# http://127.0.0.1:4180/crm-129-ui-pilot-017/ui-ux-pro-max/index.html
```

### What you can operate in the preview

- the four state chips at the top (`داده` / `خالی` / `بارگذاری` / `خطا`);
- `دسکتاپ` / `موبایل ۳۹۰` — a real 390 px frame, via container queries, so the phone layout
  is the same CSS the app would ship, not a screenshot;
- `تاریک` — Twenty's dark tokens (`#171717` surface, `#ebebeb` ink, accent ink switched to
  `blue11` because `blue9` measures 3.44:1 there — pairs in `DESIGN-SYSTEM.md §4`);
- add · edit · set default · activate/deactivate · delete (two presses, with the server's
  rules shown as disabled states and reasons) · search · filter · unsaved-edit refusal ·
  inline validation with Persian-digit parsing.

## 3. What the design changes, in one paragraph

The panel becomes a **catalogue with fixed column tracks** (name · tax · duty · total ·
usage · actions) instead of three content-sized islands per row, so every rate sits on one
vertical line and can be compared by looking down. The live rate is marked by a 3 px accent
bar down the row's edge, not by a 12 px pill. The four actions stay present on every row but
are ranked by consequence — `ویرایش` is the row's primary, `حذف` is red at rest and sits
behind a rule and 12 px of air. The editor grows **inside the row's own columns** with the
computed total in the total column's position, instead of a 720 px form floating in a
1052 px card. Below 768 px the row becomes a card, the three rates become one comparable
strip, and every control is 44 px with the destructive one on its own line.

## 4. Not touched (S5)

`tax-policy-settings-panel.tsx` and every other file under `packages/twenty-apps/` are
unmodified. No backend, money domain, tax-policy rules, revision/snapshot, PDF, accounting
adapter, permissions, user data, database, worker restart or `:6080` change. The only
changes in the working tree are the files in this folder.

## 5. Your decision (S4)

- **Approve** → this design becomes the Design of Record, `Taste Skill` stays installed and
  unused, and implementation begins only after your explicit go-ahead, compared against
  this preview.
- **Reject** → say so explicitly, and only then will `Taste Skill` be activated to produce an
  independent alternative with its own preview, for a side-by-side comparison.

No implementation, deployment, or further design exploration happens before that.
