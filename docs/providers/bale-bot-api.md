# Bale Bot API — contract notes (CRM-129-S3-R4)

Source of truth: [docs.bale.ai](https://docs.bale.ai/) (بازوی بله).

## Request shape

- Base: `https://tapi.bale.ai/bot<TOKEN>/<METHOD_NAME>`
- HTTPS only; GET or POST; JSON body supported for non-file methods.
- Response always includes boolean `ok`. On success, payload is in `result`. On failure: `error_code`, `description`.

## sendMessage

| Param | Required | Notes |
| --- | --- | --- |
| `chat_id` | yes | Unique conversation id (integer/string) or `@channelusername` |
| `text` | yes | 1–4096 characters |

Example:

```http
POST https://tapi.bale.ai/bot<TOKEN>/sendMessage
Content-Type: application/json

{"chat_id":183266491,"text":"سلام"}
```

Success returns the sent message object including `message_id`.

## CRM mapping

- Workspace secret: `BALE_BOT_TOKEN` (communication app variable).
- Provider id: `bale`; channel: `BALE`.
- Quotation share uses `recipient = chat_id` (numeric required for customer DMs).
- Only provider `SENT`/`DELIVERED` maps to quotation `PROVIDER_SENT`.
