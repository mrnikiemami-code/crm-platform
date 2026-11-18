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
