# CRM-129-ACCOUNTING-ROADMAP-019

**Companion to:** `CRM-129-ACCOUNTING-AUDIT-019.md`  
**Gate:** `STOP_FOR_ARCHITECT` — do not start implementation without architect approval  
**Principle:** small, independently testable tasks; no whole-module rewrite  

---

## Priority definitions

| Priority | Meaning |
|---|---|
| **P0** | Financial correctness, data integrity, security — blocks safe use |
| **P1** | Completeness of the accounting workflow for the intended vendor path |
| **P2** | UX / information architecture coherence |
| **P3** | Nice-to-have for first release |

---

## Recommended sequence (executive)

```
P0-1 Default-connection contract
  → P0-2 Connection retire (deactivate) without destroying history
    → P0-3 Go-live checklist (flags + LIVE_VERIFIED criteria + reconcile UX)
      → P1-1 Quotation surface uses same default rule as settings
        → P1-2 Asan live verification program (tunnel, money unit, one dry-run env)
          → P2-* UX coherence
            → P3 Sepidar adapter (only if product commits)
```

---

## P0 — Correctness, integrity, security

### P0-1 — Single workspace “default / active destination” contract

**Why:** Settings uses localStorage; quotation tab uses first `isActive`. Mapping and export can target different connections.

| | |
|---|---|
| **Depends on** | Architect decision: workspace-default field vs selection-only |
| **Scope** | One authoritative rule; both surfaces consume it; optional `isDefault` on `accountingConnection` **or** documented selection-only with no “پیش‌فرض” language |
| **Out of scope** | Adapter rewrite, Sepidar |
| **Acceptance** | Given two connections A/B: setting default (or documented selection) makes quotation preview/export resolve the same id as settings catalog/customers; unit + one Dev DOM check; no secret logging |
| **Architect decision** | **Yes** — pick the model before coding |

### P0-2 — Retire connection without harming history

**Why:** `isActive` exists but no deactivate/delete route; stale destinations stay selectable.

| | |
|---|---|
| **Depends on** | P0-1 (what “active” means after retire) |
| **Scope** | Server action `deactivate` (soft): keep sync ops, item/party links; exclude from “selectable for new work”; refuse hard delete if history exists **or** only soft-retire forever |
| **Out of scope** | Vendor-side product deactivate |
| **Acceptance** | Deactivated connection: not offered for new mapping/export; history still readable in اسناد; GraphQL generic delete still blocked; focused Jest + settings UAT script extension |
| **Architect decision** | **Yes** — soft-only vs eventual purge policy |

### P0-3 — Go-live safety pack (flags, verification, retry)

**Why:** Export path exists but defaults off; Asan has no idempotency; test never yields LIVE_VERIFIED.

| | |
|---|---|
| **Depends on** | Architect criteria for LIVE_VERIFIED and when flags may flip |
| **Scope** | Document + enforce: (a) when UI may show “قابل ارسال”; (b) reconcile-before-retry when `remoteIdempotency=false`; (c) whether successful health + tunnel + money-unit confirmed can set LIVE_VERIFIED |
| **Out of scope** | Inventing Asan idempotency; production `:6080` |
| **Acceptance** | With flags false: execute routes refuse with clear Persian code; with flags true in Dev mock: succeed; ambiguous Asan retry without `reconciled` refuses; no real vendor call unless architect authorizes a named Dev tunnel |
| **Architect decision** | **Yes** |

---

## P1 — Workflow completeness

### P1-1 — Align quotation accounting tab with P0-1

| | |
|---|---|
| **Depends on** | P0-1 |
| **Scope** | `accounting-connection-panel.tsx` resolves connection via shared helper, not ad-hoc `find(isActive)` |
| **Acceptance** | Same connection id as settings for preview/export; regression test with two connections |
| **Architect decision** | No (once P0-1 decided) |

### P1-2 — Asan installation readiness checklist (ops + product)

| | |
|---|---|
| **Depends on** | P0-3 |
| **Scope** | Checklist UI or overview tasks: tunnel token, transport approval, money unit ≠ UNCONFIRMED, special item codes confirmed, at least one tax mapping, party+item links for a sample quotation |
| **Acceptance** | Overview lists unmet gates with deep links; cannot claim “ready to send” until checklist green **or** explicit override role |
| **Architect decision** | Partial — which gates are hard vs soft |

