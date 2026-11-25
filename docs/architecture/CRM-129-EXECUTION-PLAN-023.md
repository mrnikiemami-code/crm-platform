# CRM-129-EXECUTION-PLAN-023

**Companions:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md), [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md), [`CRM-129-GOAL-023-PROGRESS.md`](./CRM-129-GOAL-023-PROGRESS.md)  
**Plan baseline:** `0fe64a9305` · **Execution activation:** `cdb890b3f5` + EXECUTION-024 (C1–C7)  
**Gate:** pack-level `STOP_FOR_ARCHITECT` / user gates as required  
**Principle:** each pack is independently reviewable and revertible; Goal completeness ≠ big-bang merge; one pack PASS ≠ Goal done

---

## S4 — Product design program

### Intent

One coordinated visual/UX language for **accounting settings** and the **quotation draft/record** financial surfaces, so a Persian operator can finish the workflow without a technical guide (Goal SC10).

### Designer autonomy

- Designer diagnoses UX defects from product contracts + live Dev walkthrough + this Goal.
- **Do not ask the user** where buttons go, which colors to use, or card-vs-table.
- Design approval is **user-only**. Rejected or unapproved frames are not Design of Record.

### Prior art (status)

| Artifact | Status | Use |
|---|---|---|
| TAX-016 tax panel | Shipped Design of Record for «مالیات و عوارض» list | May extend; do not silently restyle without user |
| UI pilot 017 rev-02 | Awaiting user; **not** approved | **Not** a product reference |
| Any Superdesign archive | Historical | Forbidden as implementation source without new approval |

### Design deliverables (before related implementation)

1. Browser-reviewable static HTML (local static server), covering at least:
   - Accounting settings: overview, connections (incl. mapping ownership copy), catalog, customers, documents
   - Quotation draft: document currency, per-line tax, read-only snapshotted codes, defaults
2. Short DESIGN-DECISION.md tying each major choice to an operator defect
3. Explicit non-goals (no outbound live, no multi-currency activation chrome)

### Design gate sequence

```
Design pack (WS7-A frames)
  → USER visual approval
    → Design of Record frozen
      → only then UI implementation packs consume frames
```

Superdesign is **out of scope** for this Goal’s design path unless architect reopens credits/tooling.

### Skills

Prefer installed free skills (`ui-ux-pro-max`, `design-taste-frontend`, Impeccable) under the same “user approval required” rule as 017. Taste Skill only after explicit reject of the active designer path.

---

## Dependency graph (executive)

```
WS0  Goal docs ── DONE
EXECUTION-024 C1–C7 ratification + Progress + WS1 preflight ── THIS CHECKPOINT
  │
  ├─ STOP_FOR_ARCHITECT (WS1 schema + lock preflight)
  │
  ├─ WS7-A Design frames
  │     └─ USER_APPROVAL ──┐
  │                        │
  ├─ WS1 Reference accounting codes (after architect open)
  │           │
  ├─ WS2 Snapshot + first-use lock (C4; confirm lock family)
  │           │
  ├─ WS3 Per-line tax + multi-tax outbound gate (C7)
  │           │
  ├─ WS4 Document currency IRR phase 1 + phase-2 hooks (C2)
  │           │
  ├─ WS5 Settings ownership cleanup (C6)
  │           │
  ├─ WS6 Mock/Asan shared capability UX
  │           │
  └─ WS7-B Implement Design of Record
        └─ USER_UAT (SC10) → Goal close board
```

Parallelism: WS7-A // WS1 after architect opens WS1; WS5 after catalogs exist; WS6 // WS5.

---

## Workstream packs

### WS0 — Goal registration (this task)

| | |
|---|---|
| **Scope** | Master Goal, Financial Contract, Execution Plan, Recovery pointer |
| **Files** | `docs/architecture/CRM-129-MASTER-GOAL-023.md`, `…-FINANCIAL-CONTRACT-023.md`, `…-EXECUTION-PLAN-023.md`, `CRM-ARCHITECT-RECOVERY.md` |
| **Deps** | None |
| **Risk** | Low |
| **Acceptance** | Docs on branch; Recovery CURRENT cites Goal 023; no product diff |
| **Done when** | `STOP_FOR_ARCHITECT` recorded |
| **Next gate** | Architect opens WS1 and/or WS7-A |

