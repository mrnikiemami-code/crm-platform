# CRM-129 accounting UX 037 — architect source recovery (0.1.78)

State: SOURCE_READY_FOR_BUILD, not operational PASS.

Source commits: 0aa8f3e292 (automatic party identity and delegated CRM writes), 9cbc38792a (catalog synchronization and bulk safety), plus prior row-menu and action-bar fixes.

- User-owned Person and Company mutations use the delegated caller, not a new blanket application write role. Preflight the new nullable unique nationalCode fields and company accountingMobile against installed workspace metadata; refuse conflicting pre-existing definitions rather than deleting or duplicating fields.
- National identifier normalization preserves leading zeroes and determines kind from 10/11-digit length, not an official checksum. Ambiguous, conflicting and missing identities require review. No guessing by name alone.
- Catalog synchronization applies name and known exact price to the default IRR list. Historical prices are retained; same-day active price is updated, or a new dated price is created. The vendor adapter does not currently provide a trustworthy service/product distinction or unit for new catalog items, so the existing PRODUCT/عدد defaults remain.
- Mapping updates are confirmed after CRM changes. Cross-call writes are retryable, not an atomic distributed transaction. Stable IDs and nationalCode uniqueness reduce duplicate creation; verify concurrency and retry behavior operationally.
- Bulk import must not execute on a truncated, stale, or incompletely paged snapshot. Each apply request remains bounded.
- Document queue traverses all bounded pages and reads operation history for the relevant quotation revisions. Live outbound master remains disabled; UI does not claim a mock write occurred. Do not change flags to reach PASS.

## Cursor: BUILD + VERIFY ONLY
Use Dev only (3002), clean immutable image, no hot patch. Keep Intranet (6080) untouched. Verify exact source SHA and quotation 0.1.78, server/worker image identity, TypeCheck, full relevant unit suites, build and app sync. Use isolated mock records and real Chromium interactions plus persisted DB/API evidence:
- All connection row menu items work, correct record, keyboard and pointer; action/filter groups separated; only relevant bulk button visible.
- Import nonempty Person and Company selection and all across pages; existing national ID updates same CRM row, missing creates one row, repeat and concurrent calls do not duplicate, ambiguous/conflicting identities refuse, role and workspace isolation verified. Verify phone preservation.
- Import product creation, changed existing name and exact price, unchanged repeat, duplicate code refusal, two-page all, partial failure/retry and no-list refusal.
- Document queue across multiple pages, revision-specific operation states; outbound remains disabled and direct server refuses. Do not send real documents, mutate live vendor or enable global switch. Successful isolated mock export tests only if existing test harness supports it without changing operational guard; otherwise mark BLOCKED.
- Full quotation regression including PDF; legacy /s remains unavailable; report evidence for each case and all residuals. No source edits; report any compile/runtime errors to architect.
