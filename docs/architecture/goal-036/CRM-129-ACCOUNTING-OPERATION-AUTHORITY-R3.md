# CRM-129 R3 — Accounting operation authority and reproducible Dev verification

Base: f5481f2031eb7ddd47205dde353ec579d05fabb9. Quotation app version 0.1.72. Source implementation, not a runtime PASS.

- Single public accounting transport: existing authenticated POST /rest/quotation/actions. Six connection operations use existing Nest authority; seven import and five outbound actions use an explicit server allowlist and the existing installed application execution engine. No HTTP relay, alternate endpoint, vendor adapter copy, or Functions fallback.
- The accounting tab inside a quotation now consumes the same Nest connection DTO. The old accounting connection/import/outbound HTTP triggers are removed from the app manifest; applying the new app version must retire old metadata. Dispatcher refuses old HTTP-trigger installations. Existing function UUIDs remain unchanged.
- Existing app worker remains the execution owner of accounting algorithms, snapshots, workspace app variables and outbound flags. This repair is not a replacement of the Logic Function engine. Standard deployment of matching server/worker images is mandatory; worker GraphQL errors cannot be treated as success.
- Explicit safety decision: global operations use settings authority (or the installed Quotation application identity); record-specific preview/history for users or API keys checks actual quotation visibility without permission bypass. This is stricter than the old authenticated-only HTTP triggers. No new permission is silently granted. Confirm read-only and hidden-record cases in Dev. Actual vendor calls, credential changes and flag enablement remain prohibited under Goal 023.
- Runtime metadata remains unknown in Nest connection responses rather than claiming unverified worker flags. No outbound is enabled by this patch.
- Existing old-route diagnostic scripts may require transport updates before reuse; do not use them as proof of the new boundary.

## Immutable-image Dev gate (no hot patches)

Use the existing Dockerfile at packages/twenty-docker/twenty/Dockerfile. Build from a clean checkout of the exact commit, tag the image with that commit, and add the OCI revision label. Use the full twenty target if the current Dev container serves the frontend. Use the exact same image digest for server and worker in the existing Dev Compose project; preserve configuration, volumes, ports and database; verify the active project is the Dev instance before any recreate. Never touch intranet :6080. Do not run docker compose down -v or docker cp into running containers.

Example build from clean checkout:
```sh
docker build --target twenty -f packages/twenty-docker/twenty/Dockerfile --build-arg APP_VERSION=0.1.72 --label org.opencontainers.image.revision=<full-commit> -t twenty-dev/crm129:<commit> .
```

Before apply: TypeCheck, Vitest (zero unhandled), relevant server Jest and clean package/image build. After server and worker recreation: verify both image IDs, health, database continuity, apply quotation@0.1.72 to Dev only, inspect manifest removal of HTTP triggers, authorized browser/API tests for all actions, unauthorized direct legacy URL and cross-workspace/record access negative controls, no external vendor writes. Record actual image digest, commit, app version, runtime results and any blockers. Goal 023 stays ACTIVE.
