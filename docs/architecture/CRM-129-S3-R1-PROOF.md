# CRM-129-S3-R1 PROOF — Secure Customer Quotation Link

**Base:** `40b1ee34f99e35457a074629cd108c2e498f19d9`  
**Branch:** `feat/crm-129-quotation`  
**GitHub SHA:** `e29f25d093806e21a081f79d7a86947e2138ab58`  
**Result:** **PASS** (Dev API). Lifecycle button is present; browser click is `MANUAL_UI_CHECK_REQUIRED`.

## 1. Source review

- Public HTML pattern: document-generator `view-document` (`isAuthRequired: false`, `GET /s/...`).
- Authenticated mutation routes stay `isAuthRequired: true` and use the app token, same as save-draft.
- Lifecycle UI posts to `/rest/quotation/actions` as the signed-in user. That controller allow-list was not extended. Mint and revoke go through the existing app-route client so no server/front contract changes.
- Customer page query selects person/company **names only** (no ids).

## 2. Contract

- Raw token: 32 random bytes, base64url, returned once.
- Stored value: sha256 hex only (`tokenHash`, unique).
- Expiry is required. Revoke sets `revokedAt`. Either condition fails closed.
- Issuable statuses: `READY_TO_SEND`, `SENT`, `CUSTOMER_ACCEPTED`, `CUSTOMER_REJECTED`.
- Public page is read-only HTML for that one quotation. No API key, token, CRM ids, or other customers.

## 3. Implementation

- Object `quotationCustomerLink` + quotation `customerLinks` relation.
- Logic functions: `POST /quotation/create-customer-link`, `POST /quotation/revoke-customer-link`, `GET /quotation/customer-view`.
- Lifecycle panel: «صدور لینک مشاهده مشتری» and «لغو همین لینک» for allowed statuses.
- App **0.1.8** applied on `dev-crm129` (`http://localhost:3002` only).
- Dev URL note: inside the container `TWENTY_API_URL` is `http://127.0.0.1:3000`. The link rewrites only that listen address to `http://localhost:3002`. Other hosts are unchanged.

## 4. Tests

| Check | Result |
| --- | --- |
| Vitest quotation app | **231 PASS** |
| Dev `dev-exercise-s3-r1-customer-link.cjs` | **`S3_R1_CUSTOMER_LINK_PASS`** |

Dev cases:

| Case | Result |
| --- | --- |
| Draft mint | refused |
| Valid public GET | **200**, own line visible, no token/person id/other quotation |
| Unknown token | **404** |
| Revoked | **410** |
| Forced expiry | **410** |
| Unauthenticated mint | HTTP 500 body `Missing authentication token`; link count unchanged (platform status, route did not run) |

## 5. Isolation

- Intranet `:6080` was down and was not started.
- `twenty-server-1` had exited (255) and was started so Dev `:3002` could be verified. No intranet container, no worker, no SMS, no accounting write, no release-branch change.
- Unrelated dirty files left uncommitted: Settings select/API-key front files + `enterprise-plan.service.ts`.

## Residuals

- Unauthenticated logic routes return 500 rather than 401. Denial is still fail-closed.
- Public link host rewrite is Dev-port specific (`:3000` → `:3002` on localhost only).
- Operator UI click on the lifecycle buttons was not browser-verified.

## STOP_FOR_ARCHITECT