---

### WS1 — Authoritative CRM accounting codes

| | |
|---|---|
| **Scope** | Add `accountingCode` to tax policy; currency catalog foundation; item + person/company fields; settings/tax panel edit surfaces (functional, design-light until WS7-B) |
| **Likely files** | `tax-policy.object.ts`, tax authority service, tax panel; new currency object + constants; `catalog-item.object.ts`; person/company field defs; universal-identifiers; tests |
| **Deps** | Architect acceptance of [`CRM-129-GOAL-023-WS1-PREFLIGHT.md`](./CRM-129-GOAL-023-WS1-PREFLIGHT.md); C1–C7; Goal + Contract |
| **Risk** | Medium — `defineField` on person/company; new currency object; metadata apply churn |
| **Acceptance** | Empty codes allowed; IRR currency catalog seeded; save/validate; workspace isolation; GraphQL generic write still blocked; **no** quotation snapshot/lock yet (WS2); **no** item/party lock (C4) |
| **Done when** | Unit + authority tests green; Progress → `TECHNICALLY_VERIFIED`; architect → `ARCHITECT_ACCEPTED` before WS2 |
| **Next gate** | Architect → WS2 |

---

### WS2 — Quotation snapshot of codes + first-use lock

| | |
|---|---|
| **Scope** | Persist snapshotted CRM accounting codes on draft save; refuse client overrides; lock reference code mutation after first use; concurrency with shared/exclusive advisory lock |
| **Likely files** | `quotation-draft-persistence.service.ts`, parse draft util, revision snapshot util, tax/currency/item authority, lock util, draft form read-only displays, Jest + UAT race harness pattern from TAX-016 |
| **Deps** | WS1 `ARCHITECT_ACCEPTED`; architect confirm of lock-family proposal (ex-D-023-6) in preflight |
| **Risk** | High — TOCTOU; must not break TAX-008 rate lock ordering; lock by **reference id** (C4) |
| **Acceptance** | First successful draft save locks tax/currency `accountingCode` by entity id; concurrent edit refused/queued with deterministic test; sealed revisions unchanged; item/party codes remain unlocked |
| **Done when** | Deterministic concurrency test PASS; recovery note |
| **Next gate** | Architect → WS3 / WS4 |

---

### WS3 — Per-line tax policy

| | |
|---|---|
| **Scope** | Line fields for policy + rates + tax accounting code; money domain per-line rates; draft form line control; header default for new lines; keep legacy header tax fields (C7); revision/PDF/API; outbound multi-tax gate (block unless adapter proves support) |
| **Likely files** | `quotation-line.object.ts`, `draft-quotation.ts`, `document-totals.ts`, `line.ts`, draft form, persistence, snapshot, PDF templates, outbound-plan / financial-contract, tests |
| **Deps** | WS2 `ARCHITECT_ACCEPTED`; independent financial-integrity gate |
| **Risk** | **Very high** — financial correctness; legacy header-only docs; PDF; adapters |
| **Acceptance** | Two lines, two policies → independent tax; default policy on new line; snapshot seals line policies; legacy reopen rule from Contract; money invariants hold; no silent reprice |
| **Done when** | Focused money + persistence + app tests PASS; architect DATA_INTEGRITY gate |
| **Next gate** | Architect; design must cover line tax before WS7-B polish |

---

### WS4 — Phase 1 document currency + phase-2 hooks

| | |
|---|---|
| **Scope** | Document currency from catalog; **IRR-only** operational amounts (C2); persist line `currencyCode = header`; `totalsByCurrency` shape reserved; `MULTI_CURRENCY_DOCUMENTS=false`; currency accountingCode snapshot via WS2 fields |
| **Likely files** | currency services/UI, draft form, persistence, financial-contract gates, feature flag constant |
| **Deps** | WS1 currency catalog; WS2 snapshot/lock for currency codes |
| **Risk** | Medium if UI accidentally exposes non-IRR |
| **Acceptance** | Default IRR auto-applies; all lines match header; non-IRR refused; mixed currency UI absent; no cross-currency sum |
| **Done when** | Tests + Contract S3 hooks present; flag off verified |
| **Next gate** | Architect (phase 2 activation is a **future Goal**, not a silent follow-on) |

---

### WS5 — Accounting settings: stop redefining tax/currency codes

