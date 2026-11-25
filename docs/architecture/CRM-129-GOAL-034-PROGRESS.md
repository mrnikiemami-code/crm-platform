# CRM-129 — Goal 034 / 034-R2 Live Visual Redesign

**Parent:** Goal 023 (ACTIVE)  
**Supersedes:** Goal 033 UX acceptance failure; Goal 034 first delivery USER_REJECTED_VISUAL  
**Branch:** `feat/crm-129-quotation`  
**App:** `quotation@0.1.64` on Dev `:3002`  
**Gate:** `STOP_FOR_USER_UAT`

## OpenDesign (R2)

Daemon `http://127.0.0.1:7456` healthy (`0.25.1`). Project `crm129-fs-r2` with skill `redesign-existing-projects`. Evidence: [CRM-129-GOAL-034-R2-OPENDESIGN-EVIDENCE.md](./CRM-129-GOAL-034-R2-OPENDESIGN-EVIDENCE.md). No paid Go credits used.

## Shipped in R2

- Absolute-anchor `RowActionsMenu` (no viewport-fixed coords); browser CDP: last-row tax menu `top = trigger.bottom + 4`, `isTopLeftBug=false`
- Removed default tax banner; default shown via row accent + badge
- Dense tax ledger; max width 1120; Edit button only (no row-click competing with More)
- Currency IRR hero card; no bootstrap button
- Rounding dense surface list
- `SettingsDialog` Tab focus trap + lg size for tax
- Delete latch spans confirm → mutation (`runDestructiveConfirm` + panel refs)
- Same CRM page only: `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d`

## Tests

- tax-policy-settings-panel + confirm + run-destructive-confirm: **36 PASS**

## Safety

No Money Domain / Nest authority / historical revision / `:6080` changes.
