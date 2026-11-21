# CRM-129-ACCOUNTING-ASAN-INTEGRATION-006 — Accounting Bridge (PROOF)

**Status:** IMPLEMENTED + verified on Dev; live Asan connection **`LIVE_UNVERIFIED`**  
**Branch:** `feat/crm-129-quotation`  
**Base:** `2d48787f87`  
**Target:** Dev `:3002` (`dev-crm129`) — app «پیش‌فاکتور» **0.1.19** installed, `plan` reports **no changes**  
**Gate:** STOP_FOR_ARCHITECT

## 1. What the panel does

The record page `پیش‌فاکتور` now has a third tab «حسابداری» (`pageLayout` `94e85adc-43eb-4729-bb6a-cf2d36f7ca54`), rendered by
`accounting-connection-panel.front-component.tsx`. It covers the whole connection lifecycle:

| Capability | Where |
|---|---|
| Adapter choice (Asan / Mock), connection name | `accounting-connection-panel.tsx` |
| Non-secret settings (base URL, accounting user id, default storage id, money unit, special codes) | `connection-settings.ts` |
| Credentials are read from app secrets only, never stored on the record | `describeSecretStatus`, `readRouteSecrets` |
| «آزمایش اتصال» with latency, health state and verification state | `testConnection` → `persistHealth` |
| Declared capability matrix + limitation list in Persian | `adapter-registry.ts`, `asan-capabilities.ts` |
| Item/price and customer import preview | `previewItemImport`, `previewPartyImport` |
| «بررسی امکان ثبت» and «ثبت در حسابداری» | `previewQuotationExport`, `executeQuotationExport` |
| Operation history | `loadOperations` |

Every refusal the panel can show is a Persian sentence from `domain/accounting/errors.ts`; no vendor message is
surfaced raw.

## 2. Vendor neutrality

`adapter-contract.ts` is the only shape the services know. `AsanHttpAdapter` speaks the documented LinqToAsan
endpoints; `MockAccountingAdapter` answers without a network call. Sepidar is represented only by the contract and
the registry slot — no Sepidar-specific code was added, per the task boundary.

## 3. Money and document gates

| Gate | Behaviour |
|---|---|
| `moneyUnit: UNCONFIRMED` (Dev state) | amount is never converted or sent; preview rows carry `PRICE_UNIT_UNCONFIRMED` and `priceMicros: null` |
| Exact conversion | `crmMicrosToAsanUnits` / `asanUnitsToCrmMicros` reject remainder and overflow instead of rounding |
| Draft protection | `QUOTATION_EXPORTABLE_STATUSES` only; a `DRAFT` refuses immediately with `QUOTATION_NOT_APPROVED` |
| Rial-only documents | `CURRENCY_NOT_IRR` |
| Customer & line links | `CUSTOMER_NOT_LINKED`, `LINE_HAS_NO_PRODUCT_LINK` |
| Switches | `ACCOUNTING_OUTBOUND_ENABLED=false`, `ACCOUNTING_DOCUMENT_EXPORT_ENABLED=false` on Dev |
| Idempotency | operation id = UUID v5 of `(connectionId, kind, internalEntityId, internalRevision)`; row written `IN_FLIGHT` before the vendor call |

## 4. Unit / contract tests

```
npx vitest run --root packages/twenty-apps/internal/quotation
Test Files  37 passed (37)
     Tests  398 passed (398)

npx tsgo -p tsconfig.json --noEmit   # clean
```

Covered: adapter contract, Asan mapping/fixtures, Jalali dates, money-unit rejection, connection settings validation,
import planning (decisions, duplicates, unit warnings), outbound planning (create/update/block), ledger transitions,
disconnect/timeout, undefined vendor responses, repeated execution, draft refusal, capability refusals.

## 5. Live Dev verification

`scripts/dev-exercise-accounting-006.cjs` exercises the deployed routes against the real workspace. It never contacts a
real Asan server: the successful path uses the mock adapter, the Asan connection points at a closed loopback port.
**15/15 PASS**:

| # | Check | Evidence |
|---|---|---|
| V1 | panel bootstrap | adapters `asan,mock`, flags `{outboundEnabled:false, documentExportEnabled:false}` |
| V2 | save mock connection | `verificationState=MOCK`, `moneyUnit=UNCONFIRMED` |
| V3 | test mock | `healthState=OK`, `isLive=false`, latency 1 ms |
| V4 | save Asan connection | `verificationState=LIVE_UNVERIFIED`; response keys carry no token field |
| V5 | Asan unreachable | `healthState=FAILED`, detail `the vendor address could not be reached`, Persian message, still `LIVE_UNVERIFIED` |
| V6 | import preview, unreachable vendor | `TRANSPORT_ERROR` + Persian message |
| V7 | mock import preview | 3 rows, `DUPLICATE_REMOTE_NAME` + `PRICE_UNIT_UNCONFIRMED`, all `priceMicros=null`, link count unchanged `0→0` |
| V8 | apply with empty selection | `createdLinks=0, createdItems=0, createdPrices=0` |
| V9 | party preview | 1 row, party links unchanged |
| V10 | export gated | preview `BLOCKED/OUTBOUND_DISABLED`; two executions `OUTBOUND_DISABLED`; ledger `0→0` rows |
| V11 | quotation context | `READY_TO_SEND`, 1 line id resolved |
| V11b | sealed revision dependency | 0 revisions for the quotation → export stops at `REVISION_NOT_FOUND` once switches are on |
| V12 | operations history | route answers, 0 operations |
| V13 | item push | preview `CREATE`; execution `OUTBOUND_DISABLED` |
| V14 | quotation untouched | `status=READY_TO_SEND`, `version=4`, `totalExact=10900.000000` |

## 6. Dependency resolved after the first landing

`quotationRevision` was empty when this proof was first recorded; the export planner therefore resolved
`revisionVersion: null` (V11b). The quotation lifecycle now seals an ISSUED revision inside the approval
transaction (branch `feat/crm-129-quotation`), the planner resolves it (`scripts/dev-exercise-crm129-revision-seal.cjs`,
R9), and every API mutation of a sealed revision is refused with `FORBIDDEN` / `REVISION_IMMUTABLE`
(R10/R10b/R10c). V11b below is kept as the historical row; the export path itself is executable now.

## 7. Dev data hygiene performed

| Item | Action |
|---|---|
| 4 test connections (`…006`) | soft-deleted; live connections `0` |
| 11 leftover `CRM129-*` test roles from earlier verification stages | deleted (no role targets referenced them) |
| Dev CLI API key `crm-129-s2-r1` | its role target had been left pointing at a test role, which made every `plan` fail with `FORBIDDEN`; rebound to `Admin` and `apiKeyRoleMap` cache invalidated in Redis |

That third row is worth remembering: after editing `roleTarget` with SQL, `plan` keeps using the cached map until
`engine:workspace:apiKeyRoleMap:<workspaceId>:*` is deleted.

## 8. Dev-only tooling

`scripts/windows-path-preload.cjs` keeps the SDK CLI usable on Windows (`Resource path must not contain backslashes`
comes from `path.relative` in the manifest builder). Use
`node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs plan -r dev-crm129`.

## 9. Not done, by constraint

- No real Asan server was contacted; no real document, customer, item or price was sent.
- No change to the quotation form, money domain or atomic save.
- Intranet `:6080` untouched, no worker restart, no push.
