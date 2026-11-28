# CRM-129-GOAL-023 — Progress board

**Goal:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md)  
**Contract:** [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md)  
**Plan:** [`CRM-129-EXECUTION-PLAN-023.md`](./CRM-129-EXECUTION-PLAN-023.md)  
**Branch:** `feat/crm-129-quotation`  
**Activation checkpoint:** `cdb890b3f5`  
**Board updated:** User REJECTED Goal 033 visual UX after seeing `quotation@0.1.61`; Goal 034 P0 same-page live design/implementation now REQUIRED; full saved recovery: [`CRM-129-GOAL-034-RECOVERY-AND-EXECUTION.md`](./CRM-129-GOAL-034-RECOVERY-AND-EXECUTION.md). Goal 023 ACTIVE; WS5–WS7 frozen. Goal 034 is NOT implemented or USER_ACCEPTED yet.

**Current transition (2026-11-28):** Goal 040 active plan for critical-first comprehensive Asan integration per user approval and audit 092. [Plan](./goal-040/CRM-129-GOAL-040-ASAN-INTEGRATION-PLAN.md) / [progress](./goal-040/PROGRESS.md). Phase 1 authorized source, Phase 2 missing field/workflow source, Phase 3 one focused runtime acceptance, Phase 4 external live gates separate. Unit catalog C8 approved. Goal 039 broad scope cancelled; Goal 023 ACTIVE. Last installed evidence 0.1.91; no new implementation or tests in planning commit.

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `TECHNICALLY_VERIFIED` · `ARCHITECT_ACCEPTED` · `USER_ACCEPTED`

**Rule:** never mark a pack final without evidence + required gate. Pack success ≠ Goal complete.

---

## Pack status

