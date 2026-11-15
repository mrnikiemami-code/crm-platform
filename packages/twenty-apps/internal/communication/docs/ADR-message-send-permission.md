# ADR: authorizing message sends from apps

Status: proposed (the API-key half is not implemented)

## Context

The Communication app owns the workspace's outbound messaging: an SMS composer
on a Person, a settings test-send, and a send route the UI calls.

Two authorities are involved when somebody sends a message:

1. **Which customers may this caller see** — already answered by roles and
   row-level predicates, and already enforced on every read.
2. **May this caller send anything at all** — a different question. Reading a
   customer must not imply the right to message them, because a send costs money
   and leaves the workspace.

Before this work, `communication-send-message` (`/communication/send`) had no
check at all: the first authority was the only gate, so any member who could see
a customer could message them. `/communication/settings-test-sms` already
enforced a permission flag server-side.

## What exists today

`PermissionFlagType.SEND_EMAIL_TOOL` is the platform's own outbound-message
permission: `send-email.resolver.ts` is guarded by
`SettingsPermissionGuard(PermissionFlagType.SEND_EMAIL_TOOL)`. It is a TOOL
flag, so it follows `canAccessAllTools` rather than the settings switch. There
is no channel-specific or SMS-specific flag.

## Decision

Reuse `SEND_EMAIL_TOOL` for every outbound channel of the app, and enforce it
inside the app's own route handlers.

Why not a dedicated `SEND_MESSAGE_TOOL`:

- It would grant nothing new. Because both flags resolve through
  `canAccessAllTools`, every role would get exactly the answers it gets today.
- It costs six surfaces: `PermissionFlagType`, `SystemPermissionFlag`,
  the default-permissions map, `TOOL_PERMISSION_FLAGS`, the role-settings UI
  config (with translations), and the regenerated metadata client.
- It would still not solve the API-key case below, so the surface would be paid
  for nothing.

The accepted cost is a naming mismatch: the UI label for the flag is
"Send Email". An administrator who grants it also permits SMS. This is stated
here so it is a known decision rather than a surprise.

## The unresolved half: API keys

An API key **cannot** be authorized on an app route, with the current platform.

Evidence, measured on an isolated copy of the intranet:

| probe | API key |
|---|---|
| `currentUser { id }` on `/metadata` | `Forbidden resource` |
| `getRoles` | returns every role, not the caller's |
| `people(first: 1)` on `/graphql` | allowed, per the key's own role |

The app learns its caller through `TWENTY_APP_ACCESS_TOKEN`, which the executor
sets to a **delegated user token** when the run has a triggering person, and to
the plain application token otherwise. An API key has no person, so both tokens
are the application token and no query can answer "what is this key allowed to
do". The app therefore has exactly two honest options: refuse, or guess. It
refuses.

Refusing is fail-closed and the route says so precisely: `CALLER_NOT_A_USER`,
distinct from `NOT_PERMITTED` (a person who lacks the flag) and from
`PERMISSION_CHECK_FAILED` (a transient read failure). Before this change the
API-key case reported `CHECK_FAILED`, which reads like a bug.

### What a real fix requires

One of these, both platform changes:

**A. Gate the route at the platform.** Add an optional permission requirement to
`HttpRouteTriggerSettings` (e.g. `requiredPermissionFlag: 'SEND_EMAIL_TOOL'`) and
enforce it in `route-trigger.service.ts` with the existing permission service,
which already resolves roles for users, API keys and applications. The trigger
settings are stored as JSON, so the storage change is small, but it adds a
metadata field, its converter, validation, and the app manifest surface — and it
must land in the platform, not this repository's app layer.

**B. Expose the caller's authority to the run.** Put the resolved role's
permission flags into the logic-function environment next to
`TWENTY_APP_ACCESS_TOKEN`, so an app can answer the question itself. Smaller
code, but it widens what every app can learn about its caller, so it needs a
deliberate security review.

Until one of these exists, automation credentials are refused on this route. No
intranet automation calls it (there are no active API keys bound to a send flow,
and the Workflow entry point is disabled), so nothing breaks today.

## Consequences

- A member needs `canAccessAllTools` to send. Admin and Member have it; the
  restricted record-access role does not, which is the intended outcome.
- Record access still applies: a sender can only send to customers their own
  role can read. Both authorities are required.
- API keys cannot send. If that is ever needed, do A or B above first.
