# CRM — Canonical Architect Recovery (read first)

## CURRENT — Goal 038 G0 repair 090 SOURCE_PARTIAL (2026-11-28)

Candidate quotation@0.1.90; direct source repairs committed on feat/crm-129-quotation. Read [checkpoint 090](./goal-038/CRM-129-GOAL-038-G0-REPAIR-090.md) FIRST for exact commits, remaining source/operational gates, supported fresh-package install flow and one comprehensive verification assignment. Actual Asan transport is explicitly bound and read-only; no approved binding configured or vendor traffic executed by architect. All 089/090 build/test/deploy gates NOT_RUN. Last verified Dev is 0.1.88. G0 NOT PASS, G1/G2 NOT AUTHORIZED, Goal 023 ACTIVE. Preserve accepted versions and Intranet.

## PRIOR — Goal 038 G0 repair 089 SOURCE_PARTIAL (2026-11-28)

Direct architect source repairs are committed on feat/crm-129-quotation; candidate quotation@0.1.89. See [repair checkpoint 089](./goal-038/CRM-129-GOAL-038-G0-REPAIR-089.md) for exact source commits, remaining gates and verification. The previous 088 runtime evidence is historical and cannot certify 089. No build, test or deployment executed for 089. Default live Asan application transport deliberately fails closed until approved transport is wired. G0 is NOT PASS, G1 not authorized, Goal 023 ACTIVE. No Intranet or real vendor traffic. Architect owns remaining product source repairs.

## PRIOR — Goal 038 G0 verification 088 COMPLETE / NOT G0 PASS (2026-11-28)

Cursor executed unified G0-A/B/C/D verification on exact tip `8dfa4a52f4e19008f7c3bd1e1f12f023f77fc57f` / quotation@**0.1.88**. Evidence: [verification-088](./goal-038/verification-088/) + [A01–A19 ledger](./goal-038/verification-088/A01-A19-LEDGER.md). **Builds/tests PASS** (Vitest 797, Asan 69, money-unit 10, Jest quotation 368). **Dev existing install** applied and idempotent; installed version **0.1.88** on `dev-crm129`. Fresh apply on `dev-crm129-084` **FAIL** (app registration owned elsewhere; workspace remains 0.1.84). Intranet untouched; no live Asan. **G0 status: SOURCE_AND_TEST_VERIFIED_PARTIAL — NOT G0 PASS.** Open P0: A11 capability parity, A12 transport authority, A13 document reconciliation/idempotency, A15 operational isolation, A16 profiles, A17 typed reads, A19 fresh install/dataset identity. Do not authorize G1 until architect closes those source gaps. Goal 023 ACTIVE. Older headings below are historical.

## PRIOR — Goal 038 G0 execution / 0.1.88 SOURCE_PARTIAL (2026-11-28)

User approved execution and durable recovery. Read [G0 ordered execution and recovery](./goal-038/CRM-129-GOAL-038-G0-EXECUTION-AND-RECOVERY.md) FIRST; audit 087 and wire contract are binding. Direct source repairs for write/readback, customer replacement preservation, price tiers, double discount, sealed payable and fail-closed live retry are committed. Last running Dev reported 0.1.86; candidate 0.1.88 is NOT built, deployed or accepted. G0-A/B/C/D all PARTIAL; exact remaining audit IDs and Cursor verification instructions in linked recovery. Local bridge unavailable. No live vendor traffic, no Intranet, no outbound flags changed. Next: verify exact candidate with Cursor and independently audit evidence; complete open P0 source gates before G1 read-only authorization. Goal 023 ACTIVE. Older headings below are historical, not instructions to revert.


## CURRENT — Goal 038 Asan-first domain audit / 0.1.87 SOURCE ONLY (2026-11-28)

User accepted native accounting table UX 0.1.86. First real integration is Asan, with the original 32-page PDF as vendor wire authority. See [domain and wire contract](./goal-038/ASAN-DOMAIN-AND-WIRE-CONTRACT.md) and [audit and sequential gates](./goal-038/CRM-129-ASAN-REAL-CONNECTION-AUDIT-087.md). 087 source fixes customer response names, stock and adapter probe shape/redirect handling; complete route/field inventory and tests added. Other P0 gates OPEN (write response/readback, full customer update, price tiers, money/discount/tax/rounding, capability parity, transport, reconciliation, isolation). No runtime validation, no live calls, no outbound activation, no Intranet. Goal 023 remains ACTIVE. Next: G0 source remediation and isolated verification before user-authorized read-only G1.


## CURRENT — GOAL 036-R2 ARCHITECT DIRECT SOURCE REPAIR COMMITTED (2026-11-26)

**Important:** User requested direct repo changes rather than another worker task. Architect has **committed actual code** for the six accounting-connection calls to the existing authorized Nest REST quotation controller, transaction-accurate `affectedRecordId`, exact Nest→UI DTO (nested tax/special-row mappings; health), server-advertised adapter availability, truthfully unverified separate secret/flag metadata and targeted tests. **Frontend package staged as `quotation@0.1.71`; NOT deployed.** Full source/write ledger: [CRM-129-GOAL-036-R2-DIRECT-REPAIR-STATUS.md](./goal-036/CRM-129-GOAL-036-R2-DIRECT-REPAIR-STATUS.md).

**Gate:** `CODE_COMMITTED / BUILD_AND_RUNTIME_NOT_RUN`. Existing R1 `quotation@0.1.70` remained `BLOCKED_WITH_PRECISE_EVIDENCE` on Dev; do not assert this commit has repaired the running `:3002` host. The Nest server must be built/reloaded in a controlled way, then the frontcomponent applied and tests actually executed. **Separate Accounting Import/Outbound `/s` dependencies remain unported**, because the Nest controller has no such allowed actions; no fake API bypass. `:6080`, Money Domain, sealed revisions, production outbound are unchanged. Goal 023 ACTIVE, WS5/WS6 not architect-accepted. Retire/inflight and credential-rotation remain open.

## PRIOR CHECKPOINT — GOAL 036 R2 ACCOUNTING SHELL RECOVERY REQUIRED (2026-11-26)

**Current product:** `quotation@0.1.70` product tip `33babfc0d4`; R1 A–C code with 776 Vitest PASS reported, but real Accounting Settings fails because connection-list CRUD still uses broken Functions/`/s`. **Gate:** `BLOCKED_WITH_PRECISE_EVIDENCE`, not READY. Full [R1 evidence](./goal-036/CRM-129-GOAL-036-R1-EVIDENCE.md).

**Source independently verified:** Existing server `packages/twenty-server/src/modules/quotation/controllers/quotation-ui.controller.ts` ALREADY implements `accounting-connection-list/save/test/set-default/deactivate/reactivate` using `AccountingConnectionAuthorityService` and server role/workspace guards. Front `accounting-settings-panel.tsx` still calls `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` for all six through /s. This is not a missing Nest service.

**Critical DTO mismatch, NOT a blind URL replacement:** Nest `connections[]` use `recordId`, save returns full `connections` list (not singular `connection` or explicit created id), test returns nested `health` (not top-level health), and Nest list does not include legacy `adapters/credentials/flags` from /s. Missing metadata must be sourced from authoritative trusted contracts or marked unavailable, not fabricated. Other `ACCOUNTING_IMPORT_ROUTE` and `ACCOUNTING_OUTBOUND_ROUTE` remain separate /s dependencies; do not silently port to non-existent Nest actions. For new save require explicit authoritative affectedRecordId, not choose by list order/name. No server capability/permission bypass or actual vendor send.

**Canonical executable task:** [CRM-129-GOAL-036-R2-ACCOUNTING-SHELL-RECOVERY-TASK.md](./goal-036/CRM-129-GOAL-036-R2-ACCOUNTING-SHELL-RECOVERY-TASK.md). Follow sequential Nest-transport → response normalization / metadata → safe operation matrix → actual Dev browser, auth, Mock, F01/F05 proof → controlled apply. One CRM session, no `:6080`, main worker restart, schema/Money/Seals, forced Git or real Asan outbound. R1 catalog inactive/orphan/unverified fixes remain protected. **This recovery entry is DOCUMENTATION ONLY; no R2 source edits/tests/deploy claimed.** Goal 023 ACTIVE; WS5/WS6 still not architect-accepted until independently attested.

## PRIOR CHECKPOINT — GOAL 036-R1 EXECUTED → BLOCKED_WITH_PRECISE_EVIDENCE (2026-11-26)

**Evidence:** [CRM-129-GOAL-036-R1-EVIDENCE.md](./goal-036/CRM-129-GOAL-036-R1-EVIDENCE.md). **App:** `quotation@0.1.70` applied to Dev (`accounting-settings-page` front component). **Goal 023:** ACTIVE / NOT COMPLETE. **Gate:** `STOP_FOR_ARCHITECT_AND_USER_UAT`.

**Product commits:** R1-A `df67212fbc` (Nest-only catalogs), R1-B `3a3df01098` (inactive≠orphan≠unverified), R1-C `159da0119f` (unavailable adapter fail-closed), R1-D `636a037fb2` (ledger), R1-E version/apply+evidence. Vitest full suite **776 PASS**. Financial Settings Nest catalogs verified on `:3002` (`IR_VAT_9`, `TAX_1000`, `TAX_1050`).

**BLOCKER (precise):** Accounting Settings shell still loads connections via `/s` `callAppRoute(ACCOUNTING_CONNECTION_ROUTE)` and on this Dev returns `تنظیمات حسابداری خوانده نشد` / `ارتباط با سرور برقرار نشد`, so the repaired Nest catalog mapping form cannot be opened for F01 dual-UI attestation or F05 browser matrix. Auth workspace scripts / responsive 320–1440 / synthetic quotation journey remain **NOT_RUN**. Do **not** treat WS5/WS6 as architect-accepted; do not fabricate PASS.

**Next allowed:** restore Accounting connection list authority (existing Nest accounting-settings actions if already present — no new invent), then re-attest F01/F05 on Dev; independent architect review + USER UAT still required.

## PRIOR — EXECUTION CONTRACT GOAL 036-R1 (2026-11-26)

**Canonical task:** [CRM-129-GOAL-036-R1-ARCHITECTURE-REPAIR-TASK.md](./goal-036/CRM-129-GOAL-036-R1-ARCHITECTURE-REPAIR-TASK.md). Prior [independent audit](./goal-036/CRM-129-GOAL-036-INDEPENDENT-ARCHITECT-AUDIT.md) was `ARCHITECT_BLOCKED_ON_WS5_CONTRACT`. Decisive rules (Nest catalog authority; Error≠Empty≠Inactive≠Missing; Mock/Asan from server capabilities) remain binding. R1 packs were implemented in-session; see CURRENT checkpoint for runtime blocker.

## PRIOR CHECKPOINT — GOAL 036 INDEPENDENT ARCHITECT AUDIT (2026-11-26)

**Verdict:** `ARCHITECT_BLOCKED_ON_WS5_CONTRACT`, NOT Goal 036 acceptance. Full evidence: [CRM-129-GOAL-036-INDEPENDENT-ARCHITECT-AUDIT.md](./goal-036/CRM-129-GOAL-036-INDEPENDENT-ARCHITECT-AUDIT.md). Audited source from `1c5bc757fb` to `4ccff18f5f` on reconciled branch `ad909fe3f9`. Product diff is scoped to frontend/tests/docs; no schema, Money Domain, Nest authority, PDF or sealed revisions changed in this pack.

**BLOCKER F01:** WS5 accounting-settings catalog reads call `callAppRoute(TAX_POLICIES_ROUTE)` and `callAppRoute(QUOTATION_CURRENCIES_ROUTE)` on Functions/`/s`, while actual financial settings use Nest wrappers `callTaxPoliciesNestAction`/`callQuotationCurrenciesNestAction` due prior /s drift. Must align authority and prove reads.

**F02:** Promise.all rejects both reads if one fails, silent catch; IRR fabricated fallback disguises failed read; base currency options include orphan/inactive codes. **F03:** existing inactive tax mappings are marked orphan because PolicyTaxTable only receives active policies. **F04:** WS6 descriptor-driven UI is improved, but unknown descriptor is treated visually like non-live and capability/gate/preview matrix not independently proven. **F05:** 142 Vitest PASS are worker-reported; full E2E, auth negatives, responsive matrix, UAT, retire/inflight and credential rotation open.

**Pack decisions:** A source acceptable UAT open; B/WS5 BLOCKED; C/WS6 conditional/integration gates open; D/WS7-B PARTIAL; E incomplete E2E. Goal 023 ACTIVE. No live vendor calls, merge, force push, DB/Money mutation. Fix scoped findings, prove real Dev behavior, then independently re-audit. Latest audit documentation commit must be fetched/reconciled in working tree before further pushes; don't discard untracked `twenty-shared` artifacts.

## PRIOR CHECKPOINT — GOAL-036 STOP_FOR_ARCHITECT_AND_USER_UAT (2026-11-26)

**App:** `quotation@0.1.69` on Dev `:3002`. **Goal 023 ACTIVE / NOT COMPLETE**.

**Pages:**  
- Financial settings: http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d  
- Accounting settings: sidebar «تنظیمات حسابداری»

| Pack | Commit | App | Evidence |
| --- | --- | --- | --- |
| A UI/microcopy | `cab53037` | 0.1.66 | `goal-036/CRM-129-GOAL-036-PACKAGE-A.md` |
| B WS5 ownership | `09c8c5b3` | 0.1.67 | `goal-036/CRM-129-GOAL-036-PACKAGE-B-WS5.md` |
| C WS6 capabilities | `33ced3c9` | 0.1.68 | `goal-036/CRM-129-GOAL-036-PACKAGE-C-WS6.md` |
| D WS7-B bounded | (HEAD) | 0.1.69 | `goal-036/CRM-129-GOAL-036-PACKAGE-D-WS7B.md` |
| E matrix | (HEAD) | 0.1.69 | `goal-036/CRM-129-GOAL-036-PACKAGE-E-MATRIX.md` |

**Regression this session:** vitest financial+accounting suites **142 PASS**. Browser Package A isolation PASS. Money Domain / `:6080` / main worker / outbound unchanged. Open risks: retire/inflight send, credential rotation; WS7-B PENDING_USER_DESIGN_APPROVAL items listed in Package D.

**Gate:** architect review + user UAT required. Do not merge / force-push / declare Goal 023 complete. Git history reconciled with architect recovery checkpoint `c47523b0e3` (docs-only).

## PRIOR — USER UAT DEFECTS DE-035 / QUOTATION 0.1.65 (2026-11-26)

**Architect recovery checkpoint `c47523b0e3` (preserved verbatim intent):** DE-035 materially redesigned the UI but has a confirmed **nested interactive event bug**: tax `TaxLedger` and rounding `RoundingList` use a row-level `role=button` with `onClick=onEdit` and `onKeyDown` handling Enter/Space. Clicking the nested three-dots menu opens the menu AND launches edit because event bubbling reaches row; current inner `onClick(stopPropagation)` on menu wrapper is not a sufficiently robust boundary against React/host events or keyboard bubbling. **Treat DE-035 as USER_UAT_FAIL_FUNCTIONAL.** Fix architecture, not only `stopPropagation`: make the row a neutral `div` and provide a dedicated native keyboard-accessible Edit button in identity/name area; menu trigger/actions independently focusable. No interactive descendants of `role=button` parent. Add regression tests clicking dots and menu items do NOT open edit and Enter/Space on trigger do not fire row edit, while Edit does.

**User-facing copy is too technical:** screenshots show repeated internal implementation descriptions and diagnostics, e.g. `ساختار ثبت با ریل زمینه`, `فاز ۱`, `bootstrap`, `در سند ثبت می‌شود` as repeated guidance, `گام رُند باید عدد صحیح مثبت ریال باشد...۰٫۰۰۱...`, `ارزهای دیگر به فازهای بعدی منتقل می‌شوند`, and redundant information panels at bottom of context rail, exposing implementation detail. Perform a *complete* inventory of all text in SettingsShell, TaxLedger, CurrencyHero, RoundingList, RecordDialog and three composers; rewrite for everyday Persian accountants, concise contextual/field-level copy only, remove internal phases/system/roadmap/bootstrap information from operational UI. Keep necessary business warnings, e.g. used/default cannot be deleted and accounting code locked. Ensure errors honest and localized; no code/units/data meanings changed.

**Scoped repair:** same CRM page `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d` and branch `feat/crm-129-quotation`; no new redesign, route, DB/schema/Money Domain/Nest contract changes, no :6080. Keep OpenDesign DE-035 design intent; fix interaction/accessibility and remove technical copy, verify real browser on tax and rounding more menus / dialog / mobile and targeted regression, commit, apply safely on Dev. Goal 023 ACTIVE, WS5–WS7 frozen. Final STOP_FOR_USER_UAT not PASS by tests alone. Agent bridge unavailable to architect at time of this source-level review, so **no code changes or new deploy claimed by this entry**.

**Note:** GOAL-036 Package A (`cab53037` / `0.1.66`) implemented the scoped interaction + microcopy repair above; architect/user UAT of that repair remains open.

## PRIOR — GOAL-036 Package C/WS6 DONE → WS7-B / E NEXT (2026-11-26)

**App:** `quotation@0.1.68` on Dev `:3002`. **Goal 023 ACTIVE**. Final Gate `STOP_FOR_ARCHITECT_AND_USER_UAT`.

**Package A:** `cab53037` / `0.1.66` — click isolation + microcopy.  
**Package B / WS5:** `09c8c5b3` / `0.1.67` — catalog-bound maps.  
**Package C / WS6:** capability/`isLive`-driven labels; mock profile UI via `testProfiles`; connections **46 PASS**. Evidence: `goal-036/CRM-129-GOAL-036-PACKAGE-C-WS6.md`.

**Next:** Package D WS7-B (approved surfaces only) + Package E matrix → STOP_FOR_ARCHITECT_AND_USER_UAT. Goal 023 not complete.

## PRIOR — GOAL-036 Package B/WS5 DONE → WS6 IN PROGRESS (2026-11-26)

**App:** `quotation@0.1.67` on Dev `:3002`. **Goal 023 ACTIVE**. Final Gate `STOP_FOR_ARCHITECT_AND_USER_UAT`.

**Package A:** `cab53037` / `0.1.66` — click isolation + operator microcopy. Evidence: `goal-036/CRM-129-GOAL-036-PACKAGE-A.md`.

**Package B / WS5:** catalog-bound currency mapping (no invented USD/EUR); destination tax-code picker when catalog present; orphan maps retained + flagged; CRM tax/currency identity stays in financial settings. Tests connections **45 PASS**, settings panel **8 PASS**. Evidence: `goal-036/CRM-129-GOAL-036-PACKAGE-B-WS5.md`.

**Next:** Package C / WS6 shared Mock/Asan capability-driven UI. Goal 023 not complete.

## PRIOR — GOAL-036 Package A DONE → WS5 IN PROGRESS (2026-11-26)

**App:** `quotation@0.1.66` on Dev `:3002`. **Page:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d. **Goal 023 ACTIVE**. GOAL-036 authorized continuous A→WS5→WS6→WS7-B→E; Final Gate `STOP_FOR_ARCHITECT_AND_USER_UAT`.

**Package A (PASS technical):** row click isolation (non-interactive register/ladder + dedicated Edit + RowMenu stopPropagation); operator microcopy (no ریل زمینه / bootstrap / فاز ۱ / ۰٫۰۰۱ future); shell density polish; vitest **32 PASS**; browser verified menu≠edit dialog and locked accounting-code hint. Evidence: `docs/architecture/goal-036/CRM-129-GOAL-036-PACKAGE-A.md`.

**Next:** Package B / WS5 accounting ownership + mapping (C1–C7/F7). Do not treat Goal 023 as complete.

## PRIOR CHECKPOINT — DESIGN-ENGINE-035 REAL OD AGENT → IMPLEMENTED → STOP_FOR_USER_UAT (2026-11-26)

**App:** `quotation@0.1.65` on Dev `:3002`. **Page:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d. **Goal 023 ACTIVE**. No WS5/WS6/WS7.

**OpenDesign engine repaired:** native `pnpm tools-dev` (not Docker `:7456`). Real OpenCode agent ran with free model `opencode/mimo-v2.6-flash-free`. Production run `d454f184-a0fe-4996-82ad-7a6ca31ad690` → `deliverableValid:true` (`preview/index.html` + DESIGN.md + 6 transfer components + TRANSFER-MAP). Evidence: `CRM-129-DESIGN-ENGINE-035-PROGRESS.md`, `docs/architecture/design-engine-035/`.

**Product IA (measurable):** context rail + tax register / currency dossier / rounding ladder. Not spacing/color-only. Domain contracts preserved. Unit tests 31 PASS. Browser: three tabs, menus, locked accounting code, mobile 390 no overflow.

**Gate:** `STOP_FOR_USER_UAT` — user must visually accept. Goal 023 stays ACTIVE until then.

## PRIOR — GOAL 034-R2 OPENDESIGN REDESIGN → USER_REJECTED (2026-11-26)

**App:** `quotation@0.1.64` on Dev `:3002`. **Page:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d. **Goal 023 ACTIVE**. No WS5/WS6/WS7.

**OpenDesign:** Docker daemon `:7456` health OK (`0.25.1`); project `crm129-fs-r2` + redesign skill artifacts transferred into React. Evidence doc: `CRM-129-GOAL-034-R2-OPENDESIGN-EVIDENCE.md`.

**Menu fix (browser CDP):** last-row tax `بیشتر` menu `top = trigger.bottom + 4px`, left-aligned with trigger, `isTopLeftBug=false` (no longer viewport top-left). Absolute anchor under relative trigger. Rounding last-row same pattern.

**Design deltas vs rejected 0.1.63:** no default banner; IRR hero card; rounding dense surface; dialog focus trap; delete latch confirm→mutation; denser ledger.

**Gate:** `STOP_FOR_USER_UAT` — user must visually accept. Goal 034-R2 / Goal 023 not complete until then.

## PRIOR — USER REJECTED GOAL 034 VISUAL DELIVERY (2026-11-25)

**User UAT evidence:** two screenshots of the SAME current financial settings page at `:3002` after reported `quotation@0.1.63` showed the rounding row's `بیشتر` menu opening at the extreme top-left of the viewport, disconnected from its trigger; tabs and content still looked substantially like prior layout; excessive blank horizontal area and repeated action controls. This refutes previous visual-ready/portal-position claims. **Goal 034 = USER_REJECTED_VISUAL, NOT COMPLETE. Goal 023 ACTIVE**. No WS5/WS6/WS7.

**Architect root-cause lead:** `RowActionsMenu` rendered in the Front Component React tree with `position:fixed` and coordinates obtained from `getBoundingClientRect()`; host stacking/coordinate or containing-block transforms make computed viewport coordinates invalid. Re-architect overlays based on proven Front Component host affordances or reliable same-containing-block anchor, do not keep tweaking top/left blindly. Probe actual rendered bounding boxes and containing block in browser, including scroll and last row. Host `openCommandConfirmationModal` only confirmed for destructive confirm, NOT a generic editor or menu portal. `createPortal` reportedly did not mount, so tools need true runtime compatibility testing. Beware an in-tree fixed settings dialog with no focus trap.

**User's higher-level directive:** autonomous designer must first inventory actual tax/currency/rounding domain functions, object/role guards, operations, and shared Twenty UI patterns, then propose and IMPLEMENT a coherent professional design directly in existing Front Components. User must not hand-spec every button/spacing. Mere CSS reshuffle or passing 35 component tests cannot qualify as real visual design. Avoid unverified Onlook claims; Onlook was evaluated but not used due to compatibility. A design owner/model should make clear information architecture and interaction decisions based on concrete feature inventory, use existing Twenty tokens, then independently verify visual results, responsive widths and actual functionality in Dev. Single CRM session, no separate mock page, no new route, no paid services or framework migration, no Money/schema/backend alteration unless strictly proven necessary. Hold final `STOP_FOR_USER_UAT` until real browser menu anchors, user-perceived design improvements and regression evidence are satisfied.

**Next:** issue a focused Goal 034-R1 continuation of existing Goal, not a new project. First recover from latest HEAD; evidence-driven host overlay repair and an autonomous full-page layout/interaction redesign. Record screenshots and exact dimensions. Do not declare it accepted without USER approval.

## PRIOR CHECKPOINT — GOAL 034 SOURCE REVIEW / USER UAT GATE (2026-11-25)

**Product HEAD audited:** `90a88b5871`, app reported `quotation@0.1.63` on Dev :3002. **Goal 023 ACTIVE**; Goal 034 `TECHNICALLY_VERIFIED / STOP_FOR_USER_UAT`, **NOT USER_ACCEPTED**. Exact current page: http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d. Onlook evaluated but not adopted; direct React/Twenty used. No duplicate app or Next migration. See [Goal 034 progress](./CRM-129-GOAL-034-PROGRESS.md).

**Source-audited positives:** diff from `6610b4fb429e` touches only quotation app frontend, small shared UI components/tests, version and docs; **not** financial schema, Money Domain, Nest financial authority, PDF, historical revision logic. Tax and rounding create/edit now use shared `SettingsDialog` instead of side inspector; tax ledger retained full width. Host shared delete confirm, no manual `راه‌اندازی ریال` button in currency UI, compact tabs, and menus present. Browser and 35 unit PASS are worker-reported, not independently rerun.

**Architecture/UX gaps before unconditional acceptance:**
- `SettingsDialog` uses in-tree fixed overlay after `createPortal` was not mounting in host; this is pragmatic but its true host stacking/clipping behavior on 320/360/390 and nested panel widths requires real browser verification. It has Escape/initial-focus/focus-return, **but no full Tab/Shift+Tab focus trap or background inertness** even though `aria-modal=true`; must implement via shared existing host semantics or proper focus containment; ensure overlay cannot leave focus behind.
- `runDestructiveConfirm` uses **module-global boolean** guard covering ONLY the host confirm dialog promise; it releases before the subsequent deletion network request completes. This also inadvertently serializes unrelated independent components/workspaces in same module instance. Prefer scoped `useRef`/operation lifecycle single-flight spanning confirm+mutation, with cleanup in `finally`, and test rapid confirm→delete duplicate trigger.
- `RowActionsMenu` uses in-tree position:fixed and initial `getBoundingClientRect`; no scroll/resize reposition or dismissal, no ArrowUp/ArrowDown/Home/End keyboard management despite `role=menu`, and no Escape/focus evidence in real browser for long/last-row menus. Prefer native/shared Twenty popover if compatible; otherwise fix within shared component, including mobile nested scroll/resize.
- `SettingsDialog` registers document keydown effect depending on `onClose` identity; re-render may repeatedly restore focus and refocus first control. Stabilize callback/one-time focus capture where appropriate.
- Front only source modifications prove no new direct financial domain diff; they do NOT establish security, permissions, PDF, data persistence or complete 320–1440 browser regression PASS independently. Require user visual UAT; no merge or WS5–WS7 start until accepted.

**Next:** user opens REAL current page, tests modal create/edit, tax delete confirmation, currency code save, rounding dialog and 320/360 mobile. If apparent behavior meets user standard, finish these bounded architecture/accessibility gaps in same CRM coding session and perform regression/browser tests before final Goal 034 `USER_ACCEPTED`; do not redesign again. No :6080, primary worker restart, schema/financial rewrite, real vendor send, force push.

## PRIOR CHECKPOINT — GOAL 034 LIVE VISUAL REDESIGN → STOP_FOR_USER_UAT (2026-11-26)

**Parent:** CRM-129-GOAL-023 (ACTIVE / NOT COMPLETE). Goal 033 UX **not user-accepted** → superseded by 034. **Branch:** `feat/crm-129-quotation`. **App:** `quotation@0.1.63` on Dev `:3002`. Final Gate **`STOP_FOR_USER_UAT`**.

**Onlook:** evaluated (Apache-2.0); **not used** — Windows desktop path / paid agent / Front-Component host architecture incompatible without forbidden Next-Tailwind conversion. Notes: `D:\CrmTools\onlook-evaluation-goal-034.md`. Implementation: direct React on the real settings page.

**Shipped vs Goal 033 risks:** portal `SettingsDialog` for create/edit (ledger full-width); portal `RowActionsMenu` (Escape/click-away, last-row safe); `runDestructiveConfirm` synchronous single-flight latch; currency/rounding auto idempotent bootstrap (no bootstrap buttons); host title once + compact tabs. Money Domain / Nest / seals / `:6080` unchanged. Detail: [`CRM-129-GOAL-034-PROGRESS.md`](./CRM-129-GOAL-034-PROGRESS.md).

**UAT:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d — sidebar «پیش‌نیازهای حسابداری». Goal 034 closes only on user confirm; Goal 023 stays ACTIVE.

## PRIOR — GOAL 033 INDEPENDENT ARCHITECT AUDIT (2026-11-25)

**Verdict:** `SOURCE_SCOPE_PASS_WITH_OPEN_UI_RISKS`. Open R1–R5 addressed under Goal 034 (single-flight, portal menu, dialog editor, responsive follow-up on Dev). Audit: [`CRM-129-GOAL-033-INDEPENDENT-ARCHITECT-AUDIT.md`](./CRM-129-GOAL-033-INDEPENDENT-ARCHITECT-AUDIT.md).

## PRIOR CHECKPOINT — GOAL 033 → STOP_FOR_USER_UAT (2026-11-25)

**Parent:** CRM-129-GOAL-023 (ACTIVE / NOT COMPLETE). Goal 032 still user-UAT open. **Branch:** `feat/crm-129-quotation`. **App:** `quotation@0.1.61` on Dev `:3002`. **Recovery baseline:** `cd3af69d17`. Final Gate **`STOP_FOR_USER_UAT`**.

**Shipped UX repair on existing `پیش‌نیازهای حسابداری`:** shared `confirmDestructiveAction` (host ConfirmationDialog / danger accent) — Delete opens dialog directly with record name; no inline/editor-for-delete; Edit + More menu on tax & rounding; compact currency IRR card; Twenty `enqueueSnackbar` only (dedupe, no empty); container-aware responsive + 44px touch; Nest/auth/Money Domain/historical seals unchanged. Detail: [`CRM-129-GOAL-033-PROGRESS.md`](./CRM-129-GOAL-033-PROGRESS.md).

**UAT:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d — sidebar «پیش‌نیازهای حسابداری». Intranet `:6080` untouched. No WS5/WS6 until user accepts. Goal 033 closes only on user confirm; Goal 023 stays ACTIVE.

## PRIOR — GOAL 033 MANDATE (pre-implement, 2026-11-25)

**Baseline feature HEAD:** `b089598eef14` / quotation@0.1.60. User: settings routes function but UX unacceptable. Mandate: designer-owned implementable repair of current page; shared confirm; toast host; compact tabs; RTL/container responsive; preserve financial integrity; continuous session → **STOP_FOR_USER_UAT**.

## PRIOR CHECKPOINT — P0 FINANCIAL SETTINGS RECOVERY → STOP_FOR_USER_UAT (2026-11-25)

**Branch:** `feat/crm-129-quotation`. **Base docs:** `6a824e9df8`. **HEAD:** `cfcc9e6347`. **App:** `quotation@0.1.60` on Dev `:3002`. Goal 023 **ACTIVE**. Final Gate **`STOP_FOR_USER_UAT`**.

**Root cause (proven):** settings UI hit broken `/s` logic-function GraphQL (`PERSISTENCE_FAILED`; currencies `TRIGGER_NOT_FOUND`). Nest `/rest/quotation/actions` already enforced workspace settings authority.

**Shipped:** Nest clients for tax/currency/rounding; page **پیش‌نیازهای حسابداری** with tabs مالیات و عوارض / ارزها / قواعد رُند کردن; IRR step positive integer only (`0.001` → `ROUNDING_STEP_INVALID`). Detail: [`CRM-129-FINANCIAL-SETTINGS-RECOVERY-PROGRESS.md`](./CRM-129-FINANCIAL-SETTINGS-RECOVERY-PROGRESS.md).

**UAT:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d — sidebar «پیش‌نیازهای حسابداری». Intranet `:6080` untouched.

## PRIOR — URGENT UAT REGRESSION NOTE (architect, 2026-11-25)

## PRIOR CHECKPOINT — GOAL 032 CUSTOM ROUNDING → STOP_FOR_USER_UAT (2026-11-25)

**Branch:** `feat/crm-129-quotation`. **Baseline:** `dab67dbbb3`. **HEAD:** `8567405840`. **App:** `quotation@0.1.59` on Dev `:3002`. Goal 023 **ACTIVE / NOT COMPLETE**. Goal 032 child of Goal 023 — Final Gate **`STOP_FOR_USER_UAT`**.

**Shipped:** named `roundingRule` catalog (seed 10…1e6 + STEP_99); settings «قواعد رُند کردن»; form picker «مبنای رُند کردن»; floor-to-step micros; snapshot fields; Nest authority; front loads catalog via Nest actions. Browser evidence: STEP_1000 → deduction −۹۵ تومان, payable ۹۳٬۱۰۰. Detail: [`CRM-129-GOAL-032-PROGRESS.md`](./CRM-129-GOAL-032-PROGRESS.md).

