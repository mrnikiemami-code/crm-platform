# CRM-129 / Goal 038 — Asan (LinqToAsan) domain and wire contract

Source: user's **LinqToAsan-API-Guide.pdf**, 32 pages, 47 methods (28 GET / 19 POST), 17 data models; all pages reviewed on 2026-11-28. The guide states its descriptions were matched to LinqToAsan.Web. No vendor server call or vendor source-code verification performed. Page references below are physical PDF pages. The guide counts some variants as headings and some inline; the inventory below counts distinct method+path pairs, grouping the two CustomerCardex parameter variants and the shared RegisterFactor discount example. Paths relative to `/api/`; spelling preserved. Base URL may already end in /api and must be normalized exactly once. Documented does NOT mean implemented, permitted, or live verified.

## Endpoint inventory (47 distinct paths)
| Method | Route | Input / parameters | Output | Effect | PDF page | Current adapter / notes |
|---|---|---|---|---|---|---|
| POST | `Factors/RegisterFactor` | FactorViewModel | int | WRITE | 3–4 | Documented; not currently called by adapter; Sale; Price is whole line; Gregorian 8-digit date accepted only here. Discount example same route. |
| POST | `PishFactors/RegisterPishFactor` | FactorViewModel | int | WRITE | 4–5 | Existing call path; verify; Primary proforma route; 0 auto number. |
| POST | `PishFactorsNew/RegisterPishFactor` | FactorViewModel | int | WRITE | 4–5 | Documented; not currently called by adapter; Alternative route; 1 also auto. No automatic fallback after write. |
| POST | `ReturnFactors/RegisterReturnFactor` | FactorViewModel | int | WRITE | 5 | Documented; not currently called by adapter; Return of sale; no assumption on cancellation or numbering. |
| POST | `BuyFactor/RegisterFactor` | FactorViewModel | int | WRITE | 5–6 | Documented; not currently called by adapter; CustomerID=supplier; 0 or 1 auto. |
| POST | `ReturnBuyFactors/RegisterReturnBuyFactor` | FactorViewModel | int | WRITE | 6 | Documented; not currently called by adapter; Return of purchase. |
| POST | `Factors/LastFactors` | Count:int, Refer:int (1 sale/2 purchase) | FactorServiceViewModel[] | READ | 7 | Documented; not currently called by adapter; Report POST, not a write. |
| POST | `Factors/LastCustomerFactors` | Count:int, CustomerCode:long, Refer:int | FactorServiceViewModel[] | READ | 7 | Documented; not currently called by adapter; Customer report. |
| GET | `PishFactorsNew/LastPishFactors` | Count:int | FactorServiceViewModel[] | READ | 8 | Documented; not currently called by adapter; Last N only. |
| POST | `PishFactorsNew/LastCustomerPishFactors` | Count:int, CustomerCode:long | FactorServiceViewModel[] | READ | 8 | Documented; not currently called by adapter; Reconciliation candidate, not exact read by request ID. |
| GET | `Factors3/GetFactorDetails` | FactorNumber:ulong, Atf:int (1/2) | FactorServiceViewModel[] | READ | 8–9 | Documented; not currently called by adapter; Sale/purchase; not documented for proforma. |
| POST | `FactorInformation/AddfactorState` | TX:string[10], NM:numeric[10] | int | WRITE | 9–10 | Documented; not currently called by adapter; Positional arrays; see delivery contract. |
| GET | `FactorInformation/UpdateFactorState` | FactorNumber:int, Refer:int, Status:int, PayMethod:int | int | WRITE | 10–11 | Documented; not currently called by adapter; Mutates despite GET; never use as probe. |
| GET | `FactorInformation/GetFactorState` | FactorNumber:int, Refer:int | int | READ | 11 | Documented; not currently called by adapter; Status enum not documented. |
| POST | `Customers/postCustomer` | CustomerViewModel | int | WRITE | 11–12 | Existing call path; verify; 0 PersonCode auto; manual three-digit >101; return semantics need actual verification. |
| POST | `ParentCustomers/postCustomer` | CustomerViewModel | int | WRITE | 12 | Documented; not currently called by adapter; PersonCode parent; -1 group full. |
| POST | `Customers2/postCustomer` | CustomerViewModel | int | WRITE | 12 | Existing call path; verify; Full replacement; -10 zero code. |
| GET | `CustomersNew/AllCustomers` | none | CustomerServiceViewModel[] | READ | 12 | Existing call path; verify; No paging. |
| GET | `CustomersNew/OneCustomer` | CustomerCode:long | CustomerServiceViewModel[] | READ | 12–13 | Documented; not currently called by adapter; Usually one, verify uniqueness. |
| GET | `CustomersNew/CustomerWithNationalCode` | NationalCode:string | CustomerServiceViewModel[] | READ | 13 | Existing call path; verify; Do not assume one match. |
| GET | `CustomersNew/CustomerWithMobile` | Mobile:string | CustomerServiceViewModel[] | READ | 13 | Documented; not currently called by adapter; Do not assume one match. |
| GET | `CustomersNew/LastCustomers` | Count:int | CustomerServiceViewModel[] | READ | 13–14 | Documented; not currently called by adapter; Remain/GenderTitle not populated. |
| GET | `CustomerCardex` | CustomerCode:long; optional FromDate:long, ToDate:long | CustomerCardexViewModel[] | READ | 14 | Documented; not currently called by adapter; Two documented variants; date bounds .NET ticks. |
| GET | `ProductsNew/AllProducts` | none | Products[] | READ | 15 | Existing call path; verify; No paging. |
| GET | `ProductsNew/AllProducts2` | StoreID:int | Products[] | READ | 15 | Documented; not currently called by adapter; Warehouse-specific. |
| GET | `ProductsNew/OneProduct` | ProductCode:decimal | Products | READ | 15 | Documented; not currently called by adapter; Includes serials. |
| GET | `ProductsNew/OneProductWithoutSerial` | ProductCode:decimal | Products | READ | 15 | Documented; not currently called by adapter; Without serial list. |
| GET | `ProductsNew/AllProductsInSubProductCode` | ParentCode:int | Products[] | READ | 15–16 | Documented; not currently called by adapter; Group partition is not cursor paging. |
| GET | `ProductsNew/LastProducts` | Count:int | Products[] | READ | 16 | Existing call path; verify; Last N, used by probe. |
| POST | `Products2/AddParentProduct` | ProductInput | int | WRITE | 16 | Documented; not currently called by adapter; ProductCode parent. |
| POST | `Products4/AddProduct` | ProductInput | int | WRITE | 16–17 | Existing call path; verify; Explicit product code. |
| POST | `Products3/EditProduct` | ProductInput | int | WRITE | 17 | Existing call path; verify; Only three price tiers; omitted SalesPrice resets tier 2/3. |
| GET | `ProductPriceNew/GetPrice` | ProductCode:long (0=all) | Products[] | READ | 17 | Documented; not currently called by adapter; SalesPrice10. |
| GET | `ProductPriceNew/GetAllPrice` | none | ProductPrice[] | READ | 17 | Documented; not currently called by adapter; PriceList 10. |
| GET | `ProductPlus/AllProductPlus` | none | ProductPlusViewModel[] | READ | 18 | Documented; not currently called by adapter; 12 additional text fields. |
| GET | `ProductPlus/OneProductPlus` | ProductCode:int | ProductPlusViewModel[] | READ | 18 | Documented; not currently called by adapter; Do not interpret custom properties without mapping. |
| GET | `ProductStatisticsNew/AmarKala` | StoreNumber:int? | AmarKalaViewModel[] | READ | 18 | Documented; not currently called by adapter; Omitted warehouse=total; 0=first warehouse. |
| GET | `ProductStatisticsNew/AmarKalaWithCount` | StoreNumber:int?, count:int? | AmarKalaViewModel[] | READ | 18–19 | Documented; not currently called by adapter; Stock strictly greater than count. |
| GET | `ProductStatisticsNew/ProductStock` | ProductCode:int | AmarKalaViewModel | READ | 19 | Documented; not currently called by adapter; All warehouses combined. |
| GET | `ProductsNew/ProductStock` | ProductCode:int, StoreID:int | double | READ | 19 | Documented; not currently called by adapter; Single warehouse. |
| POST | `ProductsNew/ProductListWithMojodi` | lstProductCode:long[], StoreID:int | {ProductCode,StoreCount}[] | READ | 19–20 | Documented; not currently called by adapter; Read-only batch POST. |
| POST | `Receive/PostReceive` | ReceiveAmountFromCustomerViewModel | int | WRITE | 20 | Documented; not currently called by adapter; Registers receipt; digits-only TransactionNumber. |
| POST | `Pay/PostPay` | ReceiveAmountFromCustomerViewModel | int | WRITE | 20 | Documented; not currently called by adapter; Registers payment. |
| GET | `Receive/GetReceives` | none | ReceiveViewModel[] | READ | 21 | Documented; not currently called by adapter; Receipt list. |
| GET | `Banks/GetBanks` | none | BankViewModel[] | READ | 21 | Documented; not currently called by adapter; Bank IDs start at 1. |
| GET | `Banks/GetBanksWithRemain` | none | BankBalanceViewModel[] | READ | 21 | Documented; not currently called by adapter; Sensitive financial read. |
| GET | `Stores/GetStores` | none | StoreViewModel[] | READ | 21 | Documented; not currently called by adapter; Warehouse IDs start at 0. |

