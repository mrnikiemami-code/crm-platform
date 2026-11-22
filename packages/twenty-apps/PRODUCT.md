# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Twenty CRM app (`packages/twenty-apps/internal/quotation`): React 19 front components built with `twenty-sdk`, rendered inside the Twenty shell with Twenty design tokens (`--t-*`). Persian RTL.

## Users

Small-business owners, sales staff and bookkeepers in Iran who already run an accounting package (Asan / Sepidar) and use this CRM to issue quotations. They are not developers: they recognise "نرمافزار حسابداری" and «کالا» and «مشتری», not "adapter", "mapping", "snapshot" or "cursor".

## Product Purpose

Connect the CRM to the accounting software so that products, customers and prices stay in agreement, and so a quotation can be prepared for registration in accounting without re-typing anything. Success means a non-technical user can connect, understand the connection state, find a product or customer, and understand why something is not matched — without a developer beside them.

## Positioning

One accounting panel that behaves the same whether the vendor's API pages or not: the CRM never asks the vendor for a whole table on every keystroke, and never pretends a bounded first-N list is the whole catalog.

## Operating Context

- The accounting destination is either a mock connection (for demonstration, no vendor traffic) or a real Asan installation that may sit behind an approved tunnel.
- Asan documents `AllProducts` / `AllCustomers` as full-list endpoints and `LastProducts?Count=N` as "last N". There is no page or cursor, so the panel reads once into a bounded snapshot and pages inside the CRM.
- Financial writes and document registration are switched off in this release; the panel is read-only towards the vendor.
- The user works on desktop in the office and on a phone while visiting a customer.

## Capabilities and Constraints

- Read strategies: `REMOTE_PAGED` (vendor pages itself) and `REMOTE_UNPAGED` (bounded snapshot in the workspace key-value store). Both render one identical UI.
- Every list is server-paged with an explicit cursor and an honest total (or an honest "unknown").
- Hard ceilings: 20 000 rows soft (sync reported as incomplete), 100 000 rows hard (explicit refusal), 64 MB response-body ceiling read with an early abort.
- Section content: overview, connections, products, customers, documents/operations history.
- Persian RTL, Persian digits, Twenty tokens only. No parallel form or service may be introduced.

## Brand Commitments

Product language is Persian and plain: «اتصال»، «همگامسازی»، «کالا»، «مشتری»، «سند». Technical vocabulary may appear only inside a folded «جزئیات فنی» block.

## Evidence on Hand

- Mock dataset with deliberate defects: 33 products (duplicate code, duplicate names, invalid ids, missing price, inactive) and 22 customers (duplicate national code, duplicate party id, missing national code).
- Synthetic scale reports: 1 000 000 CRM customers, 100 000 products, `scripts/scale-report.json`.
- Dev verification scripts producing real pass/fail lines against `localhost:3002`.
- No real Asan endpoint or credentials: the live adapters stay `LIVE_UNVERIFIED`.

## Product Principles

1. One interface regardless of vendor capability; capability is a data fact, not a different screen.
2. Never show a bounded prefix as the whole list.
3. Every screen states the one next action.
4. Technical truth lives in a folded details block, never in the main path.
5. The user must always be able to see where they are and get back.

## Accessibility & Inclusion

Keyboard-only operation with visible focus, screen-reader labelled controls, ≥4.5:1 text contrast, 44px touch targets, correct `dir="rtl"` reading order, no meaning conveyed by colour alone.