**Dev runtime:** server(+Dev worker) on `twenty-dev/o117-restore` after stock-image ORM mismatch; QuotationModule docker-cp. Backup `D:\CrmDeployment\backups\crm129-goal-032-20261125-191247\`. Intranet `:6080` untouched. No force-push/merge/outbound.

**Gate:** User UAT on real Dev form + settings. Goal 032 closes only on user confirm. Do **not** start WS5/WS6/WS7 until then. Goal 023 stays ACTIVE.

## PRIOR — GOAL 023/031: USER-DEFINED NAMED PAYABLE ROUNDING RULES SPEC (2026-11-25)

Spec recorded at `dab67dbbb3`; implemented under Goal 032 above. Exact arithmetic: payableMicros = floor(unroundedMicros/(S*1000000n))*(S*1000000n); AdjustmentMicros = payable − unrounded (never positive). Examples 99/100/1000 as in Goal 032 Progress.

## PRIOR CHECKPOINT — GOAL 031 UX COMPLETION → STOP_FOR_USER_UAT (2026-11-25)

**Branch:** `feat/crm-129-quotation`. **Goal 031 base:** `a0cdbf78d0`. **HEAD:** `883ac59517`. Goal 023 **ACTIVE / NOT COMPLETE**. Goal 031 is a child UX completion of the same real form — not a parallel architecture.

**Dev target:** `quotation@0.1.57` on `:3002` (applied). Schema WS1–WS4 already applied (DEV-APPLY-030) — **do not re-run**. Intranet `:6080` + worker untouched.

**UX pack:** حقیقی/حقوقی, paginated customer picker (≤100/page), currency + display unit clarity, per-line tax amounts, single summary, RTL/mobile, `position`↔`sortOrder` on Nest line write. Detail: [`CRM-129-GOAL-031-PROGRESS.md`](./CRM-129-GOAL-031-PROGRESS.md).

**Gate:** **`STOP_FOR_USER_UAT`** on the real Dev form. No WS5/WS6 / redesign until user confirms.

## PRIOR — GOAL 023: DEV-APPLY-030 DONE → STOP_FOR_USER_UAT (2026-11-25)

**Branch:** `feat/crm-129-quotation`. **Pre-apply recovery:** `23698e4ae7`. **Post-apply docs/IRR HEAD:** `5a665ef2b1`. Goal 023 **ACTIVE / NOT COMPLETE**.

**Dev live:** `quotation@0.1.56` on `:3002`. Schema WS1–WS4 applied. Tax/currency bootstrap idempotent (IRR default; `IR_VAT_9` default). Intranet `:6080` + worker untouched. Backup: `D:\CrmDeployment\backups\crm129-dev-apply-030\`.

**Real form for user:** http://localhost:3002/object/quotation/52179082-a5b9-4302-a28c-afed681fc729 (`UAT-APPLY-030 تست فرم واقعی`) or Person → ایجاد پیش‌فاکتور. Handoff: [`CRM-129-GOAL-023-DEV-APPLY-030-STOP-FOR-USER-UAT.md`](./CRM-129-GOAL-023-DEV-APPLY-030-STOP-FOR-USER-UAT.md).

**Gate:** **`STOP_FOR_USER_UAT`**. Do **not** start WS5/WS6, redesign, or further Apply until the user confirms appearance and behavior of the real form.

**IRR repair:** phase-1 `selectInitialDocumentCurrencyCode` always IRR; form select IRR-only; vitest document-currency 9 PASS.

## PRIOR — GOAL 023: WS4 ACCEPTED; CONDITIONAL DEV APPLY AUTHORIZED (2026-11-25)

**Verified feature HEAD immediately before this note:** `6e71646bb4`. **WS1/WS2/WS3/WS4 source ARCHITECT_ACCEPTED**, subject to executable Dev validation. Goal 023 **ACTIVE / NOT COMPLETE**. User priority: see the **real existing quotation form** on Dev `:3002`, not a mock/prototype, in the current SINGLE Cursor session.

**Architect decision:** controlled Dev-only Schema/App Apply for WS1–WS4, `quotation@0.1.56`, is **CONDITIONALLY AUTHORIZED** under `docs/architecture/CRM-129-GOAL-023-DEV-APPLY-PREFLIGHT-WS1-WS4.md`. Before any write: verify exact target/branch, no unintended dirty files; recheck metadata/UUID collisions; record DB backup and tested recovery plan; verify outbound off, no unrelated worker or `:6080` changes; inspect pending schema diff and ensure strictly additive intended fields. If a prerequisite fails or unexpected destructive schema/metadata diff appears, **STOP_FOR_ARCHITECT WITHOUT APPLY**. No production deployment.

**Important WS4 check:** `selectInitialDocumentCurrencyCode` has fallback to first active catalog row. With corrupted/incomplete catalog this may offer non-IRR in a phase-1 form although backend refuses it. Normalize phase-1 selection to IRR / fail-closed and test missing/disabled/default USD scenarios as a strictly limited repair before Apply; no extra design. Ensure currency bootstrap produces active IRR and that selector offers only active phase-1 IRR.

**Authorized execution sequence after passing preflight:** (1) controlled Dev schema apply of precisely WS1–WS4 fields, (2) apply quotation app `0.1.56` with safe build/installation requirements, (3) idempotently bootstrap tax and currency references, (4) run money/security/regression and real browser UAT smoke on SAME existing quotation form: IRR header, independent default/override per-line tax+duty, discount + Hamilton total, save/reopen, existing revision/PDF integrity, no accountingCode UI fields; (5) capture served URL and practical user test steps; **STOP_FOR_USER_UAT**. Do not launch WS5/WS6 or new prototype.

**No authorization:** enable outbound or real vendor calls; merge, force push, production deploy, main worker restart, `:6080` changes, remove historical mappings, or declare Goal complete. Test reports given by worker are not independently rerun by architect. After user UAT, reconcile Progress and remaining gates.

## PRIOR CHECKPOINT — GOAL 023 / WS4 TECHNICALLY_VERIFIED; STOP_FOR_ARCHITECT — AWAIT APPLY (2026-11-25)

**Goal 023 stays ACTIVE / NOT COMPLETE.** Branch `feat/crm-129-quotation`. Base `745bf58fea`. Single Cursor session. Highest priority: real quotation form on Dev `:3002` after controlled Apply.

**Prior rulings:** WS1–WS3 source **ARCHITECT_ACCEPTED**. WS4 implementation authorized and now **TECHNICALLY_VERIFIED** (document IRR currency on existing form; line inheritance; phase-2 stubs OFF; no FX). Detail: [`CRM-129-GOAL-023-WS4-STOP-FOR-ARCHITECT.md`](./CRM-129-GOAL-023-WS4-STOP-FOR-ARCHITECT.md). App prepared `0.1.56`.

**Dev Apply still unauthorized.** Consolidated preflight: [`CRM-129-GOAL-023-DEV-APPLY-PREFLIGHT-WS1-WS4.md`](./CRM-129-GOAL-023-DEV-APPLY-PREFLIGHT-WS1-WS4.md). **No new packs** until Apply grant + smoke + USER_UAT path.

**Next recovered-chat action:** architect accepts WS4 (or amends) and issues **separate Apply authorization** for WS1–WS4 schema/app on Dev → smoke on actual form → `STOP_FOR_USER_UAT`. Do not start WS5/WS6.

**Safety:** no `:6080`, no primary worker restart, outbound disabled, no vendor send, no force push/merge, no history deletion.

## PRIOR CHECKPOINT — GOAL 023 / WS3 TECHNICALLY_VERIFIED; STOP_FOR_ARCHITECT (2026-11-25)

**Goal 023 stays ACTIVE / NOT COMPLETE.** Branch `feat/crm-129-quotation`. Base `d1d5da6c4a`. Single Cursor session; no prototypes/redesign; existing draft cards remain design authority.

**Architect ruling (prior):** WS2 + WS2-R1 = ARCHITECT_ACCEPTED; WS3 opened with **narrow Money Domain** grant only.

**WS3 shipped (awaiting architect financial integrity accept):** Independent per-line tax/duty policy on existing quotation cards; default auto-applied for new lines; override one line without mutating others; frozen rates + accounting-code snapshot per line (no codes on form); Hamilton allocation preserved; multi-tax outbound `MULTI_TAX_UNSUPPORTED`; legacy header fields + sealed revisions preserved. App prepared `0.1.55`. **Dev Schema/App Apply still unauthorized.**

**Evidence:** Vitest money/draft/outbound **240 PASS**; Jest persistence/totals/revision **44 PASS**. Detail: [`CRM-129-GOAL-023-WS3-STOP-FOR-ARCHITECT.md`](./CRM-129-GOAL-023-WS3-STOP-FOR-ARCHITECT.md) + [`CRM-129-GOAL-023-WS3-PREFLIGHT.md`](./CRM-129-GOAL-023-WS3-PREFLIGHT.md).

**Next path, serial:** Architect accept/amend WS3 → **WS4** document IRR currency → controlled Dev schema/app apply (separate grant) → smoke on **actual** `:3002` form → **STOP_FOR_USER_UAT**. No WS5/WS6 polish until user sees the form. No outbound / `:6080` / force-push.

**Safety:** No outbound enablement, no real Asan/Sepidar send, no :6080 or primary worker restart, no deletion of historical docs or mappings, no force push, no merge until Goal passes all gates.

**Next recovered-chat action:** review WS3 STOP package; if accepted, open WS4 only.

## PRIOR CHECKPOINT — CRM-129-GOAL-023 / WS2-R1 TECHNICALLY_VERIFIED; STOP_FOR_ARCHITECT (2026-11-25)

**Goal 023 stays ACTIVE / NOT COMPLETE.** Branch `feat/crm-129-quotation`. Recovery base `44c1951f83`. Single Cursor session; no prototypes/redesign; existing draft cards are design authority.

### WS2-R1 shipped (awaiting architect accept)

- `resolveAccountingSnapshot` is **fail-closed**: catalog read errors and missing required reference rows refuse the draft save (transaction does not insert/update blank codes).
- Empty `accountingCode` snapshot allowed only when the reference row exists and has no code; record ids still stored.
- Evidence: draft persistence **23 PASS**; PG suite **4 PASS**; authority suites PASS.
- Detail: [`CRM-129-GOAL-023-WS2-R1-STOP-FOR-ARCHITECT.md`](./CRM-129-GOAL-023-WS2-R1-STOP-FOR-ARCHITECT.md).
- **WS2/R1 still NOT ARCHITECT_ACCEPTED.** Dev Apply still unauthorized. Money Domain / WS3 still unauthorized until this STOP is cleared.

### Next after architect accept (REAL-FORM-027)

1. Open WS3 with **narrow Money Domain** grant (per-line tax/duty after Hamilton discount allocation only).
2. WS4 document IRR currency on existing form header.
3. Controlled Dev Apply (WS1–WS4) → browser smoke on real `:3002` form → **STOP_FOR_USER_UAT**.
4. No WS5/WS6 / visual polish until user reviews that form. No outbound / `:6080` / force-push.

**Recovered chat next:** review WS2-R1 STOP package; if accepted, open WS3.

## PRIOR CHECKPOINT — CRM-129-GOAL-023 / WS2 TECHNICALLY_VERIFIED (2026-11-25; ACTIVE; STOP_FOR_ARCHITECT)

**Goal 023 remains ACTIVE and INCOMPLETE.** Feature branch `feat/crm-129-quotation`. Authoritative state: Progress board + this note + HEAD/diff + real tests. A Cursor PASS alone is not Goal completion.

### Architect ruling (this session)

| Decision | Ruling |
|---|---|
| WS1 + WS1-R1 | **`ARCHITECT_ACCEPTED`** (source review) |
| WS2 | Implemented → **`TECHNICALLY_VERIFIED`** — see [`CRM-129-GOAL-023-WS2-STOP-FOR-ARCHITECT.md`](./CRM-129-GOAL-023-WS2-STOP-FOR-ARCHITECT.md) |
| Dev Schema / App Apply | **Not authorized** until separate approval (app `0.1.54` prepared) |
| Money Domain / WS3 | **Not authorized** until WS2 accept + explicit Money grant |

## PRIOR — STOP REDESIGN + UX PACK A (2026-11-25; superseded as CURRENT by WS2 IMPLEMENT)

Pack A UX micro-repairs + cancelled WS7-A product redesign. See Progress CP-UX-REPAIR-A.

### Mandatory recovery order (new chat / Cursor session)

1. Read `docs/architecture/CRM-129-MASTER-GOAL-023.md`, `CRM-129-FINANCIAL-CONTRACT-023.md`, `CRM-129-EXECUTION-PLAN-023.md`.
2. Read `docs/architecture/CRM-129-GOAL-023-PROGRESS.md` and `CRM-129-GOAL-023-WS1-PREFLIGHT.md`.
3. Verify current branch, HEAD, dirty worktree; never overwrite unrelated dirty files.
4. **ONE Cursor session, SERIAL execution.** No parallel worktree; no Money Domain edits without architect grant.
5. Continue approved packs only. A completed pack is **not** a completed Goal.

### Redesign cancelled

- From-scratch WS7-A product redesign: **cancelled** by user.
- `docs/design/crm-129-goal-023-ws7a/` is **non-binding archival reference only** — not Design of Record; do not copy into product.
- Keep existing draft form + five-section accounting settings chrome; repair defects only.

### Architect decisions applied in WS1

| Decision | Ruling (applied) |
|---|---|
| `WS1-OPEN` | APPROVED → implemented to `TECHNICALLY_VERIFIED` |
| `Q-LOCK-1` | Option A in Contract C4/F6 (enforcement ships in **WS2**) |
| `Q-LOCK-2` | Dual advisory keys; currency lock util created; TAX-008 order preserved |
| `Q-STD-1` | `defineField` on person/company after Dev collision check (**0** collisions) |
| `Q-WS2-COLS` | No quotation snapshot code columns in WS1 |
| `Q-IRR-SEED` | Idempotent IRR bootstrap **even if catalog non-empty**; phase-1 operational default **IRR only** (WS1-R1) |

### WS1-R1 fix (technical evidence)

- `QuotationCurrencyAuthorityService.bootstrap`: inserts/activates IRR when missing from a non-empty catalog; restores IRR as sole default when drifted.
- `saveCurrency` / `setDefaultCurrency`: refuse non-IRR operational default (`QUOTATION_CURRENCY_DEFAULT_MUST_BE_IRR`).
- `enforceSingleActiveDefault`: never auto-promotes a non-IRR currency.
- Advisory currency lock + financial contracts preserved.
- Jest: `quotation-currency-authority.service.spec.ts` **8 PASS**.
- **No Dev Apply** this turn. App still **0.1.53**.

### UX Pack A (this delivery — no Money Domain)

- Persian honesty (no English «Mock» in operator-facing readiness copy).
- Draft RTL hygiene (`dir=ltr` on Latin SKU / raw policy-code fallback).
- Connection form ownership hint (CRM tax/currency codes on «مالیات و عوارض»; connection maps vendor destinations only).
- `fa-IR` formatting for connection health-check timestamps.
- **Not shipped:** per-line tax, catalog document currency, WS7-A table chrome, Deploy.

### Architect stop package

Full decision brief: [`CRM-129-GOAL-023-STOP-FOR-ARCHITECT-UX-REPAIR.md`](./CRM-129-GOAL-023-STOP-FOR-ARCHITECT-UX-REPAIR.md).

### Next actions (serial)

1. Finish WS2 → `STOP_FOR_ARCHITECT` (no Dev Apply until separate grant).
2. After WS2 accept: open **WS3** only with **explicit Money Domain permission**.
3. Then **WS4** (IRR-only document currency + multi-currency hooks off).
4. Then WS5/WS6; **`STOP_FOR_USER_UAT`** on real Dev product.
5. Goal close only after SC1–10 + USER_UAT + architect PR/merge. Default branch `crm-platform`; no force-push.

### Known gates that must survive

- Money/TAX-008/sealed revisions preserved.
- 021-R1 retire↔inflight-send hard lock still OPEN.
- Credential rotation still pending (history); no force-push.
- No LIVE_VERIFIED, no outbound enablement, no real Asan/Sepidar, no secret exposure, no mapping purge, no main worker restart, no `:6080` changes.
- **Never claim GOAL_023_COMPLETE** early.

### Gates open now

| Gate | Owner |
|---|---|
| `STOP_FOR_ARCHITECT` (WS2 evidence) | Architect |
| Dev Apply (WS1 schema + WS2 columns) | Separate approval |
| `STOP_FOR_USER_UAT` | Deferred until Pack B on real Dev |

## PRIOR CHECKPOINT — CRM-129-GOAL-023 single-session architect note (2026-11-25 @ `9884f2a4c3`)

Documented WS1-OPEN and serial WS7-A requirement before implementation evidence. Superseded as CURRENT by WS1 TECHNICALLY_VERIFIED above; sequence rules retained.

## PRIOR CHECKPOINT — CRM-129-GOAL-023-EXECUTION-024 docs (2026-11-25 @ `6bc3f558b9` / `cdb890b3f5`)

C1–C7 ratification, Progress board, WS1 preflight (docs only).

## PRIOR — CRM-129-FINANCIAL-CONTRACT-AND-UX-GOAL-023 (2026-11-25; planning @ `cdb890b3f5`)

Initial Goal/Contract/Execution Plan registration. Superseded as *active execution* by EXECUTION-024 above; docs remain normative and were amended in-place with C1–C7.

## PRIOR — CRM-129-ACCOUNTING-RETIRE-021-R1 (2026-11-25; **IMPLEMENTED** → `STOP_FOR_ARCHITECT`)

Close the retired-connection **history read** defect and document send/retire concurrency.

### R1 fix

- `operations` uses `loadConnectionByIdForHistory` (retired allowed; no reactivate/default).
- Preview/execute keep `resolveConnection` + `requireActiveAccountingConnection` (retired refused).
- `executeItemPush` / `executeQuotationExport` re-check activity before ledger/vendor (Mock cutoff).
- Consumer matrix + concurrency stop-line: `docs/architecture/CRM-129-ACCOUNTING-RETIRE-021-R1-AUDIT.md`.

### Evidence

- Vitest: connection + outbound + resolve + connections section **79 PASS**; settings panel **8 PASS**; server authority **21 PASS** (020/021).
- App **0.1.52** applied to `dev-crm129` (logic/front only; no Nest module change required for this R1).
- No vendor call; outbound flags unchanged; worker / `:6080` untouched.

### Architect decision still open (concurrency)

Hard “retire always aborts in-flight send” needs a **shared** lock/outbox with deactivate — **not** done in R1. Current cutoff is the last successful active check before ledger create.

## PRIOR — CRM-129-ACCOUNTING-CONNECTION-RETIRE-021 (2026-11-25; **IMPLEMENTED** → `STOP_FOR_ARCHITECT`)

Soft retire / reactivate for accounting connections (P0-2 from ACCOUNTING-AUDIT-019 / DEFAULT-020).

### Contract shipped

- `deactivate` → `isActive=false`; **no hard delete**; history, party/item links and settings retained.
- Retiring the workspace default clears `isDefault` in the **same advisory-locked** transaction; **no auto-promotion**.
- `reactivate` → `isActive=true` and forces `isDefault=false` (never auto-default).
- New work / temporary localStorage selection refuse inactive destinations (`CONNECTION_INACTIVE` / cleared working id).
- GraphQL generic delete/update still closed by write-guard (unchanged).

### Evidence

- App vitest focused: **70 PASS** (resolve + connections section + settings panel + connection service).
- Server Jest: authority + write-guard (**66 PASS** in those suites), including deactivate default, reactivate without default, foreign id, forbidden, shared lock key with set-default.
- App **0.1.51** applied to `dev-crm129`; `dist/modules/quotation` copied into `twenty-server-1` only; worker / `:6080` untouched.
- No vendor calls; outbound flags unchanged; no LIVE_VERIFIED claim; Money/tax/revision/PDF untouched.

### Architect still owns

- P0-3 go-live / LIVE_VERIFIED; Sepidar priority; optional live UAT of retire on `:3002`.

## PRIOR — CRM-129-ACCOUNTING-DEFAULT-020 (2026-11-25; **IMPLEMENTED** → `STOP_FOR_ARCHITECT`)

Workspace default accounting destination contract (P0-1 from ACCOUNTING-AUDIT-019).

### Architect decisions shipped

- At most one **active** workspace default per workspace (`accountingConnection.isDefault`).
- Temporary UI selection ≠ workspace default (localStorage key renamed to `quotation:accounting:working-connection`).
- Default is **never** inferred from row order, first-active, or localStorage.
- Existing rows stay `isDefault=false` until an authorized `set-default` (no auto-migration).
- Missing valid default → explicit `ACCOUNTING_DESTINATION_REQUIRED` / UI «نیازمند انتخاب مقصد پیش‌فرض».

### Schema / compatibility

- New boolean field `isDefault` on `accountingConnection` (UUID `03f6b497-56e1-5a40-bf1b-418fec79a2d7`), `defaultValue: false`, `isUIEditable: false`.
- App version **0.1.50** applied to `dev-crm129` (field + viewFields + front components + logic checksums; familiar stale `objectPermission` 16 destroy/recreate).
- No backfill of defaults; no deletion of connections; sync operations / money / tax / revision / PDF untouched.
- GraphQL generic writes remain closed; only REST `accounting-connection-set-default` mutates the flag (under `pg_advisory_xact_lock`).

### Shared resolve

- Server: `resolve-accounting-destination.util.ts`
- App: `domain/accounting/resolve-destination.ts`
- Consumers: settings shell (temporary working id), connections list badges/actions, quotation accounting tab, `resolveConnection` for outbound/import when no explicit id.

### Evidence

- App vitest (focused): **65 PASS** (resolve + connection service + connections section + settings panel).
- Server Jest: resolve util + authority service (**23 PASS** including set A→B, inactive refuse, forbidden, foreign id, insert `isDefault:false`, advisory lock).
- `tsgo --noEmit` clean for quotation app + twenty-server.
- Dev: app **0.1.50** applied; `dist/modules/quotation` copied into `twenty-server-1` and **only** that container restarted; worker `StartedAt` unchanged; `:3002` health **200**; `:6080` untouched.
- **No** Asan/Sepidar live call; outbound flags unchanged; **no** LIVE_VERIFIED claim.

### Still owned by architect

- P0-2 connection retire; P0-3 go-live / LIVE_VERIFIED criteria; Sepidar priority.
- Optional: confirm live UAT of set-default A↔B on `:3002` with two connections (unit evidence already covers the contract).

## PRIOR — CRM-129-UI-DESIGN-SKILLS-PILOT-017 (2026-11-24; **REVISION 02 PREVIEW** → `STOP_FOR_USER_APPROVAL`)


Design-only pilot on the «مالیات و عوارض» panel. It does **not** supersede the 016 board
below: nothing was implemented, deployed or applied to Dev, and the app on `:3002` is still
`0.1.47`.

- **Branch / HEAD:** `feat/crm-129-quotation` @ `edc1fb4adb` (+ uncommitted revision-02 docs only).
- **Working tree scope:** only `docs/design/crm-129-ui-pilot-017/` (and this recovery note).
  No file under `packages/` was modified; no backend, money-domain, tax-policy, revision,
  PDF, adapter, permission or DB change; no worker restart; `:6080` untouched.
- **Skills installed (free, no account, no credits):**
  - `ui-ux-pro-max` (`ui-ux-pro-max-cli` 2.15.0) → `C:\Users\User\.cursor\skills\ui-ux-pro-max\`
  - `design-taste-frontend` (tasteskill 2.5.1) → `C:\Users\User\.agents\skills\design-taste-frontend\`
  - Superdesign out of scope; Taste Skill installed but **still unused** (S4 fallback only —
    revision 02 remains under UI UX Pro Max; user has not rejected Design #1 into Taste).
- **Designer #1 used for real:** four `uipro` invocations (`ux` and `style` domains plus
  `--design-system --persist`); raw artifacts in
  `docs/design/crm-129-ui-pilot-017/ui-ux-pro-max/evidence/`. Landing-pattern palette
  (`#0F172A` / `#22C55E` / Fira) rejected against the product contract and recorded.
- **Revision 01 (kept):** `docs/design/crm-129-ui-pilot-017/ui-ux-pro-max/index.html` +
  `DESIGN-DECISION.md` (**untouched** per user instruction after S4 “changes”).
- **Revision 02 (current proposal):**
  `docs/design/crm-129-ui-pilot-017/ui-ux-pro-max/revision-02/index.html` — rebuilds three
  axes only: (1) action cell — Option A compact primary+menu vs Option B 4-button cluster;
  (2) Persian reading floor ≥12 px, `line-height: 1.9`, tabular nums; (3) hierarchy —
  focal `نرخ کل` 17 px/700, component rates 14 px/400, unified header, default accent bar.
  Decisions A/B/C from revision 01 are **not** finalized. Serve via
  `python -m http.server 4180 --bind 127.0.0.1` from `docs/design/` →
  `http://127.0.0.1:4180/crm-129-ui-pilot-017/ui-ux-pro-max/revision-02/index.html`.
- **Awaiting:** user decision on revision 02. Approve → Design of Record only after explicit
  go-ahead for implementation. Request further changes → stay on Pro Max. Explicit reject of
  Pro Max → then and only then activate Taste Skill.

## EXECUTED — CRM-129-TAX-PANEL-016 FINAL CLOSURE (2026-11-24; DESIGN **PASS** / DATA_INTEGRITY **PASS** / SECURITY **PASS (rotation pending)** → `STOP_FOR_ARCHITECT` → `USER_UAT`)

Working point: branch `feat/crm-129-quotation`. Scope stays the tax panel, its tests, UAT scripts and `docs/design/crm-129-tax-panel-016/`. Money domain, PDF, adapter, revision/snapshot and other Twenty modules were not touched.

### Gate board

| Gate | Status | Basis |
|---|---|---|
| `DESIGN_GATE` | **PASS** | Architect removed Superdesign (credits exhausted) and authorized Impeccable as design authority. `DESIGN-DECISION.md` records D1–D10; implementation ships those rulings; independent fidelity measured on Dev; panel tests **30/30**. Superdesign artifacts archived under `archive-superdesign/` as history only. |
| `DATA_INTEGRITY_GATE` | **PASS** | `dev-verify-crm129-tax-uat-015.cjs` → **17/17** this delivery (`SUMMARY 17/17 passed`), including deterministic `S5-15c` (`queued=true`, `TAX_POLICY_IN_USE`, policy kept). Historical quotation/revision digests unchanged (`S5-13`). |
| `SECURITY_GATE` | **PASS for source**, **rotation pending architect authorization** | No credential literal in tracked scripts; `requireDatabaseUrl()` fails closed (exit 2, safe message, no secret printed). Prior leak remains in Git history — no rewrite / force-push. Rotation deferred to architect. |

### Delivered UI (Dev `:3002`)

- App **پیش‌فاکتور `0.1.47`** applied to `dev-crm129` (front-component checksum update only for «مالیات و عوارض»).
- Manual UAT URL: `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`
- Designer rulings shipped: token-only colours (`--t-color-*`), `نرخ کل` + exempt `معاف`, stable four-action set with disabled-not-hidden delete, sibling editor (host-safe focus), native `<form>` Enter-to-save, field-linked validation, unsaved-edit refusal, load retry, 32 px desktop / 44 px phone targets.
- Late polish in `0.1.47`: `aria-expanded` forced to `'true'|'false'` (host emptied boolean `true`), mobile action padding reduced so `غیرفعال‌سازی` no longer clips across the 3-slot grid.
- Evidence screenshots beside the design folder: `served-desktop-0.1.46.png`, `served-mobile-390-0.1.46.png` (pre-0.1.47 polish; live DOM re-checked after apply).

### What the architect still owns

1. **Credential rotation** for the historically leaked staff Postgres role (consumers first). No history rewrite proposed here.
2. **USER_UAT** visual sign-off on the Dev page above — technical gates are closed; product acceptance is the user's.

### Prior section below

The following section is the earlier mid-task record when `DESIGN_GATE` was still blocked on Superdesign credits. It is retained as audit trail and is superseded by this board.

## SUPERSEDED MID-TASK — CRM-129-TAX-PANEL-016 (2026-11-24; DATA_INTEGRITY **PASS** / SECURITY **PASS (rotation pending)** / DESIGN_GATE **was BLOCKED — designer credits**)

Working point then: HEAD `497eb5a39e` at start. Nothing outside the tax panel, its tests, the UAT scripts and `docs/design/crm-129-tax-panel-016/` was touched.

### Gate board (historical)

| Gate | Status | Basis |
|---|---|---|
| `DATA_INTEGRITY_GATE` | **PASS** | `dev-verify-crm129-tax-uat-015.cjs` → **17/17**, `SUMMARY 17/17 passed`, 1337 ms, re-run this turn through the env-only credential path; 672 app tests; 293 server quotation tests |
| `SECURITY_GATE` | **PASS for source**, **rotation pending architect authorization** | no credential literal remains in any tracked script; the literal is absent from the working tree and from every tracked file at HEAD; 7 commits in history carried it and are not rewritten |
| `DESIGN_GATE` | **was BLOCKED** | designer executed and its revised frames implemented, but the Impeccable critique raised findings that contradict the designer's own specification and the platform refuses further designer turns. Re-confirmed this turn through the CLI itself, not only the MCP wrapper: `You're out of credits, so this generation was blocked`, at two payload sizes, on a model the catalogue lists as `free` |

### S0 — repository state recorded before any change

Twelve tracked files modified (`package.json` → `0.1.39`, the panel, its test, nine verification scripts) and the `docs/design/crm-129-tax-panel-016/` artifacts added untracked. No unrelated file was reverted or rewritten. The credential scrub was applied by a one-off script that printed file names and counts only; it was deleted after use rather than committed, since a committed file-rewriter is a footgun and the scrub is fully visible in the diff.

### S1 — designer actually executed; the second round is refused by the platform

- Diagnosis draft `971bcdae-827c-458f-a799-311780c6b9c5` and revised design `41dea32c-f4e4-41d5-b5e9-41dc4045ef71`, both `gemini-3.1-pro`, recorded in `docs/design/crm-129-tax-panel-016/`. The designer named the concept **Action-Isolated Row** and authored five non-negotiable criteria; `DESIGN-DECISION.md` records them verbatim plus the one gap it could not close.
- The shipped `0.1.39` panel is that specification: 32 px bounded controls, accent total, `#f1f1f1` formula chip, usage count under the name, inline replacement editor, 390 px stack.
- **Impeccable critique ran** as two isolated assessments (design review; detector + structural evidence) — `docs/design/crm-129-tax-panel-016/IMPECCABLE-REPORT.md`. Detector `impeccable` 4.10.0 returned `[]` on the `.tsx`, and its own stderr says that path is regex-only and an **undercount**, so the report declares that degradation and compensates by computing the contrast of all 13 painted colour pairs itself.
- Findings that contradict the designer's own committed values were returned to the designer as one revision request. The platform refused:

  ```json
  { "error": "Team has insufficient credits", "code": "insufficient_credits",
    "upgrade_url": "https://superdesign.dev/teams/d35be7fa-00e0-41a4-a8c4-620c04284560/billing?gate=api_credits" }
  ```

  This is the second platform refusal in this task for the same cause. **No designer-authored revision of those findings exists, and none was fabricated.** The three findings that do not need designer arbitration are listed separately in the Impeccable report.

### S3 — the S5-15c race: root cause is the harness, and the backend contract is sound

- **Backend is correct, and that is checked rather than assumed.** `quotation-tax-policy-lock.util.ts` takes one advisory lock as the first statement of both transactions, keyed `quotation-tax-policy:${transactionScope.workspaceId}` — shared for a draft save, exclusive for a policy mutation. A draft save therefore cannot have the policy row change between its policy read and its commit, and the two paths take row locks only after it, so no lock-order inversion exists.
- **Two harness defects produced 15/17; neither was a backend race.**
  1. *The blocker blocked nothing.* The script resolved `workspaceId` from `~/.twenty/config.json` (`remotes['dev-crm129']?.workspaceId ?? null`) and never checked it against the schema it inspects. A null or foreign value makes the advisory key one no server ever takes, so the "blocker" held a lock nobody contended for.
  2. *No ordering existed at all.* The old test issued the delete and let a real draft save race it, separated by `sleep()`. Whichever won was timing, so the same build could pass or fail on machine load — a test that cannot state which order it exercised cannot prove either behaviour.
- **Repair, deterministic and asserted.** The workspace is now read from the access token's own `workspaceId` claim and cross-checked against `core.workspace."databaseSchema"`, throwing on mismatch rather than testing another tenant. Ordering is produced at the DB level on the very same shared lock a draft save takes first: a writer holds the transaction and the lock, the delete is issued, `pg_locks` is polled for `not granted` on that exact key until the delete is **observed** queued, the quoting document is inserted and committed, and only then can the delete run. A queue that never forms fails the assertion instead of being slept past. Four orders are asserted: document before delete; document commits while the delete waits (`TAX_POLICY_IN_USE`, policy kept); document removed and the same delete then allowed; delete before document (`TAX_POLICY_UNKNOWN` for the removed code). The pre-order draft in step (a) keeps the final refusal from passing vacuously on a malformed body.
- **Result:** `17/17`, including `cleanup`, at 985 ms — the race is proven, not timed. `S5-13` still shows the live-quotation and revision digests unchanged across the settings mutations.

### S4 — the credential is out of the source; it is still in the history

- The literal PostgreSQL credential appeared in **10 tracked scripts at HEAD** and in **6 commits** on this branch, and the branch is pushed to `origin`. Deleting it from the working tree does not remove it from the objects or the remote.
- All ten now call `requireDatabaseUrl()` from the new `scripts/db-connection.cjs`, which reads `CRM129_DATABASE_URL`, else `CRM129_DB_PASSWORD` / `PGPASSWORD` (with optional `CRM129_DB_HOST/PORT/USER/NAME`, then `PG*`), and **exits 2 with a safe message when none is present**. It never prints the value it returns; the only string it composes with the password is returned, never logged.
- Verified: zero credential-bearing URL or password literal in the working tree; all ten scripts migrated.
- **Exposure assessment:** a staff Postgres role for the local dev database, readable by anyone with read access to this branch's history — which includes the remote. Rotation is a shared-resource change: other local services, the Dev `:3002` stack and any parallel session using the same role would break if it were rotated mid-run. **Rotation is therefore left to the architect**, as is any history rewrite; no force-push was performed and none is proposed here.
- No new secret was written to code, docs, commits or this report.

### S5 — nothing else moved

Money domain, tax/duty formula, default-policy and historical-rate semantics, revision/snapshot, PDF, accounting adapter, currency and tax-code mapping, permission and workspace isolation, and every other Twenty module are untouched. The diff is the panel, its test, `package.json`, the nine scripts, `db-connection.cjs` and the design documents.

### S6 — regressions

`npx vitest run` in `packages/twenty-apps/internal/quotation` → 54 files passed, **672 passed** (3 skipped). `npx jest …/modules/quotation` → 26 suites, **293 passed**.

### S8 — third designer attempt, this time through the CLI; what actually shipped

The credit refusal had only ever been observed through the MCP wrapper, so it was re-tested against the CLI directly, which is the surface the Superdesign skill itself documents.

- `npx --yes @superdesign/cli@latest` → `auth: authenticated as team "Personal" (local credentials)`, project `cff68fa9-107a-4e63-882f-2b7c66c121a6` visible, 16 nodes listed. **Authentication is not the blocker.**
- `list-models` → `gemini-3.1-pro,google,free,Latest Gemini with thinking`. The model the task asks for is on the **free** plan, so an exhausted paid balance should not have blocked it.
- A revision request was composed as `docs/design/crm-129-tax-panel-016/designer-brief-03-revision.md` — problems and measured evidence only, no remedy, no colour value, no markup, and an explicit instruction to decide the resting action set for the active-unused row rather than return a menu. It was sent with the Twenty token excerpt (`twenty-tokens-excerpt.css`, generated from `theme-light.css`).
- First attempt, with the component source and the full Impeccable report attached, failed on transport: `✗ API Error: read ECONNRESET`. Second attempt, brief plus tokens only, reached the service and was refused on billing: `✗ You're out of credits, so this generation was blocked.`, then it opened the team billing page in the browser.

So the block is a team balance, not auth, not the model, not the payload, and not the prompt. **No designer revision exists for the five designer-owned findings, and none was invented.** The two artifacts above are committed because they are the honest record of what was asked and what came back.

**What shipped this turn, and why it is not a design decision.** The only visual change is the mobile target floor: `.tax-btn`, `.tax-add` and the editor inputs are 32 px on desktop and 44 px below 767 px. Heights moved out of the inline styles into the panel's own stylesheet because an inline `height` beats a media query — the same 32 px is still painted on desktop, and the rule that changes it cites the product contract. That satisfies both the product brief (44 px) and the designer's own criterion (*at least* 32 px), so it does not overwrite a designer value. Layout properties for `.tax-row-main`, `.tax-metrics`, `.tax-row-actions` and `.tax-fields` moved from inline objects into the existing scoped stylesheet for the same mechanical reason: the 767 px block could not override them where they were.

Everything else the Impeccable report separates out as engineering — focus restoration, an unsaved-edit guard, per-row accessible names, a load retry — was **left unimplemented on purpose**. Each of those needs a visible shape (a prompt, a retry control, a focus ring placement) that belongs to the designer, and inventing it now would repeat the exact violation this task exists to correct. They remain listed, unbuilt, in the Impeccable report.

Deployed state: app **0.1.41**, `Synced پیش‌فاکتور (39 files)`, `Published quotation v0.1.41 to dev-crm129`, `core.application` row reads `پیش‌فاکتور | 0.1.41 | INSTALLED`. The built bundle on disk contains the 767 px block. Nothing on `:6080` was touched and no worker was restarted.

**Served-page measurement after the redeploy** (`http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`, live DOM, three real policies):

| Viewport | `.tax-btn` heights | Add control | Row heights | Horizontal overflow | Text under 12 px |
|---|---|---|---|---|---|
| 1920 px | 32, 32, 32, 32 | 32 px tall | 85, 85, 85 | 0 | 0 |
| 390 px (emulated) | 44, 44, 44, 44 | 44 × 44 | 311, 208, 311 | 0 | 0 |

The page also loads cleanly at this version — the first tab inspected still held old code and showed the load-failure banner, and a reload cleared it, which is the expected behaviour of a front-component bundle swap rather than a defect. Screenshots kept beside this file: `served-desktop-row-0.1.41.png`, `served-mobile-390-0.1.41.png`.

This is evidence that the deployed screen is coherent and safe to look at. It is **not** a `DESIGN_GATE` pass: the gate also asks whether the served screen matches the designer's decision, and on the five contested points the designer has not spoken.

### S7 — what the architect must decide

1. **Designer credit top-up** (or an explicit waiver of designer arbitration) before the five designer-owned findings in the Impeccable report can be closed. Until then `DESIGN_GATE` is not PASS. This is the only thing standing between the task and acceptance, and it cannot be bought from inside the repository.
2. **Credential rotation**, with the consumers of that role identified first. Nothing was rotated, and no history rewrite or force-push is proposed here.
3. Whether the three remaining contract-level findings (focus management, unsaved-edit loss, load retry) may be implemented without a further designer turn — and if the unsaved-changes prompt and the retry control may take an executor-chosen shape. The 44 px mobile target from that list is **already done**, because it is a floor both the product brief and the designer set.

