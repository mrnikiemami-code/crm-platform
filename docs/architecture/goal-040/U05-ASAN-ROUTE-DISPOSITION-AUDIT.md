# Goal 040 — U05 route disposition source audit (Lane A)

Audited 47 guide method/path pairs against actual `asan-endpoints.ts`, `asan-wire-contract.ts`, `asan-http-adapter.ts` and `asan-approved-transport.ts` on finance branch at source checkpoint `12a7d702c5c86506352a92bb530ef8c5401047ed`. Source presence is not a verified CRM workflow or runtime PASS. No vendor request. All real writes remain disabled by approved read-only transport; all G1/G2 gates not authorized. A read route allowlisted does not mean it is active for a user; explicit binding and permission still required. Pending routes require exact typed contract, privacy and authority review in convergence; no speculative activation. This is an independently useful route audit, not U05 completion.

- OUT_OF_SCOPE / DISABLED: 16
- ADAPTER_SOURCE / LIVE_WRITE_OFF: 5
- PENDING_SCOPE_REVIEW: 14
- ADAPTER_SOURCE / READ_ALLOWLIST: 11
- ALLOWLIST_ONLY / NO_CALLER: 1

| Method | Guide path | Effect | PDF pages | Source status | Owner/scope |
|---|---|---|---|---|---|
| POST | `Factors/RegisterFactor` | WRITE | 3–4 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `PishFactors/RegisterPishFactor` | WRITE | 4–5 | ADAPTER_SOURCE / LIVE_WRITE_OFF | quotation/F06 |
| POST | `PishFactorsNew/RegisterPishFactor` | WRITE | 4–5 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `ReturnFactors/RegisterReturnFactor` | WRITE | 5 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `BuyFactor/RegisterFactor` | WRITE | 5–6 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `ReturnBuyFactors/RegisterReturnBuyFactor` | WRITE | 6 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `Factors/LastFactors` | READ | 7 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| POST | `Factors/LastCustomerFactors` | READ | 7 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `PishFactorsNew/LastPishFactors` | READ | 8 | ADAPTER_SOURCE / READ_ALLOWLIST | reconciliation/F06 |
| POST | `PishFactorsNew/LastCustomerPishFactors` | READ | 8 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `Factors3/GetFactorDetails` | READ | 8–9 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `FactorInformation/AddfactorState` | WRITE | 9–10 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `FactorInformation/UpdateFactorState` | WRITE | 10–11 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `FactorInformation/GetFactorState` | READ | 11 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `Customers/postCustomer` | WRITE | 11–12 | ADAPTER_SOURCE / LIVE_WRITE_OFF | customer/U03 |
| POST | `ParentCustomers/postCustomer` | WRITE | 12 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `Customers2/postCustomer` | WRITE | 12 | ADAPTER_SOURCE / LIVE_WRITE_OFF | customer/U03 |
| GET | `CustomersNew/AllCustomers` | READ | 12 | ADAPTER_SOURCE / READ_ALLOWLIST | customer/U03 |
| GET | `CustomersNew/OneCustomer` | READ | 12–13 | ADAPTER_SOURCE / READ_ALLOWLIST | customer/U03 |
| GET | `CustomersNew/CustomerWithNationalCode` | READ | 13 | ADAPTER_SOURCE / READ_ALLOWLIST | customer/U03 |
| GET | `CustomersNew/CustomerWithMobile` | READ | 13 | ADAPTER_SOURCE / READ_ALLOWLIST | customer/U03 |
| GET | `CustomersNew/LastCustomers` | READ | 13–14 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `CustomerCardex` | READ | 14 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductsNew/AllProducts` | READ | 15 | ADAPTER_SOURCE / READ_ALLOWLIST | catalog/B |
| GET | `ProductsNew/AllProducts2` | READ | 15 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductsNew/OneProduct` | READ | 15 | ALLOWLIST_ONLY / NO_CALLER | U05 — confirm need/permission |
| GET | `ProductsNew/OneProductWithoutSerial` | READ | 15 | ADAPTER_SOURCE / READ_ALLOWLIST | catalog/B |
| GET | `ProductsNew/AllProductsInSubProductCode` | READ | 15–16 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductsNew/LastProducts` | READ | 16 | ADAPTER_SOURCE / READ_ALLOWLIST | health |
| POST | `Products2/AddParentProduct` | WRITE | 16 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `Products4/AddProduct` | WRITE | 16–17 | ADAPTER_SOURCE / LIVE_WRITE_OFF | catalog/U02 |
| POST | `Products3/EditProduct` | WRITE | 17 | ADAPTER_SOURCE / LIVE_WRITE_OFF | catalog/U02 |
| GET | `ProductPriceNew/GetPrice` | READ | 17 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductPriceNew/GetAllPrice` | READ | 17 | ADAPTER_SOURCE / READ_ALLOWLIST | pricing/U02 |
| GET | `ProductPlus/AllProductPlus` | READ | 18 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductPlus/OneProductPlus` | READ | 18 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductStatisticsNew/AmarKala` | READ | 18 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductStatisticsNew/AmarKalaWithCount` | READ | 18–19 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductStatisticsNew/ProductStock` | READ | 19 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| GET | `ProductsNew/ProductStock` | READ | 19 | ADAPTER_SOURCE / READ_ALLOWLIST | inventory observation/U02 |
| POST | `ProductsNew/ProductListWithMojodi` | READ | 19–20 | PENDING_SCOPE_REVIEW | U05 — confirm need/permission |
| POST | `Receive/PostReceive` | WRITE | 20 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| POST | `Pay/PostPay` | WRITE | 20 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `Receive/GetReceives` | READ | 21 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `Banks/GetBanks` | READ | 21 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `Banks/GetBanksWithRemain` | READ | 21 | OUT_OF_SCOPE / DISABLED | not enabled in quotation scope |
| GET | `Stores/GetStores` | READ | 21 | ADAPTER_SOURCE / READ_ALLOWLIST | inventory reference/U02 |

