# CRM-129 — GOAL 034 LIVE DESIGN & IMPLEMENTATION RECOVERY

**Last user directive:** 2026-11-25. **Priority P0.** This is the canonical continuation after a chat context loss. Read together with [CRM-ARCHITECT-RECOVERY.md](./CRM-ARCHITECT-RECOVERY.md), [CRM-129-MASTER-GOAL-023.md](./CRM-129-MASTER-GOAL-023.md), [CRM-129-FINANCIAL-CONTRACT-023.md](./CRM-129-FINANCIAL-CONTRACT-023.md), [CRM-129-GOAL-023-PROGRESS.md](./CRM-129-GOAL-023-PROGRESS.md) and [CRM-129-GOAL-033-INDEPENDENT-ARCHITECT-AUDIT.md](./CRM-129-GOAL-033-INDEPENDENT-ARCHITECT-AUDIT.md).

## Current reality

- Repository `mrnikiemami-code/crm-platform`, branch `feat/crm-129-quotation`; last audited *pre-recovery* remote HEAD `99c212bc9442`. Verify HEAD and working tree before coding; never reset user work to a document's old hash.
- Dev UI `http://localhost:3002`, API `http://localhost:3002`, separate intranet `:6080` MUST NOT be touched. Existing real financial settings page: `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`. Real quotation form: `http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729`.
- Last delivered/deployed app per agent report `quotation@0.1.61`. This is not user-accepted.
- Goal 023 **ACTIVE / NOT COMPLETE**. WS1–WS4 source architect accepted and Dev-applied; Goal 031 quotation UX on Dev; Goal 032 named rounding on Dev with user-acceptance pending; Goal 033 settings UX front-only repair `SOURCE_SCOPE_PASS_WITH_OPEN_UI_RISKS`, now **USER REJECTED VISUALLY** after review. WS5 settings ownership, WS6 Mock/Asan integration, WS7 closure remain frozen, not authorized to proceed until this current settings milestone.
- Last Goal 033 source implementation `3730ef3aab`, UAT docs `1acbaf7e9e`, independent audit `047cbb81eaa`. Auditor did not rerun local server tests. DO NOT claim new Goal 034 code, tool installation or visual approval already exists.

## User's explicit rejection, from actual screenshots (2026-11-25)

Despite earlier UI refactors, the current app is not acceptable:
1. **Create and edit tax policy STILL open a side-by-side inspector beside a compressed ledger. Must NOT.** Use an appropriate single independent centered dialog or native host drawer, overlaying the existing list and preserving its full width. Confirm delete uses a separate native shared destructive confirm directly.
2. **`پیش‌نیازهای حسابداری` appears twice** (host chrome and page content). Remove redundant local page title; preserve correct navigation naming.
3. **`راه‌اندازی ریال` button is a developer/internal bootstrap exposed to users. Remove from everyday UI.** IRR bootstrap belongs to idempotent startup/authority flow with truthful failure handling and no unwanted new currency or double seed.
4. **Currency UI and messages are confusing;** one phase-1 operational IRR, optional accounting code with appropriate role lock. Need verify save/error behavior with actual Nest response, real UI messages and persistence, not just visual changes.
5. **Rounding tab shows a large inline form and long narrow list, excessively wasted space;** use a tidy compact list and independent create/edit modal/drawer.
6. Overly verbose help text, horizontal scroll/clipped menus, inconsistent spacing, too much unused area, unattractive weak toasts, messy narrow/mobile layouts.
7. Delete must use existing host `openCommandConfirmationModal` (danger) directly, never open edit panel. Single-flight guard must protect entire confirm+delete, not only post-confirm.
8. User expressly rejects a separate prototype page or static HTML; must change this **same operational CRM React/Twenty page**.
9. Requires a **free, capable visual designer** that writes actual React source, not paid Superdesign/credits. User selected **Onlook** as candidate to install/test, but success and Twenty front-component compatibility are NOT yet proven. Do not convert Twenty to Next.js/Tailwind just to fit an editor, sign up to paid services, or block real UI delivery on tool incompatibility. Use existing installed OpenDesign or direct React/Twenty design system if Onlook fails an early small smoke.
10. User wants a **single precise Goal 034 with continuous implementation**, no ceremonial per-step STOP. One existing CRM coding session, no parallel agent, no Cursor dependence if OpenCode works.