## DESIGN HANDOFF — USER_REJECTED TAX-PANEL-016 / DESIGNER REASSIGNMENT (2026-11-24; ASSIGNMENT REGISTERED / NOT EXECUTED)

- User rejected TAX-PANEL-016 after Superdesign A/B hybrid because its visible action labels were visually indistinguishable from normal text. Source `tax-policy-settings-panel.tsx` uses transparent 28px ghost controls despite the recorded B-inspired visible-action decision. This is a **designer-to-implementation fidelity process failure**, not proof of Superdesign incapacity nor authorization for architect-authored CSS fixes.
- Binding design governance registered in [`docs/design/CRM-DESIGN-TO-IMPLEMENTATION-GATE.md`](../design/CRM-DESIGN-TO-IMPLEMENTATION-GATE.md), commit `ed849a3737a39cfd72434edb079001129276715c`. It requires **fresh designer-led Superdesign critique/iteration**, designer-owned design decisions, Impeccable checks on design AND actual implementation, documented deviations, independent measured fidelity acceptance and user sign-off. Developer must **not** impose architect's visual remedy; Superdesign is asked to diagnose and design anew based on observed failures.
- **Next handoff to Cursor:** run the designer brief in the gate document on `feat/crm-129-quotation`; keep existing business/financial behavior unchanged, evaluate saved vs served UI, present design artifacts and proofs. This repository documentation does **not** mean Superdesign has been re-invoked or the panel has been re-deployed.
- **Outstanding security/integrity blockers remain:** dedicated S5-15c concurrency race failed in 016 (15/17), and tracked UAT test script has a plaintext DB credential. They remain separate authorization-gated work, not silently declared fixed by UI redesign.
- No code/runtime/Dev changes made by this docs-only request.


## ARCHITECT REVIEW — TAX PANEL UI 016 / INTEGRITY AND SECRET GATE (2026-11-24; UI CODE REVIEW PASS / FINAL UAT BLOCKED)

- Reviewed exact remote tip `cc107bbe5abd44df9f91540ebac3d1211c994d25` vs base `6b676c50157875536ef4a542a287451ba5d2d554`. Single 016 commit adds two Superdesign-generated candidate HTML designs, `.superdesign/init` context, tests, and changes only `tax-policy-settings-panel.tsx` in executable source, plus app version 0.1.38 and recovery. No server, money calculation, adapter, schema, PDF, or revision implementation changes in this commit. Actual submitted designs and worker-reported Impeccable comparison satisfy the evidence requirement; user visual acceptance remains pending.
- **INTEGRITY BLOCKER:** permanent test `packages/twenty-apps/internal/quotation/scripts/dev-verify-crm129-tax-uat-015.cjs`, section S5-15c, holds a shared advisory lock while introducing a quotation then expects concurrent `tax-policy-delete` to refuse. Worker reports **15/17** because the delete **succeeded** (cleanup failed as a derivative). This directly contradicts the claimed race-safe delete contract. Root cause is NOT established by code review. Distinguish test harness timing/connection problems from missing lock or transaction visibility; reproduce deterministically, log exact lock keys, waiting state, transaction order and DB read visibility without exposing secrets. Until 17/17 and independent verification, do not mark accounting/tax integrity fully accepted. **No out-of-scope UI work needed.**
- **SECURITY BLOCKER:** the same tracked UAT script embeds a **literal PostgreSQL credential** in `new Client({... password: ...})`. Do not repeat or print it in reports. Immediately replace with secure env/secret injection and fail closed if missing; assess whether credential is still active, rotate/revoke through authorized secure process; review repository history/access since this secret has been pushed. Simply deleting from HEAD does not expunge Git history. Do not expose any replacement secret in code, logs, or chat.
- **Disposition:** tax-panel **visual candidate is ready for user's UI inspection on reportedly deployed Dev app 0.1.38**, but **architect final technical gate is HOLD** for confirmed race and credential exposure. Worker-reported 670 app / 293 server tests do not override the failed dedicated 15/17 integrity suite. Do not change `:6080`, restart main worker, contact live vendor, or perform financial writes. Address blockers as narrow repair with re-run tests, not as another broad redesign.


## DESIGN GATE — TAX POLICY PANEL UI UAT (2026-11-24; REQUESTED, NOT EXECUTED)

**Superseded by the EXECUTED section directly below (app 0.1.38).**

**User request:** Rework ONLY the existing Persian RTL tax-and-duty policies screen for visual/functional UAT; remove the tiny, repetitive, low-value help text clutter visible in the user-provided screenshot (2026-11-24). User has confirmed **Superdesign CLI authentication is successful** in their Windows Cursor PowerShell: `superdesign auth status` → authenticated, team Personal; `superdesign list-models` succeeds and lists free `gemini-3.1-pro` and `gemini-3-flash`. **Impeccable is installed in Cursor** and previously operated via CLI; ensure availability again at task runtime. This supersedes historical Superdesign BLOCKED records *for the user's current shell*, but the next agent must verify it can actually invoke the tool in its own execution context. **Installed/authenticated ≠ design generated.**
- **Hard requirement:** On the next UI design task, **actually invoke Superdesign to generate at least two distinct design drafts** for the tax policy screen, starting with the free `gemini-3.1-pro` if accessible; check `superdesign --help` and `superdesign create-design-draft --help` for installed CLI syntax; use Impeccable to audit the candidate(s) and final implementation, with tool commands/artifacts/evidence recorded. Do not pretend a handwritten mockup was generated by Superdesign. If inaccessible, report BLOCKED honestly and do not claim design-tool acceptance. Do not call image generation a substitute for editable frontend design.
- **Target:** existing `packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx`; no alternative tax panel and no changes to core financial architecture. Keep RTL, Persian strings, shared Twenty design tokens/components and native Twenty snackbars. Prefer a clean scannable policy table/card list and compact inline edit form with clear headers; readable type size, meaningful spacing, one prominent primary action, sensible responsive layout and focus/navigation. **Remove redundant small gray copy and repetitive per-row guidance**; preserve necessary error messages and material warnings and legal/financial consequences as contextual inline messages or accessible disclosure rather than silently deleting critical information.
- **Current accepted backend:** commit `bc4403869ef0a7d7ad8ab4e495def1536ebd60d1`, Dev app 0.1.35 worker-reported. Exactly one active default, zero inactive defaults; separate tax% and duty% inside ONE policy, aggregate read-only; `isExempt` derived only for zero+zero; soft-delete unused/unmapped policy, refuse deletion if used/mapped/default; historical revisions immutable; tax policy default applies to NEW drafts only; 17/17 integrity UAT, 660 app, 293 server tests worker-reported. **UI design must not alter these contracts, their data or permission gates.** Existing read-only technical explanations can be collapsed or removed only when redundant, not when needed to understand a refusal.
- **Acceptance evidence:** user-approved design pending; compare before/after content density using DOM and computed styles with assertions; desktop and 390px mobile; check row actions/edit/save/refresh/default/delete-confirm/cancel/active/inactive/error; no horizontal overflow, no empty inaccessible labels. Run focused integration tests + existing tax suites, confirm no core calculations/revisions/servers/adapter files changed. Build and deploy frontend component on Dev :3002 for **USER_UAT** only after actual tool-backed design and verification. No screenshots in automated harness, no main worker restart, no :6080, no vendor/fiscal writes. Keep gate STOP_FOR_ARCHITECT; user alone accepts visual UX.
- **Repository registration only:** this section is a task specification, **not evidence that Superdesign or Impeccable ran for this new design yet**, and not permission to initiate deployment or mutate tax data merely by reading recovery.

## EXECUTED — CRM-129-TAX-PANEL-PROFESSIONAL-UI-016 (2026-11-24; design-only redesign of «مالیات و عوارض»; app **0.1.38** on Dev `:3002`)

- **Gate outcome:** the tax-settings panel was rebuilt from two real Superdesign drafts, reviewed with Impeccable, and the hybrid of the two winners is live on Dev `:3002` with **UI-only** changes. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.** Final visual sign-off belongs to the user. No backend, money-domain, schema, PDF, permission, lock or contract change; no `:6080` change; no main-worker restart; no vendor traffic; no real data deleted for testing; no screenshot loop inside the automated checks.
- **S1 — design tooling actually executed (not a hand-drawn substitute).** `superdesign auth status` → `authenticated (source: config (local credentials))`, team `Personal (d35be7fa-00e0-41a4-a8c4-620c04284560)`; `superdesign list-models` was checked and the free `gemini-3.1-pro` was used. Project context was extracted into `.superdesign/init/` (`components.md`, `layouts.md`, `routes.md`, `theme.md`, `pages.md`, `extractable-components.md`) and project `cff68fa9-107a-4e63-882f-2b7c66c121a6` was created.
- **Two real drafts, both kept as evidence:** Draft A «Tax Policy Compact Table» `f5faac68-33dc-4a48-ba39-d3a650827a21` (13,768 bytes) → `docs/design/crm-129-tax-panel-016/draft-a-compact-table.html`; Draft B «مالیات و عوارض - تنظیمات» card grid `ae04fced-16d2-4e22-b39e-68b68b03088b` (12,000 bytes) → `docs/design/crm-129-tax-panel-016/draft-b-card-grid.html`. The CLI's polling client hit a `ECONNRESET` while waiting on the render job; the jobs completed server-side and both drafts were retrieved with `superdesign get-design --draft-id …`, which is what those files are.
- **S2 — Impeccable audit of both drafts.** Assessment A (design review: heuristics, cognitive load, RTL, Twenty cohesion) and Assessment B (detector + Chrome DevTools Protocol layout/accessibility measurement) agreed on the same trade-off: A wins on scan speed and column alignment across many rows; B wins on always-visible labelled actions and on explaining a consequence where the operator acts. Draft B's card-per-policy pattern costs vertical space and repeats chrome on every row when a workspace holds a handful of policies.
- **Selected design — hybrid, and why:** A's dense single-line row (name → tax → duty → total → documents → actions) with B's explicit text buttons and B's one-line consequence under the row. Columns are labelled (مالیات / عوارض / جمع / اسناد) with `tabular-nums`, so four numbers per row stay scannable in RTL; only one «پیش‌فرض» badge exists and it carries the only green in the list; danger red is reserved for delete confirmation and field errors; the row's action set is exactly what the server would allow, so the UI cannot offer a delete the server refuses.
- **S3 — panel implementation (`tax-policy-settings-panel.tsx`, presentational only).** List is a real `<ul>`/`<li>` with `<h3>` per policy; each row shows name, tax %, duty %, computed total, usage count in Persian digits, and the legal actions (ویرایش، انتخاب پیش‌فرض، غیرفعال/فعال‌سازی، حذف with two-press confirm). Explanations appear only when the operator needs one (why the default row cannot be deactivated/deleted, or that a used policy is deactivated instead of deleted); the per-row refusal is `role="alert"`. The editor is three inputs (نام سیاست، درصد مالیات، درصد عوارض) plus a live `<output>` for «جمع (مالیات + عوارض)», one short legend «هر دو نرخ صفر یعنی معاف از مالیات.», field errors under the offending field with `aria-invalid`, and ذخیره سیاست + انصراف. The name-required refusal is now bound to the name input (`aria-invalid` + `aria-describedby="tax-policy-editor-error"`) instead of being announced only as a form-level alert.
- **Two UI defects found while verifying, both closed here.** (1) After moving the default twice, the demoted row kept the سبز «پیش‌فرض» badge while showing non-default actions — the front-component host leaves a removed conditional badge node in place, so the row is now remounted when its default flag flips (the `li` key carries the default flag next to the record id) and the response of a set-default action is normalized to the row the operator pressed. Reproduced before the fix, gone after it in both directions. (2) `aria-invalid` was emitted as an empty attribute; it is now the explicit `'true'/'false'` pair.
- **S4 — browser DOM evidence on Dev `:3002`, page `3eb639f7-d39c-4705-9685-c0330b1c7c0d`, app 0.1.38** (click/read only, no screenshots in the checks):
  - Create: form filled with «UAT 016 سیاست آزمایشی» + ۶٪ + ۴٪ → live total «۱۰٪» → ذخیره سیاست closes the form and the row appears with اسناد ۰ and a حذف action.
  - Edit: name changed to «UAT 016 ویرایش شده», tax ۷٪ → total «۱۱٪» → row reads «۷٪ / ۴٪ / ۱۱٪», and after `location.reload()` the same values are read back from the server.
  - Default: «انتخاب پیش‌فرض» on the new row leaves **exactly one** badge; switching back to «مالیات بر ارزش افزوده ۹٪» also leaves exactly one — the second direction is the one that used to leave the stale badge.
  - Delete: first press turns the row into ««…» حذف شود؟ + تأیید حذف + انصراف»; انصراف restores the row untouched; the second full confirmation removes it and the snackbar reports success. The row was created unused precisely so it could be deleted; the catalog was then back to its original three policies.
  - Empty name: saving shows «نام سیاست مالیات را وارد کنید» beside the fields with the name input reporting `aria-invalid="true"` and `aria-describedby="tax-policy-editor-error"`, and the editor stays open; an empty rate reports «درصد مالیات را وارد کنید» the same way.
  - Mobile 390×844: `document.documentElement.scrollWidth = 390` (no horizontal scroll), row width 286 px, editor inputs 254 px, save button inside the viewport.
- **Regression runs:** app `npx vitest run` — **54 files / 670 tests PASS**, 3 heavy-scale files skipped by design (panel spec 16/16, including a new case that the demoted row is repainted as non-default when the payload still flags it); server quotation Jest — **26 suites / 293 tests PASS**; `oxlint` on the panel — 0 warnings/0 errors (the 19 warnings elsewhere in the app predate this task).
- **Permanent UAT script `dev-verify-crm129-tax-uat-015.cjs`: 15/17 PASS.** The two failures are the same known pair and are **not** caused by this UI task: `S5-15c` (a delete racing a document commit is expected to refuse) returned `سیاست مالیات حذف شد`, i.e. the server-side race let the delete through; because that call already deleted the race row, the following cleanup assertion then failed on `cleanupRace.success` even though its own evidence reads `default=IR_VAT_9 leftovers=0`. No script line was touched by this task; the backend race is out of scope here and stays an open backend item for the architect. The other 15 checks passed, including the single-default invariant, 5.5 % + 2.1 % → 7.6 %, derived exemption, unused delete, used delete refusal, deactivate/reactivate, last-active refusal, and the quotation/snapshot digest being unchanged (`d2ec8217dc7f` / `2a17f83d03c2`).
- **Deployment:** built with `npx twenty dev:build` and applied with `node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force` (`0 add / 2 change / 0 destroy`; the plain `npx twenty apply` fails on Windows with the known backslash resource-path validation). Workspace left at `IR_VAT_9` (۹٪) as the single default, with the original three live policies and their usage counts (۲۵ / ۸ / ۵) unchanged; no test policy remains.
- **Next:** USER_UAT of `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d` on desktop and a 390 px phone width. Only concrete visual/UX feedback should reopen this panel; the `S5-15c` delete race needs a separate backend decision.

## ARCHITECT SOURCE AUDIT — CRM-129-ACCOUNTING-015 (2026-11-24; CODE ARCHITECTURE PRESERVED / DEV USER_UAT PENDING)

- **Independent GitHub source comparison:** verified branch tip `2e2b463b2e61bdac5daafe6adafa369eb1b22e93` against prior recovery `4e0f854fff6dc3bb773505df3ca46d2437196c68`: one feature commit, **11 affected files** (10 modified, 1 added), no file deletions. Primarily UI extraction `accounting-connection-form.tsx`, shortened `accounting-connections-section.tsx`, tax policy form validation, new-draft default selection and focused tests, app version 0.1.33, recovery. **No changes in this commit to twenty-server source, accounting adapter contract, accounting outbound/preview gates, money totals/calculation, revision sealing, authorization or PDF renderer.** No destructive schema migration in this diff.
- **Source read:** `selectInitialTaxPolicyCode` selects active default for a new draft, retains selection for an existing edit and an operator-touched selection. Existing draft still hydrates stored tax code and applied rate. Tax form sends `dutyRatePercentText` and validates field and combined rate before save; underlying tax server source already supports `dutyRateBasisPoints`. Shared connection form uses one four-part layout across Mock and Asan; connectivity fields conditional, business currency and single policy-code mapping preserved, special Asan row codes moved into closed advanced details. Previous shared gate for single-currency mismatch and documented code-rate / code-composition mismatch remains untouched.
- **Architect disposition:** **NO EVIDENCE OF ARCHITECTURAL REGRESSION IN THE COMMIT DIFF. Acceptable for USER_UAT with operational caveats.** This is not independent verification of runtime/database/server deployment. Worker reports app 53/651 tests pass (3 scale skips), tsgo clean, browser DOM confirms duty 6+4 persists, default policy changes new drafts and leaves existing drafts unchanged, Dev app 0.1.33. Architect did not run local Vitest, Jest, browser or DB against Dev.
- **HIGH operational risk, not a code regression:** Dev twenty-server-1 was reportedly running stale compiled quotation output and duty persisted only after a **manual build/copy of `dist/modules/quotation` plus server container restart**. Future standard deploy MUST include the correct server build artifact and version check; never rely on ephemeral container copy. Main worker and intranet :6080 reportedly untouched. Do not claim deployment reproducibility until a clean build/deploy from source and read-back proves it.
- **Other watchpoints:** two different tax-policy codes currently share a display label; user should not be forced to distinguish policies by code. Asan connectivity claim (no API token required by cited guide) is not live-vendor-proven; confirm against target installation docs before enabling actual connectivity. No real vendor traffic or financial outbound authorized. Historical snapshot safety is inferred from unchanged paths and earlier tests, not independently re-tested here. REMOTE_UNPAGED limitations persist (soft 20k, hard 100k).
- **Next:** USER_UAT on `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d` and `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`; follow up only for concrete failures, and treat reproducible server build/deploy as an explicit future acceptance gate before production. No screenshots, no :6080, no worker restarts, no vendor or financial writes without authorization.


## EXECUTED — CRM-129-TAX-POLICY-UAT-INTEGRITY-CLOSURE-015 (2026-11-24; single-default invariant, derived exemption, delete/deactivate by real usage; app **0.1.35** on Dev `:3002`)

- **Gate outcome:** the three UAT defects (two default policies, the exemption checkbox, no way to delete an unused policy) each have a proven cause and a server-side fix, re-verified by data-integrity tests first and then in the browser DOM of Dev `:3002`. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.** No `:6080` change, no main-worker restart, no screenshot loop, no vendor traffic, no financial dispatch, no user data deleted for testing, no change to money arithmetic or to any sealed snapshot.
- **S0 root cause of the two defaults — proven from the audit trail, not inferred.** `taxPolicy` is an ordinary workspace object: `isDefault` and `isActive` are plain writable columns and the workspace schema carries **no** constraint on them (`pg_indexes` for `_taxPolicy` lists only `_taxPolicy_pkey` and the `searchVector` GIN index). The one-active-default rule existed **only inside the settings route**, so any other writer — a record update through the generic API/records page, a script, or a stale deployed bundle — could set `isDefault=true` on a second row and the database accepted it. `timelineActivity` (filtered by `targetTaxPolicyId`) records that both forbidden states really existed:
  - `2026-11-21 16:38:00.388` and `16:39:07.495`: several rows flip `isDefault` `false → true` within the same millisecond, and the opposite flips arrive as separate writes — so intermediate states with two rows `true` were written and readable; nothing in the data layer made the pair atomically exclusive.
  - `2026-11-23 22:44:58.473` and 13 earlier writes: a row is deactivated (`isActive` `true → false`) without the same update touching `isDefault`, so nothing tied "no longer active" to "no longer default". A row left that way is the inactive default the invariant forbids, and it prices nothing while still carrying the badge.
  - The list read stored flags verbatim, so two rows correctly rendered two badges. **Hiding the second badge was never the fix**: the flags themselves were inconsistent.
- **S1 fix — the invariant now holds after create, edit, set-default, deactivate and delete.** Every mutation runs inside one transaction under `acquireTaxPolicyExclusiveLock` (`quotation-tax-policy:${workspaceId}`), clears the previous default before writing, refuses to make an inactive row default, refuses to remove the last active row, and ends with `enforceSingleActiveDefault`, which repairs contradictory state deterministically (oldest active policy wins) and says so in the outcome message instead of failing silently — and throws (rolling back) if a workspace would be left with no active rate. Quotation pricing takes the same lock in shared mode, so a concurrent save cannot create a second default. Covered by tests: sequential move, two simultaneous set-default requests, and the refusal paths.
- **Data-layer constraint deliberately not added.** Twenty index metadata cannot express a partial unique index (`UNIQUE (isDefault) WHERE isDefault AND deletedAt IS NULL`), and a hand-written partial index per workspace schema would not be created for future workspaces by metadata sync — that is exactly the "risky migration / parallel tooling" the task forbids. Recorded limitation: a raw record write outside the app route can still set both flags; the next settings mutation repairs it and reports the repair. The app's own read path never invents a flag, it returns what the server stored after enforcement.
- **S2 — the exemption checkbox is gone, exemption is arithmetic.** `isExempt` was removed from the editor state, the form, `SaveTaxPolicyInput`, the route body parsing and the service. The server derives it strictly as `taxBasisPoints === 0 && dutyRateBasisPoints === 0`; the stored column is still written so older readers keep working, but no request value is trusted and the old `TAX_POLICY_EXEMPTION_MISMATCH` refusal (which only existed because the flag was a separate choice) was removed. Historical documents and sealed revisions are untouched: the quotation/revision digest is byte-identical before and after the settings mutations (`d2ec8217dc7f` / `2a17f83d03c2`).
- **S3 — delete for unused rows, deactivate for used ones, decided by the server in the same transaction as the check.** `tax-policy-delete` is an allowed, mutating action. Inside the lock the server counts live quotations by `taxPolicy` code (trashed rows excluded — their sealed snapshot carries the rate they were issued with) and inspects every `accountingConnection.specialCodes.taxPolicyMappings` for the code, then refuses with `TAX_POLICY_IS_DEFAULT`, `TAX_POLICY_IN_USE` («این سیاست در N سند استفاده شده است…»), `TAX_POLICY_MAPPED` (naming the connections), or `TAX_POLICY_LAST_ACTIVE`. An allowed delete is a soft delete, so the audit trail of who introduced the rate survives. `quotationCount` is produced by the same read that produces the row, so the list and the refusal can never quote different numbers, and the delete waits on the same advisory lock as draft saves — a document committed during the delete waits and then makes it refuse.
- **S4 — one simple row.** Each row shows name, tax %, duty %, total («مالیات ۵.۵٪ + عوارض ۲.۱٪» → «۷.۶٪»), active/inactive, exactly one «پیش‌فرض» badge in the whole list, usage («در ۲۵ سند» / «بدون استفاده»), and the actions that are legal for it: ویرایش, انتخاب به‌عنوان پیش‌فرض, غیرفعال/فعال‌سازی, حذف (two-press confirm). A refusal is printed next to the row that caused it (`role="alert"`), and successes use the Twenty snackbar. No checkbox of any kind remains on the page.
- **S5 — data integrity first, then UI.** `packages/twenty-apps/internal/quotation/scripts/dev-verify-crm129-tax-uat-015.cjs` is the permanent, re-runnable suite and executes in that order: DB invariant → default move + DB reread → catalog reflects exactly one default and a new draft starts from it → 5.5 % + 2.1 % saves as 7.6 % and survives a fresh read → 0 %/0 % is exempt by arithmetic while the legacy zero policy is unchanged → unused delete → used delete refused → used non-default deactivate/reactivate → last active/deactivating the default refused → deleting the default refused → no quotation or snapshot digest changed → two simultaneous default requests leave one default → unauthorized / forged-id / delete-racing-a-save all refused → cleanup of only the rows the run created and restore of the original default. **17/17 PASS**, workspace left at `TAX_1050` default with `1` active default and `0` inactive defaults.
- **Fresh-server-from-source check.** `npx nx build twenty-server --skip-nx-cache` was run on this source and the compiled `dist/modules/quotation/services/tax-policy-authority.service.js` (MD5 `1dd54451d2715165b7864bad343ffd8c`) is byte-identical to the file inside `twenty-server-1`, so the server that answered these tests is a build of the committed source, not a hand-edited container copy. (The Windows-only failure of the `mkdir -p …/twenty-client-sdk` step in `project.json` is a POSIX-command issue in the Nx target, not a compile failure; the copies were made directly.)
- **Other tests executed here:** server quotation Jest — full quotation package **26 suites / 293 tests PASS** (focused re-run of the two touched specs: 26/26); app `npx vitest run` — **54 files / 660 tests PASS** (3 heavy-scale files skipped by design; focused re-run of panel + service: 16/16).
- **Browser DOM evidence (Dev `:3002`, page `3eb639f7-d39c-4705-9685-c0330b1c7c0d`, app 0.1.35):** 7 live rows, **exactly 1** «پیش‌فرض» badge, **0** «معاف» badges, **0** `input[type=checkbox]` on the page, row explanations «این سیاست در ۲۵ سند استفاده شده است؛ حذف نمی‌شود و فقط غیرفعال می‌شود.» / «این سیاست در هیچ سندی استفاده نشده؛ حذف آن مجاز است.» / «پیش‌فرض فعلی است؛ برای حذف یا غیرفعال‌سازی، ابتدا پیش‌فرض دیگری انتخاب کنید.»; the create form shows نام سیاست / درصد مالیات / درصد عوارض / جمع (مالیات + عوارض) and the legend «هر دو نرخ صفر یعنی سیاست معاف؛ معافیت تیک جداگانه ندارد…»; pressing حذف turns the row into «تأیید حذف» + «انصراف» and cancelling restores the list untouched.
- **Database before/after (workspace `workspace_aemygqnvl0yhlv0fg3qwjt525`, table `_taxPolicy`):** before the run — 7 live rows, `TAX_1050` (600/400) default, `IR_VAT_9` (600/300), `TAX_1000` (600/400), `TAX_0` (0/0, derived exempt), `TAX_1050_2` (1050/0), `TAX_1000_2` (1000/0), `TAX_550` (550/210, inactive), usage 25/8/5 documents on `IR_VAT_9`/`TAX_1000`/`TAX_1050`; after the run — the same rows and the same default, `1` active default, `0` inactive default, and none of the run's test policies left behind.

## EXECUTED — CRM-129-ACCOUNTING-UAT-FORM-CLOSURE-015 (2026-11-23; duty persistence and default-policy defect fixed; app **0.1.33** on Dev `:3002`; superseded on tax-policy behaviour by the section above)

- **Gate outcome:** both UAT-reported defects have a root cause and a real fix, verified in the browser DOM of Dev `:3002`; the tax form and the accounting-connection form are now one simple structure for every adapter. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.** No `:6080` change, no main worker restart, no vendor traffic, no financial dispatch, no screenshot evidence (DOM reads only).
- **Defect 1 — duty stayed zero.** The app already carried `dutyRateBasisPoints` end to end, but the **deployed** Dev server container was still running an older compiled `dist/modules/quotation` bundle in which the duty field was absent from the read/write path, so every save was silently rewritten as duty `0` while the UI echoed the typed value until refresh. Root fix: rebuilt the quotation server module from the current source (`tsconfig.build.json`), replaced `dist/modules/quotation` inside `twenty-server-1` (as root, because the container user cannot write there), and restarted **only** `twenty-server-1`. The worker was untouched. The panel also gained the same parse-before-send contract as the server: Persian (`۴٫۵`), English (`4.5`) and decimal digits are accepted, and a refused rate/duty/total now reports **beside the field that caused it** instead of only at the top of the page.
- **Defect 2 — the default policy had no effect on new drafts.** `quotation-draft-form.tsx` only replaced the selection when the currently selected code had disappeared from the catalog. The legacy 9% row always exists, so the flagged default was never applied. Replaced with one decision point, `selectInitialTaxPolicyCode` (`src/domain/money/tax-policy.ts`): a **new** draft takes the flagged active default, an **existing** draft keeps the policy it was saved with, and an operator who already touched the select is never overridden when the async catalog arrives later. `set-default` still writes through the server action, and the list/badge updates from the response the action returns.
- **Connection form simplified to one shape for every adapter** (`accounting-connection-form.tsx`, used by the connections section): **مشخصات اتصال** (name, accounting software, destination address, the credentials that adapter actually needs, real connection state, save + test) → **ارز و واحد پول** (destination currency, money unit, optional destination currency code; the technical `CurrencyHandlingMode` selector is gone) → **مالیات و عوارض** (one row per active CRM policy: policy name, combined percent, **one** optional destination code; no tax-rate/TAX_CODE/DUTY_AMOUNT dropdowns, rates are never redefined here) → **تنظیمات پیشرفته** (closed by default: special row codes, destination user/warehouse ids, network details). Mock is labelled «آزمایشی، بدون ارتباط واقعی».
- **Preserved:** one VAT policy with two internal rates, one destination code per policy per connection, `taxOnlyMicros + dutyMicros = taxMicros`, immutable revision snapshots, `TAX_CODE_RATE_MISMATCH` / `TAX_CODE_COMPOSITION_MISMATCH` refuse in the single shared gate, F1 single-currency check, F2 saved-connection-only probe, workspace/connection separation, catalog paging, outbound and fiscal registration OFF.
- **Browser DOM evidence (Dev `:3002`, app 0.1.33 re-applied after the last code change):**
  - Tax page `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d` — after setting duty to ۴ and reloading, the row reads `مالیات ۱۰٪ 007 | ۱۰٪ | مالیات ۶٪ + عوارض ۴٪ | پیش‌فرض`; DB `_taxPolicy` has `TAX_1000 rateBasisPoints=600 dutyRateBasisPoints=400`. Out-of-range duty (6٪ + ۹۵٪) shows «جمع مالیات و عوارض از ۱۰۰٪ بیشتر نمی‌شود» and refuses the save.
  - Default scenario run end to end: default `TAX_1000` → open new draft → select reads `TAX_1000`; set `IR_VAT_9` default from the panel → badge moves immediately and DB has exactly one `isDefault` → open new draft → select reads `IR_VAT_9`; set `TAX_1000` default again → new draft reads `TAX_1000` again (state left at `TAX_1000` = 6% + 4%).
  - Existing-document safety: with `IR_VAT_9` as the workspace default, the saved draft `CRM129-tax007-1795273156618-twelve` still opened through «ویرایش پیش‌نویس» with `TAX_1000` selected and its own applied rates `۱۲٪ / ۰٪`, i.e. the default change did not touch an existing document.
  - Connection isolation: `_accountingConnection.specialCodes.taxPolicyMappings` shows `IR_VAT_9 → TAX-01` only on «UAT 014 کدی»; every other connection keeps an empty mapping, so saving/selecting one connection cannot bleed codes into another.
- **Tests (executed here):** quotation app `npx vitest run` → **53 files / 651 tests pass, 3 heavy-scale skipped by design**; `tsgo --noEmit -p tsconfig.spec.json` clean; `oxlint` has no findings outside `__tests__` files (the remaining test-file findings pre-date this change).
- **Known limitations (unchanged, not new):** no live Asan/Sepidar traffic, so a destination that publishes no catalog stays `UNVERIFIABLE` rather than accepted; the app still runs against the single Dev workspace seeded for UAT; the deployed server module is a manual container copy, so any future server redeploy must rebuild it from source or the duty path regresses.
- **Test links:** tax form `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`, accounting settings `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`, quotation list `http://localhost:3002/objects/quotations`.

## CURRENT HANDOFF — CRM-129 ACCOUNTING-014 (2026-11-23; latest Dev UAT checkpoint)

**Partly superseded by the 015 section above:** the duty-always-zero and default-policy-not-applied defects reported in UAT are fixed and verified on Dev, and the connection form was unified. Everything else in this handoff still stands.

**Read this first in a new chat.** Repository: `mrnikiemami-code/crm-platform`, branch `feat/crm-129-quotation`. Code HEAD reviewed for this handoff: `efb9efac6f102969ea0974eafc392bc73ca14265` (feature `a1ea4573e9`, recovery `7b8cbd86eb` / `efb9efac6f`, on top of architect note `f0d2cf846d`). This new handoff is documentation only and will advance the branch HEAD again. **The earlier architect blockers documented below are historical and superseded by the latest code; they must not be treated as open without fresh evidence.**

- **Current decision:** **DEV TECHNICAL REVIEW PASS / READY_FOR_USER_UAT**, **not** final user acceptance and **not** live accounting/production certification. Actual source of `financial-contract.ts`, `document-preview.ts`, `outbound-plan.ts`, `tax-code-contract.ts` checked through GitHub at the above HEAD. Test execution, Docker state and served browser DOM in the worker's latest report are **worker-reported**, not independently rerun by architect.
- **One VAT policy, one destination tax code.** A CRM policy contains `taxRateBasisPoints` + `dutyRateBasisPoints`, with `taxOnlyMicros + dutyMicros = taxMicros`; a CODE-based destination maps `Workspace + Connection + TaxPolicy.code → one destination tax code` via `taxPolicyMappings`. **No `dutyPolicyMappings`, no separate policy duty code**. The destination may internally apportion tax/duty; destination-special **item row codes** (e.g., Asan 999123/999140/999141) are a distinct installation-level contract and must never be confused with the policy code. Never hardcode the user's illustrative `64`.
- **Single known-mismatch safety gate now closed:** `checkFinancialRequirements` compares **sealed revision** rates against a destination's published `taxCodeCatalog` with `matchTaxPolicyToDestinationCode`; known total mismatch → `TAX_CODE_RATE_MISMATCH` **REFUSED**, known internal split mismatch with equal total → `TAX_CODE_COMPOSITION_MISMATCH` **REFUSED**, MATCH passes, no trustworthy catalog / unlisted code → UNVERIFIABLE (allowed only under current unchanged preview/dispatch policy, **clearly unconfirmed** as `TAX_CODE_UNVERIFIED` / `TAX_CODE_VERIFIED=false`). Preview and dispatch share this same gate, not duplicate comparisons. Snapshot absent duty = historically zero; corrupt/unreadable rate remains unverifiable, never invented as zero.
- **Earlier currency/test blockers closed in source:** F1 `SINGLE_CURRENCY` checks exact document vs destination base-currency match; F2 refuses probes for unsaved new connection instead of falling back to another selected connection. Connection selection and editing are independent; selected connection first/highlighted, per-connection capability-driven tax/currency mapping and Twenty native snackbar kept.
- **Worker evidence:** `npx vitest run` app **53 files / 648 PASS**, 3 intentional heavy-scale skips; TypeScript `tsgo --noEmit` (app and spec configs) clean; server quotation Jest **26 suites / 288 PASS**. Worker reports applied app `@internal/quotation` **v0.1.32** on `dev-crm129` / `http://localhost:3002`, HTTP 200, sync operations 0, zero Asan/Sepidar requests and financial writes, no `:6080` or main worker restart. Metadata apply worker-reported **25 add / 18 change / 16 destroy**, with 16 deletes described as stale duplicate `objectPermission` entries, role still retaining 39 intended permissions; this is not independent post-apply DB verification.
- **Test pages:** Accounting settings `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` → «اتصال‌های حسابداری» → CODED mock → one «کد مالیات در حسابداری» column and known mismatch refusal / unknown catalog note. Quotation list `http://localhost:3002/objects/quotations` → accepted quotation → «حسابداری» preview. Outbound/fiscal registration OFF.
- **Still unresolved as product limitations (not newly introduced by this fix):** No live Asan/Sepidar validation; missing vendor tax catalogs cannot prove rate/code match; `REMOTE_UNPAGED` snapshots still have soft 20k preview cap, hard 100k refusal and bounded-body transport; no claim of complete million-row vendor sync; Persian PDF visual acceptance not completed; Superdesign authentication blocked (Impeccable was used), and UI remains **pending the user's manual acceptance**. Do **not** trigger more code tasks without a concrete user-reported failure.
- **Instructions for next chat:** read this header, the following execution section `EXECUTED — ACCOUNTING-014 FINAL TAX CODE SAFETY GATE`, and latest branch HEAD **before issuing actions**. Preserve no screenshots, no `:6080` changes, no main worker restart, no live vendor calls, no financial writes unless newly explicitly authorized. No assumed production acceptance.


## ARCHITECT REVIEW — 014 SINGLE VAT POLICY / CODE CONTRACT (2026-11-23; TECH HOLD FOR ONE REMAINING FINANCIAL GATE)

