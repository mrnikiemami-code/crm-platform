# CRM-129-MASTER-GOAL-023 — Financial contract & professional UX

**Status:** ACTIVE GOAL (execution stream `CRM-129-GOAL-023-EXECUTION-024`)  
**Branch:** `feat/crm-129-quotation`  
**Activated from checkpoint:** `cdb890b3f5`  
**Progress board:** [`CRM-129-GOAL-023-PROGRESS.md`](./CRM-129-GOAL-023-PROGRESS.md)  
**Companions:** [`CRM-129-FINANCIAL-CONTRACT-023.md`](./CRM-129-FINANCIAL-CONTRACT-023.md) · [`CRM-129-EXECUTION-PLAN-023.md`](./CRM-129-EXECUTION-PLAN-023.md) · [`CRM-129-GOAL-023-WS1-PREFLIGHT.md`](./CRM-129-GOAL-023-WS1-PREFLIGHT.md)

**Gates:** pack-level `STOP_FOR_ARCHITECT` as required · Goal close = `STOP_FOR_ARCHITECT` + `USER_UAT`  
**Rule:** completing one workstream ≠ Goal complete. Technical PASS alone ≠ success.

---

## Master goal

Deliver one coherent quotation + accounting-settings system in which:

- every accounting code has a single authoritative owner,
- tax and currency policy on a quotation is recorded and snapshotted correctly,
- reference tax/currency codes lock after first successful draft save (by reference id),
- each line can carry its own tax policy,
- phase 1 is single-currency IRR (document currency on every line),
- phase 2 multi-currency is designed into the domain but not user-activated,
- item and party accounting codes live on their reference records (distinct from vendor link ids),
- accounting settings do not re-author tax/currency CRM codes,
- Mock and Asan share UI structure and real adapter capabilities,
- Persian operators can complete the whole workflow without a technical guide.

---

## Success criteria

| # | Criterion | Pack |
|---|---|---|
| 1 | One authoritative owner per accounting code | WS1 |
| 2 | Tax & currency policy correctly recorded and snapshotted on quotations | WS2–WS3 |
| 3 | Tax/currency reference codes locked after first successful draft (by reference id) | WS2 |
| 4 | Independent tax policy per line | WS3 |
| 5 | Phase 1 single-currency IRR; every line inherits document currency | WS4 |
| 6 | Phase 2 multi-currency designed, not activated | WS4 |
| 7 | Accounting code fields on items, persons, companies | WS1 |
| 8 | Accounting settings do not redefine tax/currency CRM codes | WS5 |
| 9 | Mock and Asan share UI shell + real adapter capabilities | WS6 |
| 10 | Professional Persian UX (user Design approval + live UAT) | WS7 |

---

## Ratified hard contracts (C1–C7, EXECUTION-024)

These supersede open “architect choice” wording from the original planning pass where they conflict.

### C1 — Tax / duty policy

- One optional CRM `accountingCode` per policy (tax + duty share that single code).
- Tax and duty remain **two independent rates** on the policy.
- On the quotation, the operator selects **only the policy** (never types accounting codes).
- Each quotation **line** may use a different policy.
- Workspace default policy applies automatically to new lines / new drafts.

### C2 — Currency

- Each currency has an optional CRM `accountingCode`.
- Workspace has exactly one default currency.
- **Phase 1:** only **IRR** is allowed for operational amounts; every line inherits the document currency.
- Phase 2 multi-currency infrastructure may exist in schema/types; **must not** be user-activated; no mixed-currency arithmetic.

### C3 — Codes on the quotation (absolute prohibitions)

Forbidden in the quotation UI:

- tax accounting-code input,
- currency accounting-code input,
- issuer editing of snapshotted accounting codes,
- presenting codes as editable line settings.

Operator selects **policy** and **currency** only. Codes are resolved from reference records and written into snapshot/storage automatically. If the reference code is set, saving it on the document is mandatory; if unset, empty snapshot is allowed.

### C4 — Code lock (Q-LOCK-1 Option A)

- From the **first successful quotation save** (including **DRAFT**) that **persists a non-empty** tax-policy or currency `accountingCode` onto the document/snapshot, that reference’s `accountingCode` becomes immutable.
- Empty reference codes may still be set later until the first non-empty snapshot for that reference id.
- Server refuses post-lock edits; draft-save vs code-edit races are transactional and tested (WS2).
- Lock is keyed by **reference entity id** (policy id / currency id), not by comparing code text.
- Item and customer code locks are **out of scope** until a separate contract; do not fold them into C4 by implication.

### C5 — Items and customers

- `accountingCode` on catalog item, person, and company reference records.
- Must never be confused with destination `externalItemId` / `externalPartyId` on link objects.

### C6 — Accounting settings

- Remove CRM tax/currency **accounting-code authoring** from connection settings.
- Destination-specific mapping fields only when an adapter capability **documents** the need, and always distinct from CRM reference codes.
- No physical deletion of existing mappings before dependency / history / compatibility review.
- Asan special row codes only under the proven Asan adapter contract.

### C7 — Compatibility and calculations

- Keep independent tax and duty rates.
- After document-discount allocation, each line is taxed with **that line’s** policy rates.
- Retain legacy document-level tax fields for compatibility.
- Sealed documents/revisions are immutable.
- PDF and API stay consistent with the financial snapshot.
- Multi-policy quotations export only if the adapter **proves** multi-tax support; otherwise accounting send is blocked.

---

## Preserved prior contracts

Money/TAX-008/016, DEFAULT-020, RETIRE-021/R1 (including open retire↔send concurrency risk), outbound flags off, secrets off records, unapproved design pilots not Design of Record.

---

## Mandatory read for every CRM-129 task under this Goal

1. This Goal + Progress board.
2. One sentence: which SC# this change advances.
3. Cite the Financial Contract clause (incl. C1–C7).
4. Never mark a pack final without evidence and the required gate.
5. Never declare Goal complete because one pack or a build passed.

---

## Current execution posture

| Item | State |
|---|---|
| WS0 planning docs | Done (`cdb890b3f5`) |
| C1–C7 ratification in docs | This EXECUTION-024 activation |
| Progress board | Created |
| WS1 implementation | **Blocked** on `STOP_FOR_ARCHITECT` — see WS1 preflight |
| Product / schema / deploy | Untouched until architect opens WS1 |
