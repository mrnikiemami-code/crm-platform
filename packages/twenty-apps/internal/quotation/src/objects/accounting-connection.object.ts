import {
  defineObject,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_FIELDS,
  ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_ITEM_LINK_FIELDS,
  ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_PARTY_LINK_FIELDS,
  ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SYNC_OPERATION_FIELDS,
  ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// One configured accounting destination. Vendor-neutral by construction: `adapterId`
// names a contract implementation, never a vendor hardwired into the app.
//
// NO CREDENTIAL FIELD HERE. Secrets are declared as `applicationVariables` with
// `isSecret: true`, which the platform encrypts per workspace and injects into the
// logic-function context. Storing a token in a record would put it in the UI, in
// exports and in backups.
//
// `capabilities` is the JSON the adapter reported, kept on the record so a decision
// taken yesterday ("we could create items then") is still explainable today.
export default defineObject({
  universalIdentifier: ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'accountingConnection',
  namePlural: 'accountingConnections',
  labelSingular: 'Accounting connection',
  labelPlural: 'Accounting connections',
  description:
    'A configured accounting destination, with the capabilities its adapter reported.',
  icon: 'IconPlugConnected',
  labelIdentifierFieldMetadataUniversalIdentifier: ACCOUNTING_CONNECTION_FIELDS.name,
  fields: [
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'For example سامانه حسابداری فروشگاه مرکزی.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.adapterId,
      type: FieldType.TEXT,
      name: 'adapterId',
      label: 'Adapter id',
      description:
        'Stable machine id of the adapter implementation, for example mock or holoo. Never a display name.',
      icon: 'IconPlugConnected',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.adapterVersion,
      type: FieldType.TEXT,
      name: 'adapterVersion',
      label: 'Adapter version',
      description:
        'Version of the adapter contract the connection was configured against, so behaviour can change deliberately.',
      icon: 'IconVersions',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.capabilities,
      type: FieldType.RAW_JSON,
      name: 'capabilities',
      label: 'Capabilities',
      description:
        'What this destination can actually do, as reported by its adapter. Gates every write; an unsupported operation becomes MANUAL_EXPORT_REQUIRED rather than a silent success.',
      icon: 'IconListCheck',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Active',
      description: 'Inactive connections keep their history but receive no new operations.',
      icon: 'IconCircleCheck',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.lastHealthCheckAt,
      type: FieldType.DATE_TIME,
      name: 'lastHealthCheckAt',
      label: 'Last health check',
      description: 'When testConnection last succeeded.',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.baseUrl,
      type: FieldType.TEXT,
      name: 'baseUrl',
      label: 'Service address',
      description:
        'Address of the vendor API. Never carries a user name, a password or a token; credentials are workspace secrets.',
      icon: 'IconWorld',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.remoteUserId,
      type: FieldType.TEXT,
      name: 'remoteUserId',
      label: 'Vendor user id',
      description:
        'The vendor user the CRM writes as, kept as text because it is a vendor identifier, not a CRM user.',
      icon: 'IconUser',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.defaultStorageId,
      type: FieldType.TEXT,
      name: 'defaultStorageId',
      label: 'Default warehouse id',
      description:
        'Warehouse the vendor should book a line into. Empty means the adapter default.',
      icon: 'IconBuildingWarehouse',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.moneyUnit,
      type: FieldType.SELECT,
      name: 'moneyUnit',
      label: 'Amount unit',
      description:
        'The unit the vendor stores amounts in. UNCONFIRMED is the safe default and blocks every amount transfer.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: `'UNCONFIRMED'`,
      options: [
        {
          id: SELECT_OPTION_IDS.accountingMoneyUnitUnconfirmed,
          value: 'UNCONFIRMED',
          label: 'تأییدنشده',
          color: 'red',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.accountingMoneyUnitRial,
          value: 'RIAL',
          label: 'ریال',
          color: 'green',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.accountingMoneyUnitToman,
          value: 'TOMAN',
          label: 'تومان',
          color: 'blue',
          position: 2,
        },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.transportApproved,
      type: FieldType.BOOLEAN,
      name: 'transportApproved',
      label: 'Transport approved',
      description:
        'Whether a person approved TLS/tunnel for this destination. Writes stay closed until it is true.',
      icon: 'IconLock',
      isNullable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.specialCodes,
      type: FieldType.RAW_JSON,
      name: 'specialCodes',
      label: 'Special item codes',
      description:
        'Which vendor special item codes (discount, duty, tax) exist in this installation. Sending an undefined code would fail at the vendor.',
      icon: 'IconCode',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.financialSettings,
      type: FieldType.RAW_JSON,
      name: 'financialSettings',
      label: 'Financial settings',
      description:
        'Currency base and mapping, conversion rate, and the test-only mock profile. Only the fields the destination declared are read; an absent block means the conservative default, never "no requirements".',
      icon: 'IconCurrencyDollar',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.healthState,
      type: FieldType.SELECT,
      name: 'healthState',
      label: 'Health',
      description: 'Result of the last connection test.',
      icon: 'IconHeartbeat',
      isNullable: false,
      defaultValue: `'UNKNOWN'`,
      options: [
        {
          id: SELECT_OPTION_IDS.accountingHealthUnknown,
          value: 'UNKNOWN',
          label: 'آزمایش‌نشده',
          color: 'gray',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.accountingHealthOk,
          value: 'OK',
          label: 'پاسخ داد',
          color: 'green',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.accountingHealthFailed,
          value: 'FAILED',
          label: 'خطا',
          color: 'red',
          position: 2,
        },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.lastHealthMessage,
      type: FieldType.TEXT,
      name: 'lastHealthMessage',
      label: 'Last health message',
      description:
        'Readable result of the last test, including why it failed. Persian because a person acts on it.',
      icon: 'IconMessage',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_CONNECTION_FIELDS.verificationState,
      type: FieldType.SELECT,
      name: 'verificationState',
      label: 'Verification',
      description:
        'MOCK or LIVE_UNVERIFIED until a real vendor server answers; only then LIVE_VERIFIED.',
      icon: 'IconShieldCheck',
      isNullable: false,
      defaultValue: `'LIVE_UNVERIFIED'`,
      options: [
        {
          id: SELECT_OPTION_IDS.accountingVerificationMock,
          value: 'MOCK',
          label: 'آزمایشی',
          color: 'gray',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.accountingVerificationLiveUnverified,
          value: 'LIVE_UNVERIFIED',
          label: 'فعال، تأییدنشده',
          color: 'orange',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.accountingVerificationLiveVerified,
          value: 'LIVE_VERIFIED',
          label: 'فعال، تأییدشده',
          color: 'green',
          position: 2,
        },
      ],
    },
    {
      universalIdentifier: RELATION_FIELDS.accountingConnectionPartyLinks,
      type: FieldType.RELATION,
      name: 'partyLinks',
      label: 'Party links',
      description: 'Customers and companies mapped into this destination.',
      icon: 'IconUsers',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        ACCOUNTING_PARTY_LINK_FIELDS.connection,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.accountingConnectionItemLinks,
      type: FieldType.RELATION,
      name: 'itemLinks',
      label: 'Item links',
      description: 'Catalog items mapped into this destination.',
      icon: 'IconLink',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        ACCOUNTING_ITEM_LINK_FIELDS.connection,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.accountingConnectionSyncOperations,
      type: FieldType.RELATION,
      name: 'syncOperations',
      label: 'Sync operations',
      description:
        'Every write attempted against this destination. The ledger reconciliation reads.',
      icon: 'IconArrowsExchange',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        ACCOUNTING_SYNC_OPERATION_FIELDS.connection,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