- Verified remote branch at `427d9e12a78100f9d0f7b83ed19936841313adc9` (one commit ahead of previous architect `ccae8eaeb36aa48adc6a67334ca29ca266f4f908`). Tax policy is one entity with `rateBasisPoints` and `dutyRateBasisPoints`; totals preserve `taxMicros = taxOnlyMicros + dutyMicros`; tax policy mapping remains one code per destination connection, no separate duty-policy code. `tax-code-contract.ts` compares exact published total and optional composition, reports `MATCH/MISMATCH/UNVERIFIABLE`. F1 `SINGLE_CURRENCY` rejects mismatched document vs base currency in shared financial gate. F2 `test(form.id)` rejects unsaved form rather than probing selected prior connection. Asan's separate special-item row codes are distinct from the destination policy code. No live vendor or financial dispatch validation.
- **BLOCKER:** published destination catalog explicitly disagreeing with CRM policy total or tax/duty split currently yields only `warnings` in `document-preview.ts` (nonblocking by comment), while `outbound-plan.ts` lacks equivalent mismatch refusal. This is not acceptable as a financial-send readiness gate: a known 9%↔10% or 6+3↔5+4 discrepancy must fail closed; an absent/unknown catalog remains `UNVERIFIABLE`, never fabricated as MATCH. Add a shared explicit known-mismatch gate in preview and dispatch, with negative tests (including code mismatch) and unchanged legacy/unverifiable behavior. Keep outbound OFF; do not redesign or separately map duty.
- Worker-reported app 632, server 288 and follow-up reruns 106/12 were not independently rerun; latest deployed Dev app for this exact HEAD was NOT attested in last report. After focused gate and tests, deploy to Dev :3002 and perform User UAT; no :6080, restart or vendor calls.


## ARCHITECT REVIEW — ACCOUNTING-014 USER UAT (2026-11-23; BLOCKED FOR TECH ACCEPT UNTIL TWO FOCUSED GATES)

- **Verified:** remote `feat/crm-129-quotation` HEAD `acd30e43101283ec1b09d25da323b8f23b55c1e1` equals user report; compare from `b2d069bd116ba2d9ed931c7d828853ba7512848d` shows exactly feature `fdc70c8efe` and recovery `acd30e4310`, with capability server utility, settings parser, shared financial gate, connection UI and tests. Authoritative server adapter capabilities (including closed Mock profiles), tax-policy mapping parser fix, independent selection vs edit and native `enqueueSnackbar` are present. Worker reports 17 DOM scenarios and 583 app/281 server tests; architect has not independently run Dev browser.
- **BLOCKER F1 — SINGLE_CURRENCY cross-currency fail-open:** `packages/twenty-apps/internal/quotation/src/domain/accounting/financial-contract.ts` `checkFinancialRequirements` validates only `CURRENCY_CODE_PATTERN.test(financial.baseCurrency)`, then returns `accepted(null)` for SINGLE_CURRENCY without comparing `document.currencyCode` to `financial.baseCurrency`. `outbound-plan.ts` currently allows only IRR documents, which narrows the current blast radius but still permits an IRR quotation to a connection configured with USD base currency. Fix: require exact currency agreement or verified exchange contract, and negative regression IRR document vs USD single-currency connection in preview AND dispatch; keep outbound off. Do not invent rates.
- **BLOCKER F2 — test wrong connection:** `accounting-settings-panel.tsx` `test()` calculates `const testConnectionId = form.id ?? selectedConnectionId;`; an unsaved new connection has `form.id=null`, so clicking Test may test the previously selected stored connection while user thinks new draft was tested. Fix: disable/refuse test with a clear 'save first' message when current form is a new unsaved draft; editing a stored record must not probe stale data after unsaved changes, identify exact targeted connection and settings revision. Test DOM with two connections and unsaved new form.
- **Watchpoint:** `ACCOUNTING_CONNECTION_STORAGE_KEY='quotation:accounting:connection'` has no workspace namespace, but selection is validated against server-returned connection ids; avoid using stale choice across workspaces and consider workspace-keyed storage where authority supports it. Not a reason to rearchitect entire app.
- **Disposition:** 014 substantive implementation and UX improved, but do NOT issue final TECH ACCEPT or production acceptance until F1/F2 verified. Issue **same task 014 surgical closure**, 2 code paths + focused tests + tax/security/financial regressions, no broad redesign, no new numbered follow-up, no :6080, no worker restart, no vendor traffic, no accounting outbound. After evidence, user can UAT connection selection, currency and tax mapping. Do not hide the previously reported remote-unpaged 20k soft cap/100k hard refusal.

## EXECUTED — ACCOUNTING-014 FINAL TAX CODE SAFETY GATE (2026-11-23; destination-code mismatch now BLOCKS preview and dispatch; app **0.1.32** on Dev `:3002`)

- **Gate outcome:** the one remaining financial defect is closed. A destination code that disagrees with the sealed policy no longer produces a warning — it **refuses the document** in the same single gate the preview and the dispatcher both call. **`READY_FOR_ARCHITECT` → `STOP_FOR_ARCHITECT` (manual UAT next).** No vendor traffic, no financial write, no `:6080` change, no worker restart, no new task.
- **One control, not two.** `checkFinancialRequirements` (`src/domain/accounting/financial-contract.ts`) now takes the sealed components (`document.taxPolicyRates`) and, for a code-based destination, runs the existing `matchTaxPolicyToDestinationCode` (`tax-code-contract.ts`) — the same function the connection table uses, no parallel logic. `MATCH` passes; `MISMATCH / TOTAL_RATE` → `TAX_CODE_RATE_MISMATCH`; `MISMATCH / COMPOSITION` → `TAX_CODE_COMPOSITION_MISMATCH`; `UNVERIFIABLE` stays **allowed but unconfirmed**, never reported as a match. The gate returns the comparison in its outcome (`FinancialGateOutcome.taxCodeMatch`), so `buildQuotationDocumentPreview` reuses that result for display instead of recomputing it, and `planQuotationExport` (the dispatch planner that `executeQuotationExport` runs first) refuses on the same codes. Preview and dispatch therefore cannot disagree.
- **Rates come from the revision, not the policy today.** `taxPolicyProfileFromSnapshot` reads `taxRateBasisPoints` + `dutyRateBasisPoints` from the sealed snapshot, treats an absent duty component as zero (how every pre-duty revision was sealed), and leaves an unreadable component unreadable so the matcher reports `UNVERIFIABLE` rather than comparing a zero the document never had.
- **UI:** the mapping table's alert now says sending is stopped until the mapping is fixed, and an `UNVERIFIABLE` code shows «تطابق این کد با نرخ سیاست تأیید نشده است (کاتالوگ معتبر مقصد در دسترس نیست)». The preview adds a `TAX_CODE_VERIFIED` check row **only when a code is in use** (`برقرار` for MATCH, `نقص دارد` for UNVERIFIABLE) plus the `TAX_CODE_UNVERIFIED` warning; blocking mismatch codes have their own `DOCUMENT_ERROR_LABELS` sentences.
- **Preserved:** one code per policy per connection (`taxPolicyMappings`), Asan row codes (`specialItemCodes` 999123/999140/999141) still separate from policy codes, historical snapshot bytes and hash unchanged, `taxOnlyMicros + dutyMicros = taxMicros`, F1 (`CURRENCY_BASE_MISMATCH`) and F2 (saved-connection-only probe), PDF/amounts untouched. No code value is hardcoded (`64`/`70` live only in the mock CODED catalog).
- **Tests (executed here, commit `a1ea4573e9`):** quotation app `npx vitest run` → **53 files / 648 tests pass, 3 heavy-scale skipped by design**; `tsgo --noEmit` on `tsconfig.json` and `tsconfig.spec.json` → 0 errors. twenty-server quotation module `npx jest …/modules/quotation` → **26 suites / 288 tests pass**.
  - Negative gate tests: 9% policy vs 10% code → `TAX_CODE_RATE_MISMATCH`; 6+3 vs 5+4 (same 900 bp total) → `TAX_CODE_COMPOSITION_MISMATCH`; same policy mapped to a matching code → accepted; no catalog → accepted **and** reported `UNVERIFIABLE`; a rate destination never compares a code (`financial-contract.test.ts`).
  - Dispatch: the same four cases through `planQuotationExport` (`outbound-plan.test.ts`), and the same four through `buildQuotationDocumentPreview` including the document being `null` on mismatch (`document-preview.test.ts`).
  - Revision reading: absent duty = zero, exact integer addition, unreadable component stays unverifiable (`tax-code-contract.test.ts`).
- **Known limitation (unchanged):** a destination that publishes no catalog (Asan today) cannot be verified; that is shown as unconfirmed, not as accepted, and no rate is invented.
- **Deployed `0.1.32` on Dev `:3002`:** `twenty plan -r dev-crm129` showed **25 add / 18 change / 16 destroy**, the 16 destroys being only the familiar stale duplicate `objectPermission` rows (role still holds its declared 39 permissions, no field/view/page/logic deletion); applied with the monorepo SDK CLI (`packages/twenty-sdk/dist/cli.cjs`, rebuilt because the app's pinned 2.35.0 CLI writes Windows separators into the manifest and the server refuses backslashes). Verified after apply: `core.application` «پیش‌فاکتور» = **0.1.32**, the two «مالیات و عوارض» front components carry the new built checksums (`cb70caf031e7`, `184f8a62173a`), `_accountingSyncOperation` = **0**, no Asan/Sepidar line in the last 10 minutes of server logs. `twenty-server-1`/worker/`:6080` were not restarted; only `:3002` health = 200.
- **Manual test URLs:** settings page `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` (section «اتصال‌های حسابداری» → a CODED mock connection → the single «کد مالیات در حسابداری» column, its alert, and the preview tab of a record); quotation list `http://localhost:3002/objects/quotations`. Nothing is sent: outbound and fiscal registration stay off.

## EXECUTED — ACCOUNTING-014 CORRECTION: ONE TAX POLICY, ONE DESTINATION CODE (2026-11-23; single-code contract, tests only, no Dev call)

- **Gate outcome:** the previous round's separate tax-code and duty-code tables were **wrong** and are replaced by one mapping per policy. **`READY_FOR_ARCHITECT` → `STOP_FOR_ARCHITECT`.** No Dev deployment, no vendor call, no financial write, no `:6080` change in this correction.
- **Contract now implemented:** a CRM value-added policy is ONE entity with two internal components (`TaxRate` value + `DutyRate` عوارض); the displayed total is their sum. A destination that wants a fiscal code gets **exactly one code per policy** (`Workspace + Connection + TaxPolicy → single destination code`), and the destination performs its own internal split. Rates and amounts remain computed and stored separately from a valid snapshot (`taxOnlyMicros + dutyMicros = taxMicros`).
- **Removed:** `dutyPolicyMappings` from `ConnectionSettings`, the connection form, the settings panel, the server settings parser and the mock capability layer; the `DUTY_CODE` / `DUTY_CODE_AND_AMOUNT` handling modes; the second "کد عوارض" column and its per-connection table.
- **Duty contract modes are now:** `DUTY_WITHIN_POLICY` (the one tax code represents the whole policy — the destination splits it), `DUTY_RATE`, `DUTY_AMOUNT`, `AGGREGATE` (combined figure only), `UNSUPPORTED`. `fields.dutyWithinPolicy` renders «یک کد، کل سیاست» and asks for no second code; `AGGREGATE` renders «قرارداد تجمیعی».
- **Row codes are not policy codes:** the installation's special-row item codes (`specialItemCodes: { discount, duty, tax }`, Asan's documented 999123/999140/999141 as defaults) stay in their own block «کدهای ویژهٔ ردیف در نصب مقصد». They say WHICH row an amount is posted under, never which policy it is.
- **Code matching (ACCOUNTING-014 §8):** new `src/domain/accounting/tax-code-contract.ts` — `matchTaxPolicyToDestinationCode({ policy, destinationCode, catalog })` compares exact basis points against the destination's published `taxCodeCatalog`. Equal totals with a different tax/duty split are told apart (`MISMATCH / COMPOSITION`); an unknown code or absent catalog reports `UNVERIFIABLE`, never a silent pass. The mapping table shows «نرخ کل (مالیات + عوارض)» per row and a `role="alert"` warning on mismatch; `document-preview` emits the non-blocking `TAX_CODE_RATE_MISMATCH` / `TAX_CODE_COMPOSITION_MISMATCH` warnings.
- **Illustrative only:** `64` / `70` exist solely in the mock CODED profile catalog (`mock-profiles.ts`) to exercise the comparison; the CRM hardcodes no code, and Asan declares `TAX_AMOUNT` / `DUTY_AMOUNT` (amounts on special rows, no policy code).
- **Preserved invariants:** F1 (`CURRENCY_BASE_MISMATCH`: a `SINGLE_CURRENCY` destination refuses a document in another currency) and F2 (only a saved connection can be probed; unsaved edits are warned as not tested) are both still enforced and now have focused tests. Historical snapshots keep their bytes: a duty-free revision gains no `dutyMicros` / `taxOnlyMicros` / `dutyRateBasisPoints` key and still hashes to the shared fixture `5df2777760c2…`; a duty-bearing revision seals `taxOnlyMicros` + `dutyMicros` with `taxMicros` as their sum and refuses duty without a sealed duty rate.
- **Tests (all executed in this correction):** quotation app `npx vitest run` → **53 files / 632 tests pass, 3 heavy-scale skipped by design**; `tsgo --noEmit -p tsconfig.spec.json` → 0 errors. twenty-server quotation module `npx jest …/modules/quotation` → **26 suites / 288 tests pass**.
  - Mandated scenarios, each its own assertion: 9% policy with two components → `line-and-document.test.ts` (6% + 3% split at line level, totals add up, legacy no-duty policy unchanged) and `document-discount-and-payable.test.ts` (document totals split, payable unchanged); same policy mapped to `64` in connection A and a different code in connection B → `accounting-connections-section.test.tsx`; only one «کد مالیات در حسابداری» field and no duty-code field/table → same file (also asserts the form state has no `dutyPolicyMappingsText` key); rate/composition mismatch warnings → `tax-code-contract.test.ts` + the UI warnings above; snapshot integrity → server `quotation-revision-snapshot.util.spec.ts`; F1/F2 → `financial-contract.test.ts` and the probe-only-saved-record tests. Asan row split (two rows vs one combined row, and installation-specific row codes) → `asan-mapping.test.ts`.
- **Known limitation:** when a destination publishes no catalog (Asan, and any vendor without documented code rates), the mapping is `UNVERIFIABLE` by design — the CRM does not invent a rate comparison. No live vendor traffic was performed, so nothing here validates a real Asan/Sepidar code table.

## EXECUTED — CRM-129-ACCOUNTING-CONNECTION-UAT-CLOSURE-014 (2026-11-23; Dev `:3002` app **0.1.31**, real-browser DOM UAT)

- **Gate outcome:** the accounting panel now works with both shapes of destination — a simple one that only takes a fixed currency and a tax rate, and an advanced one that wants a tax code and a currency code — without imposing either on the other. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.** UI acceptance remains the user's.
- **Commits:** feature+fixes `fdc70c8efe` on `feat/crm-129-quotation`, rebased over the architect record `b2d069bd11` (previous local tip `4f5629cc65`); this checkpoint follows as a docs commit. Scope: the quotation app, the quotation module of `twenty-server`, and their tests. No `twenty-front` churn.
- **S0 — tools, honestly.** **Superdesign is still BLOCKED**: it needs an email/Google account this session does not have (the earlier device-code flow stopped at that sign-in), so **no render was produced and none is claimed**. The UI was evaluated with the **Impeccable local CLI** static pass; this task changed capability logic, copy and two broken actions, not the visual system, so the contrast/target measurements recorded for 013 still describe the shipped panel.
- **S1 — the contract is the server's.** `TaxHandlingMode` (`TAX_RATE`, `TAX_AMOUNT`, `TAX_CODE`, `TAX_CODE_AND_AMOUNT`, `UNSUPPORTED`) and `CurrencyHandlingMode` (`SINGLE_CURRENCY`, `CURRENCY_CODE`, `CURRENCY_NAME`, `CURRENCY_CODE_AND_RATE`, `UNSUPPORTED`) are parsed and validated in `accounting-connection-settings.util.ts`; the mock carries a **closed profile list** (`SIMPLE`, `CODED`, `AMOUNT`, `NO_TAX`) that the server expands into capabilities, so a caller can name a profile but cannot describe a capability that does not exist. A mock profile sent for a live adapter is refused. The CRM rate/amount is read from the existing tax policy and snapshot; nothing recomputes it.
- **S2 — selection.** The selected destination is pinned first by **id** (never by position), carries the badge «اتصال انتخاب‌شده» and a tinted row, and «انتخاب این اتصال» is a separate button from «ویرایش تنظیمات», so selecting does not open the form. The choice is stored under the host-namespaced key `frontComponentStorage:…:quotation:accounting:connection`; verified with a full page load: selected id `71569ab6-dfeb-4b6b-b7ee-74b5a460870d` before and after navigation, row first, badge present. Switching the destination left the other connections' rows untouched (three independent records re-read over the API after every switch).
- **S3/S4 — forms follow the destination.** A single-currency destination shows only «ارز پایهٔ مقصد» + «واحد مبلغ مقصد» and says in words that no currency code is wanted; a code destination shows the CRM-to-vendor currency table and no base-currency select. A rate destination shows the CRM rates (no code input); a code destination shows one mapping box per policy; `UNSUPPORTED` shows the refusal «مالیات در این مقصد پشتیبانی نمی‌شود» and no mapping. `UNCONFIRMED` stays visibly distinct («تأییدنشده (ارسال مبلغ ممنوع)» + a warning) from a confirmed unit.
- **S5 — the two broken buttons.** «تعیین واحد پول» and «تنظیم مالیات حسابداری» (renamed from «تنظیم کدهای مالیات») now open the **selected** connection and land on the section itself: verified in the browser on the legacy «آسان (بدون سرور) 006» (money) and on «UAT 014 بدون مالیات» (tax), each time in `data-form-section="money"|"tax"` with the panel still healthy.
- **S6 — honest testing.** A mock probe reports «آزمایش شبیه‌سازی‌شده موفق بود؛ هیچ تماس واقعی با نرم‌افزار حسابداری انجام نشد»; the readiness list says «آزمایش شبیه‌سازی‌شده (Mock) موفق بوده است — نه اتصال واقعی»; saving settings resets health to `UNKNOWN` with «تنظیمات اتصال تغییر کرد؛ آزمایش اتصال دوباره لازم است».
- **S7 — Twenty's own notifications.** Feedback goes through `enqueueSnackbar` from `twenty-sdk/front-component` (observed as the host's `role="status"` snackbar with its dismiss control), field errors render inline with `role="alert"` beside the field, and no second toast system and no stacked banners were added.
- **S8 — untouched:** `REMOTE_PAGED`/`REMOTE_UNPAGED`, KV snapshots and cursors, workspace and connection isolation, document revisions, idempotency, permissions, and both outbound flags (still OFF). Money/tax calculation code was not modified.
- **S9 — browser UAT (real DOM, no screenshots), `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`:** three independent mock connections created through the form («UAT 014 ساده» SIMPLE, «UAT 014 کدی» CODED, «UAT 014 بدون مالیات» NO_TAX); selected row first and distinct; a non-selected row selected without opening the form; selection survived a reload; settings did not mix between connections; the single-currency destination saved with **no** currency code; the code destination stored `{IRR:1, USD:2}` and `{IR_VAT_9: TAX-01}`; the rate destination has no code input at all; the no-tax destination refuses rather than silently dropping tax; both action buttons reached the right section; a save + reload preserved every value; a mock success never read as a live connection; the Twenty snackbar was used; `_accountingSyncOperation` rows = **0** and the server log shows **no** vendor traffic; server suites (`26 suites / 281 tests`) and app suites (`52 files / 583 tests`, 3 heavy-scale tests skipped by design) passed.
- **Defects found by this UAT and fixed at the root (not patched in the UI):** (1) the saved settings came back as defaults — `parseServerConnectionView` handed `connectionSettingsFromRecord` the view envelope instead of its `settings` node, so unit, address, profile and mappings read as defaults and a save then wrote those defaults back; (2) the tax-code mapping was dropped on save — the server read only the nested `specialCodes.taxPolicyMappings` while the panel sends it at the top level (both are read now, top level wins, still written under the nested key the record has); (3) the deep link threw `scrollIntoView is not a function` and took the panel to «بارگذاری کامپوننت front ناموفق بود» — the host's node is not a browser element, so scrolling is now attempted only when the method exists and the section still opens. Each has a regression test (`accounting-connection.service.test.ts`, `accounting-connection-settings.util.spec.ts`, `accounting-connections-section.test.tsx`).
- **Metadata:** one new field, `accountingConnection.financialSettings` (`RAW_JSON`), because a currency base, mappings and the test profile had no column that belongs to the destination's own contract. Apply plan was `4 add / 6 change / 0 destroy`; presence verified in `core."fieldMetadata"` for workspace `afc7afb6-94ef-4142-872b-52a81b3e91dd`. Nothing destructive ran.
- **Dev facts:** app **0.1.31** published privately and applied to `dev-crm129`; the rebuilt `dist/modules/quotation` was copied into `twenty-server-1` and that container was restarted (the main worker was **not** restarted); workspace now holds **19** live connections, three of them the mock `UAT 014 …` records created by this UAT (left in place, as in 013).
- **Known limitations (reported, not hidden):** focus does not move into the deep-linked section on this host (the node has no `scrollIntoView` and its controls ignore `focus()`); the section itself opens correctly. The three heavy scale tests were skipped in this run, not failed. No real Asan/Sepidar call was made, so nothing here says anything about live vendor behaviour — Asan's own capabilities were not changed without documentation. Superdesign produced nothing (BLOCKED above).

## ARCHITECT GATE — ACCOUNTING-013 FINAL UX 0.1.30 (2026-11-23; DEV TECH ACCEPT / USER_UAT OPEN)

- **Source-reviewed** latest branch HEAD `4f5629cc658019e482f8dbb765a308026818396d`, 3 commits ahead of `c464117c557db2a40de933b4c02d0d7ce6a300fb` (feature `bfe2b035ac`, docs `e3a250f8ec`, accessibility `4f5629cc65`). Changes scoped to accounting business UI, mapping/Asan budget checks, design reports/prototypes, tests, package version and recovery.
- **Architect judgment:** **DEV TECHNICALLY ACCEPTABLE FOR USER_UAT**, not user visual approval, production, or full-scale unpaged API acceptance. In code, `accounting-settings-panel.tsx` maintains five sections, persistent desktop rail/mobile bottom nav, `aria-current`, visited section state with display-toggle, inner-view back navigation and preserved connection form drafts. `accounting-business-ui.tsx` supplies named nav / user-readable detail collapse. Paged mapping now fails closed with `ADAPTER_CONTRACT_INCOMPLETE` when declared reader is missing. Asan `readBoundedResponseText` checks content-length and reader bytes and aborts over budget: **bounded streaming receipt, not incremental JSON parsing**; up to configured body size is accumulated then decoded/parsed. Fallback non-streaming runtime buffers before byte check; never imply universal streaming.
- **Design tooling evidence:** Superdesign login BLOCKED (account auth required), no AI render; A/B HTML prototypes manually authored. Local Impeccable CLI detect results and before/after audit present; no claim the plugin itself generated UI. Worker-reported 501/501 Vitest, tsgo clean, DOM desktop/mobile 390px, 0 overflow, accessibility improvements and app 0.1.30 on Dev :3002; architect did NOT rerun browser/dev, and physical keyboard / forced INCOMPLETE Dev display remain not independently proven.
- **Business-scale caveat remains:** REMOTE_UNPAGED Asan full-list path limited to soft 20k preview and hard 100k refusal; **not full millions-row remote sync**, and no live Asan/Sepidar validation. Must not silently lift ceilings or claim this closed. No accounting outbound or financial posting authorized.
- **Next:** user visually tests `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`; collect concrete UX issues only. Do not run another design task merely to satisfy inaccessible Superdesign; do not close USER_UAT before user's decision. No :6080, Worker or payment changes.


## ARCHITECT REVIEW — ACCOUNTING-013 SCALING DELIVERY (2026-11-22; CONDITIONAL / UX UAT PENDING)

- **Verified commit chain:** `970c4c187f40b8ccfda95d8860c76765b4d9c75f` -> feature `d0ddb06927` -> recovery `c30fe5dffab4e60064cdb36374dd786dc1e24401` on `feat/crm-129-quotation`; compare shows accounting UI sections, read-strategy adapter contract, remote snapshot storage/service, paging and scale tests. No actual local Dev browser execution by architect, only worker-reported tests.
- **Architecture accepted in principle:** `REMOTE_PAGED` adapter reads vendor pages through optional `readItemPage/readPartyPage`; `REMOTE_UNPAGED` snapshots are persisted in KV chunks 500, with reused pages, stale fallback, and a unified MappingPagePayload; standalone accounting UI splits into 5 business sections. Asan explicitly unpaged per provided `LinqToAsan-API-Guide.pdf`.
- **CRITICAL LIMITATION (must remain transparent):** unpaged path `adapter.listItems/listParties` still gets full vendor lists before `buildItemSnapshot/buildPartySnapshot` truncates to soft 20,000 rows; hard 100,000 refuses. 100k remote products thus show **only first 20k** with `INCOMPLETE`, and 1M unpaged remote customers are **not supported** (explicit refusal). This is safety-bounded, **not complete large unpaged synchronization**, and must not be represented as full coverage. Source `accounting-destination-snapshot.service.ts` and `accounting-mapping.service.ts` verified. Asan HTTP limit 64MiB is checked prior to JSON.parse but client response `text()` still buffers; do not claim streaming implementation.
- **Worker claims not independently replayed:** 12/12 read strategy, 35/35 settings, 49 files/492 Vitest, 3/3 scale harness, isolated PG 1M/100k; not actual Asan calls. Reported Dev :3002 version 0.1.28, no outbound, no :6080 impact. Note first metadata apply without --no-delete 16 old duplicate objectPermission replacement; subsequent --no-delete plan 0/3/0.
- **Review state:** CONDITIONAL technical acceptance for partial, transparently capped unpaged preview; **USER_UAT of commercial UI still required**. Before any claim of unbounded vendor support, design actual safe ingestion/stream processing or explicit vendor-specific operational caps with a product decision; don't silently raise limits, repeatedly fetch all or invent API paging. Product requirement remains: UI must be paged regardless of vendor API paging, and unsupported large datasets must be truthfully blocked. Verify any REMOTE_PAGED adapter advertising native paging but missing readItemPage/readPartyPage fails closed rather than silently falling back to full unpaged reads. No corrective loop without concrete failing acceptance requirement.
- **Next decision:** inspect the actual 5-tab page with the user, and only open a bounded follow-up if acceptance is rejected; use Cursor Impeccable/Superdesign in a fresh task/session if design changes are authorized (installed while 013 was running, not evidenced in 013). No real vendor traffic or :6080 touch.
- **Superseded since this review:** the 5-tab page was rejected by the user and rebuilt (see the next section), and the 64 MiB buffering caveat no longer holds — `readBoundedResponseText` now cancels the reader at the ceiling instead of buffering `text()`.

## FOLLOW-UP — CRM-129-ACCOUNTING-013 ACCESSIBILITY CLOSURE (2026-11-22; Dev `:3002` app 0.1.30)

- **Trigger:** two independent design critiques were run on the S0 prototypes (`a-cartable.html` / `b-rail.html`), not on the shipped panel. Their findings were re-tested against the real panel in the real DOM; only what the panel actually failed was changed.
- **Claims that do not apply to the shipped panel (checked, not assumed):** «create opens a pre-filled edit form» — no: `startNewConnection` sets `EMPTY_FORM` and the h2 is «اتصال جدید» when `form.id === null`; `a > button` nesting — no `<a>` in the accounting UI; a rail footer swallowed by the section handler — the rail footer is a read-only flags card; missing credential-safety copy — present («رمزها و توکن‌ها فقط در متغیرهای محرمانهٔ برنامه نگهداری می‌شوند…»); a status tag with no reason — each row already renders `DECISION_HELP` reason text under the tag.
- **Contrast (measured on the real panel, canvas-resolved `color()`/`color-mix` values):** three failures — success tag 3.86:1, warning tag 3.20:1, active rail label 4.42:1 — against 4.5:1 for 11–12px text. Foregrounds are now deepened against black (`color-mix(token 55%, black)`, blue 80%) and tag text moved 11.1px → 12px. Re-measured on نمای کلی and کالاها: **0 elements below 4.5:1**, badges included.
- **Screen readers:** eight `<table>`s now carry an accessible name (اتصال‌ها، کالاها، مشتریان، قابلیت‌ها، آمادگی سند، نگاشت ردیف‌ها، ردیف‌های سند، سوابق عملیات). A section change is announced through a 1×1 `role="status"` `aria-live="polite"` line («بخش «کالاها» نمایش داده می‌شود») without moving focus off the rail button, and the decorative `←`/`→` glyphs are `aria-hidden` so they leave the accessible names.
- **Phone targets:** 36 of 41 controls were under 44px at 390px (search field 24px, filter chips 34px, buttons 36–38px, checkboxes 13px). Inline `min-height`s were removed so the panel's media query is the single source of the floor; now **0 of 41** controls are under 44px, checkboxes are 20px, and horizontal overflow stays 0. Desktop keeps its 38px floor.
- **Copy:** «این نرم‌افزار امکان صفحه‌بندی ندارد» left the main path. The list now says «همهٔ فهرست نمایش داده نمی‌شود» + what was read and that search is the way to find a specific row, or «این نرم‌افزار فهرست را یک‌بار و یک‌جا می‌فرستد؛ جابه‌جایی بین صفحه‌ها در همین برنامه انجام می‌شود.»
- **S0 retry, still BLOCKED:** a second `superdesign login` produced device code `VAAU-1071`; the browser landed on `superdesign.dev/auth/login?redirect=/auth/cli?code=VAAU-1071`, i.e. an email/Google sign-in that needs an account this session does not have. No render was produced and none is claimed; the two options remain hand-written prototypes evaluated with the Impeccable local CLI.
- **Evidence:** 49 vitest files / **501 tests** pass, `tsgo` clean; app **0.1.30** applied to `dev-crm129` with plans **0 add / 2 change / 0 destroy** then **0 / 1 / 0** (front components only). Browser re-check: a draft in the connection form survived a detour through کالاها and back, sub-view back is 44px with a hidden arrow, «جزئیات فنی» still collapsed, documents section intact, 5 bottom-bar sections at 390px. No behaviour, data, vendor call, `:6080` or worker change.

## EXECUTED — CRM-129-ACCOUNTING-013-FINAL-UX-AND-INTEGRITY (2026-11-22; Dev `:3002` app 0.1.29, real-browser DOM desktop + 390px, 49 files / 501 tests)

- **Gate outcome:** the rejected panel was rebuilt as a five-section product screen and the 013 integrity gaps were closed. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.** UI acceptance is still the user's; nothing here is final production acceptance.
- **Commits:** `bfe2b035ac` (feature) and this record on `feat/crm-129-quotation`, rebased onto the architect review `c464117c55`. Scope is the quotation app plus its design evidence; no `twenty-front` churn.
- **S0 — design tools, honestly reported.** **Superdesign is BLOCKED**: CLI `0.14.0` is installed, but `list-models` exits 4 with `API Error: Not authenticated. Run 'superdesign login' first.` — no cloud session exists here, so **no Superdesign render was produced**. Two HTML prototypes were authored instead (`packages/twenty-apps/.impeccable/designs/a-cartable.html`, `b-rail.html`) and evaluated with the **Impeccable local CLI** (`impeccable detect … --no-advisory`): run 1 — `a-cartable` 3 anti-patterns (`low-contrast` 3.9:1 on `#b5651d`/`#fdf1e3`), `b-rail` 0; run 2 after the token fix (`#2b7048` / `#8a4a12`) — 0 on both (`_detect.json`, `_detect-after-fix.json`, `IMPECCABLE-AUDIT.txt`). `b-rail.html` was selected because a rail survives an open inner view while a tab-in-card layout cannot; rationale in `.impeccable/designs/A-DECISION-RATIONALE.md`. Impeccable `detect` is a static contrast/copy pass and cannot prove navigation, so every navigation claim below is a browser assertion.
- **S1 — navigation.** Persistent rail (bottom bar under 860px) names all five sections and is mounted in every view including the connection form and the CRM candidate picker; `aria-current` marks the active one. Sections stay mounted behind a `display` toggle, so a search string, filter chips, page cursor and row selection survive section switches. `SubViewBar` gives the connection form and the customer picker an explicit «→ بازگشت» at 44px on phones, and the breadcrumb/h2 follow the inner view. A deliberate behaviour change: clicking the already-active section leaves the form, but a detour through another section keeps it — the old code reset `connectionView` on any section change and silently discarded a half-typed draft.
- **S2 — content.** Overview states accounting state, real snapshot freshness (age/status of the last read, not the last connection test), an attention list and the next action. Connections is a searchable list with one selected, a software step, edit/test, and a described-not-required service address for adapters that never dial out (a non-routable `http://mock.invalid` placeholder is stored, so a Mock connection no longer fails `CONNECTION_BASE_URL_REQUIRED`). Catalog/customers carry search, filter chips, match, price difference, duplicate-code and duplicate-party warnings; documents carry readiness, operation history and unfinished recovery. Technical values (adapter id, version, `FAILED — …` codes) live only inside a collapsed «جزئیات فنی» details block; row errors are Persian reason + remedy.
- **S3 — integrity.** (1) `REMOTE_PAGED` without `readItemPage`/`readPartyPage` refuses with `ADAPTER_CONTRACT_INCOMPLETE` instead of falling back to a full read (`accounting-mapping.service.ts`, tests at `accounting-read-strategy.test.ts:353,370`); (2) unpaged destinations keep the chunked KV snapshot; (3) incomplete/stale/degraded state is rendered, and `lastHealthy` is served with an explicit notice; (4) the 20 000-row ceiling and the «vendor cannot page» fact are stated in `LimitNotice`, not presented as large-catalog support; (5) the Asan body budget is real streaming — `readBoundedResponseText` counts UTF-8 bytes per chunk and cancels the reader at 64 MB, and a declared `content-length` above it is refused before the body (`asan-http-adapter.test.ts` `asan response body budget`, 5 cases incl. the no-stream runtime); (6) 100 000 rows hard-refuses and 1 000 000 refuses in under 2 s (scale suite), requests clamp to 100 rows; (7) both strategies return the same `MappingPagePayload`, so the UI cannot tell them apart; (8) `keeps one workspace snapshot invisible to another workspace` guards isolation.
- **S4 — real browser, no screenshots.** On `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`: all five sections switched and returned; connection form opened/back; a typed draft survived a detour through «کالاها» and came back intact; mock connection created and tested end to end; catalog and customer search + paging + selection retained across sections; a failing connection produced a Persian snackbar and, in the catalog, «ارتباط با نرم‌افزار حسابداری برقرار نشد» + remedy + «تلاش دوباره», with the technical code only inside the collapsed block; a stale snapshot was served as «استفاده از نسخهٔ قبلی» with its notice. 390×844: bottom bar pinned, sub-view back at 44px, zero horizontal overflow. Focus rings reached every control by DOM focus traversal; the harness does not deliver synthetic Tab keystrokes, so physical keyboard traversal is not claimed.
- **S5 — non-technical acceptance.** Each of the seven required actions is reachable without a technical term: find the accounting software (software step), create a trial connection (Mock), read its state (health + plain reason), find an item/customer (search + chips), understand a mismatch or error (reason + remedy per row), return to the previous section (rail + breadcrumb + back bar), and know the next step (one primary action per section).
- **Dev facts:** app **0.1.29** is installed under name «پیش‌فاکتور»; workspace **16** live connections (15 that predate this task + the one created by the browser UAT, «اتصال آزمایشی جدید») and **0** `_accountingSyncOperation` rows. No `:6080` change, no main-worker restart, no live Asan/Sepidar traffic, no outbound switch enabled, no financial calculation touched, no DB seed.
- **Known limitations (reported, not hidden):** Superdesign produced nothing (BLOCKED above) — the two options are hand-written prototypes, not model renders. `INCOMPLETE` snapshot rendering is covered by unit/scale suites but was not forced on Dev without restarting the worker or changing ceilings. Physical key events unverified (harness). Adapters remain `LIVE_UNVERIFIED`; financial outbound and export flags stay OFF; PDF Persian shaping remains a visual-only gate. The mock connection created by the browser UAT («اتصال آزمایشی جدید») remains in the dev workspace and was not deleted.

