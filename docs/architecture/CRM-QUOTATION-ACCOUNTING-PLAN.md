# CRM Quotation + Universal Accounting Integration — Architecture Plan
Date: 2026-11-18
Status: PROPOSED / SOURCE AUDIT INCOMPLETE / STOP_FOR_ARCHITECT
Target: customized Twenty CRM; Dev :3002; intranet :6080 is read-only unless separately approved.

## User-approved product scope
- Issue pro-forma quotations inside CRM for products, services, and mixed lines.
- Integrate with many accounting products by adapters, never hardwire a single vendor.
- CRM owns quotation lifecycle; accounting destination owns posted invoices, payments and ledger.
- No claim that every vendor offers API access or identical capabilities.

## Source evidence and limits
- Directly fetched root package.json on release/record-access-115: Twenty monorepo using Yarn/Nx.
- Directly fetched docs/architecture/CRM-ARCHITECT-RECOVERY.md: customized installed apps include Event Registration, Communication, Record Access; independent sales-followup app and Dev-only CRM-128 E2E described. Local CRM-128 code reported unpushed. Operational intranet :6080 must not be modified without separate approval.
- GitHub code search for quote/product/invoice/catalog/price yielded no results; this is NOT proof of absence. Attempted guessed standard-object paths returned 404 and directory fetch is unsupported by fetch_file. Current audit cannot confirm existing Product/PriceList/Invoice/Quotation schema, current local unpushed changes, or exact app SDK APIs.
- All entity names and paths below are proposed, NOT confirmed existing code.

## Ownership and bounded contexts
1. Sales/Quotation: catalog references, quotation draft, lines, revisions, approval, PDF, customer-facing secure share.
2. Accounting integration: connections, adapter contracts, capability discovery, field mappings, outbound commands, inbound status, audit and reconciliation.
3. Existing CRM Person/Company/Opportunity/permissions are reused after inspection; do not duplicate.
4. Accountancy is source of truth for posted fiscal invoices, settlements, taxes booked, balances and journal entries; CRM does not invent accounting ledger.
5. Do not couple module activation to removed Applications settings UI. Validate existing app-install/feature control before selecting mechanism.

## Proposed domain contracts (subject to source audit)
- CatalogItem: id, type PRODUCT|SERVICE, name, sku optional, unit, active; optional inventory attributes only for PRODUCT.
- PriceList/Price: currency, unitPrice, effective period; no implicit FX conversion.
- Quotation: id, workspaceId, customerRef (Person or Company), opportunityRef optional, owner, sequence, status DRAFT|PENDING_INTERNAL_APPROVAL|READY_TO_SEND|SENT|CUSTOMER_ACCEPTED|CUSTOMER_REJECTED|EXPIRED|CANCELLED|CONVERTED, expiry, currency, taxPolicy, terms, totals, version, timestamps.
- QuotationLine: itemRef optional, kind PRODUCT|SERVICE, description, quantity decimal, unit, unitPrice decimal, discount amount/rate, tax/duty components, lineTotal, sortOrder, immutable snapshot on issuance.
- QuotationRevision: version, canonical snapshot, totals, hash, actor/time, approval evidence; accepted revision cannot mutate; revisions require explicit new version.
- AccountingConnection: workspace scoped, adapterId/version, capability set, encrypted credential references, mappings, health; secrets never stored as plaintext or logged.
- AccountingSyncOperation: quotationRevisionId, operation type, idempotency key, connectionId, status, attempts, externalDocumentId, externalStatus, error code, correlationId; append-only audit events.
- Monetary arithmetic: decimal/minor-unit policy with explicit rounding and currency; tax/discount calculation order is a separately approved business rule, not inferred from a vendor. Iran-specific tax compliance and fiscal invoice numbering require legal/accounting confirmation.

## Quotation UX
- Customer and opportunity picker; product/service mixed editable lines; price/tax/discount breakdown; internal approval; preview/print PDF Persian RTL; secure expiring customer link; acceptance/rejection and audit; immutable accepted snapshot.
- Customer acceptance is not a legally posted invoice. No accounting transfer solely because a draft was saved.