### P1-3 — Tax policy label uniqueness / mapping clarity

| | |
|---|---|
| **Depends on** | None (can parallel) |
| **Scope** | Prevent two active policies sharing the same display label **or** always show code beside name in mapping rows |
| **Acceptance** | Mapping row always disambiguates; tax settings cannot save duplicate active labels (if chosen) |
| **Architect decision** | Soft — enforce uniqueness vs display-only |

### P1-4 — Incomplete snapshot honesty (REMOTE_UNPAGED)

| | |
|---|---|
| **Depends on** | None |
| **Scope** | Catalog/customers show incomplete/capped state when soft ceiling hit |
| **Acceptance** | Operator cannot mistake first-N for full catalog; matches PRODUCT.md principle |
| **Architect decision** | No |

---

## P2 — UX coherence (no visual redesign tools required)

### P2-1 — One “next action” strip across sections

| | |
|---|---|
| **Depends on** | P1-2 helpful |
| **Scope** | Persistent next-action from overview counters (pending items/customers, unmapped tax, flags off) visible when leaving overview |
| **Acceptance** | From catalog/customers/documents, operator can see the single highest-priority next step without returning blindly |
| **Architect decision** | No |

### P2-2 — Connection list vs form IA polish

| | |
|---|---|
| **Depends on** | P0-2 |
| **Scope** | Clear badges: آزمایشی / آسان / بازنشسته؛ select vs edit never confused; test-only-on-saved already present — keep |
| **Acceptance** | Independent fidelity review against PRODUCT.md principles (Persian, one next action); no Superdesign required |
| **Architect decision** | No |

### P2-3 — Documents section language matches flag state

| | |
|---|---|
| **Depends on** | P0-3 |
| **Scope** | Copy distinguishes پیش‌نمایش / ارسال واقعی / ارسال خاموش |
| **Acceptance** | With flags off, no string implies fiscal registration succeeded |
| **Architect decision** | No |

---

## P3 — Later / optional

### P3-1 — Sepidar adapter (only if product commits)

| | |
|---|---|
| **Depends on** | External API docs + architect vendor priority |
| **Scope** | New `AccountingAdapter` implementation + registry entry; remove or replace `SEPIDAR_UNAVAILABLE` |
| **Acceptance** | Mock-level contract tests; LIVE_UNVERIFIED until proven; UI capabilities driven by descriptor |
| **Architect decision** | **Yes** — vendor priority |

### P3-2 — Multi-currency destinations beyond Asan SINGLE_CURRENCY

| | |
|---|---|
| **Depends on** | Real vendor contract that accepts currency codes |
| **Scope** | Expand mapping UI only when an adapter declares non-SINGLE modes |
| **Acceptance** | Capability-driven fields; no invented Asan currency field |
| **Architect decision** | Yes if market needs |

### P3-3 — Design system polish of accounting shell

| | |
|---|---|
| **Depends on** | Architect design gate (separate from this audit) |
| **Scope** | Visual consistency with tax Ledger+Inspector only if intentionally unified |
| **Acceptance** | Designer-owned if UI redesign authorized — **not** from this audit |
| **Architect decision** | **Yes** before any design-tool pass |

---

## Explicit non-goals (do not open as tasks from this roadmap)

- Rewriting Money Domain or tax basis-point arithmetic  
- Hardcoding destination tax codes (e.g. illustrative `64`)  
- Enabling `:6080` / production outbound from this plan  
- History rewrite for past credential leaks (separate security process)  
- Superdesign / Taste / Composer design generation without a new design task  

---

## First executable task (recommendation)

**After architect answers P0-1:** implement **P0-1** (single destination contract) as the first coding task.  
It unblocks P0-2, P1-1, and most UX confusion, without touching adapters or enabling live fiscal writes.

If the architect instead prioritizes go-live on Asan with a single connection already in use, **P0-3** may lead — but P0-1 remains debt.

---

## STOP_FOR_ARCHITECT

Await decisions on: default-connection model; connection retire policy; LIVE_VERIFIED + flag flip criteria; Sepidar priority.  
**No implementation until explicitly authorized.**
