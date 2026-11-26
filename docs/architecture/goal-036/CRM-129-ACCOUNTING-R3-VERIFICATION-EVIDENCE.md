# CRM-129 — Accounting R3 Verification Evidence

**Mode:** BUILD + DEPLOY + VERIFY  
**Date:** 2026-11-26  
**Branch:** `feat/crm-129-quotation`  
**Architect expected HEAD:** `657047e8bc83ce69fd5743b82f8e815c39b7c9fc`  
**Verified build HEAD (image revision):** `da49edb4c433416dddf9e053d3f28e3dd3ff18bc`  
**App:** `quotation@0.1.72` applied on Dev (`dev-crm129`)  
**Intranet `:6080`:** untouched (`crm-intranet/twenty:53db32b3`)

## Verdict

`READY_FOR_ARCHITECT_REVIEW` with documented Dev operational overlays and build-helper fixes required on this host.

Goal 023 remains ACTIVE / NOT COMPLETE. No real Asan document send occurred (`OUTBOUND_DISABLED` on execute-quotation-export).

## 1. Git / gates

| Check | Result |
| --- | --- |
| FF to expected architect commit | PASS (`657047e8bc`) |
| Follow-up build fixes committed | `604bd69686` ambient.d.ts; `da49edb4c4` DNS pins; `f5c85bdff3` Windows inspect JSON |
| `npx tsgo --noEmit -p tsconfig.spec.json` (quotation) | PASS |
| `npx vitest run` (quotation) | **784 PASS** / 0 unhandled |
| Jest dispatch + UI controller + connection authority | PASS (10 + 22) |

## 2. Immutable image build

Script: `packages/twenty-apps/internal/quotation/scripts/build-crm129-dev-image.ps1`

| Item | Value |
| --- | --- |
| Image tag | `twenty-dev/crm129:da49edb4c433416dddf9e053d3f28e3dd3ff18bc` |
| Image ID | `sha256:2dff464412413170809d7df3610d37bcccef3a4399fb917c76e9ecac445229d5` |
| OCI revision label | `da49edb4c433416dddf9e053d3f28e3dd3ff18bc` (matches tag) |
| PlatformVersion build-arg | `dev` initially invalid at runtime; Dev overlay clears `APP_VERSION` to empty (prior Dev image behavior) |
| Hot patch | **Not used** |

### Host build blockers fixed (operational)

1. Docker Hub 403 → pulled matching node base via `public.ecr.aws/docker/library/node:24.19.0-alpine3.23` (digest `sha256:244cc2b5…`).
2. Alpine/npm CDN sinkholed to `127.x` inside Docker DNS → script `--add-host` pins.
3. Babel/lingui reject `static prototype` in `react-pdf-fontkit.ambient.d.ts` → removed invalid ambient.
4. PowerShell mangled Go-template label inspect → JSON inspect in script.

## 3. Dev deploy (same digest, no hot patch)

Project: `twenty` / compose `D:\crm setup\twenty\docker-compose.yml` + CRM129 image overlay (+ local APP_VERSION / `LOGIC_FUNCTION_API_URL` overlay).

| Service | Image | Digest | Health |
| --- | --- | --- | --- |
| `twenty-server-1` | `twenty-dev/crm129:da49edb4…` | `sha256:2dff4644…` | healthy / `:3002` |
| `twenty-worker-1` | same | same | running |
| `crm-intranet-server` | unchanged | `ad06c934…` | `:6080` |

**Required Dev runtime overlay (not Intranet):**

- `APP_VERSION=''` — baked `dev` fails Nest semver validation.
- `LOGIC_FUNCTION_API_URL=http://127.0.0.1:3000` on **server** — Nest executes Logic Functions in-process; public `SERVER_URL=http://localhost:3002` is refused inside the container. Without this, all import/outbound Nest dispatches returned `QUERY_ERROR`.

## 4. Apply `quotation@0.1.72`

```text
node -r ./scripts/windows-path-preload.cjs ./node_modules/twenty-sdk/dist/cli.cjs apply -r dev-crm129 --force
→ Synced; httpRouteTriggerSettings → null for:
  accounting-connection / accounting-import / accounting-outbound
```

### Legacy `/s` removal (post-apply)

| Path | Status | Code |
| --- | --- | --- |
| `/s/quotation/accounting-connection` | 404 | `TRIGGER_NOT_FOUND` |
| `/s/quotation/accounting-import` | 404 | `TRIGGER_NOT_FOUND` |
| `/s/quotation/accounting-outbound` | 404 | `TRIGGER_NOT_FOUND` |

## 5. Eighteen Nest accounting operations

Transport: `POST /rest/quotation/actions` only.

### Connection (6) — PASS

| Action | Result |
| --- | --- |
| `accounting-connection-list` | success; `supportedAdapters` asan/mock |
| `accounting-connection-test` | success; simulated mock test |
| `accounting-connection-save` | success |
| `accounting-connection-set-default` | success |
| `accounting-connection-deactivate` | success |
| `accounting-connection-reactivate` | success |

### Import (7) — PASS (after `LOGIC_FUNCTION_API_URL`)

| Action | Result |
| --- | --- |
| `accounting-import-preview-items-page` | success (`page`) |
| `accounting-import-preview-parties-page` | success (`page`) |
| `accounting-import-search-party-candidates` | success |
| `accounting-import-preview-items` | success (`preview`) |
| `accounting-import-preview-parties` | success (`preview`) |
| `accounting-import-apply-items` | success (empty selections) |
| `accounting-import-apply-parties` | success (empty selections) |

### Outbound (5)

| Action | Result |
| --- | --- |
| `accounting-outbound-operations` | success (`operations`) |
| `accounting-outbound-preview-item-push` | success (`preview`) |
| `accounting-outbound-preview-quotation-export` | success (`preview`) |
| `accounting-outbound-execute-quotation-export` | **fail-closed** `OUTBOUND_DISABLED` (no vendor write) |
| `accounting-outbound-execute-item-push` | fail-closed `QUERY_ERROR` without valid selections (no Asan call observed) |

## 6. UI / mapping / history / regression

| Case | Result |
| --- | --- |
| Accounting overview | loads; mapping counts truthful «نخوانده» when unread |
| Connections list | 19 connections |
| Goods import UI | 31 mock items after reload |
| Customers UI | 20 parties |
| Documents / history | loads; auto-send off copy |
| Hidden quotation preview | `FORBIDDEN` for unknown `quotationId` |
| Quotation list regression | 40 rows incl. sealed / tax007 / number-race |
| Draft IRR | prior panel still IRR-only |

## 7. Residuals / notes for architect

1. Build image from `657047e8` alone fails lingui extract until ambient.d.ts fix (`da49edb4` lineage).
2. Dev needs `LOGIC_FUNCTION_API_URL` on **server** when Nest owns LF execution; worker-only setting is insufficient.
3. `PlatformVersion` must be empty or valid semver; string `dev` crashes Nest config validation.
4. `execute-item-push` empty-selection `QUERY_ERROR` is fail-closed; outbound master switch remains off.

## STOP_FOR_ARCHITECT

Immutable Dev image + identical server/worker digest deployed; `quotation@0.1.72` applied; three `/s` triggers gone; eighteen Nest actions exercised; no Intranet mutation; no live Asan document send.