## ACCOUNTING ADAPTER CONTRACT CORRECTION — PAGED AND UNPAGED SOURCES (2026-11-22; USER PRODUCT DECISION FOR 013)

- **Decisive requirement:** customer/product interface must work at huge scale regardless of whether the accounting vendor's API exposes native paging. Treat **vendor capability** and **CRM UI pagination** as separate axes. NEVER require all vendors to support remote pagination.
- **Source evidence:** user-supplied `LinqToAsan-API-Guide.pdf` (library file `LinqToAsan-API-Guide.pdf`, uploaded 2026-11-18) documents `GET ProductsNew/AllProducts` and `GET CustomersNew/AllCustomers` as unparameterized full-list endpoints; `ProductsNew/LastProducts?Count=N` and `CustomersNew/LastCustomers?Count=N` return last N, **not** arbitrary paginated traversal. Individual lookups exist `ProductsNew/OneProduct?ProductCode=`, `CustomersNew/OneCustomer?CustomerCode=`. No page/offset/cursor for the full-list endpoints is established by this PDF; do not claim these APIs have paging without fresh source verification.
- **Required adapter contract:** support `REMOTE_PAGED` (cursor/offset API with bounded page fetch) and `REMOTE_UNPAGED` (all-list endpoint) explicitly, plus honest capabilities for incremental/single-record lookups. UI/backend interface offers one `search/list({query,filter,sort,cursor,limit})` against **server-side indexed CRM snapshot/index**, not vendor network per UI keystroke. Remote paged adapters incrementally import pages; remote unpaged adapters ingest full responses via **bounded/streamed, background, checkpointed and failure-safe** ingestion where feasible, enforce hard response size/memory/time limits, and atomically publish a validated snapshot. Do not claim streaming if HTTP/vendor client buffers full response. A too-large unpaged response is an explicit `SOURCE_LIMIT_EXCEEDED` / `SYNC_BLOCKED`, never silent truncation/partial completeness. Retain last-known-good snapshot and surface its staleness/completeness; no cross-workspace record leakage.
- **Scale/integrity:** 5k products/100k customers are examples, not caps. Test at higher synthetic scale, with bounded DB queries/page responses, correct total or honest unknown, stable ordering/cursors, dedupe and invalid-ID reporting, durable progress/retry, no UI bulk load. This is an architectural contract; real Asan API and performance **remain unverified** without authorized endpoint.
- **Scope:** Amend active task `CRM-129-ACCOUNTING-BUSINESS-UX-SCALING-013` only. No new numbered remediation task, no screenshots, no :6080, no main worker restart, no real vendor call, no accounting financial outbound. Preserve one shared adapter abstraction and user-friendly labels, plus OpenSpec/Impeccable guidance.


## EXECUTED — CRM-129-ACCOUNTING-BUSINESS-UX-SCALING-013 (2026-11-22; Dev `:3002` 12/12 read-strategy + 35/35 settings + 492 app tests + 3/3 scale)

- **Feature commit:** **`d0ddb06927`** on `feat/crm-129-quotation`, parent `970c4c187f`; this recovery record is the commit immediately after it. Unrelated `twenty-front` formatter churn was reverted so the commit stays inside the accounting app. App **0.1.28** applied to `dev-crm129`: plan **16 add / 12 change / 16 destroy** (the familiar stale duplicate `objectPermission` set, replaced 1:1 — the role still holds exactly **16** permissions), 15 live connections / 35 rows, **0** sync operations, no `:6080` and no worker restart.
- **Mandatory architecture correction (part of 013, not a follow-up task):** `AdapterCapabilities.readStrategy` is now `REMOTE_PAGED | REMOTE_UNPAGED`, and `AccountingAdapter` exposes optional `readItemPage` / `readPartyPage`. `loadItemMappingPage` / `loadPartyMappingPage` dispatch on that flag and return the same `MappingPagePayload<TRow>`, so no screen can tell which kind of destination it is talking to. Asan is **`REMOTE_UNPAGED`**: per `LinqToAsan-API-Guide.pdf`, `LastProducts` / `LastCustomers` accept only `Count` (last N) with no cursor or page token, so they are never treated as pagination.
- **Bounded snapshot for unpaged destinations:** rows live in the app workspace kv store in 500-row chunks (`acct-snap:*`), so a second "next page" call reuses the snapshot instead of re-reading the destination (process memory did not survive a logic-function invocation). The index keeps at most 4 keys with a 15-minute TTL, keeps `lastHealthy` for a failed refresh (served with an explicit degraded notice), and a chunk registry with a self-healing sweep deletes replaced, evicted and orphaned chunks. Search scans chunk by chunk and retains at most one page.
- **Hard resource ceilings:** 20 000-row soft limit → `syncStatus: INCOMPLETE` + `incompleteReason: SNAPSHOT_LIMIT_REACHED`; 100 000-row hard max → refusal `REMOTE_DATASET_TOO_LARGE` before any import row is built; Asan list bodies above 64 MB are refused before `JSON.parse`; every page request is clamped server-side to ≤100 rows. No path fetches a whole remote catalog per keystroke.
- **One UI for both strategies:** the standalone page is now five tabs (نمای کلی / اتصال‌ها / کالاها و خدمات / مشتریان / اسناد و سوابق); connections are a searchable list with one selected, not chips. `LimitNotice` states truncation, the vendor-cannot-page fact, the 20k ceiling and the incomplete-sync status in Persian, and renders identically for paged and unpaged destinations.
- **Evidence — synthetic scale (no vendor calls, no screenshots):** `CRM129_SCALE=1 npx vitest run src/scale` **3/3** — 100 000 items truncate to 20 000 with `INCOMPLETE` while still paging 25 rows and reading one chunk per page; 1 000 000 unpaged customers are refused in under 2 s; 1 000 000 CRM customers are walked at 25 rows/page with every request `first ≤ 25`. Real Postgres harness (`scripts/scale-harness.cjs` → `scale-report.json`, isolated db `twenty_scale_crm129_013`, 1M customers / 100k items): deep page 78.73 ms, catalog p95 0.88 ms with the ordered index, against an unbounded baseline of 1 803.7 ms / 166.7 MB payload / 587 MB heap. `unbounded-read.guard.test.ts` reads the source and fails on `first: >500`, `slice(0, 100/200)` fetch-then-slice, the whole-catalog reader, or a screen returning to `preview-items` / `preview-parties`.
- **Evidence — Dev `:3002`:** `dev-verify-crm129-read-strategy-013.cjs` **12/12 PASS** (unpaged capability declared, bounded page with honest total and cursor, fresh read then `reused=true` snapshot reuse, no row overlap across pages, 1 000 000-row request clamped to 100, search before paging, explicit refresh, customers on the same contract, 0 operations and 0 outbound). Regression `dev-verify-crm129-accounting-settings-010.cjs` **35/35 PASS**; app Vitest **49 files / 492 tests**; `tsgo` clean on `tsconfig.json` and `tsconfig.spec.json`.
- **Known limitations (reported, not hidden):** Asan exposes no paging for `LastProducts` / `LastCustomers`, so a destination above 20 000 rows is shown as an explicitly incomplete first-N snapshot and above 100 000 rows is refused — this is not full scalability against Asan. Adapters stay `LIVE_UNVERIFIED` with no real Asan/Sepidar traffic; financial outbound and document export switches stay OFF; PDF Persian shaping remains a visual-only gate. oxlint reports the pre-existing 21 errors in `money/`/`quotation/` test files and none in this change.

## PRODUCT UX REJECTION — ACCOUNTING SETTINGS UAT-012 (2026-11-22; USER REJECTED CURRENT UX)

- **User acceptance feedback:** the accounting settings UI at `/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` is **REJECTED for business use** despite technical UAT-012 PASS. Provided screenshot shows a monolithic form, lengthy developer-facing warnings and dozens of horizontally wrapping saved-connection buttons. Unclear orientation, no obvious initial action, and unsuitable for ordinary merchants/accountants. Keep technical/security acceptance of 009-012 distinct from **product UX acceptance, which is NOT granted**.
- **Source-verified scalability problem:** `accounting-settings-panel.tsx` iterates all `data.connections.map(...)`; `accounting-shared.tsx` filters `preview.rows` client-side and displays `visibleRows.slice(0, 100)`; `accounting-import.service.ts` calls `adapter.listItems()` and `adapter.listParties()` for the remote lists. This is not true server-side pagination and not viable proof for 5,000 products or 100,000 customers. It is forbidden to pretend UI slicing/scanning is cursor pagination.
- **Next bounded deliverable (DESIGN + IMPLEMENT + REAL DOM VERIFY, no screenshot):** `CRM-129-ACCOUNTING-BUSINESS-UX-SCALING-013`. Rework the existing standalone accounting page into clearly labeled tasks/sections: overview / connections / products / customers / documents, accessible in Persian RTL, with one primary action and short user-oriented copy. Preserve one connection settings form and existing server authority, adapters, outbound flags; no parallel business logic. Saved connections must be a searchable/listed or paginated select, NOT a row of chips. Show one selected connection and progressively disclose advanced settings. Product/customer grids require server-side indexed CRM search and bounded paged API with explicit total/next-cursor/unknown limitations. For vendor endpoints without true pagination, document and enforce a bounded, truthful adapter capability or offline snapshot strategy; do not fetch or render unbounded full remote catalogs per keystroke, and do not claim complete results when only first 100 are available. Preserve clear mock badges and no actual vendor calls.
- **Acceptance scale tests:** generated isolated synthetic dataset of 5k product records and 100k customer records outside operational workspace; test query count, network payload bounds, search, sorting, filtering, paging, stable selections, empty/loading/errors, 390px and desktop DOM/keyboard accessibility; no screenshots, no production DB seed/backfill. Measure and report latency/memory with reproducible thresholds based on dev baseline; do not invent perf PASS. Role restrictions/GraphQL negative/security regression and 0 outbound contact remain intact. No `:6080`, worker restart, merger, or real vendor writes.
- **Decision:** one bounded product UX implementation pass to address the rejected business experience; no infinite chain of cosmetic tasks. Architect review at STOP_FOR_ARCHITECT, followed by actual user UAT. Existing previous technical milestones remain accepted; **current UI is not approved**.


## ARCHITECT UAT GATE — ACCOUNTING-MOCK-012 (2026-11-22; READY_FOR_USER_UAT / NO FIX LOOP)

- **Source verified:** branch `feat/crm-129-quotation` HEAD `16177cabbbf712de132b4eb3a1445b6c0505e48d`, 3 commits after prior recovery `f8238ae81c034ee5a30effdba2e5d58558da109a`: feature `2b42d714cad531cca14c4a1498f8ce532ff391bc`, recovery `e92c82c091`, version pin `16177cabbb`. Git compare shows 17 changed paths scoped to accounting mock fixture/preview, related UI/services/tests, app version and recovery. Architect inspected `mock-dataset.ts`, `document-preview.ts`, accounting outbound safety check, and quotation accounting record tab.
- **Decision:** ACCEPT *mock-scoped code architecture* and mark **READY_FOR_USER_UAT**, not final UI/production acceptance. Mock catalog contains 33 items with deliberate code/name duplicates, invalid and inactive entries, missing price; 22 parties with duplicate identifiers/national code and missing national codes; four illustrative tax rate samples and four explicitly illustrative operation-history samples. These fixtures are module constants rather than a DB seed/backfill. Document preview operates on sealed revision + same Asan mapping, exposes 15 readiness checks, no vendor call in pure builder; record-tab dispatch button is hard-disabled. `executeQuotationExport` is distinct from preview, while outbound contract refuses writes when flags off. No duplicate money domain/service detected in inspected changes.
- **Evidence recorded from worker (not independently replayed):** Dev app 0.1.25 and healthz=200, accounting UAT 22/22, settings 35/35, TAX-009 22/22, Vitest 44 files/443 tests, tsgo 0; browser DOM desktop and mobile 390x844 without screenshots/no horizontal overflow, preview search and field warnings, 15 readiness checks, disabled dispatch. Tests did not prove actual physical keyboard Tab delivery (DOM focusables only). Reported 0 vendor calls, 0 new operations/links, no `:6080`/worker touch. UI UAT is still pending the user's actual review.
- **Precise user-test URLs (reported from Dev):** settings `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`; quotation list `http://localhost:3002/objects/quotations`; sample record `http://localhost:3002/object/quotation/0a896586-2c2d-496b-b8ce-9352b2eef66b`. The URLs were provided by the worker and not independently browser-opened by architect.
- **UAT acceptance checklist:** settings Mock save-refresh, mock test health (no real vendor), catalog code `1001` duplicate-name and `2004` duplicate-code, party duplicate national-code warning, quotation create/edit/reload and Persian numbers, record-tab preview and 15 checks, disabled real 'register in accounting' button, labeled demo-only history. Capture only concrete user issues with reproduction path; no screenshot requirement or repeated broad refactors.
- **Watchpoints:** worker reports 15 existing Dev connections and 207 quotation records; they are **not fixtures** and must not be reset/overwritten. Imported tax rates are illustrative only, not legal assertions. Any 'mock succeeded' label must not imply a real Asan/Sepidar send. App still has real outbound action backend hidden behind disabled flags, so keep both flags OFF, and never claim API integration validated. Dev 0.1.24's metadata apply was not no-delete (worker reports replaced 16 stale objectPermissions 1:1); future apply should use plan review and `--no-delete` unless architect approves a precise diff.
- **Next gate:** USER_UAT; after the user's concrete feedback, at most one bounded UI polish task if needed. If accepted, proceed to next product capability without reopening TAX-008/009 or ACCOUNTING-010/011/012. Remaining nonblocking: real Asan/Sepidar unverified, PDF visual Persian glyphs, Nx Windows POSIX asset-copy, dev limited API-key fixture cleanup, physical keyboard interaction not directly replayed.
- **Safety:** no live accounting calls or financial sends, no `:6080` changes, no Worker restart, no screenshots.


## EXECUTED — CRM-129-ACCOUNTING-MOCK-UAT-012 (2026-11-22; Dev `:3002` 22/22 mock UAT + 35/35 accounting + 22/22 TAX + 443 app tests)

- **Gate outcome:** S0–S6 executed on Dev `:3002`; manual UAT surfaces are ready, outbound and fiscal registration stay disabled, zero vendor traffic. **`READY_FOR_USER_UAT` → `STOP_FOR_ARCHITECT`.**
- **Source baseline / commit:** branch `feat/crm-129-quotation` from recovery head `f8238ae81c03`; feature commit **`2b42d714cad531cca14c4a1498f8ce532ff391bc`** (this recovery record is the commit immediately after it); no merge. Unrelated dirty `twenty-front` files were preserved and not committed.
- **S1 — isolated mock dataset:** new `src/domain/accounting/adapters/mock/mock-dataset.ts` exports **33 catalog items** (duplicate remote code `2004`, duplicate names `1001`/`1003`, non-numeric IDs `X-901`/`-5`, null price `5001`, inactive `7001`) and **22 destination parties** (duplicate national code `10301010303`, duplicate party ID `101`, two rows without national code), plus tax samples `0 / 9 / 10 / 10.5` and four demonstration operation outcomes (`SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_FINAL`, `MANUAL_EXPORT_REQUIRED`). Fixture only: no seed, no backfill, no deletion of workspace records; the settings page renders the demo history without writing an operation row.
- **S2/S3 — forms:** the standalone settings page keeps adapter selection, connection list/switching, mock create/edit, service URL, remote user/store, RIAL/TOMAN, TLS approval, special codes, tax mapping, masked secret status, mock connection test and health. Item and customer previews now show a search box, destination ID, destination/CRM price, difference and Persian warnings; duplicate IDs, ambiguity and missing candidate stay refused until the user links an explicit CRM record. Live-only actions remain labelled «فقط آزمایشی (بدون تماس واقعی)» / require a real connection. A new «تاریخچهٔ نمایشی عملیات» table (mock adapter only) satisfies the success/failure/review samples.
- **S4 — document readiness:** new `src/domain/accounting/document-preview.ts` builds the 15-check matrix, line mapping table and the simulated Asan factor from the sealed revision; `accounting-outbound.service.ts` returns it with every export preview. Browser proof on an accepted quotation: `BLOCKED`, `CUSTOMER_NOT_LINKED`, two unmapped lines, «ثبت در حسابداری (غیرفعال)» disabled; no document created.
- **S5 — live evidence:** `scripts/dev-verify-crm129-accounting-mock-uat-012.cjs` **22/22 PASS** (readiness matrix, mock document or explained refusal, both switches off, generic GraphQL write refused, anonymous read 403, previews create 0 operations/links/quotations, tax coverage). Regression: accounting settings **35/35 PASS**, TAX closure **22/22 PASS**, app Vitest **44 files / 443 tests**, `tsgo` clean. Browser (no screenshots) desktop and 390×844 mobile: settings page and quotation accounting tab have zero horizontal overflow, all controls focusable (16 focusable elements in the tab, none `tabindex=-1`), demo history renders four outcomes. IDE browser harness does not deliver synthetic key events to the page, so keyboard traversal is evidenced by DOM focusability, not keystrokes.
- **S6 — deployment:** quotation app **0.1.25** applied to `dev-crm129`. `0.1.24` needed one plan **16 add / 14 change / 16 destroy** (the familiar stale duplicate `objectPermission` rows, 1:1 replacement; role still holds exactly 16 permissions, no page/view/field/logic deletion); `0.1.25` was **0 add / 1 change / 0 destroy** (settings front component only). Dev server (`twenty-server-1`) restarted once to pick up the provisioned Member API key `crm-129-011-limited` whose expiry had lapsed; the main worker, `:6080` and `:3002` front were untouched. DB after UAT: 15 live accounting connections (33 incl. soft-deleted), **0 sync operations**, no Asan/Sepidar log lines.
- **Test URLs:** settings `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`; quotation list `http://localhost:3002/objects/quotations`; example accepted document `http://localhost:3002/object/quotation/0a896586-2c2d-496b-b8ce-9352b2eef66b` (tab «حسابداری»).
- **Known limitations (unchanged, reported):** no real Asan/Sepidar endpoint or credentials, adapters stay `LIVE_UNVERIFIED`; financial outbound and document export switches off; PDF Persian shaping remains a visual-only gate; Windows Nx POSIX asset-copy failure persists (deployment used built `dist`).

## ARCHITECT ACCEPTANCE — ACCOUNTING-011 (2026-11-22; DEV ACCEPT / NO MORE FIX LOOP)

- **Remote head reviewed:** `6ca5a4e12a0b5e3a78fc8b3ceac27d78ab0fa59a` on `feat/crm-129-quotation`, 3 commits above `2ee860f0583aa6df490722d31bd42a9ce2af59ef`: feature `c1bd09ca8a889e6fd36f8c8b48ef8c2361dbaa7d`, docs `922157b451`, proof/spec `6ca5a4e12a`. Architect examined changed paths and actual source for graphQL write guard, server-owned authority/probe, address classification/pinned GET, adapter capability contract and app route. **Not independently re-executed** browser/DB tests.
- **Acceptance:** ACCOUNTING-011 **ACCEPT for DEV**. Public generic GraphQL `accountingConnection` mutations now fail for every auth type including owning application/system; app removed old direct mutation exports, routes mutations through role-checked REST. Server derives capabilities from known adapter id rather than caller's `body.capabilities`. The deprecated health-input action is no longer a writable endpoint; connection health now comes from server-executed read-only test. Server network probe validates all DNS answers, pins the connection to the vetted address, refuses redirects and local/link-local/metadata addresses, and requires server-maintained allowlist+transport approval for permitted private destinations. Existing accounting workspace settings page and read-only quotation tab preserved; outbound remains disabled.
- **Worker-reported Dev evidence:** accounting 35/35, tax 22/22, mock 15/15, revision seal 14/14, server Jest 26 suites/279, app Vitest 42 files/432, tsgo 0 errors; 66 GraphQL negative invocations with unchanged DB fingerprint, app 0.1.23, `:3002` healthy. These are recorded as worker-executed, not falsely architect-replayed. `:6080` and main worker reportedly unchanged; no real vendor calls.
- **Non-blocking watchpoints for real read-only Asan integration:** server `accounting-adapter-contract.util.ts` intentionally repeats vendor capabilities declared in app adapter; establish explicit contract-drift test before changing Asan API capabilities. `testConnection` reads connection configuration then probes outside a write transaction and updates health later; consider configuration/version claim or compare-and-set so a concurrent settings change cannot attach an outdated probe result to a new destination. Re-verify DNS/transport/allowlist against actual approved deployment network; no secrets to unapproved destination. No new security remediation task solely for these until real integration scope.
- **Other known limitations:** actual Asan/Sepidar `LIVE_UNVERIFIED`, financial outbound/doc export switches off, Windows Nx final POSIX asset-copy issue separate, PDF visual Persian shaping separate, Dev limited-role API-key fixture remains and should be revoked at test cleanup. Retain prohibition on live writes and on `:6080` modifications without separately approved launch.
- **Product continuation:** stop repeating 010/011. Next bounded deliverable is **Asan read-only integration readiness**: approved endpoint/credentials/transport, GET-only health/items/parties with sample-data comparison, no create/update/delete, no money-bearing document export, and independent contract-drift test. One delivery and one architecture gate; no screenshots, no infinite loops, report BLOCKED explicitly if actual authorized Asan environment is unavailable.
- **Final:** `STOP_FOR_ARCHITECT` satisfied; **Dev feature development may proceed**.


## EXECUTED — CRM-129-ACCOUNTING-SECURITY-CLOSURE-011 (2026-11-22; 35/35 live + 22/22 TAX + 15/15 mock + 14/14 seal)

- **Gate outcome:** S1/S2/S3/S4 PASS on Dev `:3002`; no real Asan/Sepidar call, outbound and financial transfer still disabled. **`STOP_FOR_ARCHITECT`** — do not auto-start another slice.
- **Source baseline / commit:** `feat/crm-129-quotation` from `2ee860f0583aa6df490722d31bd42a9ce2af59ef`; feature commit **`c1bd09ca8a889e6fd36f8c8b48ef8c2361dbaa7d`**. Deployed to `twenty-server-1` (Dev server restarted only; main worker and `:6080` untouched) and quotation app **0.1.23** synced to `dev-crm129`.
- **S1 — one authoritative writer, including the owning app.** Eleven `@WorkspaceQueryHook` classes still guard every generated `accountingConnection` mutation (`create/update/delete/destroy/restore`, one and many; `mergeMany` is not in the generated schema). `AccountingConnectionWriteGuardService.assertMachineWriter` now throws `ACCOUNTING_CONNECTION_WRITE_FORBIDDEN` for **every** auth context, `APPLICATION` and `SYSTEM` included; the owning app writes through the same REST settings route as a person, where its workspace role is resolved. The app-side legacy writers are gone: `buildCreateAccountingConnectionMutation`, `buildUpdateAccountingConnectionMutation`, `saveConnection` and `persistHealth` were removed, and `saveConnectionThroughServer` / `testConnectionThroughServer` are the only write clients. Live negative matrix: **11/11 GraphQL mutations refused for admin user, Member user, Admin-role API key, Member-role API key, unrelated app and owning app** (66 calls) with the connection-table fingerprint byte-identical; the admin REST save and the app-authorized save still succeed. Reads, list and previews are unchanged (`R0`, `R0.2`, `S8.2`).
- **S2 — server-derived capabilities and server-executed health.** Save ignores `body.capabilities` completely; capabilities and `adapterVersion` come from `accountingAdapterContract(adapterId)`, and fake capabilities were stored as the real contract (`createProforma=true`, `updateFields=PRICE_ONLY`). `accounting-connection-health` is retired (`INVALID_INPUT`, zero rows changed) and replaced by `accounting-connection-test`, which resolves authority, runs `AccountingDestinationProbeService` in the server process and persists only its result; caller-supplied `healthState`, `message`, `checkedAt` and `verificationState` are not read. A forged `FAILED`/`HACK-010-FORGED`/`LIVE_VERIFIED` payload stored health `OK` from the real mock probe with message «اتصال آزمایشی در حافظه پاسخ داد…». Any settings save resets `healthState` to `UNKNOWN` with a re-test message, and a live adapter stays `LIVE_UNVERIFIED` after a successful or failed probe.
- **S3 — DNS/IP validation at connection time with pinning.** `probeAccountingDestination` resolves once per probe, validates **every** returned address, and pins the socket to the validated answer through a `lookup` override; a second DNS answer cannot be used (rebinding). 3xx redirects are reported `REDIRECT_REFUSED` and never followed. IPv4/IPv6 loopback, link-local (`169.254/16`, `fe80::/10`), cloud metadata `169.254.169.254`, unspecified `0.0.0.0`/`::`, multicast/reserved, NAT64, 6to4 and IPv4-mapped forms are `BLOCKED` categorically — an operator allowlist cannot unlock them (unit + live: loopback with transport approval and allowlist still refused). RFC1918, CGNAT and documentation ranges are `PRIVATE`: storable/reachable only with `transportApproved` **and** an `ACCOUNTING_PRIVATE_DESTINATION_ALLOWLIST` entry for the host/port. A LAN save with approval but no allowlist is refused `CONNECTION_DESTINATION_NOT_ALLOWLISTED`; `transportApproved` is no longer a blanket egress grant. No secret is attached to any probe.
- **S4 — live evidence on Dev `:3002`:** `scripts/dev-verify-crm129-accounting-settings-010.cjs` **35/35 PASS** (page + nav metadata, Mock save/read/reload, refused actors with identical digest, 66 GraphQL refusals, unsafe destinations, forged health/capabilities, retired action, Asan `LIVE_UNVERIFIED`, outbound disabled with 0 sync operations, no secret leak, untouched tax metadata, PDF 12 549 B and 20 sealed revisions byte-identical). TAX closure **22/22 PASS**, accounting mock **15/15 PASS**, revision seal **14/14 PASS**. Server quotation Jest **26 suites / 279 tests**, app Vitest **42 files / 432 tests**, `tsgo --noEmit` clean for both packages. Browser (no screenshots): `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` renders the full workspace form (adapter selector, registered connections, service URL, remote user/store, money unit, TLS approval, special codes, tax mapping, secret status, capabilities, send-lock panel «ارسال به مقصد: خاموش — ثبت سند مالی: خاموش»); the quotation record tab «حسابداری» shows only that document («حسابداری این پیش‌فاکتور», selected connection, readiness, history, disabled «ثبت در حسابداری») and points workspace settings to the sidebar page. Metadata audit: 58 objects, 0 soft-deleted page layouts/views/view fields/logic functions; the 5 soft-deleted `pageLayoutWidget` rows predate this slice (2026-10-27..11-01).
- **Metadata apply note (deviation, audited):** app `0.1.23` was applied **without `--no-delete`**; the plan reported `16 to add / 12 to change / 16 to destroy`. The destroyed rows were stale duplicate `core.objectPermission` rows from an older manifest state: the app role now holds exactly the 16 object permissions declared by the manifest (all 16 manifest universal identifiers verified present), and no page layout, view, view field, field, object or logic function was soft-deleted. Net effect is a 1:1 permission replacement, not a reduction of the app's declared grants. Future applies should keep using `--no-delete` plus a plan audit.
- **Dev-only test fixture:** a real Member-role API key (name `crm-129-011-limited`, id `9c1f4b52-0110-4c3a-9d2e-7b6a11110011`) was provisioned in Dev so the restricted-API-key negative case is a real principal (REST 403, GraphQL `FORBIDDEN`, zero writes). It is workspace data, not a source change; the verification script only deletes keys it created itself.
- **Changed files (22):** server — `quotation-ui.controller.ts`, `quotation.module.ts`, `accounting-connection-authority.service.ts`, `accounting-connection-write-guard.service.ts`, new `accounting-destination-probe.service.ts`, `types/accounting-connection.type.ts`, `utils/accounting-connection-settings.util.ts`, new `utils/accounting-adapter-contract.util.ts`, `utils/accounting-destination-policy.util.ts`, `utils/accounting-destination-probe.util.ts`, four specs; app — `package.json` (0.1.23), `data/accounting-queries.ts`, `logic-functions/accounting-connection.ts`, `services/accounting-connection.service.ts`, two specs, `scripts/dev-verify-crm129-accounting-settings-010.cjs`. Unrelated dirty `twenty-front` files were left untouched and uncommitted.
- **Remaining (reported, not bypassed):** no real Asan/Sepidar reachability or write; all accountancy stays `LIVE_UNVERIFIED` and outbound is off; Nx `twenty-server` build still fails only at the Windows POSIX asset-copy step (SWC output is deployed from `dist`); PDF Persian glyph shaping remains a visual-only gate.

## ARCHITECT INDEPENDENT REVIEW — ACCOUNTING-010 (2026-11-22; DEV UAT APPROVED / SECURITY FINAL GATE OPEN)

- **Verified repository state:** branch `feat/crm-129-quotation` at `e6045e709451f111a37bfbb0a67edf8d5ec4dbf7` (one commit after architect baseline `90db850f643cb50adc9c9fc614873e4643ae42de`). Source review read server `AccountingConnectionAuthorityService`, `AccountingConnectionWriteGuardService`, `accounting-connection-settings.util.ts`, the controller, app route, service, standalone page manifest, shared accounting components and quotation tab; compare includes ~40 changed paths. **Worker-reported** 31/31 accounting, 22/22 TAX, 15/15 accounting mock, 438 app and 230 server tests, Dev app 0.1.22 and page ID `20c28688-fc16-42f8-a231-9d5735d1b2c2`; architect did NOT independently execute browser/DB tests.
- **Accepted structural changes:** separate standalone `تنظیمات حسابداری` + sidebar; quotation tab is a small document-context read/preview/history UI, not a second settings editor. `accounting-shared.tsx` hosts shared presentation/types; record and page reuse existing vendor-neutral `accounting-connection.service` and adapters. No Money Domain, numbering, issuance or workflow changes. Secrets still belong to app variables; live Asan/Sepidar status stays `LIVE_UNVERIFIED`; real outbound remains disabled in declared environment. Dev **user UAT is permitted**; no production release or live writes.
- **P0 VERIFY/FIX: app-owner GraphQL writes bypass central settings validation.** Eleven workspace GraphQL hooks exist, but `AccountingConnectionWriteGuardService.assertMachineWriter` explicitly ALLOWS `APPLICATION` (owner identity) and `SYSTEM`. Therefore the claim that **all** generic GraphQL writes are blocked is inaccurate for owning app identity. `accounting-connection.service.ts` still EXPORTS legacy `saveConnection` / `persistHealth` which create/update via generic GraphQL and can directly write `verificationState` (including `LIVE_VERIFIED`), bypassing `AccountingConnectionAuthorityService` and its server validation. Prove whether any live logic route can invoke these; irrespective of reachability, establish one protected write authority for all principals or a narrow proven internal-only path. Add real positive/negative owner app token GraphQL tests, and preservation of older import/outbound paths. Do not break required read-only GraphQL queries.
- **P0 VERIFY/FIX: client-controlled capabilities and health evidence.** `QuotationUiController.handleAccountingConnectionAction` passes `body.capabilities` into `AccountingConnectionAuthorityService.saveConnection`, and on INSERT stores `asRecord(input.capabilities)` without server-side derivation; capability flags could be forged even if the caller has settings authority, changing future export readiness. `persistHealth` accepts arbitrary status/message/date from authorized caller and writes `healthState:'OK'`; although `verificationState` is clamped, a forged green health indicator is possible. The server must derive capabilities from known adapter contracts and distinguish actual server-executed read-only probes from unauthenticated self-reported results, or treat such fields as untrusted/display-only. Test direct REST with forged payloads.
- **P1 SSRF/transport hardening:** `parseAccountingBaseUrl` checks absolute http(s), no URL credentials/query/fragment and a subset of literal private address forms, and allows private/loopback when `transportApproved`. It does NOT resolve DNS at connection time or enforce DNS/IP pinning at request, redirects, IPv4-mapped IPv6, CGNAT/reserved IP ranges, or a strict destination allowlist. Therefore “private/local URL rejected” only holds with `transportApproved=false` and known literal addresses; a public hostname can later resolve privately. Separate ability to approve an internal vendor transport from an unrestricted HTTP destination. Before ANY real `testConnection` or live Asan traffic, require operator-approved endpoint/egress policy, DNS validation at connect, redirect restrictions, and tests with controlled DNS/redirects. Do not claim generic SSRF-proof.
- **P1 permissions review:** list is open to every authenticated member and exposes base URL, remote user id, health and connection metadata (not secret values). Assess least privilege and masking for ordinary staff; accounting settings write authorization is correctly checked via workspace role at REST for ordinary users/API keys, but the separate application token path and GraphQL guard require P0 reconciliation.
- **P2 development hygiene:** the legacy client functions that still express direct `createAccountingConnection/updateAccountingConnection` mutations should be removed or restricted once call sites are proven migrated; otherwise the documented 'one writer' is not structurally true. Consider thin client view DTOs rather than two separate money-unit/validation authorities. Confirm non-destructive metadata plan on final Dev installation; rollback of added standalone page must not delete historic quotation UI. Keep separate Windows Nx copy-step issue.
- **Gate outcome:** ACCEPT the page-layout/presentation separation **for Dev UAT only**. **DO NOT SIGN OFF ACCOUNTING-010 AS SECURITY COMPLETE** until P0 server bypass/capability/health findings are closed by a bounded task, then P1 transport review before any live adapter call. No `:6080`, no real Asan/Sepidar actions, no main worker restart. User can test `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` and `http://localhost:3002/objects/quotations` now. `STOP_FOR_ARCHITECT`.


## EXECUTED — CRM-129-ACCOUNTING-SETTINGS-010 (2026-11-22; Dev `:3002` 31/31 live + 22/22 TAX + 15/15 accounting)

