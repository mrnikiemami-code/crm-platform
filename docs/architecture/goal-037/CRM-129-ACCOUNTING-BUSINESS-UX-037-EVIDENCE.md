# CRM-129-ACCOUNTING-BUSINESS-UX-037 — Evidence

**Mode:** IMPLEMENT + ARCHITECTURE COMPLIANCE + BUILD + VERIFY  
**Date:** 2026-11-26  
**Branch:** `feat/crm-129-quotation`  
**Commit:** `c5c350d600c3a792952134a51a4ff598106cb6dd`  
**App:** `quotation@0.1.77` applied on Dev (`dev-crm129`)  
**Image:** `twenty-dev/crm129:c5c350d600c3a792952134a51a4ff598106cb6dd`  
**Image ID:** `sha256:8e0d740c26789e48152e3edcaf21caa7499a856ba751c7ca68e35c0d9f5694a5`  
**Intranet `:6080`:** untouched (`crm-intranet/twenty:53db32b3`)  
**Final gate:** `STOP_FOR_ARCHITECT`

## Verdict

`READY_FOR_ARCHITECT_REVIEW` with documented residuals.

Goal 023 remains ACTIVE / NOT COMPLETE. Outbound master switch stays off (`OUTBOUND_DISABLED`). No real Asan document send. No hot patch. No Intranet mutation.

Task text target was `0.1.73`; Dev already carried `0.1.73–0.1.76` from interim UX work, so this deliverable ships as `quotation@0.1.77`.

## 1. Git / gates

| Check | Result |
| --- | --- |
| Commit | `c5c350d600` pushed to `origin/feat/crm-129-quotation` |
| `npx tsgo --noEmit -p tsconfig.spec.json` (quotation) | PASS |
| Vitest accounting + nest-response | **91 PASS** |
| Vitest accounting + import service | **102 PASS** |
| Jest `accounting-operation-dispatch.service.spec.ts` | PASS |

## 2. Immutable image + deploy

| Item | Value |
| --- | --- |
| Build script | `packages/twenty-apps/internal/quotation/scripts/build-crm129-dev-image.ps1 -Commit HEAD -PlatformVersion 1.0.0` |
| Image tag | `twenty-dev/crm129:c5c350d600c3a792952134a51a4ff598106cb6dd` |
| Image ID | `sha256:8e0d740c26789e48152e3edcaf21caa7499a856ba751c7ca68e35c0d9f5694a5` |
| `twenty-server-1` | same tag + digest; healthy |
| `twenty-worker-1` | same tag + digest |
| Overlay | `APP_VERSION=''` + `LOGIC_FUNCTION_API_URL=http://127.0.0.1:3000` on server |
| Hot patch | **Not used** |

## 3. Apply

```text
node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force
→ quotation@0.1.77 synced (connection/import/outbound LF + accounting front components)
```

New Nest action: `accounting-outbound-list-exportable-quotations` (in image + client map).

### Legacy `/s`

| Path | Status |
| --- | --- |
| `/s/quotation/accounting-connection` | 404 `TRIGGER_NOT_FOUND` |
| `/s/quotation/accounting-import` | 404 `TRIGGER_NOT_FOUND` |
| `/s/quotation/accounting-outbound` | 404 `TRIGGER_NOT_FOUND` |

## 4. Acceptance matrix (Dev)

Workspace default mock connection: `8343ab54-eb2a-4fe2-bef9-403691f1135b` («اتصال ماسک بازبینی نسخه»).

### Connections

| ID | Result | Evidence |
| --- | --- | --- |
| A01 | PASS | Browser: no temp-view controls; workspace default only |
| A02 | PASS | Browser: only `عملیات …` row menus; menu items ویرایش / آزمایش / پیش‌فرض / غیرفعال |
| A03 | PASS | Menu label `غیرفعال کردن`; no `بازنشسته` |
| A04 | PASS | Mock form: no mock-profile / money / tax fields (`SHOW_CONNECTION_FINANCIAL_UI=false`) |
| A05 | PASS | Asan still shows service URL only for live connectivity |
| A06 | PASS | Adapter select drives connectivity fields; financial sections gated off |
| A07 | PASS | Save merges prior `moneyUnit` / `financial` / mappings from existing record |
| A08 | PASS | Default `isDefault:true` survives reload (`accounting-connection-list`) |

