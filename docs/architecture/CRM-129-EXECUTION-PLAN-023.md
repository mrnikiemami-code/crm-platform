# CRM-129-EXECUTION-PLAN-023

**Companions:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md), [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md)  
**HEAD at plan:** `feat/crm-129-quotation` @ `0fe64a9305`  
**Gate:** `STOP_FOR_ARCHITECT` — no pack starts without architect approval for that pack  
**Principle:** each pack is independently reviewable and revertible; Goal completeness ≠ big-bang merge

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
WS0  Goal docs (this delivery) ── DONE as planning
  │
  ├─ WS7-A Design frames (accounting + quotation financial UX)
  │     └─ USER_APPROVAL ──┐
  │                        │
  ├─ WS1 Reference accounting codes (tax/currency/item/party)
  │     └─ D-023-1, D-023-4
  │           │
  ├─ WS2 Snapshot + first-use lock + draft authority
  │     └─ D-023-6
  │           │
  ├─ WS3 Per-line tax (money + persistence + PDF/API)
  │     └─ D-023-3, D-023-5
  │           │
  ├─ WS4 Document currency phase 1 + phase-2 schema hooks
  │     └─ D-023-2
  │           │
  ├─ WS5 Settings ownership cleanup (no CRM code redefinition)
  │           │
  ├─ WS6 Mock/Asan shared capability UX honesty
  │           │
  └─ WS7-B Implement approved design on live surfaces
        └─ USER_UAT (SC10)
```

Parallelism allowed: WS7-A // WS1 after architect opens both; WS5 can start after WS1 identities exist; WS6 can parallel WS5.

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
| **Deps** | Close **D-023-1**, **D-023-4**; Goal + Contract read |
| **Risk** | Medium — standard-object field strategy; metadata apply churn |
| **Acceptance** | Empty codes allowed; save/validate; workspace isolation; GraphQL generic write still blocked; no quotation behavior change yet |
| **Done when** | Unit + authority tests green; Dev apply of fields only if architect authorizes deploy pack |
| **Next gate** | Architect → WS2 |

---

### WS2 — Quotation snapshot of codes + first-use lock

| | |
|---|---|
| **Scope** | Persist snapshotted CRM accounting codes on draft save; refuse client overrides; lock reference code mutation after first use; concurrency with shared/exclusive advisory lock |
| **Likely files** | `quotation-draft-persistence.service.ts`, parse draft util, revision snapshot util, tax/currency/item authority, lock util, draft form read-only displays, Jest + UAT race harness pattern from TAX-016 |
| **Deps** | WS1; close **D-023-6** |
| **Risk** | High — TOCTOU; must not break TAX-008 rate lock ordering |
| **Acceptance** | First draft save locks code; concurrent edit queues/refuses with stable code; sealed revisions unchanged; permissions preserved |
| **Done when** | Deterministic concurrency test PASS; recovery note |
| **Next gate** | Architect → WS3 / WS4 |

---

### WS3 — Per-line tax policy

| | |
|---|---|
| **Scope** | Line fields for policy + rates + tax accounting code; money domain per-line rates; draft form line control; header default for new lines; revision/PDF/API; outbound multi-tax gate per **D-023-3** |
| **Likely files** | `quotation-line.object.ts`, `draft-quotation.ts`, `document-totals.ts`, `line.ts`, draft form, persistence, snapshot, PDF templates, outbound-plan / financial-contract, tests |
| **Deps** | WS2; close **D-023-3**, **D-023-5** |
| **Risk** | **Very high** — financial correctness; legacy header-only docs; PDF; adapters |
| **Acceptance** | Two lines, two policies → independent tax; default policy on new line; snapshot seals line policies; legacy reopen rule from Contract; money invariants hold; no silent reprice |
| **Done when** | Focused money + persistence + app tests PASS; architect DATA_INTEGRITY gate |
| **Next gate** | Architect; design must cover line tax before WS7-B polish |

---

### WS4 — Phase 1 document currency + phase-2 hooks

| | |
|---|---|
| **Scope** | Currency catalog UX/default; document currency selection (per **D-023-2**); persist line `currencyCode = header`; `totalsByCurrency` shape; `MULTI_CURRENCY_DOCUMENTS=false`; currency accountingCode snapshot |
| **Likely files** | currency object/services, draft form, persistence, snapshot, financial-contract gates, feature flag constant |
| **Deps** | WS1 currency rows; preferably WS2; close **D-023-2** |
| **Risk** | High if non-IRR selectable without money-domain STOP |
| **Acceptance** | Default currency auto-applies; all lines match header; mixed currency UI absent; no cross-currency sum; IRR history intact |
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

## Suggested first implementation slice (after architect opens)

1. Ratify open decisions D-023-1…6 (can be a short architect addendum).
2. Open **WS7-A** and **WS1** in parallel.
3. Sequence **WS2 → WS3 → WS4**; **WS5/WS6** after catalogs exist.
4. **WS7-B** only on approved design.

---

## Goal completion board (future)

| Gate | When |
|---|---|
| CONTRACT_GATE | Architect accepts Financial Contract (possibly amended) |
| DESIGN_GATE | User approves WS7-A Design of Record |
| DATA_INTEGRITY_GATE | WS2–WS4 evidence |
| SECURITY_GATE | Guards + isolation + lock tests |
| UX_GATE | USER_UAT on Dev |
| GOAL_023_COMPLETE | All SC1–10 evidenced; Recovery CURRENT closed |

---

## Final gate for *this* planning delivery

**`STOP_FOR_ARCHITECT`** — executable plan registered; product untouched.