| Pack | Status | Evidence / note |
|---|---|---|
| WS0 Goal registration | `ARCHITECT_ACCEPTED` (planning) | `cdb890b3f5` |
| EXECUTION-024 C1–C7 + board + WS1 preflight | `ARCHITECT_ACCEPTED` | `6bc3f558b9` + WS1-OPEN |
| WS1 Reference accounting codes | `ARCHITECT_ACCEPTED` | Source + **Dev schema applied** in DEV-APPLY-030 |
| WS2 Snapshot + code lock | `ARCHITECT_ACCEPTED` | Source + **Dev schema applied** in DEV-APPLY-030 |
| WS3 Per-line tax | `ARCHITECT_ACCEPTED` | Source + **Dev applied**; real form UAT evidence in STOP_FOR_USER_UAT |
| WS4 Document currency phase 1 | `ARCHITECT_ACCEPTED` | Source accepted; **Dev applied** (`quotation@0.1.56`); IRR-only form verified |
| DEV-APPLY-030 (WS1–WS4 schema + app) | `TECHNICALLY_VERIFIED` → gate | [`CRM-129-GOAL-023-DEV-APPLY-030-STOP-FOR-USER-UAT.md`](./CRM-129-GOAL-023-DEV-APPLY-030-STOP-FOR-USER-UAT.md) |
| GOAL-033 Financial settings UX | `TECHNICALLY_VERIFIED` / **`USER_REJECTED_VISUAL`** | App `0.1.61`; see independent audit and latest user screenshots; cannot close |
| GOAL-034 Real-page visual implementation | `NOT_STARTED` / P0 authorized request | [Full recovery and execution](./CRM-129-GOAL-034-RECOVERY-AND-EXECUTION.md); must update SAME operational page, no new prototype or paid tool |
| GOAL-031 Quotation UX completion | `TECHNICALLY_VERIFIED` → gate | [`CRM-129-GOAL-031-STOP-FOR-USER-UAT.md`](./CRM-129-GOAL-031-STOP-FOR-USER-UAT.md); app **0.1.57** |
| GOAL-032 Named payable rounding rules | `TECHNICALLY_VERIFIED` → gate | [`CRM-129-GOAL-032-PROGRESS.md`](./CRM-129-GOAL-032-PROGRESS.md); app **0.1.59** then recovery **0.1.60** |
| P0 Financial settings recovery | `TECHNICALLY_VERIFIED` → gate | [`CRM-129-FINANCIAL-SETTINGS-RECOVERY-PROGRESS.md`](./CRM-129-FINANCIAL-SETTINGS-RECOVERY-PROGRESS.md); Nest tax/currency/rounding + tabs; **STOP_FOR_USER_UAT** |
| GOAL-036 Package A (DE-035 click/microcopy) | `TECHNICALLY_VERIFIED` | `quotation@0.1.66`; evidence `goal-036/CRM-129-GOAL-036-PACKAGE-A.md` |
| WS5 Settings ownership | `TECHNICALLY_VERIFIED` | GOAL-036 Package B / `0.1.67`; evidence `goal-036/CRM-129-GOAL-036-PACKAGE-B-WS5.md` |
| WS6 Mock/Asan shared UI | `TECHNICALLY_VERIFIED` | GOAL-036 Package C / `0.1.68`; evidence `goal-036/CRM-129-GOAL-036-PACKAGE-C-WS6.md` |
| WS7-A Design frames | `CANCELLED_AS_PRODUCT_PATH` | Static HTML under `docs/design/crm-129-goal-023-ws7a/` is **non-binding reference only** — not Design of Record; do not ship into product |
| WS7-B Product UX polish | `PARTIAL` | GOAL-036 Package D / `0.1.69`; PENDING_USER_DESIGN_APPROVAL listed |
| GOAL-036 Package E matrix | `TECHNICALLY_VERIFIED` → gate | `goal-036/CRM-129-GOAL-036-PACKAGE-E-MATRIX.md`; **STOP_FOR_ARCHITECT_AND_USER_UAT** |
| GOAL-036-R1 catalog/capability integrity | `BLOCKED_WITH_PRECISE_EVIDENCE` | Product A–C + `0.1.70` apply; Dev Accounting `/s` connection-list shell blocks F01/F05 browser; evidence `goal-036/CRM-129-GOAL-036-R1-EVIDENCE.md` |
| WS5 Settings ownership (post-R1) | remains open | Do not mark ARCHITECT_ACCEPTED until F01 Dev dual-UI attested |
| WS6 Mock/Asan shared UI (post-R1) | remains open | Capability unit PASS; live form attestation blocked by shell |
| UX Pack A micro-repairs | `TECHNICALLY_VERIFIED` | Same product chrome; copy/RTL/ownership/timestamp; see CP-UX-REPAIR-A |
| Pack B financial (WS2–WS4) | `TECHNICALLY_VERIFIED` on Dev | Real `:3002` form live; awaiting **USER** accept |
| Goal 023 close | `NOT_STARTED` | **ACTIVE / NOT COMPLETE** |

---

## Success criteria roll-up

| SC | Status | Notes |
|---|---|---|
| 1 Owner per code | Partial | WS1 fields landed; snapshot/lock WS2 |
| 2 Snapshot on quotation | Incomplete | WS2–WS3 |
| 3 Lock after first draft | Incomplete | C4/F6 docs ratified; enforcement WS2 |
| 4 Per-line tax | Partial | WS3 on Dev; mixed-line UAT PASS; summary labels cosmetic gap |
| 5 Phase-1 IRR inheritance | Partial | WS4 on Dev; form IRR-only; bootstrap IRR; USER_UAT gate |
| 6 Phase-2 designed inactive | Partial | Flag OFF + `totalsByCurrency` stub + line `currencyCode` |
| 7 Item/person/company codes | Partial | Fields defined; record UI via standard forms |
| 8 Settings no CRM code redefine | Incomplete | WS5 |
| 9 Mock/Asan shared | Incomplete | WS6 |
| 10 Persian UX | Incomplete | WS7 |

