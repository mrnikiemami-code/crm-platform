# CRM-129 Design Engine 035 — Progress

**Parent:** Goal 023 ACTIVE / Goal 034-R2 USER_REJECTED_VISUAL  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.65` on Dev `:3002`  
**Page:** http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d  
**Gate:** DESIGN_EVIDENCE_REQUIRED → implemented → **STOP_FOR_USER_UAT**

## Root cause repaired

Docker OpenDesign (`:7456`) could not run host Windows OpenCode. Native OpenDesign (`pnpm tools-dev`) on Daemon `http://127.0.0.1:49750` / Web `http://127.0.0.1:49751` made agents available. MCP `user-open-design` pointed at the native daemon.

## Real design-agent execution (evidence)

| Field | Value |
| --- | --- |
| Project | `crm129-de-035` |
| Discovery run | `772674de-e033-4371-a327-a5e3eef06531` (succeeded, plan only) |
| Production run | `d454f184-a0fe-4996-82ad-7a6ca31ad690` |
| Request / strategy | `odnext_04ae3c4d658b48f29070931957d93f5a` |
| Agent | OpenCode |
| Model | `opencode/mimo-v2.6-flash-free` (no paid credits) |
| Deliverable | `deliverableValid: true` — `preview/index.html` |
| Studio | http://127.0.0.1:49751/projects/crm129-de-035/conversations/e0c6e49f-e984-4806-9279-7db8c1f85a3c |
| Preview | http://127.0.0.1:49750/api/projects/crm129-de-035/raw/preview/index.html |

Artifacts archived under `docs/architecture/design-engine-035/`:

- `DESIGN.md` — IA “register with a context rail”; three tab structures
- `TRANSFER-MAP.md`
- `preview/index.html` (~85KB interactive RTL prototype)
- `transfer/components/*` — SettingsShell, TaxLedger, CurrencyHero, RoundingList, RecordDialog, RowMenu

**Not** project+decision-file only: production `start_run` wrote nine files via OpenCode tool_use (`write` ×9) and OD validated syntax.

## Product implementation

Same Front Component page (no new route). Composers keep Nest / Money Domain contracts.

| Area | Change |
| --- | --- |
| Tax | `SettingsShell` + `TaxLedger` register (not table/cards/black CTA) |
| Currency | `CurrencyHero` IRR dossier (no bootstrap button) |
| Rounding | `RoundingList` step ladder |
| Dialogs / delete | Host `SettingsDialog` + `runDestructiveConfirm` unchanged |
| Menus | Transfer `RowMenu` absolute under relative trigger |

Tests: `tax-policy-settings-panel.test.tsx` — **31 PASS**.

## Browser match

| Check | Result |
| --- | --- |
| Shell + rail + register | PASS |
| Currency dossier | PASS |
| Rounding ladder | PASS |
| More menu + edit dialog + locked accounting code | PASS |
| Mobile 390 overflow | PASS (`scrollWidth === clientWidth`) |
| Financial regressions observed | None (list/save/delete guards intact) |

Screenshots: `docs/architecture/design-engine-035/browser/`.

## STOP_FOR_USER_UAT

Goal 023 remains **ACTIVE**. Please review the live page visually against prior 033/034/034-R2 rejection criteria (structure, not spacing/color tweaks).