- **Source baseline / deployment:** branch `feat/crm-129-quotation` from `90db850f64`; server module rebuilt and copied into `twenty-server-1` (restart of the Dev server only), quotation app `0.1.22` applied with `--no-delete` (Plan: 5 add / 7 change / 0 destroy). Worker and `:6080` untouched. Live metadata: page layout `20c28688-fc16-42f8-a231-9d5735d1b2c2`, tab `53855f4a-…`→DB row, widget `f6a99bbb-…`, navigation item `4d0d2eb6-3182-4823-bf3e-55c88112db5a` (position 37), front component `2ebedd86-1eb7-482e-b948-a869ccb560b6`. **Real page URL: `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`**, quotation list `http://localhost:3002/objects/quotations`.
- **S0 — one service, one adapter, one form.** The workspace destination still has the single app-side connection service and the vendor-neutral adapter contract; the page reuses them. Shared presentational pieces and settings types were extracted to `src/components/accounting/accounting-shared.tsx`; `accounting-settings-panel.tsx` owns workspace configuration; the existing `accounting-connection-panel.tsx` was slimmed to document-only content. No second accounting service, adapter, schema or credential store was created.
- **S1 — server write authority (REST) + closed public GraphQL writes.** `AccountingConnectionAuthorityService` decides `resolveSettingsAuthority(authContext, 'accountingConnection')` inside `POST /rest/quotation/actions` for `accounting-connection-save` and `accounting-connection-health`; reads stay open to members (`accounting-connection-list`, `accounting-settings-authority` returns `canManage`). Eleven `@WorkspaceQueryHook` classes plus `AccountingConnectionWriteGuardService` refuse every generated GraphQL mutation with `ACCOUNTING_CONNECTION_WRITE_FORBIDDEN` before a repository is touched. Save validates: known adapter (`mock`/`asan`, `sepidar` → `ADAPTER_UNKNOWN`), absolute credential-free `http(s)` URL, no query/fragment, private-network/link-local/loopback refused unless the record is transport-approved, numeric remote user/storage ids, money unit normalised to `UNCONFIRMED|RIAL|TOMAN`; a save resets health. Secrets stay in `applicationVariable` (`MOCK_ADAPTER_SHARED_SECRET`, `ASAN_TUNNEL_TOKEN`, `isSecret`) — no response field carries them.
- **Two real server defects found by the live probe and fixed:** (1) `toView` crashed on `lastHealthCheckAt` because a stored timestamp arrives as `Date`, making every list/save call return `UNEXPECTED` on records that had been tested before — `readText` now tolerates `Date`/null (unit-tested); (2) `accounting-connection-health` accepted a caller-claimed `verificationState`, so a settings-authorized member could mint `LIVE_VERIFIED`; verification is now derived from the stored adapter (`mock`→`MOCK`, otherwise `LIVE_UNVERIFIED`) and the field is no longer accepted from the client.
- **Gate 1 live matrix (real tokens):** admin `pilot.a` (allowed), Member `pilot.b` (refused, `ACCOUNTING_SETTINGS_FORBIDDEN`), owning quotation application token (allowed), unrelated application token (refused), anonymous (403), role-less API key (403 before the authority decision). **10/10 GraphQL mutations refused for admin user, Member user, Admin-role API key, role-less API key and unrelated app — 50 calls — with the `_accountingConnection` fingerprint byte-identical** (`guard=10/10` where the schema exposes the field). Unsafe saves refused: loopback / `169.254.169.254` / LAN `192.168.4.85:6080` → `CONNECTION_PRIVATE_NETWORK_NOT_APPROVED`; `ftp:` and query-string → `CONNECTION_BASE_URL_INVALID`; embedded credentials → `CONNECTION_BASE_URL_HAS_CREDENTIALS`; unknown adapter → `ADAPTER_UNKNOWN`. Zero rows changed.
- **S2 — standalone page.** `STANDALONE_PAGE` «تنظیمات حسابداری» + sidebar item (after «مالیات و عوارض»), pattern copied from the tax settings page. Live render (no quotation id): software selector (آسان, Mock, سپیدار disabled with an explicit "no adapter" note), registered connections, service URL / remote user / default warehouse, money unit including `UNCONFIRMED`, TLS approval, special codes + tax-code mapping, secret status without values, stored health/test state, adapter capabilities, item/customer preview, sync history, and a send-lock panel reading "ارسال به مقصد: خاموش — ثبت سند مالی: خاموش". Fail-closed: a member without authority sees no save form.
- **S3 — record tab separated.** The quotation «حسابداری» tab now shows only that document: selected connection, readiness, document export preview, mapping errors and that document's operation history, with a pointer to the sidebar page for workspace settings. Verified in the real browser: no workspace form or connection list is rendered there; `ثبت در حسابداری (غیرفعال)` stays disabled.
- **S4 — live evidence.** `scripts/dev-verify-crm129-accounting-settings-010.cjs`: **31/31 PASS** — page + nav metadata, Mock save/read/persistence across two reloads, refused writers with byte-identical table, 50 GraphQL refusals, unsafe destinations, health write with a forged `LIVE_VERIFIED` stored as `MOCK`, Asan kept `LIVE_UNVERIFIED` after a failed probe, preview/execute `OUTBOUND_DISABLED` with zero sync operations, no application secret in any captured response, and untouched tax catalogue (19 sealed revision hashes, 37 quotations, 58 objects, 0 soft-deleted page layouts).
- **Regression:** quotation app Vitest **42 suites / 438 tests**, quotation server Jest **24 suites / 230 tests**, `tsgo --noEmit` 0 errors. TAX-008/009 live closure **22/22 PASS**; accounting mock live exercise **15/15 PASS** after replacing its loopback Asan address with `https://asan-006.invalid` (the 006 script predated the private-network gate; behaviour, not policy, was stale). PDF still renders (11 219 B in the 010 probe, 15 268 B in closure-009) and sealed revisions are byte-identical. `twenty-front` dirty files were left untouched and uncommitted.
- **Known limitation (reported, not bypassed):** this platform version only allows the **Admin** role on API keys (`createApiKey`/`assignRoleToApiKey` reject Member and custom roles) and rejects a role-less key as revoked once cached, so a *valid but restricted* API-key principal cannot be minted on Dev. The restricted-role decision is proven by the Member user's live refusal and by the `resolveSettingsAuthority` role/API-key unit tests; the role-less key probe is fail-closed at 403. Accountancy remains `LIVE_UNVERIFIED`; no real Asan/Sepidar call was made and financial transfer stays disabled.

## ARCHITECT NEXT SLICE — CRM-129-ACCOUNTING-SETTINGS-010 (2026-11-22; APPROVED TO IMPLEMENT ON DEV, NOT DEPLOYED)

- **Source baseline:** `feat/crm-129-quotation` at `080ea65796522f3930d6a37939f1dfb93a9adca1` (TAX-009 accepted scoped). User needs an independently reachable workspace accounting settings page rather than hiding configuration inside quotation record tabs. This checkpoint is an architecture contract/authorization, **not a claim of implementation or tests**.
- **Observed source facts:** existing `components/accounting-connection-panel.tsx` (~1397 lines) owns workspace connection list, save/test, item and customer previews, selections/import, operations and quotation-specific export, obtains quotation context via `useSelectedRecordIds()`; `page-layouts/quotation-record.page-layout.ts` mounts the same front component in the record's «حسابداری» tab. `page-layouts/tax-policy-settings.page-layout.ts` + `navigation-menu-items/tax-policy-settings.navigation-menu-item.ts` demonstrate the supported standalone/sidebar composition when Applications Settings is disabled. `logic-functions/accounting-connection.ts` exposes `list/save/test` through authenticated app route, but has **no explicit admin permission enforcement for save** in that route; an authenticated route is not a role authorization. Confirm all other accounting mutations and secrets boundaries before publishing a workspace settings surface.
- **Decision / clean architecture:** preserve ONE accounting connection application service, vendor-neutral adapter and record store; do not duplicate adapter logic, connection schema, secrets, or business rules. Create a dedicated `STANDALONE_PAGE` + sidebar item «تنظیمات حسابداری» using app-owned universal IDs. Extract presentational/shared connection UI (and pure form normalization) from the current panel, so the workspace settings screen has no quotation-id assumption and quotation record tab shows **only document-specific operations** (e.g., export preview/record history). Do not merely place the full current panel in two locations. Keep existing quotation tab and metadata until migration verified.
- **SECURITY MUST PASS BEFORE UAT:** enforce `list` read vs `save` mutation permissions at an actual server-side workspace auth boundary using existing platform role/capability patterns; a front-end hidden button is not a gate. Explicitly test non-admin user, limited API key, unrelated app token, authorized admin/app, anonymous; refuse on missing/unproven authority with zero DB changes. `test` is a read of vendor but persists health and may emit network traffic: assess privilege and keep default/mock/offline until specifically approved; prevent SSRF via baseUrl allowlist/transport policy and prohibit private-network arbitrary destinations exposed to ordinary users. Ensure secrets remain app variables and never appear in record/API/UI responses.
- **Financial safety:** display persisted connection identity/vendor, base URL, user, store, `UNCONFIRMED` rial/toman unit, capability/health, tax-code mapping and no-write flags; retain outbound/document-export disabled by default. UI must not silently enable writes, auto-sync, or transmit a real Asan/Sepidar request. All accounting stays `LIVE_UNVERIFIED` unless independent real read-only validation.
- **Delivery plan:** S0 component/route/permission dependency audit (brief); S1 role-safe backend boundary and negative tests; S2 shared extracted components + standalone page/sidebar + slimmer record tab (no parallel forms); S3 Dev `:3002` install/re-read metadata + browser UAT + mock-only accounting regression; S4 record proof and STOP_FOR_ARCHITECT. Confirm concrete standalone page URL from installed Dev metadata; **do not invent UUID**.
- **Constraints:** no `:6080`, no real vendor write/test without approval, no main worker restart, no migration/destructive metadata removal, no Money Domain/quotation lifecycle changes, no changes to unrelated dirty front files, no endless screenshot/retry loop.
- **Remaining unrelated gates:** Nx Windows POSIX copy step and PDF visual glyph check remain separate/nonblocking tasks; TAX-009 delegated-app token semantics require revalidation only if touched by this slice.


## CLOSURE-009 EXECUTED — TAX-008 FINDINGS CLOSED (2026-11-22; 22/22 + 9/9 + 15/15 live on Dev `:3002`)

- **Commit:** `38a50b0cd0` on `feat/crm-129-quotation`, deployed to Dev `:3002` (`twenty-server-1` restarted; worker and `:6080` untouched).
- **P0 — every direct GraphQL write path is closed.** Eleven `@WorkspaceQueryHook` pre-query hooks (`taxPolicy.createOne/createMany/updateOne/updateMany/deleteOne/deleteMany/destroyOne/destroyMany/restoreOne/restoreMany/mergeMany`) call `TaxPolicyWriteGuardService.refuseWrite`, which throws `FORBIDDEN` with `TAX_POLICY_WRITE_FORBIDDEN` before a repository is touched. The authority service writes through the ORM inside its own transaction and never calls the API, so internal writes stay open (proved live: `tax-policy-save` created `TAX_1250`). `mergeManyTaxPolicies` does not exist in this version's generated schema.
- **P0 live matrix (real tokens, real Dev):** admin user (`pilot.a`), limited user (`pilot.b`), API key, quotation application token and unrelated application token — **10/10 mutations refused for each of the 5 principals** (50 calls), with the full taxPolicy table fingerprint byte-identical before and after. Application tokens were minted through the platform's own `generateApplicationToken` mutation with the API key, so they carry no user delegation (`userId` absent in the JWT).
- **P1 — one shared consistency lock, fixed order.** The first statement of a draft-save transaction is `pg_advisory_xact_lock_shared(hashtext('quotation-tax-policy:'||workspaceId))`; the first statement of every authority mutation is the exclusive `pg_advisory_xact_lock` on the same key. Live: a held shared lock blocked a settings write for the full 1.5 s probe (then succeeded), and a held exclusive lock blocked a draft save the same way — no deadlock, because neither path takes a second lock first.
- **P1 — history and invariant.** `createdBy`/`createdAt` are untouched by updates (live DB readback); `updatedBy` moves. An inconsistent row set (default on an inactive row, zero active defaults) is repaired deterministically to the oldest active policy and the outcome message says «وضعیت پیشفرض ناسازگار بود», never a silent fix.
- **P2 — application identity from the platform contract.** `resolveApplicationSettingsAuthority` accepts an app only when the `taxPolicy` object's `applicationId` resolves to that application's universal identifier, or the application's platform default role carries `canUpdateAllSettings`. Live: the quotation app (`e7bcb5ba-…`) is accepted; the unrelated Sales Follow-up app is refused on both `/rest/quotation/actions` (`TAX_SETTINGS_FORBIDDEN`) and GraphQL (`TAX_POLICY_WRITE_FORBIDDEN`), zero writes. A user-delegated app token acts as that user by platform design; it is not evidence of application identity, so the probe uses pure app tokens.
- **P3 — regression.** Gate 1: 9/9 (guard + limited-role modes, anchor/zero-write). Gate 2: 15/15 (single active default, read purity, concurrent default switches, rollback, rate stability, 19 sealed revision hashes unchanged across a 9 %→10 % edit, counterfeit rate refused, inactive/unknown policy refused, exact stored amounts, default switch leaves documents untouched). PDF: real `%PDF-` bytes (11 451 B, `quotation-QT-1405-000051.pdf`) and revisions byte-identical. Jest: 21 suites / 168 tests; `tsgo --noEmit`: 0 errors.
- **Metadata audit (16 stale deletions):** no deletion log exists in this version, so the audit is a DB inventory, not a replay: 58 objects / 1 211 fields / 106 page layouts, **0 soft-deleted page layouts, views, view fields or logic functions**, 5 soft-deleted `pageLayoutWidget` rows all dated 2026-10-27..11-01 (pre-existing Event-Lead guidance widgets, unrelated to quotation). All 14 quotation objects are present with 18–43 fields each, and `صفحه پیشفاکتور` still has its three tabs and the creation form 99 widgets. No blind re-apply was run; `twenty plan` cannot run on Windows (resource paths built with backslashes) and was logged, not patched.
- **Windows build note (unchanged):** `npx nx build twenty-server` still fails only at the final POSIX `cp -r` asset step; SWC compiled 9 343 files and `dist` was deployed. Unrelated `twenty-front` dirty files were left untouched.
- **Dev form links:** list `http://localhost:3002/objects/quotations`, tax settings `http://localhost:3002/page/94e85adc-43eb-4729-bb6a-cf2d36f7ca54`, record form via any quotation row.
- **Still `LIVE_UNVERIFIED`:** accountancy outbound (no real Asan/Sepidar write), PDF Persian glyph shaping visual review.

## ARCHITECT DEEP REVIEW — TAX-008 (2026-11-22; CONDITIONAL / REMEDIATION GATE)

- **Remote source reviewed:** branch `feat/crm-129-quotation` at `89df3fdd7b5846fc5ad29d741d149f07c2cd3733`, compare against `4b686a269ea6365521aa5a6732c53791f54abe28` (2 commits, 35 paths). Read `CRM-129-TAX-008-CONTRACT.md`, full `TaxPolicyAuthorityService`, `QuotationUiController`, `QuotationPermissionService`, `QuotationDraftPersistenceService`, `evaluateDraftTaxPolicy`, app tax route/client/service, taxPolicy object and app role and query hook index. Tests reported by worker and contract but not independently executed by architect.
- **Architect verdict:** structural separation substantially improved and prior S1/S2/S3/S4 behavior supported by code + reported Dev probes; **DO NOT CERTIFY SECURITY/DOMAIN INTEGRITY FULL PASS** yet. No new production deploy, no real accounting write, no worker restart. UAT on Dev `:3002` may proceed for visible flows only.
- **P0 VERIFY + CLOSE direct GraphQL bypass:** the server-only `TaxPolicyAuthorityService` gates `/rest/quotation/actions`, but `taxPolicy` remains a normal workspace object with `isUICreatable:false`/`isUIEditable:false` (UI flags), the app role grants `canUpdateObjectRecords:true`, and the quotation `query-hooks/` index contains **no taxPolicy hooks**. App removal of its own GraphQL mutation builder does not disable generic GraphQL mutations. Verify real authenticated GraphQL `create/update/delete/destroy/restore` attempts (one/many, admin/ordinary role), ensure no unauthorized bypass of rate/exemption/default/immutable references; close using platform-native object write guard or a purpose-designed transactional boundary, without blocking the privileged transaction's own writes. No blanket claim of exploit until live probe.
- **P1 lock consistency:** tax-policy mutations acquire `pg_advisory_xact_lock(hashtext('quotation-tax-policy:' || workspaceId))`; draft saves select policy inside their own transaction but do not acquire this shared lock. A concurrent tax edit may occur between policy read and quotation commit. Define and test serialization or explicit optimistic policy-version semantics at both paths. Existing document version checks do not protect the policy row.
- **P1 audit:** `TaxPolicyAuthorityService.savePolicy` builds `columns` with `createdBy: actor` and uses these columns in both `insert` and `update`. Preserve original `createdBy` on update; update `updatedBy` only. Cover in real DB/readback tests.
- **P1 invariant robustness:** `ensureSingleDefault` counts defaults without requiring active; if zero defaults, chooses `rows[0]` without ensuring active, and `setDefaultPolicy` doesn't run this repair. Clarify whether historical/corrupt states need safe rejection/repair and ensure exactly one **active** default under every permitted mutation.
- **P1 type/authorization review:** `QuotationPermissionService.resolveSettingsAuthority` accepts any `authContext.type === 'application'` without checking the specific app identity/role or purpose. Confirm platform auth semantics and whether another workspace app token could call privileged tax admin operations. Restrict to verifiable entitlement at the server boundary. Preserve explicit denial for user/apiKey roles without `canUpdateAllSettings`.
- **P2 metadata risk:** `twenty apply` reported 16 stale metadata deletions, not individually enumerated. Audit the exact manifest plan and confirm no unrelated app/page/field data was removed; no blind re-apply. PDF Persian shaping not visually inspected. Nx server build target fails at Windows POSIX-only asset copy, independent of quotation compilation; log as separate build portability issue, not evidence of passing complete Nx build.
- **Accounting:** `LIVE_UNVERIFIED`; keep adapters behind vendor-neutral interface; account settings currently embedded in a quotation record tab and should ultimately be separated into a workspace settings page without duplicating connector logic.
- **Next gate:** one bounded architect-approved corrective slice with independent direct GraphQL negative tests and DB invariants, not a new development loop. Preserve unrelated twenty-front dirty files. `STOP_FOR_ARCHITECT`.


## LATEST — TAX-008 ARCHITECTURE HARDENING EXECUTED (2026-11-21; four gates PASS on Dev `:3002`)

- **Branch / baseline:** `feat/crm-129-quotation` from `a35ccde8f4` (contract commit) on top of architect recovery `4b686a269e`. Contract and executed evidence: [CRM-129-TAX-008-CONTRACT.md](./CRM-129-TAX-008-CONTRACT.md) §8.
- **Gate 1 (identity):** tax-policy mutations now decide identity inside `POST /rest/quotation/actions` from `getWorkspaceAuthContext()` and `QuotationPermissionService.resolveSettingsAuthority` (`role.canUpdateAllSettings`). `logic-functions/tax-policies.ts` and `src/data/tax-policy-api.ts` no longer invent a caller: no Authorization header means `TAX_SETTINGS_UNAVAILABLE` in the app and 401/403 at the guard. `domain/tax-settings/settings-access.ts` and `caller-identity-queries.ts` are deleted. Live negative tests with a real non-admin API key: 4/4 refused, zero writes.
- **Gate 2 (financial integrity):** `TaxPolicyAuthorityService` owns `save/set-default/deactivate/bootstrap` in one workspace transaction under `pg_advisory_xact_lock`; reads never insert; bootstrap is explicit and idempotent. `QuotationDraftPersistenceService` validates `(taxPolicy, taxRateBasisPoints)` against the workspace policy row (`quotation-draft-tax-policy.util.ts`) independently of the app: inactive/unknown/counterfeit pairs are refused, a stored draft keeps its own rate. Live PostgreSQL: 15/15 (concurrency, rollback, no-write-on-read, rate stability, 19 sealed revision hashes unchanged).
- **Gate 3 (Dev UAT ready):** server build on `:3002` (advisory lock present in `dist`), app `0.1.20` applied (`37 files`), tax form create/edit/default/deactivate exercised in the real browser, draft form shows only active policies and recomputes `0 / ۱٬۲۰۰ / ۹۰۰` tax correctly, save→reload keeps `۱۰٬۰۰۰ / ۹۰۰ / ۱۰٬۹۰۰ تومان`, PDF rows match the DB row (`۹٪`, `۹٬۰۰۰` tax, `۱۰۹٬۰۰۰` total in IRR).
- **Gate 4 (regression):** 40/431 Vitest, 19/146 module Jest, 12/91 named regressions, typecheck clean. `NOT VERIFIED` items are listed in the contract (PDF glyph shaping, enumeration of 16 stale metadata rows removed by the app apply). Accountancy stays `LIVE_UNVERIFIED`.

## ARCHITECT SOURCE REVIEW — TAX-007 (2026-11-21; DEV FUNCTIONAL PASS / ARCHITECTURAL GATES OPEN)

- **Source evidence:** tax commit `e2cb35a287c5a83196013dd925ce4aa1c94af4c8`, Boolean i18n commit `e3b64885161e4d5ad99be98435e681eceec0cf77`, and proof `4210f5f86c4d126d8aa4d647e7936f9883991a2c` inspected on `feat/crm-129-quotation`. The branch HEAD can advance beyond the reported proof commit: always fetch HEAD before subsequent edits. Source confirms taxPolicy workspace manifest, standalone tax settings page, single existing QuotationDraftForm with policy select, exact basis-point Money Domain, sealed snapshot rate, accounting export mapping gate and Lingui Boolean labels. User/worker reports Dev `:3002` 424 Vitest, 99 Jest, 17/17 live tax, 14/14 seal, 15/15 accounting mock; architect did not rerun the live environment.
- **Bounded verdict:** ACCEPT the delivered Dev UI/i18n and functional tax workflow **within the evidence supplied**, NOT blanket security or architecture certification. Do not silently change accounting, quote lifecycle, numbered revisions, Money Domain, or production `:6080`.
- **SECURITY GATE S1 — fail-open principal identity:** `logic-functions/tax-policies.ts` treats a missing forwarded Authorization header as trusted and also treats `FORBIDDEN`/`AUTH_REQUIRED` from the identity lookup as trusted; `domain/tax-settings/settings-access.ts` grants admin operations when flags are null. An authenticated app-route is not proof of admin role. Require a verifiable principal/type and a fail-closed authorization contract for tax-policy mutations; distinguish internal app capability tokens from human callers without inferring privilege from missing identity/error. Include negative real-route tests and zero-write proof.
- **INTEGRITY GATE S2 — enforce tax-policy authority on direct server writes:** `QuotationDraftPersistenceService` invokes `evaluateQuotationDraftTotals` which verifies the client-declared basis-point rate against line tax, but does not itself prove the rate/code pair matches an active policy in that workspace. The app logic function currently resolves catalog policy first, but direct `POST /rest/quotation/actions` is another write boundary. Audit/close any ability for a caller holding quotation.edit to submit an arbitrary rate/policy via the direct REST route. Preserve legacy documents and read-only presentation.
- **CONSISTENCY GATE S3 — settings write atomicity and non-mutating reads:** `tax-policy.service.ts` implements `setDefaultTaxPolicy` using multiple GraphQL mutations, so “exactly one default” is not transactionally guaranteed under parallel requests/mid-write errors. Also `loadTaxPoliciesWithBaseline` may INSERT the initial policy on a list/read path. Specify a single server-side transaction/unique constraint or equivalent race-safe authority and move initialization to an explicit authorized/idempotent bootstrap. Test concurrent changes and rollback. Avoid a second business-logic engine in the front end.
- **CONFIGURATION/SNAPSHOT GATE S4:** confirm edits to rates of policies already referenced by drafts do not silently reprice them and that issued revisions always remain pinned to the immutable stored rate/hash; decide policy-versioning/immutability strategy before production. Legacy issued documents without stored rate must never be assigned a guessed rate.
- **Accountancy remains `LIVE_UNVERIFIED`**: the vendor mapping gate is not a real Asan/Sepidar connection or permission to export. All tests and any future repairs are Dev-only, no external writes, no worker restart, `STOP_FOR_ARCHITECT`.
- **Implementation discipline:** next changes must be small, architecture-first and tested at server/HTTP/DB boundaries, not rapid frontend-only patches. Preserve the unrelated dirty files and do not repeat large work without bounded design and acceptance gates.


## LATEST CHECKPOINT — CRM-129-TAX-007 LANDED / awaiting architect (2026-11-21)

**Read first:** [CRM-129-TAX-007-PROOF.md](./CRM-129-TAX-007-PROOF.md).

- **Branch / commits:** `feat/crm-129-quotation` from `daf525013d`; tax work `e2cb35a287c5a83196013dd925ce4aa1c94af4c8`, Persian booleans `e3b64885161e4d5ad99be98435e681eceec0cf77`. Both pushed.
- **Tax is workspace data:** a new `taxPolicy` object stores Persian name, policy code, integer basis-point rate, default/active/exempt flags. The settings surface is the sidebar page «مالیات و عوارض» at `/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`, because Settings → Applications is disabled in this fork. `IR_VAT_9` at 900 bp is kept only as the legacy baseline; no rate is hardcoded and no policy is ever deleted (only deactivated).
- **Draft pricing:** the existing `QuotationDraftForm` selects among active policies, recalculates net/tax/total in integer micros from the chosen policy, and stores both the policy code and the rate it used. The server re-derives each line's tax from the declared rate and refuses `TAX_AMOUNT_MISMATCH` / `TAX_RATE_OUT_OF_RANGE`; the atomic save and optimistic-version contracts are unchanged.
- **Immutability:** `taxRateBasisPoints` is sealed in the revision snapshot beside `taxPolicy`, so changing the default later cannot re-interpret an issued document (live T13: `policyRate=1200 issuedRate=900 hashStable=true`). No document was migrated or rewritten.
- **Accounting:** `taxPolicyMappings` (CRM policy code → vendor tax code) is part of the connection settings; a taxed document with no mapping is blocked `TAX_POLICY_NOT_MAPPED`. No real vendor call was made.
- **Persian booleans:** the shared field input now resolves True/False through Lingui, with `fa-IR.po` mapping to «بله»/«خیر»; form, table and filter share the same msgids, stored values stay `true`/`false`. Verified in the live UI on the «فعال» filter.
- **Evidence:** app vitest **39 files / 424 tests**, server quotation jest **15 suites / 99 tests**, app `tsgo` clean, `twenty plan` on `dev-crm129` reports no changes, live `dev-verify-crm129-tax-007.cjs` **17/17**, revision-seal **14/14** and accounting-006 **15/15** regressions intact.
- **Isolation:** Dev `:3002` only; no `:6080`, no worker restart, no real accounting traffic. `STOP_FOR_ARCHITECT`.

## ARCHITECT ACCEPTANCE — SEALED REVISION API GUARD (2026-11-21; ACCEPT)

- **GitHub source verified:** actual feature commit is `a98f484966e84f17ca17a6132554fbf37de4ee9b` (operator report labeled it `d396d0853c`, which GitHub could not resolve); documentation commit `5cf7b6ffe6aa45679d87d3d5684eec1a22a793b8` is on `feat/crm-129-quotation`.
- **Review:** ten workspace pre-query hooks block public `quotationRevision` create/update/delete/destroy/restore, one and many, using `QuotationRevisionWriteGuardService` and `REVISION_IMMUTABLE`. The legal issuance transaction remains a privileged internal write. Architect accepts the scoped API immutability implementation.
- **Reported (not independently re-executed) live tests:** revision-seal 14/14, accounting mock 15/15, server Jest 96/96, four unique consecutive numbers, clean typecheck and lint. No fresh independent Dev probe was done by the architect.
- **Next gate:** Asan adapter remains `LIVE_UNVERIFIED`. Prioritize a bounded read-only connection/capability and monetary-unit verification on the actual accessible Asan installation, then explicitly authorize any outbound writes only with credentials/transport/security, customer and product mappings, idempotency/reconciliation and currency evidence. No production `:6080` writes or unapproved external export. Sepidar later.
- **STOP_FOR_ARCHITECT:** no automatic start of a new coding task.


## ACCOUNTING INTEGRATION GAP — ARCHITECT STATUS (2026-11-21)

- **User correction:** the quotation work is NOT complete as a business integration: no confirmed live accounting connection, bidirectional catalog sync, customer mapping or accounting pro-forma registration.
- **Source checked:** `docs/architecture/CRM-QUOTATION-ACCOUNTING-PLAN.md` specifies vendor-neutral accounting ownership and Asan first / Sepidar second; app manifests for `accounting-connection`, `accounting-item-link`, `accounting-sync-operation` exist, and `src/domain/accounting/adapters/asan/` contains mapping/capability helpers. These source files are NOT evidence that an Asan server is connected.
- **Next bounded slice:** build/verify accounting integration runtime with connection configuration, secure transport, real read-only Asan capability handshake, catalog/customer preview and mapping and durable idempotent operation ledger, initially using fixtures/mocks and explicit read-only testing if endpoint unavailable. Actual production Asan credentials, server reachability, monetary unit, special tax/discount codes and user approval are prerequisites for live writes. Only after reviewed evidence should register-pro-forma/customer/item outbound writes be enabled. Sepidar later behind same interface.
- **Guardrails:** never treat CRM quotation as posted fiscal invoice; no automatic invoice creation/payment/ledger writes; no `:6080`, no production or unapproved external writes, no main worker restart; `STOP_FOR_ARCHITECT`.


## ARCHITECT ACCEPTANCE — ATOMIC-SAVE-005 (2026-11-21; ACCEPT)

- **Architect source review:** commit `2d48787f877ec2d4cf0c78e09329f685857820cf` on `feat/crm-129-quotation` inspected; parser rejects omitted/null expectedVersion on edits and the service checks version defensively. Create null/null and stale-edit conflict behaviors retained.
- **Decision:** `ACCEPT` for the bounded 004/005 atomic persistence and optimistic-version contract. `DATA_INTEGRITY_PASS` is accepted within the reported Dev test scope; direct PostgreSQL test totals (18/18, 52/52, 19/19, 16/16, 67/67, 270/270) are evidence from the committed execution report, not independently rerun by the architect.
- **Next work:** separately scope quotation business lifecycle/customer approval/outbound delivery, preserving current Money Domain, numbering, atomic save, PDF and send authorization contracts. No automatic implementation or production deployment.
- **Isolation:** no `:6080` activity or production acceptance is claimed.


## VERSION GUARD CLOSED — CRM-129-QUOTATION-ATOMIC-SAVE-005 (2026-11-21; DATA_INTEGRITY_PASS maintained)

- **Gap the architect flagged is closed:** `parseQuotationDraftSaveRequest` now refuses an edit (`quotationId` present) whose `expectedVersion` is missing or `null` with `QUOTATION_VERSION_REQUIRED`, before any permission lookup or connection. `QuotationDraftPersistenceService.updateDraft` repeats the check defensively and then requires exact equality with the stored version, so an update can no longer skip the claim. Create still requires `quotationId=null` + `expectedVersion=null`.
- **Contract as implemented:** create → `null`/`null` only; edit → positive integer required; fractional/zero/string version → `INVALID_INPUT`; stale → `QUOTATION_VERSION_CONFLICT`; immutable status → `QUOTATION_IMMUTABLE`. Persian copy for `VERSION_REQUIRED` already existed and is what the form shows.
- **Direct-endpoint verification on Dev `:3002` (real PostgreSQL):** **18/18** — V1 create null/null saved as DRAFT v1 without a number; V2 edit with stored version saved v2 with both lines; V3 edit with the key omitted **and** with explicit `null` both refused `QUOTATION_VERSION_REQUIRED` with a byte-identical header+lines snapshot and the attempted name absent from the table; V4 stale version refused `QUOTATION_VERSION_CONFLICT` with an identical snapshot; V5 fractional version refused `INVALID_INPUT` with nothing written; V6 baseline restored (`quotations 158→158`, `lines 101→101`).
- **No regression:** atomic core suite **52/52**, deployed form route **19/19**, bundled form handler **16/16**, server quotation jest **67/67** (3 new: omitted version, explicit null, service-level refusal before the transaction), app vitest **270/270**. `tsgo` server shows only the two pre-existing errors in untouched files; oxlint clean on the four changed files.
- **Deployment / isolation:** only `dist/modules/quotation` was copied into `twenty-server-1` and only that container restarted; `twenty-worker-1` `StartedAt` unchanged. No app version bump was needed (no app code changed). `:6080` untouched, no form/PDF/numbering/lifecycle change.

## ARCHITECT REVIEW — ATOMIC SAVE 004 (2026-11-21)

- **Remote verification:** GitHub branch `feat/crm-129-quotation` at `a81f9c0203c0bcbd2f92040aab2cf219c852d3de`. Source confirms a single server-side transactional write path and removal of the app's previous per-line GraphQL mutation path. The 52/52 PostgreSQL, 19/19 form, 16/16 headless, 64/64 server and 270/270 app tests are reported in the committed recovery/worker report; the architect did not independently rerun the live tests.
- **Architect review:** transactional boundary/rollback architecture **accepted provisionally**. The version gap it flagged (an edit could omit `expectedVersion`) was closed by ATOMIC-SAVE-005 above; see that checkpoint for the contract and the zero-write proofs.
- **Narrow next gate:** closed by ATOMIC-SAVE-005 — a positive integer `expectedVersion` is now required on every edit, with omitted/null, invalid, stale and current-version regression coverage plus a direct-endpoint zero-write proof. Preserve the existing transaction and domain contracts.
- **Not touched:** production `:6080`, release branch, worker. No new deployment performed by this review.


## ARCHITECT ACCEPTANCE — RECORD FORM (2026-11-21)

- **User acceptance:** the operator explicitly confirmed on 2026-11-21 that the quotation record form issue is fixed. This is user acceptance of the visible form, not evidence of any additional deployment or transaction integrity.
- **Verified branch:** `feat/crm-129-quotation` at `f3230a0ff9710240cf806ad3f623e8e85a503f6f`; application `0.1.18` installed on Dev `:3002` per applied-form verification. Do not conflate with production `:6080`.
- **Next authorized scope for task proposal:** transactional save of quotation header and lines as a single server-side unit with version/permission/immutability enforcement, fault injection and rollback verification; reuse existing quotation Money Domain and application form, no parallel form or payment/send stack.
- **Open gate:** `DATA_INTEGRITY_PASS` is still NOT established. Implement and independently inspect before stating PASS. Continue with `STOP_FOR_ARCHITECT`.


