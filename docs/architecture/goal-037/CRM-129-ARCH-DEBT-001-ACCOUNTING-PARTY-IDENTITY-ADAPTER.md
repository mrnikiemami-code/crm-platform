# CRM-129-ARCH-DEBT-001 — Vendor-independent accounting customer identity

**Status:** PARTIALLY VERIFIED — 0.1.84 Dev Mock operational acceptance; remaining vendor conformance and certification evidence OPEN  
**Priority:** P0 (customer data integrity); blocks final acceptance of general-purpose customer synchronization  
**Owner:** Architecture / CRM-129  
**Parent:** Goal 037; related to active Master Goal 023, C1–C7 (preserve CRM reference-code ownership)  
**Recorded:** 2026-11-27  
**Observed baseline:** quotation@0.1.78, `98314f524cd27ed684651a11be6483fb43a72b5f`  
**Execution:** separate architect-approved remediation after current verification; this entry does not alter the frozen verification candidate.

## Evidence and gap

- `domain/accounting/adapter-contract.ts`: RemoteParty exposes externalPartyId, code, fullName, mobile, nationalCode, remoteVersion; it lacks explicit party kind, economic identifier and address.
- `domain/accounting/adapters/asan/asan-customer.ts`: Asan's outbound mapping knows PersonCode and PersonEcoCode; Asan has no separately documented company entity. Do not claim that an undocumented inbound field or customer-kind inference is verified.
- `objects/accounting-party-link.object.ts`: identity already uses connection + externalPartyId; externalCode is display-only under the current contract. Preserve existing links and separate CRM-owned accountingCode from vendor identifiers.
- `services/accounting-party-identity.service.ts` and `domain/accounting/party-identity.ts`: baseline resolver requires a 10/11-digit national identifier before resolving an existing mapping; this excludes legitimate customers without a national ID, and infers party kind from length. Economic-code matching is missing.
- Mock and Asan exist today; Sepidar, Holoo, Mahak and other vendors are future adapter implementations, not verified integrations.

## Required target architecture

1. A versioned vendor-neutral party contract carries stable external ID, customer code as text (leading zeros retained), explicit PERSON/COMPANY/UNKNOWN with provenance, national personal ID, legal national ID, economic code, mobile, name, address where supported, and remote version. Missing fields are explicitly unavailable, not fabricated.
2. Adapter registry declares identifier semantics, uniqueness scope, supported fields, kind mapping, normalization and read/write capabilities. If the vendor's customer code is its stable unique ID, the adapter maps it to the canonical external identity. Otherwise retain distinct external ID and code. Vendor-specific formats and API schemas remain inside adapters.
3. Durable source identity is workspace + accounting connection/dataset + stable external ID (or verified stable customer code). The same code in another connection is not proof of the same customer. Enforce uniqueness at persistence authority and preserve mapping history; do not silently rebind a connection to a different dataset.
4. One shared matching and upsert engine, one UI, no vendor-specific branches in CRM workflow. Existing valid mapping first, then exact national personal/legal ID, then economic ID, then normalized unique mobile with compatible identity evidence. Conflicting strong identifiers override priority: refuse rather than choose arbitrarily. Name alone is never identity. Existing mapping must still be checked for contradictory identity and correct party type.
5. National ID is not mandatory. Existing mapped customers without national ID can update; new customers with stable vendor identity and reliable type can be created without national ID if no conflicting/ambiguous CRM candidate exists. Unique mobile may resolve a compatible customer; shared phones, unknown type or contradictory identity go to review. Never invent a person/company type.
6. Update only source-owned, supported nonempty fields; preserve CRM notes, communications, opportunities, unrelated fields, permissions and workspace boundaries. Define normalization and field authority explicitly; missing vendor data must not erase CRM values. Use authoritative Person/Company persistence, not a parallel customer store.
7. Retries, concurrent first import, partial write recovery and duplicate detection must be durable across invocations and pages. Never report successful link before required writes are confirmed. Existing mappings and document references must survive contract evolution. Metadata collision/backfill plan requires explicit architect approval.
8. Adding a vendor requires adapter implementation, registry descriptor and conformance tests, not a rewrite of shared UI or matching engine. No invented vendor capability; unsupported operations fail closed. Keep canonical Nest transport; no legacy /s route or live outbound activation.