Do not expose all 47 methods as enabled UI actions. First live scope = read-only customers, products, selected price/stock/store references and health; then approved proforma. Financial postings, delivery mutation, sales/purchase/return, receipts/payments are separate scope. The guide has no deletion, cancellation, proforma line update, generic paging, incremental change token, or idempotency API.

## Complete wire model dictionary
All field names and original .NET types below are transcribed from PDF pp.22–32; slash aliases in the guide are listed separately. No required/nullable inference except where explicitly marked. Do not replace vendor fields with CRM names in the adapter wire layer. All other absent facts are unknown, not zero. Customer input and output are distinct models.

### FactorViewModel
| Field | .NET type |
|---|---|
| `UserID` | `int` |
| `CustomerID` | `int` |
| `FactorDate` | `long` |
| `TasvieDate` | `long` |
| `Description` | `string` |
| `VisitorID` | `int` |
| `FactorNumber` | `int` |
| `RequestNumber` | `int` |
| `FactorType` | `int` |
| `OtherCustomerName` | `string` |
| `OtherCustomerTell` | `string` |
| `StorageID` | `int` |
| `FactorDetails` | `FactorDetailsViewModel[]` |

### FactorDetailsViewModel
| Field | .NET type |
|---|---|
| `ProductID` | `int` |
| `Count` | `double` |
| `Price` | `decimal` |
| `DiscountPercent` | `double` |
| `OriginalPrice` | `double` |
| `Description` | `string` |
| `Serial` | `string` |
| `TasvieDate` | `long` |
| `StorageID` | `int` |
| `Ted1` | `double` |
| `Tol` | `double` |
| `Arz` | `double` |
| `Ertefa` | `double` |
| `Color` | `string` |