## Required convergence checks
- Existing typed methods need end-to-end authority, role checks, explicit dataset binding, source field preservation and targeted fixture evidence; no assumption of verified fiscal amounts from readback identifiers.
- Customer create/update: adapter methods exist but U03 authorized CRM dispatch/claim/link and field ownership are not complete. No silent customer write on quote save.
- Read-only POST routes need explicit method/path/effect authorization, bounded body and response; do not grant generic POST. Mutating GET UpdateFactorState is excluded. Restricted cardex/balance/cost data must not enter normal catalog/customer observations.
- Serial-rich OneProduct is allowlisted but lacks adapter caller; current readback uses OneProductWithoutSerial. Do not treat serial preservation as proved. Product price and store observations remain B/integration contracts.
- Proforma alternative registration is not a retry/fallback. No sale/purchase/return, delivery-state or banking mutations within quotation scope. Historical guide documentation remains the 17-model field authority; field-level application mapping and tests must be completed after B.


## Integrated scope decisions — 2026-11-28

These are architect decisions on the 14 pending routes and the one allowlisted route without a caller. They do not supersede user authorization gates or constitute implementation evidence. The original 47-route inventory above remains the baseline.

| Route | Disposition | Remaining evidence |
|---|---|---|
| POST Factors/LastFactors | Outside quotation scope; disabled | Separate sales/purchase history scope |
| POST Factors/LastCustomerFactors | Outside quotation scope; disabled | Separate fiscal history scope |
| POST PishFactorsNew/LastCustomerPishFactors | REQUIRED / restricted customer proforma read / source pending | Exact read-only POST allowlist, bounded request/response, original-user customer permission, fixture and G1 |
| GET CustomersNew/LastCustomers | Optional incremental optimization; disabled | Not needed for complete authoritative customer import |
| GET CustomerCardex | REQUIRED / finance-restricted read / source pending | Exact linked customer, permission, bounded dates (.NET ticks), formatted decimal text kept intact, fixture and G1 |
| GET ProductsNew/AllProducts2 | Conditional warehouse-specific inventory read; disabled pending need | Store identity and stock semantics G1 |
| GET ProductsNew/OneProduct | Existing allowlist only; serial-rich verification pending | Do not infer serial preservation from OneProductWithoutSerial |
| GET ProductsNew/AllProductsInSubProductCode | Optional category browsing; disabled | Explicit taxonomy/parent mapping if required |
| GET ProductPriceNew/GetPrice | Targeted price-tier read pending | Confirm tier identities and exact money unit; no inferred names |
| GET ProductPlus/AllProductPlus | Extra product attributes outside current required quotation fields; disabled | Explicit new need and field mapping |
| GET ProductPlus/OneProductPlus | Extra product attributes outside current required quotation fields; disabled | Explicit new need and field mapping |
| GET ProductStatisticsNew/AmarKala | Sensitive purchase-cost-bearing report; disabled | Separate finance permission and field redaction if approved |
| GET ProductStatisticsNew/AmarKalaWithCount | Sensitive purchase-cost-bearing report; disabled | Separate finance permission and field redaction if approved |
| GET ProductStatisticsNew/ProductStock | Sensitive alternate stock/cost report; disabled | Current ProductsNew/ProductStock observation remains distinct |
| POST ProductsNew/ProductListWithMojodi | Alternate inventory read; disabled pending demonstrated need | Explicit POST-read transport authorization and store contract |

Customer outbound now has source for explicit preview, native person/company authorization, operation claim, identity readback and link CAS, with mock-only execution and real Asan writes hard-disabled. A mock adapter instance is not evidence of durable remote vendor state. Customer group-to-CRM IRR price-list mapping is explicit and connection-owned, not inferred. Financial reconciliation has read-only observation and conditional ledger completion source, not fiscal proof or durable authorized reconciliation acceptance. Durable dataset label is administrator attestation, not vendor-proved identity. Mandatory restricted customer reports, tier/store workflow, issuer/field mapping and integrated verification remain open. No real traffic, credential changes, or schema apply. G1/G2 NOT_AUTHORIZED.
