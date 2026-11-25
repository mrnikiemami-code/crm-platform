# CRM-129 Goal 023 — WS3 Preflight (Per-line tax)

**Status:** frozen for implementation; **Dev Schema/App Apply NOT authorized** by this document.  
**App version prepared:** `0.1.55` (from `0.1.54`).

## New line field UUIDs (frozen)

| Field | UUID |
|---|---|
| `quotationLine.taxPolicy` | `a125c2c8-7db7-52f9-9b60-425c4ec390df` |
| `quotationLine.taxRateBasisPoints` | `3addd952-6dec-5272-9251-df733d37b5d2` |
| `quotationLine.dutyRateBasisPoints` | `b48f590b-66ec-5f28-a27d-6ae46e954084` |
| `quotationLine.taxAccountingCode` | `906e354d-9ef7-578e-b3b3-21b291f83585` |
| `quotationLine.taxPolicyRecordId` | `4cf932cd-a585-5f2f-89ad-7396a178be09` |

## Apply plan (later gate)

1. Schema apply for `quotationLine` five fields above.
2. App apply `quotation@0.1.55`.
3. Smoke: two-line draft with distinct policies → save → reopen → issue → PDF.
4. Rollback: revert app version; columns remain nullable / default-safe.

## Out of scope here

- Dev apply / deploy
- Multi-currency (WS4)
- Outbound enablement / `:6080`
