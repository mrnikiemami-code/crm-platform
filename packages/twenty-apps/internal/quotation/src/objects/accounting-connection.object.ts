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
  ACCOUNTING_SYNC_OPERATION_FIELDS,
  ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
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
      defaultValue: '',
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
      defaultValue: '',
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
