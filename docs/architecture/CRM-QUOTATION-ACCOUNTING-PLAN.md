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