## Adapter boundary
- Common operations: testConnection, capabilities, mapParty, mapItem, createDraftDocument or submitInvoiceRequest (only if supported), getDocumentStatus, getReceivableStatus (optional), cancelDraft (optional).
- Capabilities must gate UI and workflow: supportsDraftInvoice, supportsFinalInvoice, supportsCustomerUpsert, supportsItems, supportsTaxLines, supportsStatusRead, supportsWebhooks, supportsIdempotency, supportsCancellation.
- Vendor adapter implementations are separate packages/components; transport may be API, secure file exchange, or approved local agent. No generic arbitrary code execution.
- Outbox/queue, bounded retry with backoff, dead-letter/reconciliation, per-connection rate limits, replay protection, stable idempotency key, external IDs, mapping errors and conflict rules.
- Outbound event only after approved immutable revision and explicit configured policy. Never auto-create final invoices or charge payments without distinct authorization. Inbound updates cannot overwrite CRM quotation approval history.

## Delivery slices and gates
S0 READ-ONLY SOURCE AUDIT (first task): inspect actual local working tree and remote divergence; find existing CRM objects, product/price/quote/invoice, app architecture, role/permission, PDF/RTL, workflow/job/trigger, encryption, APIs; report exact file paths and reusable components, conflicts, missing decisions. NO CODE, SCHEMA, INSTALL, DEPLOY, PUSH, RESTART, BACKFILL. STOP_FOR_ARCHITECT.
S1 DOMAIN CONTRACT: only after S0 approval, settle schema, money/tax/discount policy, state transitions, ownership and permissions; unit tests.
S2 QUOTATION DEV: draft/mixed lines/price snapshots, state machine, Persian UI/PDF; tests; no intranet.
S3 CUSTOMER APPROVAL DEV: secure expiring links, audit, revisions and access control.
S4 INTEGRATION CORE DEV: capabilities, adapter interface, connection management, outbox/idempotency/reconciliation; mock adapter integration tests.
S5 FIRST REAL ADAPTER DEV: select vendor only after assessing official interfaces and permitted integration mode; test failure/retry and no duplicates.
S6 INTRANET RELEASE: separate architect/user approval, migration dry-run, backup, rollback, staged deployment and E2E verification. No production writes before authorization.

## S0 acceptance evidence
- Current branch, HEAD, uncommitted/unpushed status and relationship to remote.
- Table with file paths and evidence for existing Person/Company/Opportunity, product/service/catalog, quotation/invoice, pricing/tax, PDFs, permission/roles, apps/workflows, secrets/queues.
- Explicit REUSE/EXTEND/NEW verdict and dependency diagram; no speculative claims.
- List unresolved business/legal decisions, proposed smallest S1 change, tests and risks.
- Explicit confirmation of zero writes/restarts/deployments and STOP_FOR_ARCHITECT.

## Non-goals in first slices
- Full accounting ledger, inventory accounting, payroll, tax filing, instant support for every accounting vendor, CRM-128 intranet rollout, CRM-126 SMS, bulk backfill.

## Approved scope extension — bidirectional product/service catalog sync (2026-11-18)
User explicitly requires BOTH directions: import products from accounting into CRM, and create products in CRM then publish them back to accounting. Include updates as a capability-dependent flow; support products and services, with distinct handling for inventory-bearing items.

### Domain and mapping
- CatalogItem is CRM-facing product/service record; external item identity is scoped by workspace + accountingConnection + externalItemId. Keep internal ID stable; never equate SKU/name with unique identity.
- AccountingItemLink: internalItemId, connectionId, externalItemId, externalCode, remoteVersion/etag or updatedAt, lastSyncedAt, syncDirection, syncStatus; uniqueness and soft-delete policies.
- Field-level ownership/mapping: name, SKU, unit, item type, descriptions, prices, currency, taxes, category, active status, inventory quantity; source of truth configured per field/connection. Stock/warehouse and accounting valuation remain authoritative in accounting/inventory system unless explicitly agreed otherwise.
- Distinguish creating a new item, linking an existing external item, updating, and deactivating; no blind SKU/name matching or destructive deletes.
- Price-list and tax mapping may be separate from item sync; do not assume single price or tax schema. Preserve quotation line snapshots regardless of catalog sync.
- Bidirectional synchronization must have echo suppression (origin/correlation), version checks, conflict queue/manual resolution, idempotency keys, rate limits, retry/backoff, reconciliation, audit and no silent overwrite.
- A vendor may support list/read but not create/update. Expose adapter capabilities: listItems, getItem, createItem, updateItem, listPrices, readStock, webhooks/polling, externalIdempotency. If write unsupported, show explicit pending/manual export state rather than falsely claiming successful push.
- On first connection, use preview/dry-run with counts of proposed new/linked/conflicted items; explicit approval for bulk imports. Never auto-import or push during connector setup.