## Closure criteria (operational evidence required)

- Two independent adapter fixtures with different field names and ID/code semantics produce the same normalized behavior.
- Same customer code in distinct connections does not cross-link; alphanumeric and leading-zero customer codes survive round trip.
- Existing mapping without national ID updates; missing customer with reliable type and stable vendor identity creates once; repeated and concurrent import creates no duplicate.
- Exact personal/legal national ID and economic-code cases, normalized mobile-only compatible matches, shared phones, cross-identifier conflicts, unknown type and ambiguous legacy records have explicit tested outcomes.
- 100-customer bulk run across multiple pages includes customers without national IDs, persons and companies, existing updates and new creates; no manual search for unambiguous records, no duplicates, truthful counts, partial failure/retry.
- Read/write field authority, missing fields, access denial, workspace isolation, metadata compatibility and existing document links proven.
- Test contract conformance for Mock and Asan using isolated fixtures; real vendor behavior only with separately authorized evidence. Keep outbound safety guards and Intranet untouched.

## Gate

OPEN until architect-approved implementation, build, provider/DB/HTTP/browser verification and user UAT. A PASS for the frozen 0.1.78 matrix is not evidence that this debt is closed. Do not expand the current Cursor test-only assignment or move its expected source SHA.

## Remediation candidate 0.1.79

The optional profile, adapter declarations, connection-owned ledger metadata, delegated write guards, sparse identity resolver, deterministic IDs and isolated 100-party fixture are implemented in source. See [verification contract](CRM-129-ACCOUNTING-PARTY-CONTRACT-079.md). This is not a PASS. Existing dataset rebind protection, concurrency and cross-connection uniqueness require explicit verification; the previous two failing unit-test identities were not included in the worker report. No live provider or Intranet write is authorized.

## Recovery 0.1.81 — OPEN

0.1.80 install and 100-row preview passed, customer application still failed. 0.1.81 moves the write boundary into Nest with the original authenticated user, explicit user/app role intersection, native query runners, per-row transaction and stale-plan checks. Adapter contract and identity policy remain intact. See [architect recovery 081](CRM-129-ACCOUNTING-PARTY-RECOVERY-081.md). No closure claim until clean build and operational evidence.

## Recovery 0.1.82 — OPEN

0.1.81 failed at native customer write despite green build and tests. The wildcard actor audit hooks precede the object-specific guard; both generated audit fields were incorrectly treated as external business input. Keep the role intersection; restrict the corrected guard to the exact native command scope and authenticate actor stamps. See [recovery 082](CRM-129-ACCOUNTING-PARTY-RECOVERY-082.md). No operational acceptance yet.

## Recovery 0.1.83 — OPEN

0.1.82 resolved the production authorization block. 0.1.83 explicitly includes soft-deleted identity records in matching, refuses deleted/conflicting records and mappings without automatic restoration, rechecks identity under transaction and canonical role permissions, and compares actor stamp values across runtimes. Clean-workspace acceptance and distinct tombstone negative case required. See recovery 083. Cross-workflow concurrency and production provider proof remain unverified.

## Recovery 0.1.84 — OPEN

0.1.83 resolved the focused unit regressions but first install failed due to older quotation metadata. Recovery 084 repairs required unique TEXT default contracts without changing key identity, uniqueness or nullability, including the core update validator contradiction. Fresh install and upgrade gates are mandatory. No customer-matrix acceptance yet.

## Architect disposition 0.1.84 — 2026-11-27

Installation/upgrade and the demonstrated Mock customer sync path are accepted. See [acceptance record](CRM-129-ACCOUNTING-ARCHITECT-ACCEPTANCE-084.md) for precise proved outcomes and remaining evidence gaps. No unrestricted debt closure or production release.
