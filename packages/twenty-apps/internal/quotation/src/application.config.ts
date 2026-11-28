import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The Quotation app: pro-forma quotations for products and services, plus a
// vendor-neutral accounting bridge.
//
// WHY ONE APP AND NOT TWO: the quotation needs the catalog and the connector needs the
// catalog, so splitting them would create a dependency edge between two bundles for a
// shared object. The integration code is still isolated by directory and behind an
// adapter contract, which is what actually keeps a vendor from leaking into the domain.
//
// NO SERVER VARIABLES: connector credentials are per-workspace, so they are declared as
// workspace `applicationVariables` with `isSecret: true`. The platform encrypts every
// value with the workspace key regardless, and `isSecret` only controls masking — but a
// registration-scoped variable would be shared by every workspace, which for an
// accounting credential is the wrong shape.
//
// Nothing here is `isRequired`: an unused connector must not block installation, and a
// missing credential is reported at send time with a stable code instead.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'پیش‌فاکتور',
  description:
    'مدیریت کالا، خدمات و پیش‌فاکتور. اتصال حسابداری جدا و قابلیت‌محور است (آسان اول، سپیدار دوم). محدودیت کپی نیم‌فاصله در مرورگر برای PDF همچنان ثبت است و مانع این اپ نیست.',
  serverVariables: {},
  applicationVariables: {
    // The default accounting connection used when a caller does not name one.
    ACCOUNTING_DEFAULT_CONNECTION: {
      universalIdentifier: 'e0b1c2d3-0001-4000-8000-000000000001',
      description:
        'Id of the accountingConnection used when an operation does not name one. Empty means the caller must choose.',
      isSecret: false,
    },
    // Credentials, namespaced per adapter so adding a vendor never touches another
    // vendor's configuration.
    MOCK_ADAPTER_SHARED_SECRET: {
      universalIdentifier: 'e0b1c2d3-0002-4000-8000-000000000002',
      description:
        'Shared secret for the mock adapter used in development and integration tests. Never a real credential.',
      isSecret: true,
    },
    // Asan documents no authentication. When the vendor sits behind an approved tunnel
    // or reverse proxy that requires a bearer token, it lives here, never on the
    // connection record (which is readable through the API and in backups).
    ASAN_TUNNEL_TOKEN: {
      universalIdentifier: 'e0b1c2d3-0005-4000-8000-000000000005',
      description:
        'Bearer token added to Asan requests by the approved tunnel. Secret; empty when the tunnel needs no token.',
      isSecret: true,
    },
    // Legacy variable retained so existing installations are not destructively changed.
    // It does not authorize cleartext or any real write.
    ASAN_TRANSPORT_APPROVED: {
      universalIdentifier: 'e0b1c2d3-0006-4000-8000-000000000006',
      description:
        'Legacy approval flag; does not authorize cleartext or actual vendor writes.',
      isSecret: false,
    },
    // Explicit read-only rollout binding. All three must match the saved connection.
    // No default values; installation alone never enables vendor traffic.
    ASAN_APPROVED_READ_CONNECTION_ID: {
      universalIdentifier: 'e0b1c2d3-0008-4000-8000-000000000008',
      description: 'Exact approved accounting connection id for Asan read-only access.',
      isSecret: false,
    },
    ASAN_APPROVED_READ_BASE_URL: {
      universalIdentifier: 'e0b1c2d3-0009-4000-8000-000000000009',
      description: 'Exact approved HTTPS gateway base address for Asan read-only access.',
      isSecret: false,
    },
    ASAN_APPROVED_READ_IPV4: {
      universalIdentifier: 'e0b1c2d3-0010-4000-8000-000000000010',
      description: 'Explicit public IPv4 pin for the approved HTTPS gateway; private egress is not enabled.',
      isSecret: false,
    },
    ASAN_APPROVED_READ_GENERATION: {
      universalIdentifier: 'e0b1c2d3-0011-4000-8000-000000000011',
      description: 'Unique UUID for this read authorization. Clear before revocation and replace on every credential or destination rotation; never reuse.',
      isSecret: false,
    },
    // Registering a pro-forma in accounting is a fiscal act, so it has its own switch
    // separate from ordinary catalog/price pushes.
    ACCOUNTING_DOCUMENT_EXPORT_ENABLED: {
      universalIdentifier: 'e0b1c2d3-0007-4000-8000-000000000007',
      description:
        'Master switch for registering approved quotations in accounting. Off by default; a saved draft is never exported.',
      isSecret: false,
    },
    // Whether outbound writes to accounting are enabled at all for this workspace.
    // A distinct switch from the connection being active, because turning off every
    // outbound write must not lose the connection's configuration.
    ACCOUNTING_OUTBOUND_ENABLED: {
      universalIdentifier: 'e0b1c2d3-0003-4000-8000-000000000003',
      description:
        'Master switch for CRM-initiated writes to accounting. Off by default: nothing leaves the CRM until someone turns it on.',
      isSecret: false,
    },
    // The tax policy applied by default. A rate is never baked into code: the correct
    // rate and its legal basis are an accounting decision.
    DEFAULT_TAX_POLICY: {
      universalIdentifier: 'e0b1c2d3-0004-4000-8000-000000000004',
      description:
        'Identifier of the tax policy a new quotation starts with, for example IR_VAT_9. Rates are configured per policy, not hardcoded.',
      isSecret: false,
    },
  },
});
