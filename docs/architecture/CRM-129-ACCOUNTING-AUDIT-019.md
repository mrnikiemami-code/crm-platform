# CRM-129-ACCOUNTING-SETTINGS-AUDIT-019

**Mode:** READ + AUDIT + PLAN — NO IMPLEMENTATION  
**Branch:** `feat/crm-129-quotation`  
**App path:** `packages/twenty-apps/internal/quotation`  
**Settings page:** `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2`  
**Gate:** `STOP_FOR_ARCHITECT`  
**Date:** 2026-11-25  
**Live UX witness:** authenticated Dev session (same date) — overview, connections (19 rows), customers error state. No vendor HTTP from this audit; no DB write; no deploy; no design-tool run.

Evidence is from source, unit/integration tests, prior Dev UAT scripts in recovery, and the signed-in walkthrough above. Capabilities without a witness are never marked COMPLETE.

---

## S0 — Product shape (what exists)

The accounting settings surface is a five-section shell (`AccountingSettingsPanel`):

| Section | Role |
|---|---|
| نمای کلی | Connection health, snapshot freshness, next actions |
| اتصال‌ها | Multi-connection list + shared form (Mock / Asan) |
| کالاها | Destination catalog → CRM item mapping |
| مشتریان | Destination parties → CRM person/company mapping |
| اسناد | Export readiness + `accountingSyncOperation` history |

Related quotation UI: `accounting-connection-panel.tsx` on the quotation record (preview / constrained dispatch).

**Adapter registry (operational):** `asan`, `mock` only (`ACCOUNTING_ADAPTER_IDS`).  
**Sepidar:** display-only `SEPIDAR_UNAVAILABLE` — not an adapter, cannot be saved.

**Connection route actions:** `list` | `save` | `test` only. No `deactivate` / `delete` / `set-default`.

**Secrets:** not on the connection record; workspace `applicationVariables` (`ASAN_TUNNEL_TOKEN`, transport approval). Status shown as configured/not — values never returned to the UI.

**Outbound master switches (default off):** `ACCOUNTING_OUTBOUND_ENABLED`, `ACCOUNTING_DOCUMENT_EXPORT_ENABLED`.

---

## S1 — Requirement vs reality (functional)

Legend for “Product need”: how the CRM-129 accounting scope treats the capability in code/docs — not a new invention in this audit.

