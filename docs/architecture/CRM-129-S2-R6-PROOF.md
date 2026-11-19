# CRM-129-S2-R6 PROOF — Quotation lifecycle UI & Persian PDF

**Base:** `22b59bfc57`  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS** (API lifecycle + Persian PDF + Dev app surfaces); browser click-path on `:3001` **PARTIAL** (front was not listening during this round; host bridge + record page are in source and synced)

## 1. Source review (before change)

- Draft form + save-draft route already persisted DRAFT via app token.
- Status machine + server hooks (R3–R5) already enforced permissions/immutability.
- Spike PDF (`test/spikes/quotation-pdf`) used `@react-pdf/renderer` + Vazirmatn + ZWNJ patches; not wired to product.
- Front components only hold the **application** token; privileged approve/send need a **user session** bridge (Communication pattern).

## 2. Implementation

### User-scoped host bridge
- `callQuotationRoute` on front host API → `POST /rest/quotation/actions` with `credentials: 'include'`.
- Allow-list: `get-lifecycle`, `transition`, `generate-pdf`.

### NestJS quotation UI
- `QuotationUiController` + `QuotationUiService` + `QuotationPdfService`.
- Transitions call existing `assertQuotationUpdateAllowed` (atomic patch+version).
- Buttons gated by real `QuotationPermissionService` held permissions + legal edges.
- Persian error messages for version/permission/immutability codes.
- SENT = **record send only** (sets `sentAt`); customer decision sets `decidedAt` (internal; not online customer confirm).

### Persian PDF
- Spike layout/fontkit ZWNJ patches ported under `src/modules/quotation/pdf/`.
- Vazirmatn vendored at `pdf/fonts/` (OFL) so Dev docker dist resolves `__dirname/fonts`.
- Download returns base64 PDF (no FILES field; avoids content-freeze on SENT).

### App UI surfaces
- Quotation `RECORD_PAGE`: tab **فیلدها** + tab **اقدامات** (lifecycle panel + PDF download).
- App `0.1.1` synced to Dev (`twenty apply -r dev-crm129`).

## 3. Live Dev proof (`:3002`)

Script: `packages/twenty-apps/internal/quotation/scripts/dev-exercise-s2-r6-ui-pdf.cjs` → **`S2_R6_UI_PDF_PASS`**

| Step | Result |
| --- | --- |
| get-lifecycle | success; enabled actions reflect Admin role |
| DRAFT → PENDING → READY → SENT → CUSTOMER_ACCEPTED | all success; Persian confirm messages |
| generate-pdf | ~11KB PDF written; Persian text path exercised |
| stale version conflict | Persian `هم‌زمان` message |

Regressions: **`S2_R3_LIVE_PASS`**, **`S2_R4_ROLE_PASS`**, **`S2_R5_INTEGRITY_PASS`**.  
Unit: jest quotation **13**, vitest quotation app **190**.

## 4. Manual UI path (when front is up)

1. Open `http://localhost:3001` (API `http://localhost:3002`).
2. Objects → **پیش‌فاکتورها** → open a quotation.
3. Tab **اقدامات**: lifecycle buttons (role-gated) + **دانلود PDF فارسی**.
4. Tab **فیلدها**: draft content edit while status allows; locked after READY/SENT.
5. Catalog/draft create paths unchanged (command menu / person-company create).

## 5. Isolation

- Only Dev `twenty-server-1` restarted after `docker cp` of quotation dist + fonts.
- Intranet `:6080` untouched (`rc=0`, started 2026-11-16).
- No Asan/Sepidar live, no SMS, no main-worker restart, no release-branch change.

## Residual

- Line-hook parent version claim can still bump parent if line insert fails after claim (documented since R5; not widened here).
- Browser pdf.js ZWNJ copy limitation remains PARTIAL (generation preserves ZWNJ; documented).
- `:3001` was down during this round — host bridge code is present; visual button click not re-attested in-browser here.

## STOP_FOR_ARCHITECT