### CustomerViewModel
| Field | .NET type |
|---|---|
| `PersonCode` | `int` |
| `PersonFullName` | `string` |
| `PersonGender` | `byte` |
| `PersonAddress` | `string` |
| `PersonFirstTell` | `string` |
| `PersonSecoundTell` | `string` |
| `PersonMobile` | `string` |
| `PersonNationalCode` | `string` |
| `PersonFax` | `string` |
| `PersonAccountGroup` | `string` |
| `PersonEcoCode` | `string` |
| `PersonPostalCode` | `string` |
| `UserID` | `int` |

### ReceiveAmountFromCustomerViewModel
| Field | .NET type |
|---|---|
| `PersonCode` | `int` |
| `Amount` | `double` |
| `TransactionNumber` | `string` |
| `Description` | `string` |
| `PaymentDate` | `long` |
| `BankID` | `int` |
| `UserID` | `int` |

### ProductInput
| Field | .NET type |
|---|---|
| `ProductCode` | `long` |
| `ProductName` | `string` |
| `ProductName2` | `string` |
| `ProductSerial` | `string` |
| `SellPrice` | `double` |
| `SalesPrice` | `uint[2]` |

### Products
| Field | .NET type |
|---|---|
| `ProductCode` | `long` |
| `parent` | `long` |
| `ProductName` | `string` |
| `ProductName2` | `string` |
| `ProductSize` | `string` |
| `Size` | `string` |
| `ProductSerial` | `string` |
| `Serials` | `string[]` |
| `TotalCount` | `double` |
| `StoreProduct` | `double[]` |
| `VisitorPercent` | `float` |
| `SellPrice` | `double` |
| `SalesPrice` | `uint[]` |
| `SalesPrice10` | `long[]` |
| `SellPrice3` | `long` |
| `SellPrice4` | `long` |
| `BuyPrice` | `double` |
| `LastBuyPrice` | `double` |
| `ProductUnitID` | `int` |
| `ProductUnitTitle` | `string` |
| `SecondUnitTitle` | `string` |
| `ProductUnitCount` | `double` |
| `TaxID` | `string` |
| `Karton` | `float?` |

