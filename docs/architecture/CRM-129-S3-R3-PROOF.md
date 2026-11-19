# CRM-129-S3-R3 PROOF — Quotation Multi-Channel Sharing

**Base:** `a937656cc8c291f85f94f556e1c99d592709d9f6`  
**Branch:** `feat/crm-129-quotation`  
**Result:** **PASS** (Dev share + honest MANUAL_SHARE history). Lifecycle channel-picker click remains operator-visible; REST path covers the same bridge action.

## 1. Source review

- Communication Provider Registry today registers **SMS only** (`CommunicationChannel = 'SMS'`; kavenegar / razpayamak).
- No parallel send stack was added. Share delivery resolves against that registry capability: listed messengers → `MANUAL_SHARE` until a real provider exists; a future provider branch is reserved to call Send/Persist and store `communicationId` / `providerId`.
- Privileged ops continue on the session/API-key bridge: `callQuotationRoute` → `POST /rest/quotation/actions`.

## 2. Contract

- Action `share-quotation` requires **user or API-key** actor and held permission **`quotation.send`**.
- Supported channels: Bale, WhatsApp, Telegram, Instagram, Eitaa, Rubika, Soroush.
- Response includes Persian share text (title, document number, customer, channel, secure view URL) plus `outcome`, `linkId`, `shareId`, customer person/company ids.
- History object `quotationShare` stores channel, outcome, customer ids, `linkId`, log-safe `detail` — **never** raw token or full secret URL.
- App LF `/quotation/share-quotation` always returns `USE_USER_SESSION_BRIDGE`.
- Outcome for unconnected messengers is **`MANUAL_SHARE`** — never fake `PROVIDER_SENT`.

## 3. Implementation

- App domain: `share-channel.ts`, `share-message.ts`; object `quotationShare`; lifecycle panel channel chips + «ارسال پیش‌فاکتور».
- Server: `QuotationShareService` + util mirror; controller/module/allow-list wired.
- App **0.1.10** applied on `dev-crm129`. Nest quotation share JS docker-cp’d into `twenty-server-1` (no intranet touch).

## 4. Tests

| Check | Result |
| --- | --- |
| Vitest quotation app | **236 PASS** |
| Jest share util + share authz + allow-list | **PASS** |
| Dev `dev-exercise-s3-r3-share.cjs` | **`S3_R3_SHARE_PASS`** |

Dev cases:

| Case | Result |
| --- | --- |
| App-token LF share | `USE_USER_SESSION_BRIDGE` |
| Channel `SMS` | refused (`INVALID_INPUT`) |
| Telegram share with admin API key | success; `outcome=MANUAL_SHARE`; Persian text + viewUrl |
| History row | channel/outcome/linkId/personId/quotationId; detail has no token/URL |
| Bale share | also `MANUAL_SHARE` |

## 5. Isolation

- Intranet `:6080` untouched.
- No messenger API wiring, no bulk auto-send, no fake SENT.
- Unrelated dirty files left uncommitted: Settings select/API-key front files + `enterprise-plan.service.ts` (if still dirty).

## STOP_FOR_ARCHITECT
