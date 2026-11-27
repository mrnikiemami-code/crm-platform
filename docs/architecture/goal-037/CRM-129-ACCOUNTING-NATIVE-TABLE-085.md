# CRM-129 — Native Twenty settings tables and direct pagination

Candidate: quotation@0.1.85. Base: d4e8776367b4cc949926caf7d9af9f31395ff03b (accepted 0.1.84).

## Scope
- The accounting settings lists (connections, customers, items, document queue) and auxiliary accounting tables reuse the host Twenty Table, TableBody, TableRow, TableHeader, TableCell primitives through explicitly marked HTML wrappers. The worker still has a semantic HTML fallback. No external grid library or replacement CRM UI.
- The host's SettingsPaginationControls has an optional numbered mode. Existing callers preserve their previous/next behavior. The numbered mode provides first/last, numbered controls, direct page entry, 25/50/100 page size, count/range and Persian labels/numbers. A narrow opt-in renderer resolver preserves the existing sanitized event/geometry path for unmarked HTML.
- For durable unpaged accounting snapshots, the request carries pageNumber and snapshotId; the server calculates the offset and returns the actual page. A stale snapshot restarts at page 1. Unfiltered navigation reads only the requested chunk(s). Search scans bounded snapshot chunks to calculate the filtered total; an invalid filtered page returns page 1. Existing cursor-only remote adapters retain previous/next rather than fabricating random access.
- Connections and documents page the already loaded bounded collections locally; bulk transfer/send behavior stays unchanged. Customer/item status filters remain page-local and are labeled accordingly. All existing transfer and authorization contracts remain unchanged.

## Verification gates (not yet executed)
1. Typecheck/build twenty-front-component-renderer, twenty-front, quotation and dependencies; run existing tests and new snapshot/adapter jump tests.
2. Deploy clean Dev image with both host and quotation bundle; verify the four lists actually use Twenty native DOM components and not fallback HTML. No screenshot-only or source-only PASS.
3. With a 1,300+ row synthetic isolated dataset, confirm page 50/25 returns rows 1226–1250 by one direct request; server-confirmed range, 25/50/100 page sizes, first/last, search reset, stale snapshot reset, zero/partial last page, fast repeated navigation; no intermediate page traversal or repeated provider full read.
4. Verify real host pagination event forwarding, RTL, keyboard entry including Persian digits, focus, sticky header, 360px horizontal scroll; normal row menus, select-all-current-page, cross-page selection, transfer-all and existing documents/connections operations.
5. Preserve 0.1.84 install/upgrade and financial integrity gates. No Intranet deployment, no real provider writes, no outbound flag change.

STOP_FOR_ARCHITECT after operational evidence. Source changes alone do not certify acceptance.