## Goal 034 execution contract — one current-page repair

**Mode:** INSTALL+SMOKE VISUAL EDITOR → DESIGN WITH ACTUAL REACT COMPONENTS → IMPLEMENT IN CURRENT SETTINGS PAGE → UNIT/INTEGRATION/BROWSER VERIFY → SAFE DEV APPLY → **STOP_FOR_USER_UAT**.

- First verify current remote/local HEAD, status, recovery/financial contract and available existing Twenty components. Protect 12 known unrelated untracked `packages/twenty-shared/src/ai/**` generated build artifacts if still present; do not stage/delete them.
- Evaluate official `https://github.com/onlook-dev/onlook` install/licensing/dependencies without paid credits. Only continue if it demonstrably edits existing Twenty FrontComponent code and changes appear in the real `:3002` page after build. No new production route, local HTML fake, migration to Next.js, or separate design app. Fail fast and fall back to previously installed OpenDesign or approved direct React implementation, preserving Twentys design tokens/components.
- Same three working tabs: `مالیات و عوارض`, `ارزها`, `قواعد رُند کردن`. Exactly one visible page title, compact headers. Tax policy ledger full width; create/edit in host-supported centered modal/drawer, not inline side inspector. Tax/duty name, respective rates, total, default, status, accounting code with C4 lock; short UI text.
- Currency: compact clear IRR record, valid optional accounting code edit, no `راه‌اندازی ریال` button, no other operational currency in phase 1. Tax & currency currently call Nest `/rest/quotation/actions` via `callTaxPoliciesNestAction` and `callQuotationCurrenciesNestAction` because legacy `/s` had worker/GraphQL drift. Preserve workspace auth and backend gates, do NOT restore broken /s route blindly.
- Rounding named rules: compact list and independent create/edit dialog; arbitrary positive **integer** IRR steps including 99, presets 10..1e6. Decimal step `0.001` **future NON-IRR only**, no phase-1 change. Preserve full micros, Hamilton, sealed revision snapshots, default behavior, and rounding-to-zero prevention.
- Shared native Twenty modal for direct destructive confirmation; immediate synchronous useRef latch covering opening confirm through request completion. No duplication or unsafe deletion; default/used policy or rule guard server authoritative. Use host/shared menus/popovers (prefer portal) with no clipping, Escape/focus/keyboard support. Shared Twenty toasts only, short Persian success/error with dedupe and no empty messages.
- Build layout using container width not only viewport. Test viewport 320,360,390,430,768,1024,1280,1440 and constrained panel widths including ~601px and last-row menu. No horizontal overflow, cropped modals, unreachable controls, inappropriate toast placement or misplaced RTL.
- Test tax create/edit/default/deactivate/delete allowed/refused, currency read/edit/persist/error, rounding create 99/edit/default, save-reopen quotation, money/revision/PDF basic regression, permissions. Use safe temporary data; do not alter historical sealed records. Browser real served UI evidence/screenshots + measured DOM dimensions must accompany source tests and exact commit/Dev app version.
- Only controlled Dev changes once exact host/backup/rollback verified, no :6080 or main worker restart, outbound off, no live vendors, no production apply or force push/merge. No database/schema or Money Domain modifications unless independently unavoidable and separately authorized. No modifying additional Workstreams while waiting for user UAT.
- Source signoff != User UAT; **user must visually accept the final real settings page**. If Onlook not suitable, explain tool check honestly, still deliver actual fixed product with fallback. Do not say goal complete on test PASS alone.

## Independent audit open debt to fix during 034

`docs/architecture/CRM-129-GOAL-033-INDEPENDENT-ARCHITECT-AUDIT.md` R1 delete confirmation race, R2 menu clipping due overflow ancestors, R3 custom menu keyboard/focus, R4 financial/security tests not reverified, R5 320..1440 viewport/container proof missing. Preserve historic production risks retire-vs-inflight send concurrency and rotated credentials unresolved for future go-live.

## Immediate next-turn instruction

**Do not generate another redesign/task plan from scratch.** In existing CRM OpenCode session execute Goal 034 on current component; if the session bridge is unavailable, give user one copy-ready concise task referencing THIS saved repo document and full fidelity. After worker reports result, independently inspect actual remote diff + proofs and then user sees the real page. Goal 023 ACTIVE.
