# Communication providers

Reference material for the SMS providers shipped by the internal `communication`
app (`packages/twenty-apps/internal/communication`).

## RazPayamak REST webservice

- Spec: [`razpayamak-rest-webservice.pdf`](./razpayamak-rest-webservice.pdf)
- Base: `https://rest.payamak-panel.com`
- Auth: `username` (panel account) + `password` (**ApiKey** issued under the
  developer menu). Both are sent in the request body.
- Transport: every endpoint is `POST`.
- Response envelope: `{ "Value": string, "RetStatus": int, "StrRetStatus": string }`.
  Success is `RetStatus = 1` / `StrRetStatus = "Ok"`.

### Endpoints documented in the spec

| Endpoint | Purpose |
| --- | --- |
| `api/SendSMS/SendSMS` | Send one text to up to 100 recipients (`,`-separated `to`) |
| `api/SendSMS/SendMultipleSMS` | Send a different text per recipient (`to[]`, `text[]`) |
| `api/SendSMS/SendSchedule` | Scheduled send (up to 300 recipients) |
| `api/SendSMS/GetDeliveries2` | Delivery status for a `recID` |
| `api/SendSMS/GetMessages` | Sent/received message list |
| `api/SendSMS/GetCredit` | SMS credit |
| `api/SendSMS/GetCredit2` | Rial credit |
| `api/SendSMS/GetBasePrice` | Base tariff |
| `api/SendSMS/GetSmsPrice` | Cost estimate |
| `api/SendSMS/GetUserNumbers` | Dedicated sender numbers |
| `api/SendSMS/GetSchedule` | Scheduled-record detail |

### Implemented by this app

Only `SendSMS` is wired today, through the provider at
`src/providers/razpayamak/`. It posts the documented body
(`username`, `password`, `to`, `from`, `text`) and maps a `RetStatus = 1`
response to `SENT`, taking the first entry of the comma-separated `Value` as the
provider message id.

The send endpoint is configurable through the `RAZPAYAMAK_ENDPOINT` application
variable (default: the official `api/SendSMS/SendSMS` URL), so a workspace can
point it at a mock or an alternate host without a code change.

### `Value` codes on the send call

`Value` carries a `recID` on success; otherwise it is a numeric code:

| Code | Meaning |
| --- | --- |
| `1` | Request succeeded |
| `0` | Wrong username or password |
| `2` | Insufficient credit |
| `3` | Daily send limit reached |
| `4` | Send volume limit reached |
| `5` | Invalid sender number |
| `6` | System is updating |
| `7` | Text contains a filtered word |
| `9` | Sending from public lines is not allowed via the webservice |
| `10` | User is not active |
| `11` | Not sent |
| `12` | User documents are incomplete |
| `14` | Text contains a link |
| `15` | Missing opt-out code at the end of the text |
| `16` | Recipient number not found |
| `17` | Text is empty |
| `18` | Invalid mobile number |
| `108` | IP blocked due to failed API attempts |
| `109` | Allowed IP for API use is required |
| `110` | ApiKey must be used instead of the password |
| `111` | Requester IP is invalid |

### Deliberately not implemented

- `SendMultipleSMS` — the app sends **one message per recipient, sequentially**,
  so each Person's outcome is truthful and independently recorded. It does not
  batch recipients into a single provider call.
- Delivery receipts (`GetDeliveries2`) — `supportsDeliveryReceipt` stays `false`
  until the receipt path is wired.
