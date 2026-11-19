# CRM-129-S3-R4 PROOF — Bale Direct Sending

**Base:** `03d6690d58b0a97ff83e772c42925152b9eb2961`  
**Branch:** `feat/crm-129-quotation`  
**GitHub SHA:** `ddfa3ccb1a51e533481d8c8b8e6a71ffbe7a44aa`  
**Result:** **PASS (contractual)** — `LIVE_UNVERIFIED` (no authorized test bot token / chat id supplied)

## 1. Contract (docs.bale.ai)

- Base: `https://tapi.bale.ai/bot<TOKEN>/METHOD`
- `sendMessage` JSON: `{ chat_id, text }`; success `{ ok: true, result.message_id }`
- Notes: `docs/providers/bale-bot-api.md`

## 2. Communication (no parallel stack)

- Provider `bale` registered beside kavenegar/razpayamak; channel **`BALE`**
- Workspace secret **`BALE_BOT_TOKEN`** (`isSecret: true`); API host fixed
- LF `POST /s/communication/send-outbound-message` → **Send/Persist** only
- Numeric `chat_id` required for BALE

## 3. Quotation share wiring

- `resolveQuotationShareDelivery('BALE')` → `{ kind: 'PROVIDER', providerId: 'bale' }`
- Nest `QuotationShareService` requires `quotation.send` + valid `chatId`
- Dispatches via `QuotationCommunicationOutboundService` → Communication LF (loopback)
- **`PROVIDER_SENT` only** when provider returns SENT/DELIVERED
- Duplicate `PROVIDER_SENT` for same quotation+channel refused (`DUPLICATE_SHARE`)
- Other messengers remain `MANUAL_SHARE`

## 4. Versions

- Communication **0.1.78**, Quotation **0.1.11** on `dev-crm129`
- Nest quotation share/outbound JS docker-cp’d (no `:6080`)

## 5. Tests

| Check | Result |
| --- | --- |
| Vitest Bale provider/config/registry/outbound handler/settings | **PASS** |
| Vitest quotation share-channel | **PASS** (236 suite) |
| Jest Nest share util/authz | **PASS** |
| Dev `dev-exercise-s3-r4-bale.cjs` | **`S3_R4_BALE_CONTRACT_PASS`** |

Dev cases without live creds:

| Case | Result |
| --- | --- |
| BALE without `chatId` | refused |
| BALE with non-numeric chat | refused |
| BALE with placeholder chat, no workspace token | `outcome=PROVIDER_FAILED` (not fake SENT) |
| Live send | **not attempted** — set `CRM129_BALE_BOT_TOKEN` + `CRM129_BALE_CHAT_ID` (and matching workspace secret) to verify |

## 6. Isolation

- No `:6080`, no bulk send, no unrelated Core edits, no screenshot loop
- Unrelated dirty Settings/enterprise files left uncommitted

## STOP_FOR_ARCHITECT
