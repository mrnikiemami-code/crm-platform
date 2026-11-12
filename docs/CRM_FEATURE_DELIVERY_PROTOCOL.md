# CRM feature delivery protocol

This protocol governs CRM feature work in this repository. Read it before planning or executing a CRM task. Existing architecture and code conventions in AGENTS.md / CLAUDE.md still apply.

## Outcome ownership

- Assign one end-to-end task per user-visible capability, not separate tasks for routine diagnosis, setup, build, install, and verification.
- The implementer owns ordinary development obstacles within the approved DEV scope: inspect the relevant source and runtime first, fix local dependency/environment issues safely, implement, integrate, and verify the user journey.
- A successful build, passing unit tests, or an INSTALLED app is **not** feature acceptance. Report success only when the intended UI flow works against the intended Dev environment. If manual interaction is essential and cannot be reproduced, report `MANUAL_UI_CHECK_REQUIRED`, not PASS.
- Keep the user out of routine technical decisions. Explain material trade-offs succinctly and request approval only at real decision boundaries.

## Architect's evidence-first responsibility

The architect (including an AI assistant preparing tasks) owns technical diagnosis and the recommended solution **before** issuing an implementation task. Do not delegate open-ended root-cause analysis to the implementer and call it an implementation plan.

For each nontrivial defect or architectural decision:

1. **Read the actual code:** inspect the relevant entry point, call chain, configuration declaration, dependency injection, authorization boundary, and error mapping in the repository. Confirm branch/commit and distinguish committed code from local uncommitted or deployed artifacts.
2. **Correlate runtime evidence:** trace the observed request/error through those exact code paths. Separate observed facts, inferred causes, and unverified hypotheses; do not present an inference as proof.
3. **Assess blast radius:** find shared consumers of proposed configuration, service, SDK, schema or package changes. Check environment isolation, secrets, permission scope, backward compatibility and rollback.
4. **Choose the smallest supported solution:** first inspect built-in extension points and scoped configuration; prefer app/workspace-specific fixes when appropriate. Do not hardcode local addresses, change global public URLs, or alter shared runtime architecture to mask a local issue.
5. **Verify feasibility before prescribing:** ensure the proposed mechanism is actually permitted (including reserved environment-variable names, precedence, scope, and runtime reachability). A source-level override order is evidence of precedence, **not** proof that the platform accepts that override.
6. **Issue a decisive task:** specify the exact target, file/function or supported configuration surface, expected behavior, bounded checks, prohibited changes, and PASS/STOP criteria. Implementation agents may resolve routine surprises but must not choose an unapproved architectural alternative.

If code or runtime evidence is inaccessible, attempt the available repository/connector access first. State the precise missing evidence and request only that evidence; never invent a definitive fix or send speculative implementation tasks. A read-only evidence request is not a substitute for the architect doing the analysis when the source is accessible.

**Architect's final gate:** before approving a task, answer: What exactly failed? Which code proves it? Why is the selected solution safe for other modules? How will success be verified? What is the rollback? If any answer is unknown, label it and do not claim the solution is verified.

## Before coding

- Confirm repository, branch, working tree, target environment, running services, workspace links, package manager and versions, and relevant SDK/runtime capabilities.
- Reuse existing objects, workflows, services, validation, permissions and UI patterns. Respect package boundaries and the repository's clean architecture; do not bypass layers to make a demo work.
- State a short acceptance contract: entry point, prefilling, validation, saving, errors, authorization, and observable result.
- Inspect only what is relevant; do not create a standalone planning/audit task when this can be done inside delivery.

## Execution

- Work in a single bounded implementation cycle: diagnose → implement → integrate → verify → report.
- Fix ordinary Dev-only configuration or cache problems within the task when reversible, isolated, and authorized; do not repeatedly seek approval for every command.
- Prefer the smallest correct fix. Do not upgrade dependencies, alter shared architecture, rewrite unrelated modules, or add abstractions merely to address a local failure.
- Preserve unrelated changes and uncommitted work. Never run broad resets, database resets, or destructive cleanup without explicit authorization.
- Run focused tests and one bounded runtime verification. No screenshot requirements, repeated test loops, or speculative rounds of fixes.
- If a test is blocked, explain the exact blocker and what remains unverified.

## Mandatory STOP_FOR_ARCHITECT

Stop before: changing shared architecture or package contracts; schema/migrations or business invariants; broad permission/security changes; destructive operations or real payment/registration writes; production/intranet deployment or restart; shared infrastructure changes; any action affecting another checkout or environment; or a non-reversible/unbounded fix.

At the stop, report the evidence, impact, minimal options, rollback and recommended choice. Do not start a new task or continue automatically.

## Environment boundaries

- Development frontend/backend are separate from CRM intranet `:6080`. Never modify, restart, deploy to, or migrate intranet without explicit approval.
- Verify actual workspace link targets and runtime dependency identity before changing React/SDK/Vite resolution. A local junction/cache repair is not a reason to change the source architecture.
- Keep credentials out of commits and reports; revoke temporary credentials.
- Do not create real registrations or payments merely to prove a UI works without explicit authorization.

## Reporting and acceptance

Use a compact report: task ID; user-visible acceptance status (`PASS`, `BLOCKED`, or `MANUAL_UI_CHECK_REQUIRED`); actual workflow verified; changes; focused checks; remaining blocker; Git SHA/worktree; rollback; environment isolation.

A capability is delivered only when the user can complete its intended workflow, or the remaining manual check is clearly identified. A STOP checkpoint is for consequential decisions, not routine development steps.