| # | Capability | Product need | Status | Evidence (paths) | Tests / witnesses | Risk | Architect decision? |
|---|---|---|---|---|---|---|---|
| 1 | Define new accounting connection | Required | **COMPLETE** | `logic-functions/accounting-connection.ts` `save` without id; server insert when `recordId` null; UI `startNewConnection` | `accounting-connection.service.test.ts`, settings UAT `010` | Low | No |
| 2 | Manage multiple independent connections | Required | **COMPLETE** | List all rows; per-`connectionId` import/outbound; UI list/select vs edit | `accounting-connections-section.test.tsx`, panel tests; live: 19 rows | Medium if selection semantics diverge (see #3) | No |
| 3 | Workspace default connection | Ambiguous | **PARTIAL** | No `isDefault` on `accountingConnection.object.ts`. Settings panel: **localStorage** `quotation:accounting:connection`. Quotation tab: first `isActive` then `[0]` — **not** the same rule | Panel tests cover localStorage; no cross-surface contract test | High — operator thinks “selected” is global | **Yes** |
| 4 | Per-connection settings | Required | **COMPLETE** | Isolated `settings` / `specialCodes` / `financialSettings` per record; form four blocks (identity, money, tax map, advanced) | Connection form + settings write tests; recovery ACCOUNTING-015 | Low | No |
| 5 | Currency / money-unit mapping | Required | **PARTIAL** | `financial-contract.ts` + Asan `SINGLE_CURRENCY` / `baseCurrency: IRR`; money unit UNCONFIRMED\|RIAL\|TOMAN; F1 currency mismatch gate exists | `financial-contract.test.ts`; recovery F1 closure | Medium — unit still operator-confirmed; live currency catalog thin | No (unless multi-currency product goal expands) |
| 6 | Tax/duty policy → destination codes | Required | **COMPLETE** (contract) | One `taxPolicyMappings` code per CRM policy; Asan special **item** codes separate (`999123/140/141`); duty via `DUTY_AMOUNT` row, not a second policy code; mismatch gates preview/dispatch | `tax-code-contract.test.ts`, `financial-contract.test.ts`, recovery ACCOUNTING-014 | Medium while Asan catalog unverifiable | No |
| 7 | Customer / party mapping | Required | **COMPLETE** (UI+service) | `accounting-party-link`; `accounting-customer-section.tsx`; import preview/apply | import + customer section wiring; read-strategy `013`; live: section renders, fails when connection unreachable | Medium at scale (REMOTE_UNPAGED caps) | No |
| 8 | Product / item mapping | Required | **COMPLETE** (UI+service) | `accounting-item-link`; `accounting-catalog-section.tsx`; snapshot paging | catalog + mapping services; scale tests | Medium — soft 20k / hard 100k | No |
| 9 | Quotation ↔ accounting | Required | **PARTIAL** | No accounting FK on `quotation` object; link via sync operations + sealed revision snapshot; document preview + export planner | `outbound-plan.test.ts`, `accounting-outbound.service.test.ts`, mock UAT `012` | High while export flags off / LIVE_UNVERIFIED | **Yes** (when to enable live dispatch) |
| 10 | Send / error / retry / anti-duplicate | Required | **PARTIAL** | Full op ledger + deterministic op IDs; Asan `remoteIdempotency: false` → reconcile before retry; **dispatch gated off by default** | outbound + sync-operation tests; UAT `012` zero ops with flags off | High if flags flipped without reconcile UX | **Yes** (go-live criteria) |
| 11 | Provider-specific features | Optional extras | **PARTIAL** | Asan: price-only update, special rows, unpaged lists — encoded in capabilities. Sepidar: **MISSING** adapter | asan-capabilities + registry limitations | Low for Mock/Asan path; Sepidar blocks that vendor | **Yes** (Sepidar priority) |
| 12 | Credentials / permissions / connection security | Required | **COMPLETE** (design) | Secrets off-record; tunnel + insecure-write approval; GraphQL connection writes guarded; `canManage` from server | settings UAT `010` S3/S6; write-guard specs | History may still hold past leaks elsewhere (tax UAT — out of scope here) | Rotation of any leaked secrets: **Yes** if shared |
| 13 | Deactivate / delete connection without harming history | Likely required | **MISSING** | `isActive` field exists but create always `true`; **no** deactivate/delete route; sync history objects retained only if row kept | Contrast tax-policy deactivate/delete; connection write guards block generic GraphQL delete | High — operators cannot retire a destination safely from UI | **Yes** |

---

## S2 — Providers

### Mock (`mock`) — `MOCK_ONLY`

| Area | Supported | Notes |
|---|---|---|
| List/create connections | Yes | Placeholder base URL `http://mock.invalid` |
| Profiles | Yes | Multiple mock financial profiles |
| Catalog / parties | Yes | In-memory dataset with deliberate defects |
| Document preview | Yes | No network |
| Live send | N/A | Never real traffic |
| UI for missing caps | Honest “آزمایشی” labels | |

**Implementation:** `MockAccountingAdapter`, profiles in `mock-profiles.ts`.  
**External API:** none.  
**Status:** operational for training/UAT.  
**Live witness:** many Mock rows in connections list with badge «آزمایشی — Mock».

### Asan / LinqToAsan (`asan`) — `LIVE_UNVERIFIED`

| Area | Supported in contract | Live-proven? |
|---|---|---|
| Products list/read/create | Yes (unpaged) | **No** (doc-derived) |
| Product update | PRICE_ONLY | **No** |
| Product delete | No | — |
| Customers list/create/update | Yes | **No** |
| Register proforma | Yes | **No** |
| Read document by id | No | — |
| Remote idempotency | No | — |
| Tax | TAX_AMOUNT via special item row | Catalog often absent → UNVERIFIABLE match |
| Duty | DUTY_AMOUNT via separate special row | Same |
| Currency | SINGLE_CURRENCY IRR | Code field not asked |
| Transport | Plain HTTP → tunnel required | Health probe does **not** promote to LIVE_VERIFIED |

**Implementation:** `AsanHttpAdapter`, endpoints from guide PDF (referenced in capabilities comments).  
**UI for gaps:** limitations list + capability table; test button labels “پاسخ سرور… تأیید نشده”; money-unit confirmation note.  
**Live witness:** selected Asan connection «آسان (بدون سرور) 006» → overview «بی‌پاسخ», customers «خواندن مشتریان انجام نشد» against `http://127.0.0.1:9` / `*.invalid` destinations — expected for unreachable Dev stubs; **not** a LIVE_VERIFIED proof.

### Sepidar

| Area | Status |
|---|---|
| Adapter | **Not implemented** |
| Registry | Not in `ACCOUNTING_ADAPTER_IDS` |
| UI | `SEPIDAR_UNAVAILABLE` copy only |
| Save | Would fail `ADAPTER_UNKNOWN` |
| Correct UI behaviour | Do **not** offer as selectable live destination until an adapter exists (current: mention in advanced details) |

---

## S3 — UX audit (product level, no redesign)

Findings from structure, prior Dev DOM reports, **and** a signed-in walkthrough of the accounting settings page (overview → connections → customers). No design generation was run.

1. **Two “active connection” mental models**  
   Settings remembers a connection in localStorage; the quotation tab uses first active row. Helper copy on connections («انتخاب این اتصال مقصد فعال همهٔ بخش‌های حسابداری را تغییر می‌دهد») claims workspace-wide selection, but that contract is browser-local, not shared with the quotation surface. **Workflow confusion / data integrity risk.**

2. **Connection list pollution (live: ۱۹ ردیف)**  
   Repeated UAT/Mock/Asan stubs («اتصال آزمایشی 006», multiple «آسان … 006») with no retire path. Operators cannot prune noise; search exists but does not replace lifecycle management. Status badges («تنظیمات ناقص» / «آزمایشی — Mock») are clear; volume is not.

3. **Overview honesty is strong; action duplication is noisy**  
   Live overview: connection «بی‌پاسخ», last test timestamp, sync «نخوانده», attention list «۱ مورد نیازمند رسیدگی», green banner that outbound send is disabled. Duplicate «آزمایش اتصال» (attention row + primary footer) is redundant but correct. Unlinked product/customer cards show presence dots without counts when sync never ran — ambiguous severity.

4. **Deep sections fail closed when destination unreachable**  
   Customers: clear error «خواندن مشتریان انجام نشد» + «تلاش دوباره». Mapping UI is present but unusable until connection health recovers — correct fail-closed; weak cross-link back to fix incomplete settings / test from the same error banner.

5. **Outbound is “ready” in UI language while flags are off**  
   Persistent gray note «ارسال سند به حسابداری در این نسخه غیرفعال است» on every section — good. Documents/overview readiness language must stay subordinate to that banner (see roadmap P2-3).

6. **Asan forever LIVE_UNVERIFIED**  
   Successful test does not flip verification. Correct honesty vs docs, but operators may not understand “reachable ≠ verified for fiscal use.” Live selected Asan is incomplete + unreachable — matches Dev stub, not production readiness.

7. **No retire path for a connection**  
   Cannot deactivate/delete from settings. Stale destinations stay in selectors forever → mapping and export targeting noise (amplified by ۱۹ rows).

8. **Tax mapping UX depends on tax settings elsewhere**  
   Connection form maps active CRM policies; duplicate policy **labels** (architect watchpoint) force code-level distinction. Cross-page journey tax panel ↔ accounting tax block is not guided.

9. **Provider-specific advanced codes**  
   Special item codes buried in closed details — correct for non-Asan mental model, but Asan installs that renumbered 999* codes will fail silently until advanced is opened.

10. **Scale honesty**  
    REMOTE_UNPAGED soft/hard caps are product truth; if UI understates incomplete sync, operators will trust partial catalogs.

11. **Credential messaging is good**  
    Form states secrets are not shown; tunnel/insecure approval visible as booleans — keep this pattern. No secrets observed in live DOM text in this audit.

12. **Select vs edit IA on connections is clear**  
    Live list separates «انتخاب این اتصال» from «ویرایش تنظیمات»; selected row shows «اتصال انتخاب‌شده» disabled. Footer explains the difference — keep; still does not solve #1 vs quotation tab.

**No design generation was run** (Taste / Superdesign / UI UX Pro Max / Composer design pass excluded by task). Design experiments 017/018 were not modified.

---

## S4 — Status matrix (required columns)

| قابلیت | وضعیت واقعی | فایل‌ها و مسیرها | تست و شواهد | ریسک | وابستگی‌ها | اقدام پیشنهادی | نیازمند تصمیم معمار |
|---|---|---|---|---|---|---|---|
| تعریف اتصال جدید | **COMPLETE** | `logic-functions/accounting-connection.ts`; connections section UI | service tests; UAT `010`; live «+ اتصال جدید» | Low | — | Keep; no rewrite | خیر |
| چند اتصال مستقل | **COMPLETE** | connection list + per-id services | section tests; live ۱۹ ردیف | Medium (noise) | P0-2 retire | Keep multi-conn; add retire later | خیر |
| اتصال پیش‌فرض workspace | **PARTIAL** | localStorage key in settings panel; quotation panel `find(isActive)` | panel localStorage tests only; **no** cross-surface test | High | Architect model | Unify rule or drop “پیش‌فرض” language | **بله** |
| تنظیمات مستقل هر اتصال | **COMPLETE** | connection form blocks; `settings` JSON per record | settings write tests; ACCOUNTING-015 | Low | — | Keep | خیر |
| نگاشت ارز / واحد پول | **PARTIAL** | `financial-contract.ts`; Asan SINGLE_CURRENCY IRR | financial-contract tests; F1 | Medium | Money-unit confirm | Keep gates; no invented Asan currency field | خیر* |
| نگاشت مالیات/عوارض → کد مقصد | **COMPLETE** (قرارداد) | `taxPolicyMappings`; Asan special item codes | tax-code + financial tests; ACCOUNTING-014 | Medium (catalog) | Tax panel labels | Keep contract; clarify labels (P1-3) | خیر |
| نگاشت مشتریان | **COMPLETE** (UI+service) | `accounting-party-link`; customer section | import/013; live error-closed | Medium scale | Reachable connection | Keep; honesty on incomplete sync | خیر |
| نگاشت کالاها | **COMPLETE** (UI+service) | `accounting-item-link`; catalog section | catalog/scale tests | Medium scale | Reachable connection | Keep; soft/hard cap honesty | خیر |
| ارتباط پیش‌فاکتور ↔ حسابداری | **PARTIAL** | sync ops + sealed revision; outbound planner; quotation accounting panel | outbound tests; UAT `012` | High | P0-1, P0-3 | Align connection resolve; keep flags off | **بله** (go-live) |
| ارسال / خطا / retry / ضدتکرار | **PARTIAL** | sync operation ledger; Asan `remoteIdempotency: false` | outbound + sync-op tests; flags default off | High | P0-3 | Reconcile-before-retry + flag UX | **بله** |
| قابلیت‌های اختصاصی ارائه‌دهنده | **PARTIAL** | asan-capabilities; mock profiles; Sepidar unavailable | capability descriptors | Low / Sepidar High if required | Vendor priority | Capability-driven UI only | **بله** (Sepidar) |
| احراز هویت / امنیت اتصال | **COMPLETE** (طراحی) | app variables; write guards; no secret on record | UAT `010`; write-guard specs; live no secret leak | Medium history | Secret rotation if shared | Keep pattern; rotate offline if needed | **بله** اگر نشت مشترک |
| غیرفعال‌سازی / حذف امن | **MISSING** | `isActive` field only; no route/UI | contrast tax-policy lifecycle | High | P0-1 | Soft deactivate + history retain | **بله** |
| آسان — اثبات زنده | **BLOCKED** / LIVE_UNVERIFIED | `AsanHttpAdapter`; health ≠ verified | no LIVE_VERIFIED witness; live stub unreachable | High fiscal | Tunnel + P0-3 | Verification program only after architect | **بله** |
| سپیدار | **MISSING** | `SEPIDAR_UNAVAILABLE` copy | none | Market | External API docs | Do not fake adapter | **بله** |
| پرچم‌های outbound | **PARTIAL** (ایمن خاموش) | env flags default false; UI banner | UAT `012` zero ops | High if flipped early | P0-3 | Keep off until checklist | **بله** |

\* مگر هدف محصول چندارزی گسترش یابد.

---

## Cross-cutting blockers (practical use)

Ordered by what prevents real accounting use today:

1. **Live Asan unproven** (`LIVE_UNVERIFIED`) + insecure transport defaults.  
2. **Outbound / document export flags off** — intentional safe default.  
3. **No remote idempotency** — retries need reconciliation workflow before go-live.  
4. **No connection retire API/UI** — amplified by ۱۹ Dev/UAT rows.  
5. **Default-connection semantics split** across surfaces.  
6. **Sepidar absent** if that vendor is a market requirement.  
7. **Unpaged catalog ceilings** (20k soft / 100k hard).  
8. **Reachability** — selected Asan incomplete + unreachable blocks mapping imports (expected until a real tunnel destination exists).

---

## What is deliberately out of scope for “rewrite”

Money domain, tax policy arithmetic, revision seal, PDF, and the adapter contract itself are mature enough that this audit does **not** recommend a greenfield rewrite. Gaps are lifecycle (default/retire), go-live gates, Sepidar adapter (if needed), and UX coherence — not a missing core.

Design experiment artifacts from **017 / 018** were not altered by this audit.

---

## STOP_FOR_ARCHITECT

No implementation authorized from this document. Roadmap tasks: `CRM-129-ACCOUNTING-ROADMAP-019.md`.
