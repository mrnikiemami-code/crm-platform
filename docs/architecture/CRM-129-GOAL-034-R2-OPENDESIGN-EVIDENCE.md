# CRM-129 Goal 034-R2 — OpenDesign evidence

**Date:** 2026-11-26  
**Parent:** Goal 023 ACTIVE  
**Gate:** STOP_FOR_USER_UAT  

## OpenDesign health

- Clone: `D:\CrmTools\open-design` (nexu-io/open-design)
- Docker image: `ghcr.io/nexu-io/od:latest`
- Container: `open-design` on `http://127.0.0.1:7456`
- Health: `GET /api/health` → `{ ok: true, version: "0.25.1" }`
- Cursor MCP wrapper: `D:\CrmTools\od-mcp-stdio.cmd` → `~/.cursor/mcp.json` server `open-design`
- System `od.exe` on PATH is Hermes octal dump — **not** OpenDesign; use Docker CLI/API

## Project + skills used

- Project id: `crm129-fs-r2`
- Skill: `redesign-existing-projects` (+ craft from `frontend-design`, `minimalist-ui`)
- Artifacts written into OD project:
  - `INVENTORY.md`
  - `DESIGN-DECISIONS.md`
  - `transfer/fs-contract.css`
- `start_run` not used: no local agent CLI inside the container (`claude`/`opencode` not-on-path) and Goal forbids paid Go credits. Design decisions were produced via OpenDesign skill protocols + daemon project file API, then transferred into Twenty React.

## Decisions transferred into product React

| Decision | React landing |
| --- | --- |
| Dense operational IA, no marketing glass | `tax-policy-settings-panel.tsx` max-width 1120, denser rows |
| Default via row accent, not banner | removed `tax-default-banner`; `is-default` inset accent |
| Currency = single IRR hero card | `quotation-currency-settings-section.tsx` |
| Rounding = dense surface list | `rounding-rule-settings-section.tsx` |
| Menu absolute under trigger | `row-actions-menu.tsx` |
| Dialog focus trap + sizes | `settings-dialog.tsx` |
| Delete latch confirm→mutation | `run-destructive-confirm.ts` + panel refs |

## App version

`quotation@0.1.64`
