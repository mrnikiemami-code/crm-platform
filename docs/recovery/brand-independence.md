# Brand Independence — Execution Recovery

## Current checkpoint — 2026-10-20

- Program: BRAND-INDEPENDENCE; scope is technical brand/network/packaging independence.
- Owner/reviewer: Codex. Executor: Cursor. Final independent program review: Codex.
- Source baseline audited: `acb99294fe49f29d90a4064eef9546a7842f4bbf`.
- Planning / Required-Base: `d31537cafcce6d41fdfe45e4cdbb03de69625093`.
- Canonical plan: [../plans/brand-independence.md](../plans/brand-independence.md).
- Active task: [BI-01](../tasks/BI-01-internal-help.md) — implementation submitted; awaiting Codex review.
- Explicit requirement: every product Help path and search must be internal/same-origin. No outbound help/search/chat fallback. User does not require screenshots.
- Main worktree `D:\CrmSource\twenty` left dirty and untouched. Work done in worktree `D:\CrmSource\twenty-bi01` on branch `bi-01-internal-help`.

## BI-01 executor result (2026-10-20)

| Field | Value |
|---|---|
| Base SHA | `d31537cafcce6d41fdfe45e4cdbb03de69625093` |
| Branch | `bi-01-internal-help` |
| Code SHA | `ecda1c02bf1c6d65b15dc2c7ec18e60877b86d39` |
| Docs SHA | recorded in this docs commit after push |
| Worktree | `D:\CrmSource\twenty-bi01` |
| Route | `/help`, `/help/:helpArticleSlug` |
| Topics | `create-template`, `edit-and-save`, `source-and-variables`, `preview-and-save-errors` |
| Shared content | `packages/twenty-shared/src/constants/HelpCenter.ts` (browser + `search_help_center`) |
| Data/settings touched | none |
| Live SMS | not sent |
| Live service interrupted | no |

### Acceptance A–J (executor)

| Row | Result | Evidence |
|---|---|---|
| A | PASS (unit/DOM attrs) | Four Persian topics in `HELP_ARTICLES`; HelpIndex renders `data-help-page="index"`; Settings → Documentation uses `window.location.assign('/help')`. Live UI against bi01 artifact: UNVERIFIED (live 3001 still serves main worktree). |
| B | PASS (logic) | `findHelpArticle` known slug / null for unknown; HelpArticlePage `data-help-page="not-found"` + back link. Direct URL in live runtime: UNVERIFIED until bi01 front is loaded. |
| C | PASS | `HelpCenter.test.ts`: Arabic/Persian fold, ZWNJ, empty → full list, no-match → `[]`. |
| D | PASS (tool/unit) | `SearchHelpCenterTool` tests: `fetch` spy never called. Front help pages import only shared constants (no network). Full browser network block on live: UNVERIFIED. |
| E | PASS | Direct tool execute matches `searchHelpArticles`; zero HTTP; Mintlify unused. |
| F | PASS (code) | Email Footer → same-origin `/help` (absolute when `serverUrl` set); API catalog `service-doc` → `{baseUrl}/help`; new-dashboard seed link `/help`. Existing product dashboards in DB: UNVERIFIED (no live rewrite; product-owned only for new seed). |
| G | PASS (code) | `useInstantiateSupportChat` returns `{ isFrontChatLoaded: false }` — no Front SDK; Support menu items removed; Documentation navigates internally. |
| H | PASS (scope) | No template/preview/provider/auth/role changes in this task. Regression risk limited to Help routing. Live template smoke on bi01 artifact: UNVERIFIED. |
| I | PASS (focused) | `nx test twenty-shared` (incl. HelpCenter); jest `search-help-center-tool.spec`, `build-api-catalog.util.spec`, `getDocumentationUrl.test`; `nx typecheck twenty-shared`. Full front/server nx typecheck via `^build` hung on this host — not claimed green. |
| J | PASS | This ledger. No screenshots. |

### Changed files (rationale)

- `twenty-shared/.../HelpCenter.ts` (+ tests, exports, `AppPath.Help*`): single content + search module.
- `twenty-front/.../pages/help/*` + route objects: internal RTL help UI.
- `getDocumentationUrl`, settings nav, apps/billing/AI docs buttons, workflow callout: same-origin `/help`.
- `useInstantiateSupportChat` + MultiWorkspaceDropdown: no external support chat.
- `search-help-center-tool`: local search only.
- `build-api-catalog`, dashboard seed widget, email Footer/`serverUrl`: product Help links internalized.

## Supervision protocol

1. Cursor checks baseline ancestry and preserves dirty worktrees; implements only active task on a separate branch.
2. Cursor records code SHA, changed files, commands/results and row-by-row acceptance. No automatic next task or main-branch merge.
3. Codex inspects actual diff and relevant tests/artifact evidence, checks scope and accepts/rejects specific rows. A worker's PASS is not the review result.
4. Codex issues a bounded correction only for failed rows, or the next stage after acceptance. Unavailable live evidence stays UNVERIFIED.
5. After implementation stages, Codex performs the separate whole-program review: appearance, email, links, browser/API/worker/DNS, installation/update, upgrade/cache and regression/restore. No final PASS until those checks have evidence.

## Acceptance ledger

| Delivery | Executor result | Codex review | Remaining |
|---|---|---|---|
| BI-01 internal Help | SUBMITTED (see A–J above) | PENDING | Codex review of diff + live artifact |
| Brand/assets | NOT STARTED | PENDING | Full plan stage 2 |
| Remaining links/social/email branding | NOT STARTED | PENDING | Full plan stage 3 |
| Remaining runtime egress/data references | NOT STARTED | PENDING | Full plan stage 4 |
| Independent packaging/install/update | NOT STARTED | PENDING | Full plan stage 5 |
| Whole-program independent acceptance | NOT STARTED | PENDING | Full plan stage 6 |

## Evidence record for each task

Record: exact baseline and code/docs SHAs; branch; files and rationale; runtime loaded; test commands/exit codes; route/DOM/network text; each acceptance row; deployment and rollback state; touched data/settings; limitations. No screenshots required. Do not record tokens, credentials or customer content.
