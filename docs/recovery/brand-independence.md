# Brand Independence — Execution Recovery

## Current checkpoint — 2026-10-18

- Program: BRAND-INDEPENDENCE; scope is technical brand/network/packaging independence.
- Owner/reviewer: Codex. Executor: Cursor. Final independent program review: Codex.
- Source baseline audited: `acb99294fe49f29d90a4064eef9546a7842f4bbf`.
- Planning commit: the commit introducing this file and BI-01; executor must resolve and record its SHA before starting.
- Canonical plan: [../plans/brand-independence.md](../plans/brand-independence.md).
- Active task: [BI-01](../tasks/BI-01-internal-help.md), READY_FOR_CURSOR, implementation not started.
- Explicit requirement: every product Help path and search must be internal/same-origin. No outbound help/search/chat fallback. User does not require screenshots.
- Existing product changes and deployments are not superseded by this documentation. No application code, live data, settings or infrastructure changed by this planning commit.

## Supervision protocol

1. Cursor checks baseline ancestry and preserves dirty worktrees; implements only active task on a separate branch.
2. Cursor records code SHA, changed files, commands/results and row-by-row acceptance. No automatic next task or main-branch merge.
3. Codex inspects actual diff and relevant tests/artifact evidence, checks scope and accepts/rejects specific rows. A worker's PASS is not the review result.
4. Codex issues a bounded correction only for failed rows, or the next stage after acceptance. Unavailable live evidence stays UNVERIFIED.
5. After implementation stages, Codex performs the separate whole-program review: appearance, email, links, browser/API/worker/DNS, installation/update, upgrade/cache and regression/restore. No final PASS until those checks have evidence.

## Acceptance ledger

| Delivery | Executor result | Codex review | Remaining |
|---|---|---|---|
| BI-01 internal Help | NOT STARTED | PENDING | A–J in task |
| Brand/assets | NOT STARTED | PENDING | Full plan stage 2 |
| Remaining links/social/email branding | NOT STARTED | PENDING | Full plan stage 3 |
| Remaining runtime egress/data references | NOT STARTED | PENDING | Full plan stage 4 |
| Independent packaging/install/update | NOT STARTED | PENDING | Full plan stage 5 |
| Whole-program independent acceptance | NOT STARTED | PENDING | Full plan stage 6 |

## Evidence record for each task

Record: exact baseline and code/docs SHAs; branch; files and rationale; runtime loaded; test commands/exit codes; route/DOM/network text; each acceptance row; deployment and rollback state; touched data/settings; limitations. No screenshots required. Do not record tokens, credentials or customer content.