### S0 additional source audit
Find exact existing Product/service/catalog/price/stock entities, product UI and permissions, item creation APIs, existing sync jobs, external ID mapping, uniqueness and conflict policies. Report whether products can be created and updated locally and which extension point can emit a reliable outbox event. Do not implement in S0.

### Delivery order adjustment
After S1 domain contracts, deliver CRM catalog CRUD and quotation capability (S2), then accounting connector item read/import preview and mapping, then CRM-created item outbound create/update through a mock adapter and one verified real adapter. Gate every write behind approved connector capabilities and source-of-truth policy; no implicit production sync.

## CRM-129-S0 evidence reconciliation and architect decisions (2026-11-18)
Source: user-supplied Cursor read-only audit report CRM-129-S0, HEAD 8462cbaaa7711d566b062fbc45b8494f4b2dce34, local branch feat/crm-126-workflow-template-sms, clean working tree, reported 12 local commits ahead/17 remote docs commits behind at the time. This local state is report-based, NOT independently fetched from GitHub. No checkout/merge/push is authorized.

Independently fetched on remote release branch:
- twenty-shared/src/types/composite-types/currency.composite-type.ts: CurrencyMetadata.amountMicros:number and currencyCode:string; explicitly **micro (1e-6)**, not minor units. Decimal arithmetic and overflow-safe conversions must be specified around existing storage.
- twenty-server/.../create-standard-flat-object-metadata.util.ts: STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME confirms standard-object metadata registry; complete absence of quote/catalog entities is based on Cursor's exhaustive inventory, not this partial direct read.
- twenty-apps/examples/document-generator/src/logic-functions/utils/generate-document-pdf.ts: pdf-lib StandardFonts and toWinAnsi regex strip non-Latin characters; DO NOT reuse for Persian quotations.
- twenty-sdk/src/sdk/define/connection-providers/define-connection-provider.ts: SUPPORTED_TYPES=['oauth']; API-key/file/agent connectors must not rely on ConnectionProvider.
- twenty-apps/internal/communication/src/objects/communication.object.ts: app-owned object manifests, stable select values, Persian labels, and warning that app sync cannot change existing field TYPE; plan schema carefully.
- Communication dedup-id file on remote release branch was not found at reported path; its existence in local unpushed branch remains report-only.

S0 audit findings (report-based):
- 36 standard and 19 app-defined objects searched, no product/service/catalog/pricelist/quotation/invoice/line object in those enumerations; BUT dynamically created workspace objects can exist outside manifests, so Dev workspace metadata inspection is needed before deployment and avoid claiming global absence.
- Existing Person/Company/Opportunity, FA RTL UI, app roles/RLS, six trigger kinds, REST/GraphQL, encrypted application variables, document file upload.
- Existing Opportunity stage has NEW/SCREENING/MEETING/PROPOSAL/CUSTOMER, not WON/LOST; quotation conversion is own state.
- IRR supported, IRT not in existing currency code list; no implicit currency conversion. Decide UI Toman vs stored IRR explicitly.
- No atomic quotation numbering, immutable revision enforcement, persistent accounting operation outbox/dead letter, or public expiring quotation share as confirmed by audit.
- @react-pdf/renderer + embedded fonts exists for Latin DPA; Persian shaping/bidi not verified. Need actual visual AND extracted text checks. Byte-search for Persian characters alone is not a sufficient PDF proof because embedded fonts use glyph encoding.
- Source contains Applications UI code, but prior operational cleanup hid/disabled Applications settings in intranet. **Distinguish repository presence from enabled production UI**; module must not depend on settings Applications menu.
- User-approved bidirectional item sync remains first-class: accounting -> CRM import with preview/linking; CRM -> accounting create/update, external ID mapping, per-field ownership, no echo loops, no blind SKU matching, capability-dependent operations.

### Architect decisions for next slice
1. Separate quotation domain from accounting-bridge integration boundary. Keep existing Person/Company/Opportunity and currency display; no direct modifications to core until proven necessary.
2. Implement quotation and catalog as source-controlled app-owned manifests, not ad hoc UI-created objects. Accounting-bridge connector remains independent, with adapter capabilities and persistent operation ledger.
3. S1 is **contract + isolated feasibility proof only**, no DB schema/install/deploy: (a) Persian PDF proof with embedded Unicode font and bidi/shaping visual+text extraction; (b) money micros arithmetic and explicit round policy with test fixtures, leaving tax rates/legally binding rules configurable pending signoff; (c) product/service catalog, external item mapping, ownership/conflict/idempotency contracts; (d) quotation state transitions, immutable snapshots and atomic numbering strategy; (e) manifest schema design for later review.
4. PDF spike must not force production Chromium or new dependency without a separate architect decision. No font binaries committed unless licensing reviewed.
5. Do not treat workflow FORM as sufficient proof of full multi-level approval; begin with app-owned explicit single-step approval contract, extensible later.
6. Explicit STOP_FOR_ARCHITECT before any database object creation. CRM-126 SMS, CRM-128 intranet title rollout and all unrelated services out of scope.

