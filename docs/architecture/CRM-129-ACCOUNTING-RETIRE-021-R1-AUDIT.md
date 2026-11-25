# CRM-129-ACCOUNTING-RETIRE-021-R1 — consumer audit

**Mode:** FIX + VERIFY  
**Gate:** `STOP_FOR_ARCHITECT`  

## R2 — Consumer matrix (retired connection)

| Path | Kind | Behaviour after R1 |
|---|---|---|
| `accounting-outbound` `operations` | **Historical read** | Uses `loadConnectionByIdForHistory` — retired **allowed**; ledger rows unchanged |
| `accounting-outbound` `preview-*` / `execute-*` | **New work** | `resolveConnection` + `requireActiveAccountingConnection` — retired **refused** (`CONNECTION_INACTIVE`) |
| Quotation tab history / documents ops reload | Historical read via `operations` | Same as above |
| `accounting-import` (catalog/party pages, refresh) | **New work** (remote list / apply) | Still `resolveConnection` — retired **refused** |
| Front mapping UI reading already-stored links | Local GraphQL / section state | Links remain on the retired row; no auto-reactivate |
| `accounting-connection` `test` | Operator probe (new network) | Still active-only via `resolveConnection` |
| `set-default` / `deactivate` / `reactivate` | Lifecycle | Unchanged from 020/021; reactivate never auto-defaults |

No consumer auto-activates or auto-defaults a retired connection.

## R3 — Concurrent retire vs send (Mock)

**Cutoff implemented (no wide lock):**

1. Handler: after workspace-default resolve, `requireActiveAccountingConnection` before adapter build.  
2. `executeItemPush` / `executeQuotationExport`: `requireActiveAccountingConnection` again before ledger create / vendor call.

**Explained outcome:**

- If retire commits **before** the execute-path active check → execute refuses `CONNECTION_INACTIVE`; **no** sync-operation row started.  
- If retire commits **after** that check → in-flight execute may still finish (same as any TOCTOU without a shared advisory lock between deactivate and outbound).

**Architecture stop line:** guaranteeing “retire always wins over any in-flight send” needs a **shared** lock (or outbox claim) across `deactivateConnection` and outbound execute. That is wider than this R1 fix; **not** implemented here. Evidence: unit test refuses when the connection is already inactive at the execute cutoff; residual race documented above for the architect.

## Non-goals verified

- No Asan/Sepidar live call  
- Outbound flags unchanged  
- Money / revision / PDF untouched  
- Worker / `:6080` not restarted for this doc alone  