### ProductPrice
| Field | .NET type |
|---|---|
| `ProductCode` | `long` |
| `ProductName` | `string` |
| `parent` | `long` |
| `PriceList` | `long[]` |
| `StoreProduct` | `double[]` |

### AmarKalaViewModel
| Field | .NET type |
|---|---|
| `ProductCode` | `long` |
| `ProductName` | `string` |
| `ProductSerial` | `string` |
| `Count` | `double` |
| `SalePrice` | `decimal` |
| `SalePriceArray` | `uint[]` |
| `SalePrice4` | `decimal` |
| `BuyPrice` | `double` |

### ProductPlusViewModel
| Field | .NET type |
|---|---|
| `ProductCode` | `int` |
| `Prop1` | `string` |
| `Prop2` | `string` |
| `Prop3` | `string` |
| `Prop4` | `string` |
| `Prop5` | `string` |
| `Prop6` | `string` |
| `Prop7` | `string` |
| `Prop8` | `string` |
| `Prop9` | `string` |
| `Prop10` | `string` |
| `Prop11` | `string` |
| `Prop12` | `string` |

### FactorServiceViewModel
| Field | .NET type |
|---|---|
| `FactorNumber` | `long` |
| `CustomerCode` | `long` |
| `FactorDate` | `ulong` |
| `DateTasvie` | `ulong` |
| `Description` | `string` |
| `Atf` | `int` |
| `FactorDetails` | `FactorDetailServiceViewModel[]` |

### FactorDetailServiceViewModel
| Field | .NET type |
|---|---|
| `ProductCode` | `long` |
| `Count` | `double` |
| `Price` | `double` |
| `Price_whitout_takhfif` | `double` |
| `Description` | `string` |
| `StorageID` | `int` |
| `SettlementDate` | `long` |
| `Serial` | `string[]` |
| `VisitorID` | `int` |

### CustomerServiceViewModel
| Field | .NET type |
|---|---|
| `Code` | `long` |
| `FullName` | `string` |
| `Parent` | `long` |
| `Address` | `string` |
| `Tellephone` | `string` |
| `Tellephone2` | `string` |
| `Mobile` | `string` |
| `Fax` | `string` |
| `NationalCode` | `string` |
| `EconomicCode` | `string` |
| `PostalCode` | `string` |
| `Gender` | `byte` |
| `GenderTitle` | `string` |
| `Remain` | `double` |
| `BookCredit` | `double` |
| `ChequeCredit` | `double` |
| `SettlementDays` | `byte` |
| `AccountGroup` | `string` |
| `AccountGroupPriceList` | `int` |
| `VisitorID` | `int` |
| `VisitorPercent` | `float?` |

