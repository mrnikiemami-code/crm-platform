# CRM-129-COMPOSER-DESIGN-EXPERIMENT-018 — Design rationale

**Mode:** DESIGN → IMPLEMENTATION · **Model:** Composer · **Gate:** user approved 2026-11-24  
**Status:** approved and implemented in `tax-policy-settings-panel.tsx` (app **0.1.48**)

This file records independent product/UX judgment for «مالیات و عوارض».
It does **not** reuse the visual pattern of prior drafts or `DESIGN-DECISION.md`.

---

## 1. What the product actually is (from source & contracts)

| Fact | Source |
|---|---|
| Workspace catalog of tax **policies**; one policy = one decision with **tax + duty** components | `tax-policy.object.ts`, `domain/money/tax-policy.ts` |
| Rates stored as integer basis points (never float %) | same |
| Exactly one **active default**; new quotations start from it | object description + service routes |
| `isExempt` only when tax and duty are both zero | domain rules |
| Soft-delete unused policies; refuse delete when used / default | `tax-policy-delete`, `TAX_POLICY_IN_USE` |
| Deactivate used policies; historical sealed rates stay immutable | object description |
| Users: Iranian SMB owners, sales, bookkeepers — Persian RTL, plain language | `packages/twenty-apps/PRODUCT.md` |
| A11y floors: keyboard, visible focus, ≥4.5:1, 44px touch, `dir=rtl` | PRODUCT.md |
| Settings UI must enforce invariants the generic record form cannot | object `isUICreatable/Editable: false` |

**Business goal:** let a non-developer keep the workspace tax catalog correct so every new quotation starts with the right rates, without endangering sealed documents.

**Primary user job on this page:** find the current default, compare rates, create/edit a policy, promote a default, deactivate or delete safely.

---

## 2. Design system inputs used (UI UX Pro Max)

- `--design-system` for enterprise CRM finance settings: **Minimalism / Swiss**, density **8**, variance **3**, motion **2**.
- Color bias toward **B2B professional navy/slate** rather than consumer indigo or gold-fintech dark.
- UX guidelines applied: confirm destructive actions; labelled fields; inline validation; stable layout around badges; tables → card stack on narrow viewports.
- Persian body type: **Vazirmatn** (Lexend from the English enterprise pack is weak for Arabic-script UI).

Anti-patterns deliberately avoided: decorative glass, multi-layer shadows, marketing hero, emoji icons, purple SaaS chrome.

---

## 3. Concept chosen: «Ledger + Inspector»

**One dense ledger table** for comparison, plus a **sticky inspector panel** for create/edit.

### Why not a card-per-policy wall

Policies are few, but the user’s job is **comparison** (tax vs duty vs total vs usage). A table aligns numbers in columns; cards force the eye to re-find the same field on every block. Enterprise accounting UIs (and the users’ mental model from Sepidar/Asan) already treat master data as ledgers.

### Why a side inspector instead of inline row replacement

Editing rates is a **form task** with validation, computed total, and a destructive path. Putting that next to the list:

1. Keeps the catalog visible while editing (orientation).
2. Avoids the “row morphs into a form” pattern that fights keyboard focus and selection.
3. Makes create and edit the same surface — one place to learn.

On viewports under ~960px the inspector stacks under the list (same content, linear reading).

### Why a default banner above the table

The single most consequential fact on the page is **which policy new quotations inherit**. Burying that inside a badge in row 1 fails the product principle “every screen states the one next action / where you are.” The banner is a persistent answer, not decoration.

### Hierarchy of actions

| Action | Visual weight | Reason |
|---|---|---|
| سیاست جدید | Primary filled (page header) | Rare but intentional write; needs a clear entry |
| ویرایش / پیش‌فرض / فعال‌سازی | Ghost, dense | Frequent but secondary to reading rates |
| حذف | Outline danger, disabled when blocked | Destructive; presence communicates the rule; disabled + usage column explains why |
| تأیید حذف | Solid danger, only after confirm | Accidental delete prevention (UX Pro Max) |

Disabled delete stays visible: a control that vanishes reads as “no permission,” not “this policy is referenced.”

### Numbers

Tax, duty, and total use **tabular figures**, LTR plaintext embedding inside RTL rows, so `9.5٪` columns align. Zero+zero total shows **معاف**, not `۰٪`, so exemption is a statement, not a blank measurement.

### Mobile (390)

Table collapses to compact cards with a 3-cell rate strip (مالیات / عوارض / نرخ کل) and 44px targets. Same data model; no second product.

---

## 4. What this preview deliberately does not change

- Money domain, basis-point math, default uniqueness, historical seal semantics
- Twenty shell chrome / token migration into the live app (preview is standalone)
- Live CRM source and Dev deploy

---

## 5. Deliverables

| File | Role |
|---|---|
| `preview-ledger-inspector.html` | Openable interactive preview (RTL, desktop + mobile CSS) |
| `DESIGN-RATIONALE.md` | This decision record |

Open preview:

`docs/design/crm-129-composer-design-experiment-018/preview-ledger-inspector.html`

---

## 6. Approval gate

- [x] User approved: «همین طرح پیاده کن» (2026-11-24)
- [x] Implemented as Ledger + Inspector on Dev app `0.1.48`
- Live source: `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx`