### Products

| ID | Result | Evidence |
| --- | --- | --- |
| B01 | PASS | Browser products toolbar: `انتقال انتخاب‌شده‌ها` absent until selection |
| B02 | PASS | UI shows header checkbox + top `انتقال همه` / search / filters |
| B03 | PASS | Nest `apply-items` on external `1001`,`1002` → linked; summary `linked:2` |
| B04 | PARTIAL | Transfer-all client walks pages ignoring search; multi-page Nest apply exercised only via pageSize=25 + next page UI present |
| B05 | PASS | Re-apply same ids → `refused: already linked and unchanged`; no new links |
| B06 | PASS | Duplicates remain `blocked:2` / not in apply selection set |
| B07 | PASS | Display uses Persian whole-rial formatter (`formatExactDecimalForPeople`) |

### Customers

| ID | Result | Evidence |
| --- | --- | --- |
| C01 | PASS | Multi-select + CRM picker retained in UI |
| C02 | PARTIAL | LINK_SUGGESTED set empty on current mock/CRM national-code data; UI path ready |
| C03 | PARTIAL | Transfer-all pages with empty search; full multi-page create/link not proven on Dev data |
| C04 | PARTIAL | No LINK_SUGGESTED rows available after refresh in this workspace |
| C05 | FAIL | `createNew` apply returned `QUERY_ERROR` / CRM create permission via app token path |
| C06 | PASS | Ambiguous/duplicate decisions excluded from auto transfer-all |
| C07 | N/A | No successful party write in this run to re-apply |

### Documents

| ID | Result | Evidence |
| --- | --- | --- |
| D01 | PASS | `list-exportable-quotations` → 20 ISSUED/exportable rows; UI pending tab shows QT-* |
| D02 | PASS | Queue requires ISSUED revision; drafts omitted by query |
| D03 | PASS | Sent filter uses SUCCEEDED ops; sample all `PENDING` |
| D04 | BLOCKED | Execute returns `OUTBOUND_DISABLED` (Goal 023 / no live write keys) |
| D05 | BLOCKED | Same — outbound master switch off |
| D06 | N/A | No partial success run while outbound off |
| D07 | PASS | Preview decision `BLOCKED` for incomplete mapping |
| D08 | PASS | Double execute both `OUTBOUND_DISABLED`; in-flight guard present in UI |
| D09 | PASS | Operations history section retained under documents |
| D10 | PASS | No Asan write; execute fail-closed |

### Security / Regression

| ID | Result | Evidence |
| --- | --- | --- |
| E01 | PASS | `pilot.b` `apply-items` → `FORBIDDEN` |
| E02 | PASS | Nest dispatch retains workspace auth + connectionId validation |
| E03 | PASS | `/s` routes 404 |
| E04 | PASS | `OUTBOUND_DISABLED` on execute |
| E05 | PARTIAL | Quotation list/settings pages load; dedicated draft/PDF retest not re-run this pass |
| E06 | PASS | Local typecheck + vitest + jest green (see §1) |
| E07 | PASS | Server/worker identical digest `sha256:8e0d740c…` |
| E08 | PASS | Intranet containers unchanged on `crm-intranet/twenty:53db32b3` |

## 5. Residuals for architect

1. **C05 party create:** `createPerson`/`createCompany` via record GraphQL under import LF needs CRM create authority; current Dev app-token path returned `QUERY_ERROR`. Manual CRM picker remains.
2. **D04/D05 mock send:** cannot complete successful isolated send while `ACCOUNTING_OUTBOUND_ENABLED` is false; enabling it risks live adapters — left off per Goal 023.
3. **Overview documents pending count** may show `—` until queue load; cards do not invent zero.
4. Financial connection form fields are intentionally hidden; domain data preserved on connectivity save.

## STOP_FOR_ARCHITECT

Source + `quotation@0.1.77` + immutable image `c5c350d600…` deployed with matching server/worker digests; Nest list-exportable live; products transfer proven; document queue live; outbound remains fail-closed; customer auto-create residual documented.