## First real accounting adapter: Asan (LinqToAsan), then Sepidar — 2026-11-18
User priority: implement vendor-neutral accounting interface FIRST, Asan adapter as first concrete integration, Sepidar adapter next. Reference supplied by user: `D:\HaniReference\LinqToAsan-API-Guide.pdf` (32 pages; user also uploaded identical-named PDF to conversation). This local Windows path is a worker input, not an assertion that GitHub contains the PDF. Do not commit the proprietary/reference PDF unless explicitly approved.

### Verified API contract from provided guide (not tested against live server)
- Base URL `http://ServicIP:Port/api/`; POST JSON; guide does not establish authentication, HTTPS, remote access, webhooks or idempotency semantics. Discover actual environment safely before any connection. Treat HTTP as insecure over untrusted networks; use approved TLS tunnel/reverse proxy/VPN where appropriate. Do not expose service publicly.
- Catalog inbound: GET `ProductsNew/AllProducts`; `ProductsNew/OneProduct?ProductCode=`; `ProductPriceNew/GetAllPrice`; `ProductStatisticsNew/AmarKala`; optional `Stores/GetStores`.
- Catalog outbound create: POST `Products4/AddProduct` with ProductInput, caller-assigned code; POST `Products2/AddParentProduct` under a parent code. Price update: POST `Products3/EditProduct` modifies only SellPrice and two SalesPrice entries; omitting SalesPrice zeroes price 2 and 3. **No general product name/description update endpoint is documented.** Mark updateItemFields unsupported except price fields, and never silently claim full bidirectional field updates.
- Customer inbound: GET `CustomersNew/AllCustomers`; outbound create POST `Customers/postCustomer` with PersonCode=0 auto-code; update POST `Customers2/postCustomer` keyed by PersonCode. Map CRM Person/Company to Asan customer with explicit approved rules.
- Pro forma: POST `PishFactors/RegisterPishFactor` (also `PishFactorsNew/RegisterPishFactor` documented), FactorViewModel; customer and products must exist in Asan first. For Asan, FactorDetails.Price is **total line amount**, not unit price; FactorNumber=0 auto-number (alternate endpoint also treats 1 as auto). Response int number; 0 means failed. Handle special discount/tax/duty item codes 999123/999141/999140 only when configured and pre-existing in Asan, Count=0. Avoid OriginalPrice path due -369 validation behavior.
- Sales invoice is separate: POST `Factors/RegisterFactor`; never confuse draft pro forma with posted sales invoice. Inbound pro forma reads `PishFactorsNew/LastPishFactors?Count=` and `PishFactorsNew/LastCustomerPishFactors`; document does not prove read-by-id or stable idempotency support.
- Date: FactorDate 0=server today or 8-digit Jalali; some sales invoice endpoint accepts Gregorian 8 digits, not automatically assumed for pro forma. UserID and StorageID need configured mapping.
- Item IDs/ProductCode numeric (some API types decimal), and money integer values in guide; explicit Asan money unit (rial/toman) MUST be confirmed in real installation before mapping from Twenty amountMicros; never assume.
- Guide lists 47 methods, 17 data models; no confirmed full update product endpoint or auth specification. Capabilities declared per adapter, not global.
- Safeguards: read-only connection discovery and fixture-based contract tests first; catalog import preview, external code link, user-approved write; no automatic retry of ambiguous POST create/register without reconciliation (remote idempotency not proven); stable operation journal, response code handling, conflict states; field ownership. Asan may run on private LAN, requiring separately approved secure connector/agent; do not assume CRM host can reach it.
- Adapter interface should cover customer read/upsert, catalog list/read/create, price-only update, price list, inventory read, pro forma register/query, and optional sales invoice register; Sepidar must be implemented behind same capability-aware interface without assuming Asan-specific special codes or data shapes.
- Work order: S1 pure contracts and fixtures + Asan mapping feasibility; S2 catalog/quotation domain; S3 adapter core and Asan read-only integration; S4 explicit approval-gated Asan write flows; S5 Sepidar adapter after obtaining Sepidar API docs and environment. This overrides earlier generic first-adapter selection but DOES NOT authorize live calls or production writes.
