# CRM-129 / Goal 037 — Architect disposition 084

Date: 2026-11-27
Candidate: quotation@0.1.84 / 36941c4aea0b53185d4d3f5d804cd7027aadcb88
Evidence: 0b3c7ae851547a28867c85b6fc09492312698554
Decision: ACCEPTED for Dev installation/upgrade and the demonstrated Mock customer synchronization path; READY_FOR_USER_UAT. Not unrestricted release certification.

## Independently reviewed
- FINAL-REPORT.md, party-uat.json, pg-constraints-existing.json, pg-constraints-fresh.json, metadata-fields-fresh.json, transfer-registration-back.json, and candidate-to-evidence file list.
- Existing/fresh sync and reapply succeeded. PostgreSQL evidence shows both unique TEXT indexes, NOT NULL and null column defaults. Installability blocker 083 CLOSED.
- 50 seeded customers (30 persons / 20 companies). Preview 50 LINK_SUGGESTED and 50 NEEDS_CRM_RECORD. Four preliminary operations and concurrent create account for 5 mappings / 3 creates; bulk apply adds 95 mappings / 47 creates. Final delta +30 persons / +20 companies, 100 mappings, 100 IN_SYNC; repeat creates zero. Five ALREADY_SUCCEEDED rows in bulk are expected from preliminary operations.
- Concurrent same-source creation: one success, one stale refusal at MAPPING_READ. Deleted CRM customer: refused CRM_CUSTOMER_DELETED. Injected browser plan not trusted.
- Reported numbering, link mint/revoke/expiry and baseline regression accepted as scoped worker evidence. Vitest 784 passed/3 skipped; Jest 368 passed/4 skipped. No new skips reported.
- Registration restored; Intranet and live outbound remain unchanged per evidence report. Evidence commit contains documentation/harness, not product changes.

## Limits / residual verification
- Operational mapping-write failure rollback was NOT exercised (Jest only). Stale-plan rejection is proven for the concurrent same-source mapping case; stale customer revision between planning and write was not independently induced.
- The full 100-row test uses an API harness, not one browser Transfer All interaction. Persistence field-by-field detail is empty in party-uat.json. Precondition strongCodeActiveHits=1 (not the requested literal zero); actual 50/50 preview and final counts nevertheless pass.
- Deleted mapping, exhaustive security negatives, cross-connection/cross-workspace race matrix, separate vendor conformance and real provider operation not proven by this report. Catalog/documents probes are not full browser/PDF regression.
- The underlying architecture debt remains partially verified; do not mark all vendor-independent closure criteria satisfied. User UAT pending. Master Goal 023 remains active. No new product correction is required solely on the basis of these evidence gaps; targeted residual verification is required before full certification. Do not rerun the successful 100-customer matrix solely to resolve unrelated evidence gaps.

No product change, version bump, release deployment, or outbound activation in this architect disposition.