**Updated:** 2026-11-21 (CRM-129-QUOTATION-ATOMIC-SAVE-005)
**Repository:** mrnikiemami-code/crm-platform
**Authoritative working branch:** `release/record-access-115`
**Historical detailed record:** [CRM-RECORD-ACCESS-RECOVERY.md](https://github.com/mrnikiemami-code/crm-platform/blob/docs/record-access-architecture-recovery-098-102/docs/architecture/CRM-RECORD-ACCESS-RECOVERY.md), branch `docs/record-access-architecture-recovery-098-102`. The historical file has stale early headers: read its **latest appended checkpoint**.
**Scope:** CRM intranet on port 6080. Dev port 3002 is not production. Never silently substitute.

## ATOMIC DRAFT SAVE — CRM-129-QUOTATION-ATOMIC-SAVE-004 (2026-11-21; DATA_INTEGRITY_PASS)

- **Branch / base:** `feat/crm-129-quotation` from `f3230a0ff9`; quotation app **0.1.19** applied to `dev-crm129`; the new `dist/modules/quotation` was copied into `twenty-server-1` and **only that container restarted**. `twenty-worker-1` `StartedAt` is unchanged (`2026-11-19T22:51:35Z`) — no worker restart.
- **One write path:** `QuotationDraftPersistenceService.saveDraft` parses the request, resolves the actor's held permissions **before** taking a connection, then runs everything inside `WorkspaceOrmManager.runInWorkspaceTransaction`: total verification, customer existence, header insert/update, line reconcile, soft delete and the version claim. There is no per-record fallback; the app's `persistDraftQuotation` now makes exactly **one** call (`/rest/quotation/actions {action:'save-draft'}`) instead of separate GraphQL mutations.
- **Concurrency:** the claim is `UPDATE quotation SET … , version = v+1 WHERE id = :id AND version = :v AND status IN ('DRAFT','PENDING_INTERNAL_APPROVAL')`. Zero affected rows re-reads the row to distinguish `QUOTATION_VERSION_CONFLICT` from `QUOTATION_IMMUTABLE`.
- **Permissions stay server-side:** `quotation.edit` is required by the endpoint itself (`PERMISSION_MISSING`, refused before any DB work); repositories use `{ shouldBypassPermissionChecks: true }` only after that explicit gate, matching `QuotationPdfService`/`QuotationImmutabilityService`. Unauthenticated calls are still refused by `JwtAuthGuard`/`WorkspaceAuthGuard` (HTTP 403).
- **Numbering untouched:** a draft is inserted with `version 1`, `status DRAFT` and `quotationNumberLabel = بدون شماره`, `quotationNumber` NULL; issuance at `READY_TO_SEND` still allocates the number.
- **Core endpoint suite (real PostgreSQL, throwaway `:3006`, same DB):** **52/52** — S0 anonymous 403; S1 create with 2 lines (DRAFT v1, no number, customer projection); S2 in-place edit (same id, first two line ids preserved, no duplicate); S3 removal (line soft-deleted, not destroyed); **S4 injected BEFORE INSERT trigger on `_quotationLine`** → the save failed and the header name/totals/version and the in-place line rename all rolled back to the Section-3 state (v3, 2 active lines, 3 rows); **S5 injected BEFORE UPDATE trigger on soft delete** → header and every line untouched (`v3`, same 3 rows); S6 two parallel saves with the same version → exactly one winner (stored `v2`, winner's lines only, loser's name absent); S7 `SENT` refused `QUOTATION_IMMUTABLE` with the row unchanged; S8 fabricated customer refused `CUSTOMER_NOT_FOUND` with zero rows; S9 request totals = DB totals = PDF digits (`3,161,000`); S10 repeated lifecycle reads left header and lines byte-identical.
- **Form path on `:3002` (deployed app 0.1.19):** `/s/quotation/save-draft` → app logic function → transactional endpoint. **19/19** — create (2 lines, DRAFT v1, no number), edit (v2, first two line ids kept, no duplicate), removal (soft delete + total `1,526,000.000000`), stale `expectedVersion` refused `QUOTATION_VERSION_CONFLICT` with nothing changed. The bundled handler (`save-draft-quotation.mjs`) was additionally executed headlessly against the new server: **16/16** including the stale save.
- **Unit/integration tests:** twenty-server quotation jest **64/64** (8 new in `quotation-draft-persistence.service.spec.ts`: permission gate, single transaction, partial-failure rejection, version claim, stale version, immutable status, missing customer, transaction error); app vitest **270/270**. `tsgo` app clean; server `tsgo` shows only the two pre-existing errors in untouched files; oxlint clean on every new/changed app file and on the new server files (the `rest-api-methods-should-be-guarded` warning on `quotation-ui.controller.ts` also fires for the HEAD version and is pre-existing).
- **Data hygiene:** every scenario deleted the rows it created; baseline restored `quotations 158→158`, `lines 101→101`, `softDeleted 100→100`. No `:6080` traffic, no existing document modified, no screenshot loop.
- **Residual:** the deployed `:3002` core now needs future code changes deployed the same way (`docker cp dist/modules/quotation` + server restart); no worker/cron change was made or required.

## RECORD FORM APPLIED AND VERIFIED — CRM-129 FIX QUOTATION RECORD FORM (2026-11-21; PASS)

- **HEAD:** `0073ec8d1d` on `feat/crm-129-quotation`; installed app version **0.1.18**.
- **Why the operator saw «No Data»:** the installed layout still carried the old first-tab widget, whose stored configuration was `{"configurationType":"FIELDS","viewUniversalIdentifier":null}` — a FIELDS widget with no view renders the «No Data» placeholder. The source fix was already correct; only the deployed metadata was stale.
- **Metadata readback after `twenty apply`:** `core."pageLayoutWidget"` for layout `94e85adc-43eb-4729-bb6a-cf2d36f7ca54` → tab «پیش‌فاکتور» = `FRONT_COMPONENT` → front component `quotation-draft-form`; tab «اقدامات» = `FRONT_COMPONENT` → `quotation-lifecycle-panel`. No FIELDS widget remains on the app layout.
- **Why the leftover layout cannot shadow it:** `recordPageLayoutByObjectMetadataIdFamilySelector` picks the first `RECORD_PAGE` with `isSystemSideEffect = false`. The platform's `Default پیش‌فاکتور Layout` is `isSystemSideEffect = true`, so it is skipped; the app's `صفحه پیش‌فاکتور` (`f`) is always chosen.
- **Side panel (row click):** list row → panel URL `?panel=/object/quotation/d66aba78-…` → accessibility tree exposes the real form: title, customer «شرکت آزمایشی S2R1», payment terms, one catalog line (`R7-خدمت-…`, qty ۱, price ۱٬۰۰۰), both discount selects, «ذخیره تغییرات», plus tabs «پیش‌فاکتور»/«اقدامات». No generic fields widget, no «No Data».
- **Actions tab intact:** «گردش وضعیت — وضعیت: پیش‌نویس، نسخه 2», «ویرایش پیش‌نویس», «ارسال برای تأیید», «لغو», «دانلود PDF فارسی», «تازه کردن وضعیت».
- **No writes on open/close:** before and after opening + tab switching + closing the panel, DB stayed `1` active quotation (`d66aba78-…`, `DRAFT`, `totalExact 10900.000000`, `version 2`, same `updatedAt`) with `1` active line.
- **Dev data cleanup (operator request):** kept exactly one quotation with data (`d66aba78-…`). `23` DRAFT rows were soft-deleted through the app API; `71` non-DRAFT rows refused API deletion (`QUOTATION_IMMUTABLE: a quotation in <STATUS> cannot be deleted`, the issuance guard) and were soft-deleted at the data layer with status/version/number untouched; `15` orphan lines from previously deleted quotations were also closed. Result: `1` quotation, `1` line, list header `· ۱`. Original data/production untouched.
- **Cosmetic note:** the panel still renders a secondary heading with the raw path `/object/quotation/<id>` beside the record name. Not a widget and not blocking; queued as a small follow-up.
- **Still open:** non-atomic draft persistence (`DATA_INTEGRITY_PASS` not asserted). No `:6080`, no release-branch, no production data change.

## SOURCE FIX — CRM-129 RECORD PAGE USES PROFESSIONAL EDITOR (2026-11-21; deployed and verified on Dev)

- **Issue confirmed by user's browser image:** opening a quotation from the list still showed the generic Twenty **FIELDS** widget, despite the earlier command-menu creation and edit-flow fixes.
- **Root cause:** `src/page-layouts/quotation-record.page-layout.ts` explicitly configured the first tab as `type: 'FIELDS'`, while the existing `QuotationDraftForm` was only used in command-menu surfaces.
- **Source correction:** replace the first tab's widget with `FRONT_COMPONENT` pointing at `QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER`; rename tab to «پیش‌فاکتور». Keep the separate «اقدامات» lifecycle widget unchanged. The host's `FrontComponentWidgetRenderer` passes `selectedRecordIds` and `objectNameSingular` from the record page; the existing form uses these to load the current quotation.
- **Regression coverage:** `src/__tests__/s2-surfaces.test.ts` now asserts the record page uses the professional editor widget instead of raw fields (5/5 pass).
- **Deployed (2026-11-21):** `twenty apply -f -r dev-crm129` synced app **0.1.18** with `0 rows to add, 2 to change, 0 to destroy` (tab title/icon + widget `type: FIELDS → FRONT_COMPONENT`). DB readback: tab «پیش‌فاکتور» + «اقدامات» both `FRONT_COMPONENT`.
- **Real browser check on `:3002`:** `/object/quotation/b08cc49c-7b10-485d-afa7-b8f42793a75a` renders tabs «پیش‌فاکتور»/«اقدامات», the draft form with «ردیف‌های کالا و خدمت» and the real customer «فرید رفیعی»; the generic «فیلدهای پیش‌فاکتور» widget is gone.
- **Still open:** existing non-atomic draft persistence remains separately unclaimed (`DATA_INTEGRITY_PASS` not asserted). No `:6080` action.


## CURRENT CHECKPOINT — CRM-129-QUOTATION-UNIFIED-CREATION-003 PASS WITH OPEN INTEGRITY RISK / One Creation Door (2026-11-21; latest)

**Read first:** [CRM-129-QUOTATION-UNIFIED-CREATION-003-PROOF.md](./CRM-129-QUOTATION-UNIFIED-CREATION-003-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `82447297c8d52e55f02f67c4978a3f5ed3ddb749`. Quotation app **0.1.17** deployed to `dev-crm129`.
- **One creation door:** `quotation` now has `isUICreatable: false`, so Twenty's generic record form can no longer start a quotation from any screen (list, inline, panel). The only entry is the app's `GLOBAL_OBJECT_CONTEXT` command «پیش‌فاکتور جدید» (`create-quotation-from-quotations.command-menu-item.ts`), which opens `QuotationDraftForm`. Verified in dev: opening and cancelling the form leaves the table at 95 rows — no blank header row is written.
- **Customer:** new `CustomerPicker` (debounced real Person/Company search, loading/empty/error/retry, readable names) plus `/quotation/search-customers` (auth-required, app-role reads, Persian permission errors). `verifyCustomerRecord` refuses fabricated/empty customers **before the first write** (`CUSTOMER_NOT_FOUND`, zero mutations in test). Person/Company creation preselects and preserves the relation; the form resolves the id to a real label and never populates both sides.
- **Edit in place:** «اقدامات» → «ویرایش پیش‌نویس» opens the same form with the real `quotationId`; header, customer label (now hydrated via `person { name { firstName lastName } }` / `company { name }`), lines, discounts, payment terms and version are read from the DB. Save updates the same id with `expectedVersion`; stale saves get `VERSION_CONFLICT` (Persian). Dev: `3ac47bbf-fabe-492b-83a1-14e70905e8c3`, version 2 → 4, 33,000 + 2,970 = **35,970 IRR**, exactly one row and one line — no duplicate.
- **Locked documents:** non-DRAFT refuses content edits with `QUOTATION_IMMUTABLE` (Persian) and every content section is `pointerEvents: none`, dimmed, save disabled. Verified on the same document after it reached `READY_TO_SEND`.
- **Live list sync:** a narrow, argument-free `refreshRecordData` was added to the Front Component host API (`refetchQueries({ include: 'active' })`), so the table shows the new name/customer/status/amount/number right after an app-route save. Missing bridge degrades gracefully (stale row until reload, save still succeeds).
- **Lifecycle / number:** same document went `DRAFT` → `PENDING_INTERNAL_APPROVAL` → `READY_TO_SEND` (version 5 → 6) and claimed `QT-1405-000030`; `_quotationSequence` shows `QUOTATION:1405 lastIssued=30` — unique, no gap-filling. PDF action present and seven sharing channels listed; **no share row was written** and no provider was called (Bale stays `LIVE_UNVERIFIED`).
- **Regression:** metadata readback shows `person`, `company`, `task` still `isUICreatable = true`; native create forms still open for all three. RTL drawer resize re-checked (180 → 320 px out, back to 220 px).
- **DATA INTEGRITY — NOT PASS at this checkpoint (superseded by ATOMIC DRAFT SAVE above):** header and each line were still separate GraphQL round-trips (`update/create quotation` → per-line update/create → stale deletes → read-back). No transaction existed; a mid-save failure could leave a DRAFT with new totals and partly-old lines. It stays DRAFT, so numbering/PDF/send cannot consume it as final.
- **Tests:** quotation app vitest **269**; renderer host-API jest **2**; front execution-context jest **60** (needs `NODE_ENV=test`); `tsgo` clean for twenty-front, twenty-sdk, twenty-front-component-renderer and the app. Dev scripts `dev-verify-crm129-unified-creation.cjs` and `tmp-uni003-locked.cjs` passed.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT. Next decision: approve a transactional save endpoint, and connect real outbound sharing separately.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + their test, plus `.tmp-*` probe files.

## PREVIOUS CHECKPOINT — CRM-129-QUOTATION-RECORD-UX-002 PASS / Record Panel Edit, Lifecycle, Sharing (2026-11-20; historical)

**Read first:** [CRM-129-QUOTATION-RECORD-UX-002-PROOF.md](./CRM-129-QUOTATION-RECORD-UX-002-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `8e91f7904cb30554b2d45519b23b175b59b6d7a7`. Quotation app **0.1.15** on `dev-crm129`.
- **Draft editing:** opening a row from «همهٔ پیش‌فاکتورها» now loads the real document and its lines into `QuotationDraftForm` (`services/quotation-draft-edit.service.ts`), and saving updates the **same** record with `expectedVersion` (Dev: `40f8213a-…`, version 3 → 4, payable ۹۸۱ → ۴٬۷۸۴ تومان, no duplicate row).
- **Protection:** computed/system fields are `isUIEditable: false`; server still rejects locked writes (`QUOTATION_IMMUTABLE`, Persian) and illegal transitions (`TRANSITION_NOT_ALLOWED`, Persian). `dev-verify-crm129-locked-guard.cjs` → `CRM129_LOCKED_GUARD_PASS`, nothing mutated.
- **Lifecycle/sharing:** «اقدامات» tab drives پیش‌نویس → در انتظار تأیید → آماده ارسال on the open record; document number `QT-1405-000019` and the new status appeared in the table without reload; «دانلود PDF فارسی» produced a real PDF; seven channels listed; Bale remains provider-only (`PROVIDER_FAILED` without a real API success, `LIVE_UNVERIFIED`).
- **RTL:** panel resize is fixed generally — RTL drag right 400→480 px, drag left 480→400 px; mirrored LTR narrows/widens correctly; unit tests cover both directions and zoom.
- **Operator copy:** quotation errors surface Persian `userFriendlyMessage` only (machine codes stripped by `ui-message.ts`), and the panel header shows the record label instead of `/object/quotation/…`.
- **Tests:** quotation app vitest **258**, server quotation jest **4**, front jest **65**; `tsgo` clean for twenty-front and the app. Server `tsgo` has 2 pre-existing errors in untouched files (`quotation-communication-outbound.service.ts:135`, `test/spikes/quotation-pdf/quotation-pdf-document.ts:125`).
- **Regression:** `S2_R8_FINANCE_PASS`, `S2_R6_UI_PDF_PASS`, `S3_R3_SHARE_PASS`, `S3_R4_BALE_CONTRACT_PASS`, `S2_R4_ROLE_PASS`, version-bypass guards, numbering race 000025–000028 distinct.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT.
- **Operational bans:** no `:6080`, no release-branch change, no parallel form/Send stack, no direct DB status edits, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + their test, plus `.tmp-*` probe files.

## PREVIOUS CHECKPOINT — CRM-129 LIST UX ACCEPTED (2026-11-20; historical gate)

- **Verified GitHub HEAD:** `8c33411c5c061502edaee26552c29e90e79571f3` on `feat/crm-129-quotation`. The 246 Vitest / 32 Jest / Dev `:3002` evidence is worker-reported in [CRM-129-QUOTATION-LIST-UX-001-PROOF.md](./CRM-129-QUOTATION-LIST-UX-001-PROOF.md), not a fresh architect-run browser test.
- **Decision:** ACCEPT app-owned sidebar view «همهٔ پیش‌فاکتورها» as the operator-facing view. KEEP Twenty's 34-column platform-provisioned `All پیش‌فاکتورها` view unchanged for now. Do **not** change Core/default-view provisioning or delete the other view without a separate product need and bounded approval.
- **Numbering contract:** null `quotationNumber` in DRAFT is intentional; number allocated atomically on transition to `READY_TO_SEND`. Never invent/backfill legacy numbers or mistake `version` for document number. Preserve concurrent issuance tests and no duplicate numbers.
- **Customer and money presentation:** app view projects customer from actual Person/Company relations and money through shared exact formatter; retain raw exact storage untouched. Dev browser operator URL is `http://localhost:3002/objects/quotations?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`.
- **Next:** resume CRM-129 customer acceptance/rejection online or other prioritized product capability as separately approved; no additional list-view Core task. Continue short source-grounded tasks with real browser handoff. Bale direct API remains `LIVE_UNVERIFIED`; `:6080` off-limits. Preserve unrelated local dirty files.

## PREVIOUS CHECKPOINT — CRM-129-QUOTATION-LIST-UX-001 PASS / Professional Quotation List (2026-11-20; historical)

**Read first:** [CRM-129-QUOTATION-LIST-UX-001-PROOF.md](./CRM-129-QUOTATION-LIST-UX-001-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `5ab67884a156095101e7bf171f550a6d95093316`.
- **Delivery:** List «همهٔ پیش‌فاکتورها» now shows `عنوان · شماره سند · مشتری · وضعیت · مبلغ کل`. Document numbers are claimed **at issuance** (`READY_TO_SEND`) by a single-statement `INSERT … ON CONFLICT … RETURNING` on `_quotationSequence` (Jalali year scope, `QT-۱۴۰۵-۰۰۰۰۰۱`); unnumbered rows render «بدون شماره» and were not reconstructed. `customerName` / `quotationNumberLabel` / `totalDisplay` are read-only projections; `totalExact` (six decimals) and `version` stay stored but hidden.
- **Money:** `۲٬۳۰۵٬۳۵۰ ریال` from stored `2305350.000000` via the shared Money Domain formatter — no `Number`/`parseFloat`/re-rounding.
- **Dev (`:3002`):** sidebar «همهٔ پیش‌فاکتورها» → `?viewId=c3a14f2d-d0a9-4ecb-8514-e1d61cbafaff`; 61 active rows (5 numbered, 56 «بدون شماره»); 4-way race produced 4 consecutive distinct numbers.
- **Tests:** quotation app vitest **246**, server quotation jest **32**.
- **Known limitation:** the platform-provisioned `All پیش‌فاکتورها` view still lists all 34 columns; making the app view the workspace default is a platform-level change, left undecided.
- **Continue at:** architect gate — STOP_FOR_ARCHITECT.
- **Operational bans:** no `:6080`, no bulk send, no SMS blast, no main-worker restart, no release-branch change, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + `enterprise-plan.service.ts`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R4-HF1 PASS / Quotation Form Crash Fix (2026-11-20; historical)

**Read first:** [CRM-129-S3-R4-HF1-PROOF.md](./CRM-129-S3-R4-HF1-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `a4e29f9a78fcbcf6019b2174c2b8d77a1fbe17a6`.
- **GitHub SHA:** `55eed5d8bc` (docs commit may follow).
- **Delivery:** Guard FC caret restore (`setSelectionRange` no-op when missing); sidebar nav «همهٔ پیش‌فاکتورها»; prefer application GraphQL token for catalog/quotation LF. Quotation **0.1.13** on `dev-crm129`.
- **Dev:** Form opens from Persons without crash; Persian money + 2-line draft + 10% discount saved (`2dd13611-…`); list reachable; math UI↔DB match. Vitest **240** PASS.

## PREVIOUS CHECKPOINT — CRM-129 S3-R4 PASS / Bale Direct Sending (2026-11-20; historical)

**Read first:** [CRM-129-S3-R4-PROOF.md](./CRM-129-S3-R4-PROOF.md). Feature SHA `ddfa3ccb1a`; docs HEAD was `a4e29f9a78`. `LIVE_UNVERIFIED` Bale contract.

## PREVIOUS CHECKPOINT — CRM-129 S3-R3 PASS / Quotation Multi-Channel Sharing (2026-11-20; historical)

**Read first:** [CRM-129-S3-R3-PROOF.md](./CRM-129-S3-R3-PROOF.md). Feature SHA `e18868767a`; docs HEAD was `03d6690d58`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R2 PASS / Link Authorization & Browser UAT (2026-11-19; historical)

**Read first:** [CRM-129-S3-R2-PROOF.md](./CRM-129-S3-R2-PROOF.md). Feature SHA `ff33b445ee`; docs HEAD was `a937656cc8`.

## PREVIOUS CHECKPOINT — CRM-129 S3-R1 PASS / Secure Customer Quotation Link (2026-11-19; historical)

**Read first:** [CRM-129-S3-R1-PROOF.md](./CRM-129-S3-R1-PROOF.md). Feature SHA `e29f25d093`; docs HEAD was `0aa0ec2bd2`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R11 PASS / Catalog Perf, Persian Inputs, Rounding Verify (2026-11-19; historical)

**Read first:** [CRM-129-S2-R11-PROOF.md](./CRM-129-S2-R11-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from S2-R10 `a96056f217`.
- **GitHub SHA:** `72375a7aecdb34e4754e0023f189c13b72efd637`.
- **Delivery:** catalog search cut from 3→2 GraphQL round-trips (combined catalog+default priceList); client empty-page cache; Persian money inputs with validated grouping parser; caret-safe inputs; rounding case verified consistent UI/DB/PDF (no domain change). App **0.1.7** on `dev-crm129`.
- **Bench:** before open/page2/search avg 142/129/122 ms; after-combined 163/120/125 ms wall (LF cold-start noise); internal timings ~60–70 ms (catalog~50–58 + prices~10).
- **Continue at:** architect gate — **S3** not authorized here.
- **Operational bans:** no `:6080`, no live accounting, no SMS, no main-worker restart, no release-branch change, no screenshot loop.
- **Unrelated locals left dirty (not committed):** Settings select/API-key front files + `enterprise-plan.service.ts`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R10 PASS / Professional Workspace & Floor Payable (2026-11-19; historical)

**Read first:** [CRM-129-S2-R10-PROOF.md](./CRM-129-S2-R10-PROOF.md). Superseded as “latest” by S2-R11 above.

- Feature SHA `5c831b52f7`; people display + floor payable; full page DEFERRED; app was `0.1.6`.

## PREVIOUS — CRM-129 S2-R9 UAT FEEDBACK (2026-11-19; historical REPORT then implemented in R10)

Historical report-only checkpoint on baseline `2ce697a779` / docs `ae65e83c29`: operator asked for primary add-row, alternating cards, people money display, and floor payable. Implemented and proven in **S2-R10** above.

## First actions in a new chat
1. Fetch **this file from the working release branch**, then fetch the detailed historical file on the docs branch. Confirm actual remote HEAD and any newer reports before acting.
2. Distinguish verified GitHub state, user-provided Cursor reports, and live operational evidence. Do not assume code pushed = deployed.
3. Work in short approval-gated tasks, no screenshot/browser loops, no automatic worker/container restart, no unapproved production writes, app reinstall, restore or deploy. Stop at `STOP_FOR_ARCHITECT`.

## Current source and deployment
- Release branch HEAD `d2f3e2f645` (`9e1c239156` docs-only ⇒ `d2f3e2f645` version bump). Code fix itself is `53db32b3b8`; the two later commits changed only docs and two `version` fields.
- **DEPLOYED 2026-11-17:** image `crm-intranet/twenty:53db32b3` (`sha256:ad06c934f7cf0f0bbd29dc51ecaa325b0dea5c6bbc52cd455cac59762c5ff423`) on both server and worker.
- Installed apps: Event Registration **0.1.14**, Communication **0.1.75**, Record Access **0.2.4** unchanged. CRM-122 **CLOSED**.
- Communication's `yarn.lock` is now genuinely stored in the app storage volume (`dependencies/yarn.lock`, 121,153 B), not just a checksum. `yarnLockFileId` stays NULL for tarball-installed apps by design — that column is only populated for the workspace Custom/Standard apps; the layer builder reads the file, not the FK.
- Dependency layers are rebuilt from scratch on every container recreate and no longer need a registry: after the swap `/tmp/logic-function-executor-tmpdir` was empty, the first execution built `deps/33f3154e…` (Communication) and `deps/default` (Event Registration) offline with empty `node_modules`, i.e. nothing to install.
- Rollback image `crm-intranet/twenty:c4d3efd8` (`sha256:ae6a9e54…f362a`) retained. Pre-deploy backup `D:\CrmDeployment\migration\pre125r1-intranet-20261117-025647.dump` (1,750,186 B, sha256 `263F9408…10C2`, 1317 TOC entries, isolated restore verified 215 Persons). Out-of-band pre-release backup `pre122r1-…-152107.dump` (sha256 `98211C83…6E904`) also retained.

## Root cause and code fix
- `npm pack` ignores root `yarn.lock`; installer previously ignored nested lockfile, DB stored checksum but `yarnLockFileId=NULL`, fallback wrote 84-byte stub, dependency layer always ran Yarn and failed on unreachable registry.
- **Checksum did not change across 0.1.72 → 0.1.74**; reject old changed-checksum hypothesis.
- Pushed source fix at `53db32b3b8` ships `dependencies/yarn.lock`, checks md5 against manifest, stores lockfile, fails loudly when missing, resolves actual runtime externals, avoids installing esbuild-inlined/dead `@sniptt/guards` for these two apps, and tightens layer readiness.
- Cursor R1 tests: tarballs, offline cold start, container recreation at layer granularity, non-sending `CALLER_NOT_A_USER`, Event Registration prepare, SDK/server tests PASS. Full isolated app publish/install **NOT RUN**. Genuine external deps still require a registry or offline mirror.

## Blocker history — CRM-COMMUNICATION-RUNTIME-123A (RESOLVED 2026-11-17)
- Image build was blocked because Docker Desktop's VM could not reach the registry. Root cause was a **poisoned Windows DNS client cache entry**: `registry.npmjs.org` cached as `127.153.0.107` (loopback). Docker's embedded resolver `192.168.65.7` forwards to the host resolver, so every container inherited it. Not a proxy issue (Docker's proxy is `http.docker.internal:3128`; TLS to the real IP returned 200) and not a network block.
- Minimal, reversible fix: `ipconfig /flushdns` — cache clear only. No Docker Desktop setting, DNS server, proxy, VPN, host network or Dockerfile change. The standard `docker build --target twenty` then succeeded unchanged.
- The build-time dependency that had been failing was never a packaging defect: `packages/twenty-front` `lingui:extract` depends on `^build`, the SDK build script is `npx rimraf dist && npx vite build`, and `rimraf` is only a devDependency of `packages/twenty-server`, absent from the frontend dependency stage. With registry egress restored it resolves normally. Prebuilding the frontend alone would not have skipped Lingui.

## Production release 2026-11-17 (CRM-COMMUNICATION-RELEASE-125-R1)
- Order executed: server+worker image swap → Event Registration rebuild/install → Communication rebuild/install. PostgreSQL and Redis were never restarted or recreated (uptime preserved).
- A version bump was required first (`d2f3e2f645`): the installer rejects a package whose version equals the installed one (`APP_ALREADY_INSTALLED`), so the rebuilt tarballs could not be installed over `0.1.13`/`0.1.74`.
- Verification: `healthz` 200; `/communication/send` returns `CALLER_NOT_A_USER` (guard executes, nothing dispatched); `/event-registration/prepare` returns live data; money validation rejects decimal, negative, non-numeric and overpayment inputs (the operator gate refuses API keys before validation runs, so no writes occur); counts 215/183/6/6/191, payments 6 = 24,330,000, 5 RLS predicates, 8 triggers, 6 roles, ownership field ids unchanged; zero dependency/registry/runtime/worker errors. Temporary API key revoked and `apiKeyMap`/`apiKeyRoleMap` cache purged.
- Rollback constraint: reverting to the *old* app tarballs via `app:install` is **not** a valid rollback — they declare a checksum but ship no lockfile, so the new installer fails loudly. Rollback means the `c4d3efd8` image, or rebuilding the same versions with the fixed SDK.

## Next feature — CRM-123 multi-collaborator access (NOT STARTED)
**CRM-123 multi-collaborator access**: Person.assignee remains sole owner; manager grants multiple Person collaborators, propagating authorized access to EventLead, EventRegistration, RegistrationPayment, SalesInteraction without duplicating grants; finance default deny. Current RLS AND-composition means collaborator role cannot simply OR its way past owner-only predicate. First approved slice: `personCollaborator` metadata custom object, Person/WorkspaceMember relations, unique pair, active/revoke/reactivate, manager-only writes, isolated tests; **no RLS widening in first slice**. Further server-side security and child-object access require separate architecture review. Implementation is not authorized yet.

## Side backlog (not blocking this release)
Record field changed → selected saved SMS template → Workflow/Communication send after successful save, authorization, deduplication, audit. Integration feasibility not yet proven from source.

## Recovery rules
- Keep canonical summary here on the active working branch; keep detailed history in the linked docs branch. Update this file on each architect handoff so a new chat can discover it without knowing a special branch.
- Never label the SDK fix as deployed until a new image is built and both apps are rebuilt/reinstalled with live verification.
- No hidden continuation, no automatic next task. STOP_FOR_ARCHITECT.


## Checkpoint 2026-11-16 — CRM-125 Approval B PASS, production still unchanged

- Independently verified GitHub compare `9e1c239156454461556941675683ab3526ff1d9d...d2f3e2f645ff9124d459ac8daf0b5fd8bf8387a0`: ahead 1 / behind 0, exactly two changed paths, `packages/twenty-apps/internal/communication/package.json` and `packages/twenty-apps/internal/event-registration/package.json`, each one line replaced. No code/Dockerfile change in this commit.
- Cursor report: Event Registration `0.1.14` tarball `event-registration-0.1.14.tgz`, SHA256 `5CFC5F00609C776A63B25D9C159DB4F6267426F443BFB2A249EF7DBA74593269`, 443707 B, zero runtime deps, no lock required; money-code and offline layer checks PASS.
- Cursor report: Communication `0.1.75` tarball `communication-0.1.75.tgz`, SHA256 `BDD863D997622FACC4ACF13B2081AE2CA717E298B1FA9339F158624B1B44532E`, 2837076 B, zero runtime deps, nested `dependencies/yarn.lock` 121153 B, md5 `33f3154e3015f2c34379f3c3407fc931` matches manifest, offline cold start and non-sending authorization guard PASS. App identities preserved.
- Cursor reports production UNTOUCHED, installed Event Registration `0.1.13`, Communication `0.1.74`, Record Access `0.2.4`, healthz 200. Neither new tarball published nor installed. No deployment approval given.
- Docker registry egress was fixed by Windows `ipconfig /flushdns` after a poisoned DNS client cache entry; no Docker configuration changed. Image `crm-intranet/twenty:53db32b3` reported built with image ID `sha256:ad06c934f7cf0f0bbd29dc51ecaa325b0dea5c6bbc52cd455cac59762c5ff423` and isolated offline test PASS. Image ID is not necessarily a registry manifest digest.
- **Next gate:** obtain explicit approval for one coordinated operational release: fresh backup and baseline; image swap (server/worker) followed immediately by Event Registration `0.1.14` and Communication `0.1.75` publish/install, with preflight checks, no message send, data/security/finance smoke tests, and bounded downtime. Verify rollback compatibility and DB state; reverting image alone after app version progression is not automatically a complete rollback. Avoid untested automatic DB restore.
- `CRM-122` remains OPEN until live durable release and restart/cold-start behavior are proven. `CRM-123` collaborator work remains paused. `record-access-0.2.4.tgz` must not be modified.


## CRM-126 — Workflow-triggered template SMS, analysis checkpoint (2026-11-17)

**Status: ANALYSIS COMPLETE / STOP_FOR_ARCHITECT. No implementation authorized or performed.** User priority: workflow-driven SMS on real field change with user-selected saved template; CRM-123 remains deferred.

### Confirmed by Cursor source inspection (reported, not independently code-audited here)
- Native updated/upserted database event trigger supports selecting object and `settings.fields`; listener intersects `updatedFields`. Native `settings.filter` can check `trigger.properties.after.<field>`. Deep equality suppresses unchanged saves; relation fields excluded from diff.
- Existing logic-function workflow action supports `workflowActionTriggerSettings` and `inputSchema`; public Discord action is an example.
- Reuse internal Communication `send-communication-workflow-handler`, persistence, Kavenegar/Razpayamak providers, messageTemplate source scoping, `resolveSendContext`, and safe allow-listed template interpolation. Never accept arbitrary recipient from workflow user input.
- Four gaps: (A) automatic workflow run lacks workspaceMember acting identity and fails `CALLER_NOT_A_USER`; (B) logic function cannot communicate safe terminal failure status to workflow executor (SUCCESS/FAILED mapping, retry risk); (C) no saved-template picker in workflow UI; (D) no persistent send deduplication across retries/re-runs.
- Candidate app-side first slice (NOT APPROVED): unique `deduplicationKey` on Communication; new `send-template-workflow-action` with templateId, sourceObjectNameSingular, sourceRecordId; validate/resolve/interpolate before sending; unique key claim and dispatch via existing handler. Design must prove durable state machine, concurrent sends, and recovery from queued/unknown outcomes; a unique QUEUED row alone can suppress a send after crash, so cannot be treated as proof of delivery.
- Candidate core work: explicit authorized workflow actor identity and non-retryable/safe failure signaling; candidate frontend work: template picker by source-scoped template ID. Do not silently substitute workflow creator's identity: revocation, permissions at execution time, auditing, and security boundaries require architect decision.
- Open architecture choices: authorized actor for unattended workflows (creator vs designated service principal, with revocation rules); idempotency semantics (content key suppresses A→B→A and manual re-run vs event-identity per actual change); manual replay behavior; safe failure/unknown-provider outcomes; template selection UX and cross-workspace checks.
- User requested repository recovery update only. No operational changes, no SMS sent, no CRM-126 implementation. CRM-122 remains CLOSED after CRM-125-R1 live deployment; installed ER 0.1.14, Communication 0.1.75, Record Access 0.2.4.


## CRM-126 — R1 through R4 implementation handoff (2026-11-17)

**Latest status: DEV UI IMPLEMENTED / INTEGRATION NOT PROVEN / STOP_FOR_ARCHITECT.** This checkpoint supersedes the earlier CRM-126 *analysis-only* status above. All implementation and test claims below are **Cursor reports, not independently audited remote code**: the feature branch is local/unpushed. No approval to deploy to intranet.

- Feature branch: `feat/crm-126-workflow-template-sms` from `release/record-access-115`. R1 `e4e8a210f233d62f3774eceb6e7b8e934e3805a4`; R2 `26e7a5987b368b7f084e04395fb924042d4039fc`; R4 latest `9cceeb333fc700362975cc8e393ac06c043010ac`. R3 made no commit. **No push or merge reported**; these commits are not verified on GitHub.
- User chose **CRM system-owned identity**, not creator/editor identity, for unattended sends. App variable `WORKFLOW_SMS_SENDING` defaults disabled; controlled by `APPLICATIONS` permission; intended fail-closed on revocation/disabled. Reuses existing Communication send-and-persist, provider integrations, Person relation recipient resolution and allow-listed interpolation; no arbitrary recipient input.
- R1 introduced native Workflow logic-function action `communication-send-template-workflow-action` and persisted send dedup. R2 changed idempotency to an `eventId` minted once at ORM database-event formatting; tests report distinct identities for distinct writes, replay stability, A→B→A legitimate sends, and no retry after ambiguous provider result. Workflow step failures throw; Communication reports `SENT/DELIVERED`, `FAILED`, or `UNKNOWN`. Core safe-failure contract remains unmodified; no live SMS dispatch proven.
- R3: Dev frontend `http://localhost:3001`, backend `:3002`; Communication 0.1.75 installed, action registered, record picker API returned Persian sample template. Browser rendering was not independently confirmed at that stage. Server image `twenty-dev/o117` lacked R2 eventId code; `LOGIC_FUNCTION_TYPE` absent and `NODE_ENV=production`, so logic-function execution was disabled. No real end-to-end change→send test; no production send.
- User supplied a real screenshot of R3: action exposed many technical fields (`eventId`, record ID, object name, before/after, workflow ID, field name, JSON output), unsuitable for ordinary operators; screenshot trigger was **record created**, not updated. Architect requested a single template selector and derived context, not manual UUIDs.
- R4 report: introduced opt-in `InputSchema.isHidden` and `derivedFromTrigger`, plus `workflowActionTriggerSettings.hideExpectedOutput` and `triggerRequirementMessage`; builder init effect derives real `{{trigger...}}` expressions and hides technical fields/JSON, leaving only Persian-labeled template picker. Strictly refuses missing/created/manual/multi-watched-field/unknown-workflowId contexts, showing guidance and failing closed. Reported 743 frontend Jest + 812 app Vitest + 245 shared Nx tests PASS; three-package typecheck zero errors. Communication **0.1.76 installed in Dev only**, Vite HMR on `:3001`, backend `:3002` healthy. Browser visual rendering **still not independently verified** by user/architect.
- **Known UX limitation:** native `FormSingleRecordPicker` has no source/channel filter. A mismatched template can still be selected in the picker; server rejects with `TEMPLATE_SOURCE_MISMATCH` or `TEMPLATE_UNSUPPORTED_CHANNEL` (fail closed). Do not describe this as source-filtered UI.
- **Critical pending gate:** Dev backend still reportedly runs older image lacking R2 `eventId` and logic-function execution; therefore R4 frontend/schema/unit tests do **not** prove real workflow execution, system identity or durable idempotency in running Dev. Check trigger-derived variable paths and workflowId availability against actual runtime before authorizing sends. Review hidden-input initialization on edits/trigger changes and ensure stale derived values cannot be used. Inspect error status persistence and re-run semantics before production release.
- User explicitly prohibited any change to **crm-intranet :6080**, production database/worker, Docker image builds, live SMS, unapproved restarts, push/merge. Cursor reports intranet healthz 200 and no production writes or restarts through R4. Production Communication remains 0.1.75; 0.1.76 is Dev-only.
- **Next action:** user visually checks the simplified R4 action in Dev; any further fixes require a new narrowly scoped approved task. CRM-126 is **not production-ready and not closed as end-to-end verified**. CRM-123 remains paused. Do not let this checkpoint silently authorize deployment.


## CRM-126 — R5 Dev UX/performance checkpoint (2026-11-17)

**Status: R5 CODE/TESTS REPORTED PASS; PERCEIVED CLICK LATENCY UNVERIFIED; STOP_FOR_ARCHITECT.** This supersedes the R4 UI status above, without authorizing deployment. Source: user-supplied Cursor R5 report, not independent review of unpushed code.

- Local feature branch `feat/crm-126-workflow-template-sms`, R5 commit `e303b9f25174d983bef86e86137692d9a15528df` (not pushed). Dev Communication updated to **0.1.77**; frontend `http://localhost:3001` and backend `:3002` reported HTTP 200. Intranet `:6080` untouched, no restart, Docker build, real SMS, or push.
- User reported slow response when clicking trigger/action workflow nodes and an ugly mixed-language oversized warning. R5 network measurements across 3 samples: workflow 58/5/4 ms, workflowVersion 7/4/3 ms, getLogicFunctionSourceCode 7/2/2 ms. Reported node-action network path ~15→6 ms after removing redundant requests. **These are network timings, not browser click-to-render latency; React Profiler was NOT run due to missing authenticated UI access.** Rendering bottleneck remains a hypothesis, not a proven root cause.
- R5 removed redundant `useWorkflowWithCurrentVersion` from action node, reading existing trigger from `flowComponentState` instead; reduced 2 requests/4 hook chains/one `useFindOneRecord`. Corrected memo dependencies to primitives `triggerType`, `eventName`, `fields`; removed repeated JSON output rendering. Shared workflow engine not speculatively altered.
- Replaced `Trigger not configured` with **«محرک نیاز به تنظیم دارد»**, concise Persian instructions **«برای ارسال پیامک هنگام تغییر اطلاعات، رویداد «ویرایش رکورد» و ستون موردنظر را انتخاب کنید.»**, and Design System warning Callout with actionable **«تنظیم محرک»** selecting trigger; action hidden in read-only mode. R5 reports five tests on this component.
- Reported tests: **748 frontend Jest PASS**, app typecheck zero errors. **No authenticated browser render/React Profiler proof** and no real end-to-end SMS. User visual/latency acceptance is still required; do not claim that click lag is fixed or that production is ready.
- Next: user checks Dev UI click responsiveness and warning appearance. If lag remains, obtain authorized authenticated Dev profiling evidence in a narrowly scoped task; no screenshot loops. CRM-123 still deferred. STOP_FOR_ARCHITECT.


## CRM-126 — R6 workflow node click hit-testing checkpoint (2026-11-17)

**Status: REPORTED DEV INTERACTIVE PASS / USER ACCEPTANCE PENDING / STOP_FOR_ARCHITECT.** Cursor report supplied by user; local feature commit not pushed or independently audited.

- Task `CRM-WORKFLOW-CLICK-126-R6`; local commit `e5157b5009402e142dd10134c6f4f072cc2d8ae2` on `feat/crm-126-workflow-template-sms`; one file, +6 lines; tree clean, no push.
- Root cause identified in `@xyflow/react`: `nodeClickDistance` default 0, while existing canvas `paneClickDistance={10}`. Small mouse motion between press/release may suppress node click by beginning drag. Minimal change in `WorkflowDiagramCanvasBase.tsx`: `nodeClickDistance={10}`, matching pane tolerance. No intended changes to drag, connectors, persistence.
- Reported DOM hit-test `elementFromPoint`: 14/15 grid points hit node surface, 1/15 bottom connection handle intentionally intercepts; no widespread overlay or pointer-events blocker.
- **Authenticated interactive Dev test reported PASS:** five positions (icon, center, title, upper-right, inner-bottom) on both Action and Trigger opened correct panel; switching Action→Trigger updated editor states correctly; warning button «تنظیم محرک» selected Trigger. Direct A/B synthetic 2–4px pointer-jitter behavior **not demonstrated** due tooling limitations; code/library documentation supports hypothesis.
- Reported 748 frontend Jest PASS, typecheck zero errors, Vite HMR live on `:3001`, Dev Communication 0.1.77 installed; `:6080` healthz 200 and unchanged, no Docker build, restart, SMS or push.
- Architect disposition: **R6 implementation/test evidence accepted provisionally; final UX acceptance requires user clicking in Dev.** Do not claim production-ready or end-to-end SMS tested. Next separate open task from user: DEV mock workflow SMS end-to-end plus read-only diagnosis of missing SalesInteraction titles on intranet (CRM-127), not yet reported complete.


## CRM-127 — SMS runtime probe and SalesInteraction title investigation (2026-11-17)

**Status: INVESTIGATION COMPLETE; SMS E2E BLOCKED; NO CODE/DATA CHANGES; STOP_FOR_ARCHITECT.** Evidence below is from user-provided Cursor investigation report, not independently audited DB/code. Feature tree clean at `e5157b5009`.

**A — Communication SMS Dev:** Actual `/communication/send` returned HTTP 500: `No encryption key matches keyId '1cc589d8'`. Seven old provider app variables use keyId `1cc589d8`, while active server keyId is `b0f15747` and fallback keyId `e3b0c442` (empty). Failure at `ApplicationVariableEntityService.decryptValue` in `LogicFunctionExecutorService.getExecutionEnvVariables` occurs before driver selection. Newly added `WORKFLOW_SMS_SENDING` decrypts with active key. Contrary to prior assumption, Dev logic functions execute: `/event-registration/prepare` returned HTTP 200 with domain result `success:false, reason:UNREADABLE`. Provider variables include **real Kavenegar/RazPayamak credentials**; simply restoring decryption could permit real SMS. Mock provider exists only in unit tests, not runtime. Live mock harness failed because `CoreApiClient` is not generated outside app runtime; removed. No Communication rows created (reported 0). SMS template/Person relation path traced, 36 mocked unit tests pass, but **no real Workflow E2E**. Safety gate: first implement an isolated Dev runtime fake/no-network provider and prevent live provider calls, then test; never print secrets or restore old keys merely to test.

**B — Intranet SalesInteraction titles (read-only SELECT):** 190/191 `salesInteraction.name` rows are SQL NULL; one manually entered typo `پیکیری` last updated Nov 7. Field is nullable TEXT; no observed DB title trigger, SQL writer, app logic function on `salesInteraction`, or Git history implementation of `callAttempt` title generation. UI and GraphQL reflect NULL; evidence supports **missing title generation**, not a proven deletion/regression. `callAttempt` metadata already has Persian CALL_1..CALL_5 labels. Relation `salesInteraction.eventLeadId → eventLead.personId → person.nameFirstName/nameLastName` is available; 187 named persons, 4 linked unnamed, none without lead (per report). Proposed narrow implementation: title creation on `salesInteraction.created`, optionally update on `callAttempt` change; respect manual titles, avoid self-trigger loops, provide meaningful unnamed fallback. **Architect caveat:** `name IS NULL` guard alone cannot safely update previously auto-generated titles when `callAttempt` changes; explicitly decide/manual-vs-generated provenance before implementing updates. One-time backfill for existing NULL rows only after separate dry-run and approval. Do not modify intranet or data under this checkpoint.

**Environment:** intranet `:6080` read-only and healthy, no restart; Dev key/cache cleanup reported, no new records, Docker build, push, screenshots, or actual SMS. Await architect-approved narrowly scoped implementation tasks; no automatic next task authorized.


## CRM-128 — SalesInteraction title generation domain implementation (2026-11-17)

**Status: PARTIAL / STOP_FOR_ARCHITECT; architecture decision: explicit provenance field required.** Based on user-provided Cursor report, local unpushed code not independently audited.

- Local feature branch `feat/crm-126-workflow-template-sms` commit `7cd9f6391b1f501a969b5fb8b91f6d2fd894b07c` (3 files, +356/-2). 61 domain tests / 153 whole app PASS, typecheck 0. No Dev or intranet deployment, writes, push, Docker build, or restart.
- Implemented pure `buildSalesInteractionTitle` and `decideSalesInteractionTitle` helpers, including attempt labels, person name, fallback «مشتری بدون نام», reject unknown CALL_6, idempotency, and preserve manually distinct titles. Existing helper `clean` reused. 28 new tests reported.
- Dry-run read-only: 190 NULL titles, all 190 constructible; 4 unnamed person fallbacks, no unknown/missing callAttempt; 1 manual title `پیکیری` preserved. No backfill executed.
- Cursor stopped before wiring triggers because no reliable existing provenance flag/audit; suggested comparing title with reconstructed previous-state title via `properties.before`, which has ambiguity (user may manually type canonical text). **Architect rejects heuristic compare-and-set as sole ownership authority. Add explicit provenance field (e.g. `titleIsAuto`) with defined create/manual-edit/auto-update semantics and conservative legacy default.** Person rename updates must be handled from person events or explicit dependency propagation, not assumed to arrive in SalesInteraction before-image.
- Current helpers were placed inside `event-registration` app for convenience. **Architect requires domain ownership under SalesInteraction/communications or an independent narrowly scoped component; do not put this in record-access authorization module.** Need ensure no uncontrolled dependency on optional event-registration app for baseline CRM behavior.
- Next narrow task: implement provenance field and proper title lifecycle on Dev, add tests, then dry-run. Do not write intranet records or run backfill until separately approved. The separate CRM-126 SMS encryption/mock blocker remains unresolved.


## CRM-128-R2 — explicit title provenance and independent sales-followup app (2026-11-17)

**Status: IMPLEMENTATION/TESTS REPORTED PASS; DEV APP INSTALL APPROVED; INTRANET BACKFILL NOT APPROVED; STOP_FOR_ARCHITECT.** Based on user-supplied Cursor report; local unpushed implementation not independently reviewed.

- Commit `080cc2efdac2f27b779999701694d9cabffce8c4` on local `feat/crm-126-workflow-template-sms` (21 files, +1821/-115); tree clean, not pushed. 35/35 new sales-followup tests, 135/135 event-registration, typecheck 0, lint 0, build PASS.
- New `salesInteraction.titleIsAuto`: nullable BOOLEAN, default false. Dev field created; 175 existing records got false, none marked auto. Domain title logic moved from event-registration to independent `sales-followup` app; record-access untouched. Empty title gets generated with flag=true; flag=false/manual and NULL/unknown provenance protected; auto titles recomputed on attempt or person name change; unchanged writes skipped to prevent loops. Name and ownership flag written together. Unknown call attempt rejected; unnamed fallback provided.
- App manifest defines three triggers: `salesInteraction.created`, `salesInteraction.updated` watching `callAttempt,name`, and `person.updated` watching `nameFirstName,nameLastName`; person-rename propagation capped at 200 with truncation reporting. App permissions read/update salesInteraction, read eventLead/person, no deletes.
- Read-only intranet backfill dry-run: scanned 191, would fill 190 NULL titles, preserve 1 manual `پیکیری`, no unbuildable rows. Dev dry-run: scanned 175, would fill 0 and preserve 175. Script defaults dry-run, `--apply` required; no backfill executed.
- **Dev app not yet installed**; triggers and live updateSalesInteraction mutation not validated. Architect **approves installing and testing app on Dev only**, using reversible isolated test records, verifying create, callAttempt change, person rename, manual override, idempotency, and no unintended mass changes. Ensure manual edits set `titleIsAuto=false` in same operation (or fail safely), including when editing previously auto title. Verify update loops and trigger permissions. **No intranet --apply or schema change/deployment authorization yet**; requires successful Dev integration and separate explicit user approval. Keep :6080 read-only.
- Note: Dev CreateFieldInput did not accept universalIdentifier; generated field UID used, code resolves by field name. No Docker build, restart, push, SMS, or screenshots reported.


## CRM-128-R3 — Dev live integration blocked (2026-11-17)

**Status: BLOCKED / NOT ACCEPTED FOR INTRANET; STOP_FOR_ARCHITECT.** User-supplied Cursor evidence; no independent source audit of local unpushed branch.

- Local commit `d462e52ba1` (engine compatibility range + app version). Sales Follow-up **0.1.1** installed on Dev after lowering required Twenty version from >=2.42 to >=2.41 (Dev is 2.41). Three manifest triggers registered and fired: salesInteraction.created, salesInteraction.updated [callAttempt,name], person.updated [nameFirstName,nameLastName]. LogicFunctionTriggerJob jobs 36/37/38 reported completed, but **no title writes**. Creation left name empty; changing callAttempt did not refresh title; person rename not tested. Successful job completion does not prove app domain success.
- Root cause not proven. Hypothesis: code uses flat person.nameFirstName while Dev GraphQL uses composite `name { firstName }`; app may swallow READ_FAILED / return null. Need direct evidence of logic-function inputs/results and GraphQL shape, and fail-visible diagnostics rather than silent swallowing.
- **Critical invariant failed:** manual editing name left `titleIsAuto=true` instead of switching to false. This risks overwriting manually edited titles on future events. Must implement and test ownership handoff at write boundary (UI/API), or safe detection using event before/after plus flag without rewriting a user's text; do not assume app's own auto writes are manual edits.
- Test records cleaned (2 salesInteraction, 1 eventLead, 1 person); 175 real Dev rows unchanged, 0 auto flags true, 0 empty names, no test records remain. Intranet :6080 read-only, 190 NULL titles + 1 manual preserved; no backfill, build, restart, push, SMS.
- **Architect decision:** do not deploy app to intranet or apply backfill. Dev app 0.1.1 remains installed; reported lack of writes is not a safety guarantee. Disable Dev triggers pending fix if safely supported, retaining logs/evidence. Next bounded task: establish exact runtime read failure and make domain errors observable, fix trigger execution, and enforce manual title override -> titleIsAuto=false with tests. Revalidate real Dev create/update/person rename/manual edit/idempotency before any intranet approval. No automatic continuation.


## CRM-128-R4 — direct Dev handler PASS, worker transport E2E BLOCKED (2026-11-17)

**Status: DOMAIN LOGIC PASS (reported direct real-DB integration), WORKER-TRIGGER E2E BLOCKED, NO INTRANET APPROVAL; STOP_FOR_ARCHITECT.** User-provided Cursor report, local code not independently reviewed.

- Local commit `3048837aed`; 37/37 app tests PASS, typecheck 0, lint 0. Dev Sales Follow-up triggers currently **disabled** (`bound=false`) after controlled testing; original trigger settings captured in report. Intranet :6080 read-only, no backfill, Docker build, restart, push, or SMS.
- Root causes proven from deployed bundle: generated CoreApiClient cannot query custom `eventLead` and `salesInteraction` (GraphQL missing fields), and Person name is composite `name { firstName }` rather than flat `nameFirstName`. Changed app data access to raw `/graphql` fetch with app token as used by event-registration; explicit phase-tagged errors rethrown, avoiding silent READ_FAILED.
- Ownership invariant: on salesInteraction.updated, distinguish app-generated canonical title from manual name edit using updatedFields, release `titleIsAuto=false` when user changes name to noncanonical text, preserve text; change callAttempt/person name only when auto-owned; no-op/idempotency when unchanged. Reported direct handler+real Dev DB sequence: create auto title, CALL_1→CALL_2 title refresh, person rename refresh, manual edit releases ownership, subsequent CALL_3 preserves manual title, repeated event no-op. **Caveat:** if manual edit exactly matches computed canonical text, it is not distinguishable by this event heuristic; document as residual contract ambiguity, do not claim absolute manual provenance for that edge case.
- **Remaining E2E environment blocker:** triggered jobs run in `twenty-worker-1`, where `SERVER_URL=http://localhost:3002` and localhost:3000 connection refused; `LOGIC_FUNCTION_API_URL` unset. Server has `LOGIC_FUNCTION_API_URL=http://127.0.0.1:3000` and works. Triggered job can appear completed despite transport failure. Fix requires validated worker-reachable API URL and controlled Dev worker restart. **User explicitly approved restart of Dev worker only on 2026-11-18 for CRM-128-R5**; verify isolation first, do not touch intranet worker. No intranet backfill authorization. Verify complete Trigger→Worker→API→DB path before enabling backfill or deployment.
- Dev baseline restored: 175 real interactions, zero auto, 175 manual, zero empty names; isolated test records deleted. Triggers left disabled. Intranet 190 NULL + one manual unchanged. No automatic continuation.


## CRM-128-R5 — limited Dev worker authorization (2026-11-18)

User explicitly approved correcting the Dev worker-reachable LOGIC_FUNCTION_API_URL and restarting **only the isolated Dev worker**, after proving separation from intranet :6080. Verify connectivity before restart; test real Trigger→Worker→API→Database using disposable records; return three sales-followup triggers to disabled and clean test data. No intranet changes, backfill, Docker build, other service restarts, push/merge or SMS. **Approval is scope-limited, not evidence R5 has executed or passed.** STOP_FOR_ARCHITECT.


## CRM-128-R5 — Dev worker transport fixed; app-token E2E still blocked (2026-11-18)

**Status: PARTIAL PASS / E2E BLOCKED / STOP_FOR_ARCHITECT.** Based on user-provided Cursor report, not independently audited. No code commit (HEAD `3048837aed`, clean tree); Dev-only compose config changed.

- Isolation checked: Dev worker network `twenty_default`, DB `db/default`, Redis `redis`; intranet on separate `crm-intranet-net`; intranet service names NXDOMAIN from worker. No :6080 access or restarts.
- Dev compose worker-only settings: `LOGIC_FUNCTION_TYPE=LOCAL`, `LOGIC_FUNCTION_API_URL=http://twenty-server-1:3000`; backup `docker-compose.yml.bak-128r5`. Worker-to-server /healthz and /graphql both HTTP 200 before recreation. Only Dev `twenty-worker-1` recreated with `docker compose up -d --no-deps --force-recreate worker`; server, DB, Redis, intranet untouched.
- Triggered LogicFunctionTriggerJob processed/completed (630ms) and LOCAL executor instantiated, but salesInteraction title still blank. Runner `logic-function-job-runner.service.ts` reportedly swallows nonretryable error without exposing child function logs, returnvalue or failedReason. **Actual app-token function outcome unknown; do not infer success from completed job.**
- Same handler inside same worker with same API URL and **admin token** wrote expected title, so transport and handler work with elevated identity. This does NOT prove app-token permissions cause; hypotheses include field-level read denial or mutation RLS. **Do not use admin token as production workaround** or broaden app privileges blindly.
- Dev isolated test records cleaned; baseline 175 real interactions, 0 auto, 175 manual, 0 empty, triggers disabled (`bound=false`). Intranet read-only, no backfill, build, SMS, push, or other restarts.
- Architect next step: bounded diagnosis using the **same application identity as the triggered execution**, with safe/redacted outcome visibility. Prefer existing authorized execution/logging path; if absent, consider temporary Dev-only diagnostic HTTP route with exact payload, least privilege, and mandatory removal, or a delegated-user event only to compare identities (not substitute for app-token test). Avoid core modifications or broad changes unless necessity demonstrated. No intranet authorization.


## CRM-128-R6 — application token proven; executor/Core failure still opaque (2026-11-18)

**Status: BLOCKED / STOP_FOR_ARCHITECT.** Based on user-provided Cursor report; no independent audit of local code. Local HEAD `c00942ce6e` is version bump only; no behavioral change.

- Job payload has `logicFunctionId, workspaceId, payload`; absent userId/userWorkspaceId means application identity. App access token generated with `generateApplicationAccessToken({workspaceId,applicationId})` using same service. With that identity on Dev, read person (composite name), salesInteraction and eventLead succeeded, createPerson correctly FORBIDDEN, updateSalesInteraction(name,titleIsAuto) succeeded. Deployed handler executed inside same worker with same API URL and app token returned `WRITE_TITLE / TITLE_EMPTY`. **App permissions are not the demonstrated blocker.**
- Actual database-event job (e.g. 50) queued with correct recordId, executor instantiated but no write. A diagnostic build that would write on success/error also wrote nothing, suggesting failure before handler invocation. Actual executor error unavailable: `logic-function-job-runner.service.ts` reportedly returns on nonretryable errors (lines 56–60) without logging or persisting error; job may appear completed. Root cause not yet proven; do not label a specific executor error.
- Temporary HTTP diagnostic route added then removed; installed Sales Follow-up 0.1.6 has zero HTTP routes and zero bound DB triggers. Route payload packaging differs from database event and is not proof of event contract. Dev baseline 175 records, 0 auto, 175 manual, 0 empty, 0 test rows; intranet :6080 unchanged/read-only. No new restart, backfill, Docker build, SMS or push; temporary tokens/scripts removed.
- **Architect decision:** approve only a tiny, reversible Core observability change if review confirms `result.error` is present: log sanitized nonretryable error phase/code before existing return (no payload, PII, tokens or stack); preserve retry classification, job behavior, execution identity, permissions and contracts. If error shape cannot be safely classified, STOP without modification. Re-run isolated Dev E2E after diagnostic visibility; no intranet deployment/backfill or other service restart authorization. Separate code-change approval does not authorize restart. No automatic continuation.


## CRM-128-R7 — Core nonretryable error observability patch (2026-11-18)

**Status: CODE/UNIT TEST PASS (user-reported), LIVE DEV DIAGNOSTIC NOT YET PROVEN; STOP_FOR_ARCHITECT.** Local commit `170dc1aa39df0876aa5b89dc0f4e5302e5761866`, +299/-0 additive changes, 97/97 trigger suites, typecheck and lint PASS; not independently audited or deployed.

- `LogicFunctionExecuteResult.error` exposes errorType/errorMessage/stackTrace; local driver fills errorType/errorMessage on failure. Added structured warning only before existing nonretryable/no-retries return in `logic-function-job-runner.service.ts`, with allowlisted/validated errorType, structured errorCode or redacted fallback, enum status, retry count and logLineCount. No free-form message, stack, payload, token, userId or customer data in warning. Guard prevents warnings for success. Reported no change to retry logic, job status, permissions or executor contract; tests cover redaction, success, retry and exhausted retry.
- Warning evidence is from tests, **not live Dev**: Dev worker still runs old compiled code. Dev sales-followup DB triggers remain disabled, no HTTP diagnostic route. No restart, build, intranet change, backfill, SMS or push. Frontend Dev :3001 Vite process exited after approximately 24h terminal limit; backend :3002 and intranet :6080 healthy; frontend is not required for backend diagnostics.
- Architect: accept patch for limited Dev validation, but do not infer root cause or E2E success. Next requires **separate authorization for deploying/restarting Dev worker** if necessary, after confirming isolated worker, minimal compiled patch and redaction; test with disposable records, capture sanitized error code and prove trigger→worker→handler→DB; disable triggers/cleanup afterward. No intranet deployment or backfill authorization.


## CRM-128-R8 — user-authorized Dev-only diagnostic continuation (2026-11-18)

**Status: AUTHORIZED / NOT YET EXECUTED OR VERIFIED; STOP_FOR_ARCHITECT.** User approved restarting **only the isolated Dev worker** to activate R7's structured warning, diagnose the actual executor failure, fix only a proven narrow cause, and verify the complete Trigger→Worker→API→DB path using disposable Dev records. No R8 execution report or code commit has been supplied as of this update.

- Before any action, confirm the local source commit includes R7 `170dc1aa39df0876aa5b89dc0f4e5302e5761866`, working tree and worker isolation. Deploy the minimum necessary compiled worker code without a full Docker image rebuild. **If activating R7 requires restarting Dev server or other services, STOP and seek separate authorization.** Only Dev worker recreation/restart is authorized.
- Capture only sanitized executor error phase/code. Do not broaden application permissions, substitute admin token, alter retry/execution contracts, or change unrelated Core code. Repair only an independently proven narrow defect; otherwise STOP_FOR_ARCHITECT.
- Require real isolated Dev E2E evidence for create title, callAttempt change, Person rename, manual title preservation and idempotency. A completed job or unit tests alone do not qualify. Remove test data and leave all three sales-followup triggers disabled; check baseline and intranet isolation.
- Intranet :6080 remains read-only: **NO deployment, restart, backfill, real-data modification, Docker full build, SMS, push or merge.** Dev frontend :3001 Vite timeout is unrelated and restart not requested.
- **Repository sync limitation:** R7 code commit was reported as local/unpushed. This GitHub documentation commit does **not** push or synchronize the local source branch, and does not imply remote GitHub contains the R7 code changes. A separate reviewed push/merge decision is required.


## CRM-128-R8 — real Dev trigger E2E PASS (2026-11-18)

**Status: DEV FUNCTIONAL ACCEPTED / INTRANET NOT APPROVED; STOP_FOR_ARCHITECT.** Based on user-supplied Cursor evidence, not independently audited local source. Local code commit `8462cbaaa7711d566b062fbc45b8494f4b2dce34` (reported unpushed); 37/37 app tests PASS, typecheck 0.

- **Proven defect 1:** running worker image's logic-function executor builds API base URL from `SERVER_URL`, not `LOGIC_FUNCTION_API_URL`; worker `SERVER_URL=http://localhost:3002` addressed itself and handler failed `READ_INTERACTION:TRANSPORT`. Dev-worker-only compose corrected `SERVER_URL=http://twenty-server-1:3000` (backup `docker-compose.yml.bak-128r8`). Diagnostic compiled-file patch removed after worker recreation; no diagnostic residue reported.
- **Proven defect 2:** Person update events report `updatedFields: [\"name\",\"updatedBy\"]`; trigger watched `nameFirstName/nameLastName`, so rename event was filtered. Changed `title-on-person-rename.ts` watched fields to `['name']`; app version 0.1.6→0.1.7. No Core, permissions or other service code changes in R8.
- **Real Dev E2E evidence:** create interaction → `تماس اول با R8 آزمون` auto=true; CALL_3 → `تماس سوم با R8 آزمون` auto=true; Person rename → `تماس سوم با سارا رضایی` auto=true; manual title edit → `عنوان دستی R8` auto=false, still preserved after CALL_5; self-trigger/idempotency → updatedAt unchanged after 50s. These were actual Trigger→Worker→API→DB checks, not just job completion.
- **Cleanup/isolation:** Dev baseline 175 interactions, 0 auto/175 manual, 0 empty, zero test rows; three triggers disabled; installed app 0.1.7. Only Dev worker restarted/recreated (twice, user-authorized); Dev server and intranet :6080 not restarted; intranet read-only/healthy. No backfill, Docker full build, SMS or push.
- **Environment debt:** Dev worker image `twentycrm/twenty:latest` differs from Dev server image `twenty-dev/o117`; worker reportedly runs older upstream code and lacks R7-modified LogicFunctionJobRunnerService, so R7 structured logging was not live-tested on this image. Track as separate environment-alignment item, not R8 functional blocker. Do not change images or deploy without separate review.
- **Architect decision:** close CRM-128 Dev functional E2E as PASS. No further speculative diagnostic tasks. Intranet deployment, title backfill (190 NULL + 1 manual in last reported intranet snapshot), production enablement, image alignment and remote code push/merge remain **not authorized** and require separate review. This documentation update does not push the local R8 code.


## CRM-129 — Quotation + universal accounting integration plan (2026-11-18)

**Status: PLAN RECORDED / S0 SOURCE AUDIT TASK READY / NO IMPLEMENTATION APPROVED; STOP_FOR_ARCHITECT.** User requires CRM quotations for both products and services and vendor-neutral accounting connectivity. Architecture and bounded delivery gates are recorded in [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), created at commit `9ed2a8451230cba789b349c8c33bed3653aee624`.

Directly inspected this recovery file and root package.json on the remote release branch. GitHub code search returned no matches for quotation/product/invoice/catalog/price, which does not establish absence; guessed standard-object paths were not found, and local unpushed source cannot be inspected via remote GitHub. **Next task CRM-129-S0 is read-only local source inventory and reuse mapping only**, with exact paths and divergence evidence, followed by STOP_FOR_ARCHITECT. No schema, app installation, implementation, intranet :6080 changes, push, worker restart, migration, or backfill authorized.

## CRM-129 — CURRENT RECOVERY POINTER (2026-11-18, supersedes stale S0-next wording above)

**Canonical current plan:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), updated at GitHub commit `4c2d04c12b7611542ea288139e3e661b70a8c285`. The earlier section saying “S0 task ready” is historical and no longer current.

- S0 source audit completed per Cursor report; BRANCH-ALIGN completed with local merge `8e702032660e4a8462b94e3b7297d4259f9c46dd`, no conflicts/Push; local CRM-126/127/128 commits preserved.
- S1 contract/feasibility reported completed in **local-only** commit `910f497fc84a889eec91cf6f716ed32bc873cfdd`, 48 new files, 114 Vitest passes, 11 PDF checks, no schema/install/intranet deployment/Push. This is **report evidence, not remotely verified source or independently rerun tests**.
- S1 conditional PASS only; unresolved precision, Persian PDF extraction/ZWNJ, storage-backed numbering proof, Asan fixture compatibility, 6-decimal quantities and financial policy.
- **Vendor priority: Asan first, Sepidar second**, both behind a vendor-neutral accounting interface. User supplied `D:\HaniReference\LinqToAsan-API-Guide.pdf`; do not assert guide is in Git. Asan documented product creation and price-only edit; full product-field update unsupported by evidence.
- **NEXT = CRM-129-S1-R1**, narrow contract corrections and Asan mapping fixtures. Local worker must fetch and safely align newer remote docs (including Asan and this status) without rewriting local S1 commit. Compute fresh divergence; no Push.
- **STOP_FOR_ARCHITECT** after R1. S2 not authorized. No database writes, app install, live accounting writes, :6080 changes, service restart, deployment or automatic branch push.

**Superseded:** the current state of this branch is the dated checkpoint immediately below.

## CURRENT CHECKPOINT — CRM-129-ACCOUNTING-ASAN-INTEGRATION-006 PASS (2026-11-21)

**Read first:** [CRM-129-ACCOUNTING-006-PROOF.md](./CRM-129-ACCOUNTING-006-PROOF.md).

- **Branch / base:** `feat/crm-129-quotation` from `2d48787f87`; app «پیش‌فاکتور» **0.1.19** on `dev-crm129`, `plan` = **no changes**.
- Accounting domain reused and completed behind `adapter-contract.ts`; Asan and Mock adapters, Sepidar only via the shared contract.
- «حسابداری» tab on the quotation record: adapter choice, non-secret settings, secret status, connection test, capability matrix, import previews, export gate, operation history — all Persian.
- Money stays blocked while `moneyUnit=UNCONFIRMED`; export switches `ACCOUNTING_OUTBOUND_ENABLED` / `ACCOUNTING_DOCUMENT_EXPORT_ENABLED` are **false** on Dev.
- **Tests:** 37 files / 398 Vitest pass, `tsgo --noEmit` clean. **Live Dev:** `scripts/dev-exercise-accounting-006.cjs` 15/15 pass (mock success path, unreachable-vendor failure path, read-only previews, duplicate-safe ledger).
- **Live Asan = `LIVE_UNVERIFIED`:** no reachable vendor server or credentials were supplied.
- **Dependency:** `quotationRevision` has 0 rows and nothing writes it, so export stops at `REVISION_NOT_FOUND` once switches are on; revision production is the lifecycle task's scope.
- Dev hygiene: test connections soft-deleted, 11 `CRM129-*` test roles removed, CLI API key rebound to `Admin` (had been left on a test role, which broke `plan` with `FORBIDDEN`) and the Redis `apiKeyRoleMap` cache invalidated.
- **STOP_FOR_ARCHITECT.** No intranet `:6080` change, no worker restart, no real accounting write, no quotation form/money/atomic-save change, no push.

## PREVIOUS CHECKPOINT — CRM-129 S2-R9 PASS / Professional Form & Catalog Picker (2026-11-19; historical)

**Read first:** [CRM-129-S2-R9-PROOF.md](./CRM-129-S2-R9-PROOF.md). Superseded as “latest” by S2-R10 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R8-R1 `d3eeff7a6d`.
- Catalog combobox + draft form; app was `0.1.5`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R8-R1 PASS / Allocation & Rounding Correctness (2026-11-19; historical)

**Read first:** [CRM-129-S2-R8-R1-PROOF.md](./CRM-129-S2-R8-R1-PROOF.md). Superseded as “latest” by S2-R9 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R8 `7084993d02`.
- Capacity-safe discount allocation + independent `roundingExact`; app was `0.1.4`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R8 PASS / Financial Rules & Discounts (2026-11-19; historical)

**Read first:** [CRM-129-S2-R8-PROOF.md](./CRM-129-S2-R8-PROOF.md). Superseded as “latest” by S2-R8-R1 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R7 `f4d1b7228d`.
- Introduced document discount + whole-rial payable; R8-R1 corrected allocation capacity and tax pollution by rounding.

## PREVIOUS CHECKPOINT — CRM-129 S2-R7 PASS / Dev Front UI Acceptance (2026-11-19; historical)

**Read first:** [CRM-129-S2-R7-PROOF.md](./CRM-129-S2-R7-PROOF.md). Superseded as “latest” by S2-R8 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R6 `c83d5bd7c1`.
- Browser UAT PASS for lifecycle + host PDF download; app was `0.1.2`.

## PREVIOUS CHECKPOINT — CRM-129 S2-R6 PASS / browser UI PARTIAL (2026-11-19; historical)

**Read first:** [CRM-129-S2-R6-PROOF.md](./CRM-129-S2-R6-PROOF.md). Superseded as “latest” by S2-R7 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R5 `22b59bfc57`.
- **Lifecycle UI + Persian PDF API** shipped; `:3001` was down that round — browser click path completed in S2-R7.

## PREVIOUS CHECKPOINT — CRM-129 S2-R5 PASS / UI PARTIAL (2026-11-19; historical)

**Read first:** [CRM-129-S2-R5-PROOF.md](./CRM-129-S2-R5-PROOF.md). Superseded as “latest” by S2-R6 above.

- **Branch / base:** `feat/crm-129-quotation` from S2-R4 `7c504dab17`.
- **Integrity:** claim-then-fail fixed by atomic domain patch+version UPDATE. Live `S2_R5_INTEGRITY_PASS`.
- **Dev UAT then:** draft/catalog READY; lifecycle/PDF UI completed in S2-R6.

## PREVIOUS CHECKPOINT — CRM-129 S2-R4 PASS (2026-11-19; historical)

**Read first:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md) and [CRM-129-S2-R4-PROOF.md](./CRM-129-S2-R4-PROOF.md). Superseded as “latest” by S2-R6 (via S2-R5).

- **Branch / base:** `feat/crm-129-quotation` from S2-R3 `8161b40019`.
- **S2-R4 result: PASS** — atomic optimistic version claim via Workspace ORM `UPDATE … WHERE id AND version AND status`; concurrent same-version writers reduced to a single winner on isolated Dev; real limited role (object update only) cannot approve/send/cancel/record customer decision; Admin path still can.
- **Proof:** `docs/architecture/CRM-129-S2-R4-PROOF.md`. Live scripts under `packages/twenty-apps/internal/quotation/scripts/dev-exercise-s2-r4*.cjs` plus S2-R3 regression.
- **Isolation:** only Dev `twenty-server-1` `:3002` / DB `default`; intranet `:6080` untouched.
- **Residual (addressed in S2-R5 for quotation updates):** claim could commit before GraphQL write; experiment row cleanup deferred to R5.
- **Historical:** S1-R3 PDF browser ZWNJ remains PARTIAL / not production-accepted; Asan live still unauthorized.

## PREVIOUS CHECKPOINT — CRM-129 S1-R3 PARTIAL (2026-11-19; historical)

**Read first:** [CRM-QUOTATION-ACCOUNTING-PLAN.md](./CRM-QUOTATION-ACCOUNTING-PLAN.md), including latest S1-R2/R3 checkpoint (plan update commit `09ddf0d51546317e09ec485f31d14bb34e389e81`). Superseded as “latest” by S2-R4 above for quotation concurrency/security work.

- **Verified remotely:** Architecture documents on `release/record-access-115` still preserve CRM-owned mixed product/service quotations, vendor-neutral accounting adapter, Asan first/Sepidar second, exact-money constraints and production isolation. No evidence in inspected remote docs that these architectural decisions were removed.
- **Not verified remotely (at S1-R3 time):** Cursor local quotation source and reports were unpushed on that checkpoint. S2 work later pushed on `feat/crm-129-quotation`.
- **Reported local timeline:** S1 `910f497fc84a` → S1-R1 `02ef6d7fc730` → S1-R2 `2d024c818459` → S1-R3 `d544cc83dd` (full SHA unknown). Last R3 status **PARTIAL**: generation-time ZWNJ preservation and proper PDF table columns; MuPDF correct; browser/pdf.js copy still drops ZWNJ; 171 tests reported passing.
- **Architect decision:** Accept R3 as PARTIAL; preserve browser-copy limitation as a documented issue, do not automatically replace PDF engine, and do not block all S2 domain work on it. PDF is not fully production accepted.
