# CRM-129-GOAL-023 — Progress board

**Goal:** [`CRM-129-MASTER-GOAL-023.md`](./CRM-129-MASTER-GOAL-023.md)  
**Contract:** [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md)  
**Plan:** [`CRM-129-EXECUTION-PLAN-023.md`](./CRM-129-EXECUTION-PLAN-023.md)  
**Branch:** `feat/crm-129-quotation`  
**Activation checkpoint:** `cdb890b3f5`  
**Board updated:** WS1 implementation evidence (awaiting architect accept)

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `TECHNICALLY_VERIFIED` · `ARCHITECT_ACCEPTED` · `USER_ACCEPTED`

**Rule:** never mark a pack final without evidence + required gate. Pack success ≠ Goal complete.

---

## Pack status

| Pack | Status | Evidence / note |
|---|---|---|
| WS0 Goal registration | `ARCHITECT_ACCEPTED` (planning) | `cdb890b3f5` |
| EXECUTION-024 C1–C7 + board + WS1 preflight | `ARCHITECT_ACCEPTED` | `6bc3f558b9` + WS1-OPEN |
| WS1 Reference accounting codes | `TECHNICALLY_VERIFIED` | See CP-WS1 below; needs `ARCHITECT_ACCEPTED` before WS2 |
| WS2 Snapshot + code lock | `NOT_STARTED` | Needs WS1 architect accept + lock enforcement |
| WS3 Per-line tax | `NOT_STARTED` | |
| WS4 Document currency phase 1 | `NOT_STARTED` | Catalog exists; picker/IRR refuse in WS4 |
| WS5 Settings ownership | `NOT_STARTED` | |
| WS6 Mock/Asan shared UI | `NOT_STARTED` | |
| WS7-A Design frames | `NOT_STARTED` | Not started this turn |
| WS7-B Implement Design of Record | `NOT_STARTED` | |
| Goal 023 close | `NOT_STARTED` | **ACTIVE / NOT COMPLETE** |

---

## Success criteria roll-up

| SC | Status | Notes |
|---|---|---|
| 1 Owner per code | Partial | WS1 fields landed; snapshot/lock WS2 |
| 2 Snapshot on quotation | Incomplete | WS2–WS3 |
| 3 Lock after first draft | Incomplete | C4/F6 docs ratified; enforcement WS2 |
| 4 Per-line tax | Incomplete | WS3 |
| 5 Phase-1 IRR inheritance | Partial | Catalog + IRR bootstrap; draft still IRR literal |
| 6 Phase-2 designed inactive | Incomplete | WS4 hooks |
| 7 Item/person/company codes | Partial | Fields defined; record UI via standard forms |
| 8 Settings no CRM code redefine | Incomplete | WS5 |
| 9 Mock/Asan shared | Incomplete | WS6 |
| 10 Persian UX | Incomplete | WS7 |

---

## Checkpoint log

### CP-WS1 — Implementation (this delivery)

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

**`STOP_FOR_ARCHITECT`** — WS1 technically verified. Goal 023 remains **ACTIVE / NOT COMPLETE**.