### CustomerCardexViewModel
| Field | .NET type |
|---|---|
| `Row` | `int` |
| `ActionDate` | `DateTime?` |
| `ShowDate` | `string` |
| `Description` | `string` |
| `snd` | `string` |
| `PersonCode` | `long` |
| `ProductCode` | `long` |
| `FactorNum` | `long` |
| `FactorType` | `string` |
| `Count` | `double` |
| `show_Bedehkar` | `string` |
| `show_Bestankar` | `string` |
| `show_Mande` | `string` |

### ReceiveViewModel
| Field | .NET type |
|---|---|
| `Date` | `ulong` |
| `year` | `uint` |
| `Month` | `uint` |
| `day` | `uint` |
| `PersonID` | `uint` |
| `Price` | `double` |
| `Factor` | `uint` |
| `Atf` | `int` |
| `Refer` | `string` |
| `BankID` | `int?` |

### BankViewModel
| Field | .NET type |
|---|---|
| `BankID` | `int` |
| `BankName` | `string` |

### BankBalanceViewModel
| Field | .NET type |
|---|---|
| `ID` | `int` |
| `Name` | `string` |
| `Balance` | `decimal` |

### StoreViewModel
| Field | .NET type |
|---|---|
| `StoreID` | `uint` |
| `StoreName` | `string` |

## Behavioral and numerical contracts (PDF pp.1–25)
- Product and customer must exist before document registration. Document return: positive integer number, 0 not registered; guide's generic sentence and endpoint-specific customer/product descriptions do not establish complete success/error code semantics for all write endpoints. Treat unknown code, 0 where applicable, transport timeout, conflicting response/readback as unresolved; never guess assigned code. -10 customer update with zero code; -1 parent customer group full; -369 sales OriginalPrice with any product code not 3/6/9 digits. Never automatically retry ambiguous write.
- `FactorNumber=0` auto; alternate PishFactorsNew and buy also accept 1 as auto. Use configured primary route, no write fallback. `RequestNumber` is numeric but no documented uniqueness/query contract. `FactorType`, `OtherCustomerName`, `OtherCustomerTell` not used on proforma. Header StorageID ignored; per-line storage authoritative. VisitorID=0 no visitor; per-row applies. FactorDate=0 today or 8-digit Jalali; Gregorian accepted explicitly on sale only. TasvieDate=0 inherits factor date, line TasvieDate=0 inherits header. PaymentDate supports 0, 8-digit Jalali or 6-digit yyMMdd with year <27 -> 14xx else 13xx. Cardex FromDate/ToDate are .NET ticks, not Unix milliseconds.
- FactorDetail Price = whole row amount, not unit price. Discount can be embedded in net Price OR a separate special row. NEVER combine net Price with a second subtraction. Special rows documented: discount 999123, duty 999140, tax 999141, Count=0, amount in Price; require items exist. Code 999 and these three excluded from AmarKala. CRM policy code is not ProductID and Products.TaxID is not tax rate. OriginalPrice sales-only; avoid. Serial split by semicolon, extra serials not recorded, proforma does not record serial. Ted1/Tol/Arz/Ertefa/Color not used on proforma. No undocumented rounding item. Tax and duty distinct.
- PersonCode=0 on standard create; manual code described as three-digit >101 (p.11, general table p.2 says >=101 — discrepancy to verify). Parent code on parent create, -1 when last 3 digits reach 999. Existing update uses existing PersonCode and replaces fields; no sparse patch guarantee. PersonGender is account nature, NOT legal person/company. Code is long on reads, int on write, CustomerID int; check endpoint-specific ranges before conversion. NationalCode and EconomicCode strings; preserve leading zeros. Do not infer legal type from name or account nature. National shape may be evidence, not vendor explicit type.
- Products read: TotalCount and StoreProduct; SalesPrice10 and PriceList carry ten tiers; SalesPrice distinct array, SellPrice3/SellPrice4 and BuyPrice/LastBuyPrice have distinct meanings. Price write uses SellPrice plus two uint entries; never filter out a zero and shift tier indexes; omit array on edit only if explicit intent to zero tiers. ProductSerial also registers barcode. No name update/delete documented. ProductCode long on model, decimal on OneProduct, int on stock/line endpoints. Do not silently coerce unsafe numbers. TaxID text. ProductSize/Size alias needs real payload verification. StoreProduct index=warehouse order, not inferred warehouse name.
- Monetary unit is NOT specified by PDF; choose RIAL/TOMAN only with approved live sample and accountant verification. CRM IRR exact micros canonical; vendor integers for price edits, decimal/double wire elsewhere; exact conversion or explicit approved rounding, no float re-pricing. Never sum across currencies. A zero amount/quantity/price is not missing data.
- Receive/pay transaction number digits only, interpreted numerically; bank ID starts 1, warehouse 0. Cardex show_Bedehkar/show_Bestankar/show_Mande are formatted strings, not exact numeric balances; preserve original with parse provenance if displayed. LastCustomers does not fill Remain or GenderTitle; use OneCustomer/AllCustomers for those fields. Credit, balances, bank data are restricted observations, never CRM-owned edit fields.
- Delivery AddfactorState TX[0..9]: buyer name, address1, address2, driver, national code, telephone, plate, date, delivery date, invoice date. NM[0..9]: type (1 sale/2 buy), payment method, settlement method, day, invoice no, Atf, person code, identifier, remittance no, remittance row. Outer FactorNumber/Refer/Status/PayMethod ignored by add method. No status value enumeration documented. UpdateFactorState mutates through GET: whitelist by effect, not HTTP method.