---

## Checkpoint log

### CP-DEV-APPLY-030 — Controlled Dev Apply + real form UAT

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC4/SC5 on live Dev; user can open real form |
| **2. Financial contract?** | C2 IRR-only ops; C3 no accounting codes on form; per-line sealed rates |
| **3. Real tests run?** | Browser UAT on `:3002`; bootstrap REST; Vitest document-currency **9 PASS**; DB line seals |
| **4. Still incomplete?** | User visual/behavior accept; mixed-tax summary labels; WS5/WS6 frozen |
| **5. Next allowed step?** | **`STOP_FOR_USER_UAT`** — no WS5/WS6/design until user confirms |

**Form:** http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729  
**App:** `quotation@0.1.56` · **Backup:** `D:\CrmDeployment\backups\crm129-dev-apply-030\`

### CP-WS4 — Document currency on existing draft form

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC5 document IRR select + line inheritance; SC6 phase-2 stubs inactive |
| **2. Financial contract?** | F5/C2; no FX; Money arithmetic unchanged; تومان/ریال display-only |
| **3. Real tests run?** | Vitest money/draft **206 PASS**; Jest persistence/currency **37 PASS** |
| **4. Still incomplete?** | Architect accept; **Dev Apply** WS1–WS4; USER_UAT on real form |
| **5. Next allowed step?** | `STOP_FOR_ARCHITECT` — **await Apply grant only** (no new packs) |

### CP-WS3 — Per-line tax/duty on existing draft cards

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC4 per-line policy select + frozen rates; SC2/SC3 multi-policy snapshot/lock |
| **2. Financial contract?** | Narrow Money only (rates after Hamilton allocation); C3 no codes on form; C7 header legacy + multi-tax outbound fail-closed |
| **3. Real tests run?** | Vitest money/draft/outbound **240 PASS**; Jest persistence/totals/revision **44 PASS** |
| **4. Still incomplete?** | Architect accept WS3; WS4; Dev Apply; USER_UAT on real form |
| **5. Next allowed step?** | `STOP_FOR_ARCHITECT` — then WS4 after accept |

### CP-WS2-R1 — Fail-closed accounting snapshot (REAL-FORM-027 stage 1)

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC2/SC3 honesty: no silent blank snapshot on catalog failure |
| **2. Financial contract?** | C3/C4 preserved; empty code only when reference row exists without a code |
| **3. Real tests run?** | Draft persistence **23 PASS**; PG lock/rollback **4 PASS**; authority suites PASS |
| **4. Still incomplete?** | Architect accept; Dev Apply; WS3–WS4; USER_UAT |
| **5. Next allowed step?** | `STOP_FOR_ARCHITECT` — then WS3 (narrow Money) after accept |

### CP-WS2 — Snapshot + C4 lock (prior delivery)

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC2/SC3 foundations (snapshot + lock-by-reference-id); SC1 ownership preserved |
| **2. Financial contract?** | C3/C4 Option A; F6 Tax→Currency lock order; Money Domain untouched |
| **3. Real tests run?** | Jest draft/tax/currency/snapshot PASS; PG lock suite **3 PASS** on local Postgres |
| **4. Still incomplete?** | No Dev Apply; sealed-revision PDF field display optional later; WS3+ |
| **5. Next allowed step?** | Architect accept WS2; separate Dev Apply; then WS3 with Money Domain grant |

### CP-UX-REPAIR-A — STOP redesign / targeted UX repair

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC8/SC9/SC10 honesty path only (copy, ownership hint, RTL); no SC4/SC5 product capabilities yet |
| **2. Financial contract?** | C3 preserved; **no** Money Domain change; **no** per-line tax / catalog document currency in product this turn |
| **3. Real tests run?** | Vitest `accounting-connections-section.test.tsx` — **43 PASS** (re-confirmed at checkpoint `0ac6d22153`); WS1-R1 Jest currency authority **8 PASS** |
| **4. Still incomplete?** | WS1 accept; WS2→WS3 (Money)→WS4; full WS5/WS6; real-product USER_UAT |
| **5. Next allowed step?** | **`STOP_FOR_ARCHITECT`**: accept WS1 → open WS2 → WS3 with Money Domain permission → WS4; then product UAT |

**Cancelled:** from-scratch WS7-A redesign as product path. HTML preview remains archival/non-binding.

### CP-WS7-A — Interactive design preview (superseded as product path)

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC10 design path; frames for SC8/SC9 ownership clarity |
| **2. Financial contract?** | C3 (no tax/currency codes on quotation form); C6 (connection does not author those codes); C1 per-line policy select; C2 IRR default message |
| **3. Real tests run?** | N/A product tests; browser-servable static preview with mock data only |
| **4. Still incomplete?** | Awaiting user appearance approval; WS7-B blocked |
| **5. Next allowed step?** | User approve/amend/reject design; architect still must accept WS1 before WS2/Dev Apply |

**Paths:** `docs/design/crm-129-goal-023-ws7a/index.html`, `DESIGN-DECISION.md`

### CP-WS1-R1 — IRR bootstrap / default authority (this delivery)

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC5 phase-1 IRR operational default hardened |
| **2. Financial contract?** | C2: bootstrap inserts IRR even if catalog non-empty; save/`setDefault` refuse non-IRR default; `enforceSingleActiveDefault` never auto-promotes non-IRR |
| **3. Real tests run?** | Jest `quotation-currency-authority.service.spec.ts` — **8 PASS** (empty seed; missing-IRR with USD present; restore IRR default; refuse save/setDefault non-IRR; accountingCode; create forbidden; ORM isolation) |
| **4. Still incomplete?** | No Dev Apply; WS1 still needs `ARCHITECT_ACCEPTED`; WS2–WS7 product work |
| **5. Next allowed step?** | Architect accept WS1; user review WS7-A preview (no WS7-B until approved) |

**Safety:** Advisory currency lock + financial contracts unchanged; Outbound/worker/`6080` untouched.

### CP-WS1 — Implementation (prior delivery)

| Question | Answer |
|---|---|
| **1. SC advanced?** | SC1/SC7 foundations; SC5 catalog seed; C4 docs Option A |
| **2. Financial contract?** | C1/C2/C5 fields; C3 respected (no draft code inputs); C4/F6 Option A + dual locks documented |
| **3. Real tests run?** | Jest: currency authority + write-guard + tax authority + ui controller (**42 PASS**). Vitest: accounting-code + tax panel **31** + money/draft regression **41** + tax-policy service |
| **4. Still incomplete?** | Dev app apply not done this turn; WS2–WS7; SC lock/snapshot/line-tax/UX |
| **5. Next allowed step?** | Architect `ARCHITECT_ACCEPTED` on WS1 → open WS2 (snapshot + C4 lock) |

**Collision check:** Dev `accountingCode` on person/company/catalogItem/taxPolicy → **0 rows** before schema apply.

**Safety:** Outbound off; no Asan live; no worker/`:6080`; no mapping purge; no draft accounting-code fields.

### CP-024-0 — Activation

Docs-only C1–C7 + preflight @ `6bc3f558b9`.

---

## Gate

1. ~~Architect accept WS1–WS4 source~~ — done.
2. ~~Controlled Dev Apply WS1–WS4 + `quotation@0.1.56`~~ — done (DEV-APPLY-030).
3. **`STOP_FOR_USER_UAT`** — user must confirm real `:3002` form ([handoff](./CRM-129-GOAL-023-DEV-APPLY-030-STOP-FOR-USER-UAT.md)).
4. WS5/WS6 / visual polish — **only after** user UAT of this milestone.
5. WS7-A redesign-as-product: **cancelled**.

Goal 023 remains **ACTIVE / NOT COMPLETE**.
