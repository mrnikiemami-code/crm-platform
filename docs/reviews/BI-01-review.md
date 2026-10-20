# BI-01 — Codex independent review

Date: 2026-10-20  
Verdict: **CHANGES_REQUESTED / PARTIAL — not approved for merge or final acceptance**

## Exact submission reviewed

- Required/code parent: `d31537cafcce6d41fdfe45e4cdbb03de69625093`.
- Code: `ecda1c02bf1c6d65b15dc2c7ec18e60877b86d39`.
- Executor docs/tip: `2c5295dd8dd0a71307b4192c2d0b7a8cc55cafd1`.
- Branch: `bi-01-internal-help`.
- Main at review: `67ed54133aa54444b2c1fff5a08dd49311898f45` (documentation only since required base).
- Ancestry checked locally; code remains unmerged. Isolated detached worktree used for code inspection. Customer worktrees/data/services not changed.

## What is good and independently checked

- Four real Persian topics and one shared, pure content/search module exist. Front article/index routes and tool import the same catalog. Article bodies are rendered as text nodes.
- The Help tool no longer imports/injects an HTTP client or Mintlify configuration. The Front chat bootstrap implementation has been removed from its hook. These are code findings, not a capture of the installed build.
- Executed the branch's existing `HelpCenter.test.ts` using an isolated Vitest 4.1.12 configuration: **18/18 passed**. This is a focused run of that file; it is not the repository's full Nx/Jest/typecheck/build pipeline.
- Independently executed direct Node 24 imports/probes of the actual HelpCenter module: four topics, Arabic/Persian fold, ZWNJ parity, empty/no-match query, unknown slug and local result origins passed; local search did not call a replaced/denied fetch.
- Transpiled all **28 changed TS/TSX files** for syntax diagnostics: zero syntax errors. Transpilation does NOT establish type correctness, dependency resolution, macro/Linaria compilation or successful production build.

## Required corrections

### R1 — Remaining live application-description Help links (blocking)

`packages/twenty-front/src/pages/settings/applications/utils/getStandardApplicationDescription.ts` and `getCustomApplicationDescription.ts` still contain Getting Started / Building Apps Markdown links to `https://twenty.com/developers/extend/apps/...`.

These are not dead fixtures: `useResolvedApplicationDescription.ts` returns them for standard/custom applications; application details consumes the resolved description and the About tab renders Markdown. Changing the separate Read documentation button does not remove links in that content. Product-owned translated content must also be checked at render time.

Required: make these Help links internal or remove unsupported links with clear local guidance. Test the resolved/rendered descriptions for both application types and relevant shipped translations. Do not rewrite arbitrary customer descriptions.

### R2 — Relative Help links in actual emails (blocking)

The new Footer builder returns `/help` when `serverUrl` is absent. Only invite and approved-domain templates were changed to pass that prop. Password reset, password-update notification and email verification, among others, still call BaseEmail without it.

Independent probe executed the actual Footer TSX after transpilation with React-email slots stubbed; it is not a full email HTML render. The resulting Help href props without serverUrl were `/help`, `/help`; with `https://crm.example` they were `https://crm.example/help`. The caller omission is directly present in the actual templates, not just preview props.

Required: carry the validated published front/workspace origin through every production email caller. Render real email HTML for tests. Help URLs must be absolute HTTP(S) addresses for the correct installation/workspace. A recipient's mail client has no CRM origin with which to resolve `/help`. Missing/malformed origin must not silently produce a broken or `null/help` URL; define a safe explicit outcome. Preserve CTA tokens/expiry and other email behavior.

Website/GitHub/logo branding still present in email is tracked by later program stages; this finding is specifically about the Help links changed by BI-01.

### R3 — API catalog Help origin is request-derived (blocking task requirement)

The added comment in `build-api-catalog.util.ts` says baseUrl never comes from Host. Actual call: `WellKnownController.getApiCatalog` passes `getRequestBaseUrl(request)`. That helper returns `request.protocol + '://' + request.get('host')`.

An independent execution of the actual helper with a controlled Host returned `https://arbitrary-host.example`. This establishes request-derived data flow, not an independently demonstrated deployment exploit. It also does not establish that the resulting `/help` is served by the front if API and front are on different public origins.

Required: use the installation/workspace's validated published UI origin for service-doc Help links, while preserving canonical API anchors/descriptors and their existing semantics. Test hostile Host and split API/front origins. Do not refactor global request URL behavior or trust proxy broadly as a shortcut.

### R4 — Required validation and existing dashboard remain incomplete

- There are no component/navigation tests in the submission demonstrating actual Help menu click, article render and unknown-page navigation; data attributes in source alone are not DOM execution evidence.
- Executor explicitly did not complete full front/server typecheck/build. I cannot be PASS on that basis. Emails and shared build/export integration must also be validated because they changed.
- H is marked PASS by scope, but absence of a template-file diff is not a regression smoke test.
- Dashboard seed now uses `/help`; persisted existing product-owned dashboard links are not addressed or verified. Do not update customer data broadly to close this row.
- The installed front on port 3001 is reported to still serve main. It is not evidence for the submitted artifact.
- `git diff --check d31537ca ecda1c02` also flags extra EOF blank lines in the two server spec files. Fix while closing I; this is a minor formatting issue, not the main rejection reason.

Required: validate the corrected artifact in an isolated test runtime; no live outage or screenshots. If an environment-dependent row cannot be verified, leave it UNVERIFIED and do not label BI-01 done.

## Reviewer acceptance ledger

| Row | Codex result | Basis |
|---|---|---|
| A | Code present; runtime UNVERIFIED | Four-topic content exists; real menu-to-page navigation not executed against submitted artifact. |
| B | Lookup logic PASS; route/refresh UNVERIFIED | Unknown/known slug logic checked; installed route refresh not checked. |
| C | PASS for shared search | Focused 18 tests and independent direct probes. |
| D | PARTIAL / browser UNVERIFIED | Pure local search checked; full Help browser/tool traffic capture not done. |
| E | Code reviewed; integration UNVERIFIED | Local-only implementation found; repository Nest integration not rerun in this review. |
| F | FAIL | Active external Help links, email URL omission and request-derived catalog URL; old dashboards unverified. |
| G | Code reviewed; runtime UNVERIFIED | Hook has no external bootstrap; runtime navigation/bootstrap not exercised. |
| H | UNVERIFIED | No smoke/regression execution against submitted runtime. |
| I | INCOMPLETE | Syntax passes; full typecheck/build evidence absent; whitespace errors found. |
| J | Submitted; labels need correction | Worker honestly listed live limits, but some PASS labels overstate the scope of evidence. |

## Next action

Execute only [BI-01-R1 closure](../tasks/BI-01-R1-internal-help-closure.md). Keep the existing good implementation; fix R1–R3 and close the measured R4 gaps. Preserve this main-branch handoff when merging documentation changes from Cursor's older base. No BI-02, main-branch code merge or final zero-egress claim yet.