## Field ownership and canonical mapping

| Vendor read source | CRM mapping and rule |
|---|---|
| Customer.Code / Parent | externalPartyId and externalCode scoped to workspace + connection + dataset; parent vendor metadata only |
| FullName | CRM display name; split personal name only under verified Person kind; company name separate; do not guess |
| NationalCode / EconomicCode | personal or legal national identifier with evidence, economic code distinct; never erase absent |
| Address, Mobile, Tellephone, Tellephone2, Fax, PostalCode | normalized profile, preserve raw strings and leading zeros; CRM mapping only supported fields |
| Gender/GenderTitle, AccountGroup, AccountGroupPriceList, VisitorID/VisitorPercent | connection-owned classification; no legal-type inference |
| Remain, BookCredit, ChequeCredit, SettlementDays | read-only finance/terms with source, time, unit and permissions; separate from CRM balance and payment records |
| Products.ProductCode, parent, names, sizes, serials | stable external item code; parent/serial/size metadata; not CRM UUID or SKU equivalence |
| SellPrice, SalesPrice, SalesPrice10, PriceList, SellPrice3/4 | explicit tier identities/positions and unit, no collapsing; select a price list for CRM price authority |
| BuyPrice, LastBuyPrice | restricted cost observations, not automatic selling price |
| TotalCount, StoreProduct, AmarKala.Count, StoreCount | inventory observations per warehouse or aggregate, not CRM reservation authority |
| ProductUnitID/Title, SecondUnitTitle, ProductUnitCount, Karton | unit metadata and conversion; do not assume quantity mapping across UoMs |
| ProductPlus.Prop1..12, TaxID | source metadata; explicit configurable mapping only |
| FactorServiceViewModel and details | remote document identity + type + dataset + number; store observed fields for reconciliation; never rewrite sealed CRM revision |
| Bank/Store IDs and names | source references, selectable only after read/verification; not manually guessed |
| ReceiveViewModel/Cardex | read-only financial observation; separate scope and permission from quotation sync |

Use one vendor-neutral canonical domain and adapter registry. Keep vendor-specific wire names, route effects, numeric widths, parsing, date conventions, capabilities and payload mappers in Asan adapter. A future vendor gets its own descriptor and conformance fixtures; do not add vendor-specific branches throughout business UI or shared identity engine.
