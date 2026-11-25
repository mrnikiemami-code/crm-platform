# CRM-129 Goal 033 — Independent Architecture & Regression Audit

**Date:** 2026-11-25  
**Repo / branch:** `mrnikiemami-code/crm-platform` / `feat/crm-129-quotation`  
**Audited product HEAD:** `1acbaf7e9ef649c577c82030f02568e3fb61aa9e`  
**Baseline:** `b089598eef14`  
**Goal:** CRM-129-GOAL-023 **ACTIVE / NOT COMPLETE**; Goal 033 **STOP_FOR_USER_UAT** and **NOT USER_ACCEPTED**.

## Inspection performed

Independent GitHub source diff from baseline to `1acbaf7e9e`, current Goal 033 progress, and source review of:

- `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx`
- `packages/twenty-apps/internal/quotation/src/components/quotation-currency-settings-section.tsx`
- `packages/twenty-apps/internal/quotation/src/components/rounding-rule-settings-section.tsx`
- `packages/twenty-apps/internal/quotation/src/components/shared/confirm-destructive-action.ts`
- `packages/twenty-apps/internal/quotation/src/components/shared/__tests__/confirm-destructive-action.test.ts`

Scope note: remote source audit only. Agent-reported 31 + 2 UI unit tests and Dev browser proof were not independently rerun here. No direct access to the user's local `:3002` runtime, DB, browser console, or local screenshot evidence. Thus an unconditional system-wide `ARCHITECT_ACCEPTED` / `USER_ACCEPTED` claim would be inaccurate.

## Architect findings

### A. Invariant preservation — PASS WITH SCOPE LIMIT

Compare showed changes only in docs, package version, app front components and a small shared confirmation helper/tests. **No Goal 033 diff** in server financial services, money arithmetic, schema definitions, saved revisions, accounting mapping, authentication/authorization, workspace metadata or PDF logic. Existing Nest settings API client path remains, and the helper delegates destructive confirmation to host `openCommandConfirmationModal` with `confirmButtonAccent: 'danger'`; bridge failure safely returns `cancel`. This substantially limits direct financial architecture regression risk **from Goal 033 itself**, but does not prove every earlier Goal 023 contract is correct end-to-end.

### B. Bounded outstanding risks / tests

1. **UX-R1 — confirmation race (source-visible):** Both tax and rounding `requestDelete` check React `deletingRecordId` **before** awaiting `confirmDestructiveAction`, then set it **after** confirmation. Two rapid requests can open two host dialogs before the state lock is set; state updates are also asynchronous. Guard the entire confirmation→delete operation with a synchronous `useRef` single-flight latch, released in `finally`. Add a test for double-click / rapid reentry; server delete/usage checks remain authoritative.
2. **UX-R2 — potential menu clipping (source-visible, runtime unconfirmed):** Tax row's absolutely positioned `.tax-more-menu` lives within `.tax-panel { overflow: hidden }` and `.tax-table-wrap { overflow-x: auto }`. In final rows or narrow panels the menu may be clipped. Prefer an existing host popover/menu portal or otherwise prove placement/reposition/visible bounds with actual last-row mobile+desktop tests. Avoid a custom global overlay system.
3. **UX-R3 — incomplete keyboard/menu accessibility proof:** `role="menu"`/ `role="menuitem"` are used on custom buttons, but no demonstrated arrow-key focus management, Escape close, click-away close, or focus return. Prefer Twenty shared menu; otherwise make behavior complete and test with keyboard/assistive semantics.
4. **UX-R4 — regression evidence gap:** Goal 033 reports 33 focused UI unit tests plus selected browser actions, not a fresh independently reproduced security/tenancy, financial, snapshot, permission, currency, rounding and PDF regression suite. No reason to mark those FAILED; mark them **NOT REVERIFIED** for final Goal 023 signoff.
5. **UX-R5 — responsive evidence gap:** ~601px actual container tested and reported clear; the Goal 033 spec requires widths 320/360/390/430/768/1024/1280/1440 and actual overflow/44px/central-modal placement verification. These additional measurements are **not evidenced** in the supplied progress file.

### C. Confirmed positive architecture choices

- Delegating confirmation to an existing host modal instead of implementing independent per-row modal is structurally appropriate.
- Three existing tax/currency/rounding sections were retained, with compact UI, rather than recreating new CRUD domains.
- No Goal 033 server authority or cross-workspace bypass was introduced in the diff.
- Phase-1 integer-IRR rounding contract remained unchanged; fractional step is reserved for future non-IRR currencies.

## Architect decision

**SOURCE_SCOPE_PASS_WITH_OPEN_UI_RISKS.** Financial architecture was **not modified by Goal 033** according to GitHub diff; do not conflate this with unconditional overall system acceptance. Do **not** merge or mark Goal 033 `USER_ACCEPTED` until the user reviews the real Dev page, and at least UX-R1, UX-R2, UX-R3 and required responsive proof are addressed or explicitly waived after measured evidence. Keep WS5/WS6 paused until this user UAT gate.

Recommended small follow-up (same existing CRM session, no new design): synchronous delete single-flight guard, menu visibility/keyboard fix through Twenty shared menu if possible, run narrow widths and relevant regressions, then updated screenshot / exact commit / real Dev UAT. No Money Domain, schema, worker, `:6080`, outbound or vendor send changes.

