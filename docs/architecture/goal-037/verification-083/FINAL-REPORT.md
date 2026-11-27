# CRM-129-ACCOUNTING-PARTY-RECOVERY-083 — FINAL REPORT

**Verdict: FAIL_WITH_PRECISE_EVIDENCE (fresh-workspace apply BLOCKED)**

**Candidate:** quotation@0.1.83 @ `09c96b6e508a85596e1f5c92edba28d345882d67`  
**Mode:** BUILD + DEPLOY + OPERATIONAL VERIFICATION ONLY (no product source / test expectation edits)  
**Evidence:** `docs/architecture/goal-037/verification-083/`

---

## Automated gates (PASS)

| Suite | Result | Log |
|---|---|---|
| Focused identity Vitest | 9/9 PASS | `vitest-identity.log` |
| Focused actor-hook + apply Jest | 12/12 PASS | `jest-focused.log` |
| Full Vitest (quotation) | **783 passed** / 3 skipped | `vitest.log` |
| Guard pkg cwd | 5/5 PASS | `vitest-guard-pkg.log` |
| Full Jest (quotation Nest) | **368 passed** / 4 skipped (1 suite skipped) | `jest-quotation.log` |

Prior 082 ACTOR_MISMATCH Jest failures are resolved on this SHA.

## Deploy (PASS)

| Check | Result |
|---|---|
| Clean image | `twenty-dev/crm129:09c96b6…` digest `sha256:475d00a32740546347dda150dbdc8d3ea42cd2978e21819820bcf4fb590cec24` |
| server/worker | identical |
| Intranet | unchanged since 2026-11-25 |
| Multi-workspace | enabled via verification-only compose overlay (`docker-compose.multiworkspace.yml`) so an isolated workspace could be created without product edits |

## Fresh isolated workspace (CREATED; app sync BLOCKED)

| Step | Result |
|---|---|
| Create user `party083.mwydw5jc@local.test` | PASS |
| `signUpInNewWorkspace` → `9b4c41e6-d936-401c-9d5d-90b8e3c2f17d` (`p083mwydw5jc`) | PASS |
| Activate → `ACTIVE` with Admin/Member roles | PASS (`activate-workspace-run.log`) |
| Transfer quotation registration ownership to fresh WS | PASS (`transfer-registration.json`) |
| `twenty apply -r dev-crm129-083` (0.1.83) | **FAIL** |

### Apply failure (precise)

```
Sync failed with 2 errors
index:
  1. INDEX_FIELD_INVALID_DEFAULT_VALUE: Unique index cannot be created for field tokenHash of type TEXT
     (universalIdentifier: 2cc4d45d-fa9b-59d2-8c01-1641bc0a0a64)
  2. INDEX_FIELD_INVALID_DEFAULT_VALUE: Unique index cannot be created for field scopeKey of type TEXT
     (universalIdentifier: 258ea183-6f25-5be1-a97e-e912d7030270)
```

Log: `apply.log`.  
No product source changes were made to alter indexes/fields. Windows apply used verification-only `posix-path-preload.cjs` (path separators only).

Registration ownership was transferred **back** to the original Dev workspace (`glorious-aqua-whale` / `afc7afb6-…`) after documenting the blocker (`transfer-registration-back.json`) so the contaminated workspace was not left without registration ownership.

## Mandatory operational matrix (NOT EXECUTED)

Per architect contract, the 100-customer matrix **must** run on a fresh isolated workspace with the app synced — not on the contaminated workspace and not by deleting fixture records.

Because apply could not install quotation objects/LFs into the fresh workspace, the following were **not** executable and are **not** claimed:

- Pre-seed zero-match assertion for all 100 fixture IDs
- Seed 30/20 + preview 50/50
- Apply 50 creates / 100 mappings / 0 refused
- Repeat sync, soft-deleted identity cases, rollback, stale, concurrency
- Security + accounting/quotation regression on the fresh workspace

No contaminated fixtures were reused. No existing customer/mapping records were deleted to obtain PASS.

## Constraints honored

- No product source changes; no test expectation edits; no permission bypass
- No screenshots; no Intranet changes; no live accounting writes
- Evidence under `verification-083/` only

## STOP_FOR_ARCHITECT

Gates and clean image are green. Fresh Dev workspace was created and activated, but quotation@0.1.83 cannot sync into a new workspace due to unique TEXT index validation on `tokenHash` / `scopeKey`. Architect decision required (index/field type remediation, install path, or alternate isolation strategy) before the 100-customer operational acceptance can run.
