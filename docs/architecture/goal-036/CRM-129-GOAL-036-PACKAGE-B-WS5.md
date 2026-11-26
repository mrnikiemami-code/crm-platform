# CRM-129-GOAL-036 — Package B / WS5 evidence

**Status:** TECHNICALLY_VERIFIED (not USER_ACCEPTED)  
**App:** `quotation@0.1.67`  
**Contracts:** C1–C7, F7  
**Parent:** Goal 023 ACTIVE

## Initial issue

Connection settings could invent CRM currency identities (`USD`/`EUR` hard-coded) and free-text CRM-side tax authoring patterns blurred ownership. Orphan vendor maps had no clear operator signal.

## Domain ownership matrix

| Field | Domain owner | Stored on | Edited in | Locked when | Snapshot | Adapter receives |
| --- | --- | --- | --- | --- | --- | --- |
| Tax policy `accountingCode` | Tax Policy catalog | `taxPolicy` | پیش‌نیازهای حسابداری | First non-empty snap on quotation (C4) | Line/header seals | Not redefined in connection |
| Currency `accountingCode` | Currency catalog | `quotationCurrency` | پیش‌نیازهای حسابداری | Same C4 | Document currency seal | Not redefined in connection |
| Item `accountingCode` | Catalog item | `catalogItem` | Item form | Separate contract | Item snapshot | Mapping/link external id |
| Person/Company `accountingCode` | Party | Standard object field | Record form | Separate contract | Party snapshot | Mapping/link external id |
| Vendor tax map | Connection settings | `taxPolicyMappings` | تنظیمات حسابداری → اتصال | N/A (vendor) | Used at preview/send | Destination tax code |
| Vendor currency map | Connection settings | `currencyMappings` | همان | N/A | Preview/send | Destination currency code/name |
| Asan special item codes | Adapter vendor mechanics | Connection advanced | Advanced details | N/A | Outbound plan | Special row codes |

## Root cause / decision

CRM identity lives only in tax/currency catalogs. Connection form keeps **vendor destination** maps bound to those catalog rows; orphans stay visible without purge.

## Changes

| File | Change |
| --- | --- |
| `accounting-shared.tsx` | `readCurrencies`, `resolveCurrencyMappingRows`, `resolveTaxPolicyMappingRows`; IRR-only fallback |
| `accounting-connection-form.tsx` | Catalog-bound currency rows; destination tax-code `<select>` when catalog exists; orphan alerts |
| `accounting-connections-section.tsx` | Pass `currencies` |
| `accounting-settings-panel.tsx` | Load currency catalog with tax policies |
| connections tests | Ownership / orphan / picker coverage |

## Contracts preserved

- F7: no CRM ledger-code redefinition in connection form
- C6: no physical purge of stored maps
- C2: no multi-currency activation (USD/EUR not invented)
- Money Domain / Nest authority / snapshots untouched

## Tests

| Suite | Result |
| --- | --- |
| `accounting-connections-section.test.tsx` | **45 PASS** |
| `accounting-settings-panel.test.tsx` | **8 PASS** |

Key scenarios covered: real IRR catalog row; no USD/EUR invent; save mapping; orphan currency; orphan tax policy; destination catalog picker; mismatch/unverifiable still honest.

## Remaining

- Live browser UAT of accounting settings page after Dev sync
- WS6 capability-driven shared Mock/Asan UI
- Item/person/company picker polish remains standard forms (C5) — out of this pack’s connection form