| | |
|---|---|
| **Scope** | Replace free-text CRM-side code authoring UX with pickers bound to tax/currency catalogs; copy that states vendor mapping ownership; validate orphan mapping keys; keep Asan special item codes as vendor mechanics |
| **Likely files** | `accounting-connection-form.tsx`, `accounting-shared.tsx`, connection-settings parse, settings panel tests, mapping types |
| **Deps** | WS1 (catalogs exist); design frames preferred |
| **Risk** | Medium — operator muscle memory; migration of stored mappings |
| **Acceptance** | Cannot invent CRM tax/currency identity in settings; existing valid mappings still load; Persian empty/error states clear |
| **Done when** | Panel tests + Contract F7 checks |
| **Next gate** | WS6 / WS7-B |

---

### WS6 — Mock & Asan shared structure + real capabilities

| | |
|---|---|
| **Scope** | Ensure Mock and Asan use the same settings section structure; show/hide only via `AdapterCapabilities`; Mock profiles exercise real capability matrix; no fake “full” UI for unsupported modes; honesty for REMOTE_UNPAGED / unverifiable tax catalog |
| **Likely files** | `accounting-settings-panel.tsx`, connection form, `capabilities.ts`, mock profiles, asan-capabilities, overview checklist |
| **Deps** | WS5 helpful; P0-3 go-live checklist may align later |
| **Risk** | Low–medium |
| **Acceptance** | Switching Mock profile changes visible requirements consistently with gate/preview; Asan path shows same IA; no real vendor call |
| **Done when** | Capability-driven UI tests PASS |
| **Next gate** | WS7-B |

---

### WS7 — Design then implement professional UX

#### WS7-A — Design only

| | |
|---|---|
| **Scope** | Browser-reviewable frames for settings + quotation financial UX under Goal 023; DESIGN-DECISION; no product code |
| **Deps** | Goal + Contract |
| **Risk** | Low |
| **Acceptance** | Servable HTML; user can approve/reject without guessing |
| **Done when** | `STOP_FOR_USER_APPROVAL` |
| **Next gate** | User approval → WS7-B |

#### WS7-B — Implement Design of Record

| | |
|---|---|
| **Scope** | Apply approved frames to real components; Persian microcopy; accessibility targets; no schema change unless already shipped by WS1–4 |
| **Deps** | User-approved Design of Record; preferably WS3–WS6 functionally present |
| **Risk** | Medium — fidelity vs host constraints (known from TAX-016) |
| **Acceptance** | USER_UAT: operator completes create policy → set codes → draft with line tax → preview accounting **without** engineering help; technical tests still PASS |
| **Done when** | User accepts SC10; recovery closure |
| **Next gate** | Goal 023 COMPLETE board (architect) |

---

## Cross-cutting rules for every pack

1. Read Goal 023; state which SC# the pack advances.
2. No Outbound flag flip; no Asan live; no worker / `:6080` edits.
3. No secret literals; no LIVE_VERIFIED claim.
4. Do not rewrite Money domain beyond what the pack’s Contract clause allows.
5. Do not mark COMPLETE without evidence paths in Recovery.
6. If a pack needs wide locking or money rewrite beyond Contract, **STOP_FOR_ARCHITECT** with evidence — do not improvise.

---

## Suggested first implementation slice (after architect opens WS1)

1. Implement WS1 per preflight (no quotation behavior change).
2. Optionally start WS7-A design frames in parallel.
3. Sequence **WS2 → WS3 → WS4**; **WS5/WS6** after catalogs exist.
4. **WS7-B** only on user-approved design.

---

## Goal completion board (future)

| Gate | When |
|---|---|
| CONTRACT_GATE | C1–C7 in Contract (this activation) + architect WS1 open |
| DESIGN_GATE | User approves WS7-A Design of Record |
| DATA_INTEGRITY_GATE | WS2–WS4 evidence |
| SECURITY_GATE | Guards + isolation + lock tests |
| UX_GATE | USER_UAT on Dev |
| GOAL_023_COMPLETE | All SC1–10 evidenced; Progress all USER/ARCHITECT accepted; Recovery closed |

---

## Current gate (EXECUTION-024 first action)

**`STOP_FOR_ARCHITECT` — WS1 schema and lock preflight** — product untouched; await open to implement WS1.
