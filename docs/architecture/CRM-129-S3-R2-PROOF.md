# CRM-129-S3-R2 PROOF — Link Authorization & Browser UAT

**Base:** `0aa0ec2bd28de4ee4775df1c9835c3bf24f07b72`  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS** (authz + public browser). Lifecycle button click is `MANUAL_UI_CHECK_REQUIRED` (workspace login password unavailable).

## 1. Source review

- Operator mint in S3-R1 used `callAppRoute` + app token inside the FC sandbox → any user who could load the panel could mint with app privileges.
- Privileged quotation ops already use the session-cookie bridge: `callQuotationRoute` → `POST /rest/quotation/actions` with `credentials: 'include'`.
- Permissions: `quotation.send` is granted only to full workspace editors (`canUpdateAllObjectRecords` / settings). Object-only editors get `quotation.edit` + `quotation.submitForApproval` only.

## 2. Contract

- Create/revoke require a **user or API-key** actor (not application).
- Create/revoke require held permission **`quotation.send`**.
- Revoke requires `linkId` to belong to the named `quotationId`.
- App LF routes `/quotation/create-customer-link` and `/revoke-customer-link` always return `USE_USER_SESSION_BRIDGE`.
- Public GET view remains unauthenticated and read-only.

## 3. Implementation

- Server: `QuotationCustomerLinkService` + controller actions `create-customer-link` / `revoke-customer-link`.
- Front allow-list + lifecycle panel use the session bridge; mint also copies URL via host clipboard when available.
- App **0.1.9** applied on `dev-crm129`. Dev server quotation module docker-cp’d (no intranet touch).

## 4. Tests

| Check | Result |
| --- | --- |
| Vitest quotation app | **231 PASS** |
| Jest allow-list + customer-link authz | **PASS** |
| Dev `dev-exercise-s3-r2-link-authz.cjs` | **`S3_R2_LINK_AUTHZ_PASS`** |
| R1 regression `dev-exercise-s3-r1-customer-link.cjs` | **`S3_R1_CUSTOMER_LINK_PASS`** (REST mint/revoke) |

Authz cases:

| Case | Result |
| --- | --- |
| Admin/API key mint via REST bridge | success; hash stored |
| App-token LF mint | `USE_USER_SESSION_BRIDGE` |
| Limited role (object-only) mint/revoke | `PERMISSION_MISSING` |
| Revoke with other quotationId | `CUSTOMER_LINK_QUOTATION_MISMATCH` |
| Valid / revoked / expired / unknown public GET | 200 / 410 / 410 / 404 |

## 5. Browser

- Public view without CRM login: title + read-only note shown for minted link.
- After revoke: page title **لینک لغو شده**.
- Lifecycle «صدور لینک» click: **MANUAL_UI_CHECK_REQUIRED** — Dev workspace users are `amir.nosratii94@gmail.com` / pilots; `tim@apple.dev` is absent. Front temporarily served on `:3021` because `:3001` hosts another app (Hani). Bridge path itself is covered by REST + allow-list.

## 6. Isolation / worktree

- Intranet `:6080` untouched.
- Unrelated dirty files left uncommitted: Settings select/API-key front files + `enterprise-plan.service.ts`.

## STOP_FOR_ARCHITECT
