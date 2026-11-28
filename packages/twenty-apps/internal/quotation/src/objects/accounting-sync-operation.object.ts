import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SYNC_OPERATION_FIELDS,
  ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// The durable ledger of every write attempted against an accounting package.
//
// WHY THIS EXISTS AT ALL: the platform's logic-function queue retries a bounded number
// of times and then discards the failure, leaving only a log line, and it has no
// dead-letter store. An accounting push that fails for good would therefore disappear.
// This record outlives the job: a reconciliation pass reads anything left
// FAILED_FINAL or MANUAL_EXPORT_REQUIRED.
//
// The record's own id is derived from (connection, kind, entity, revision), so the
// database's uniqueness on the primary key IS the idempotency guarantee: a retry
// cannot insert a second row for the same intended write.
export default defineObject({
  universalIdentifier: ACCOUNTING_SYNC_OPERATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'accountingSyncOperation',
  namePlural: 'accountingSyncOperations',
  labelSingular: 'Accounting sync operation',
  labelPlural: 'Accounting sync operations',
  description:
    'One attempted write to an accounting system, with its idempotency key, attempts and outcome.',
  icon: 'IconArrowsExchange',
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    ACCOUNTING_SYNC_OPERATION_FIELDS.name,
  fields: [
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'For example CATALOG_ITEM_UPDATE item-1 rev 2.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.kind,
      type: FieldType.SELECT,
      name: 'kind',
      label: 'Kind',
      description: 'What kind of write this is.',
      icon: 'IconCategory',
      isNullable: false,
      // Non-nullable SELECT requires an explicit option default for metadata apply.
      defaultValue: `'CATALOG_ITEM_CREATE'`,
      options: [
        {
          id: SELECT_OPTION_IDS.operationKindItemCreate,
          value: 'CATALOG_ITEM_CREATE',
          label: 'ایجاد کالا',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.operationKindItemUpdate,
          value: 'CATALOG_ITEM_UPDATE',
          label: 'ویرایش کالا',
          color: 'blue',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.operationKindItemDeactivate,
          value: 'CATALOG_ITEM_DEACTIVATE',
          label: 'غیرفعال‌سازی کالا',
          color: 'orange',
          position: 2,
        },
        {
          id: SELECT_OPTION_IDS.operationKindRevisionPush,
          value: 'QUOTATION_REVISION_PUSH',
          label: 'ارسال نسخه پیش‌فاکتور',
          color: 'purple',
          position: 3,
        },
        { id: SELECT_OPTION_IDS.operationKindPartyCreate, value: 'PARTY_CREATE', label: 'ایجاد مشتری حسابداری', color: 'blue', position: 4 },
        { id: SELECT_OPTION_IDS.operationKindPartyUpdate, value: 'PARTY_UPDATE', label: 'ویرایش مشتری حسابداری', color: 'blue', position: 5 },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.state,
      type: FieldType.SELECT,
      name: 'state',
      label: 'State',
      description:
        'MANUAL_EXPORT_REQUIRED and FAILED_FINAL are the states reconciliation picks up; neither is silently retried.',
      icon: 'IconProgress',
      isNullable: false,
      defaultValue: `'PENDING'`,
      options: [
        {
          id: SELECT_OPTION_IDS.operationStatePending,
          value: 'PENDING',
          label: 'در انتظار',
          color: 'gray',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.operationStateInFlight,
          value: 'IN_FLIGHT',
          label: 'در حال ارسال',
          color: 'blue',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.operationStateSucceeded,
          value: 'SUCCEEDED',
          label: 'موفق',
          color: 'green',
          position: 2,
        },
        {
          id: SELECT_OPTION_IDS.operationStateFailedRetryable,
          value: 'FAILED_RETRYABLE',
          label: 'خطای قابل تکرار',
          color: 'orange',
          position: 3,
        },
        {
          id: SELECT_OPTION_IDS.operationStateFailedFinal,
          value: 'FAILED_FINAL',
          label: 'خطای قطعی',
          color: 'red',
          position: 4,
        },
        {
          id: SELECT_OPTION_IDS.operationStateManualExport,
          value: 'MANUAL_EXPORT_REQUIRED',
          label: 'نیازمند خروجی دستی',
          color: 'yellow',
          position: 5,
        },
        {
          id: SELECT_OPTION_IDS.operationStateCancelled,
          value: 'CANCELLED',
          label: 'لغو شده',
          color: 'gray',
          position: 6,
        },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.internalEntityId,
      type: FieldType.TEXT,
      name: 'internalEntityId',
      label: 'Internal entity id',
      description:
        'The CRM record this operation writes about. Text rather than a relation because the target may be an item or a revision.',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.internalRevision,
      type: FieldType.NUMBER,
      name: 'internalRevision',
      label: 'Internal revision',
      description:
        'Snapshot version this operation carries. Part of the idempotency key, so a new revision is a new operation.',
      icon: 'IconVersions',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.attempts,
      type: FieldType.NUMBER,
      name: 'attempts',
      label: 'Attempts',
      description: 'How many times delivery was tried. Retry stops at the configured ceiling.',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: 0,
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.externalDocumentId,
      type: FieldType.TEXT,
      name: 'externalDocumentId',
      label: 'External document id',
      description:
        'Identifier the accounting system returned. The only trustworthy proof that the remote actually has the document.',
      icon: 'IconFileInvoice',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.errorCode,
      type: FieldType.TEXT,
      name: 'errorCode',
      label: 'Error code',
      description:
        'Stable machine code of the last failure. Text, so the reason survives a vendor sending free-form prose.',
      icon: 'IconAlertTriangle',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.correlationId,
      type: FieldType.TEXT,
      name: 'correlationId',
      label: 'Correlation id',
      description:
        'Ties this outbound write to the inbound event it may cause, so the app can tell its own echo from a real change.',
      icon: 'IconLink',
      isNullable: true,
    },
    {
      // Stable IDs owned by finance lane; consolidated in metadata registry at integration.
      universalIdentifier: '5f3a1d02-951c-56c5-8d5b-0105c4304001',
      type: FieldType.TEXT,
      name: 'payloadFingerprint',
      label: 'اثر انگشت درخواست',
      description: 'SHA-256 of the exact sealed request and destination binding; immutable after claim.',
      icon: 'IconFingerprint',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: '5f3a1d02-951c-56c5-8d5b-0105c4304002',
      type: FieldType.TEXT,
      name: 'payloadSnapshot',
      label: 'نسخه درخواست حسابداری',
      description: 'Canonical request evidence without tokens or credentials, retained for reconciliation.',
      icon: 'IconFileInvoice',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: ACCOUNTING_SYNC_OPERATION_FIELDS.connection,
      type: FieldType.RELATION,
      name: 'connection',
      label: 'Accounting connection',
      description: 'The destination this operation targets.',
      icon: 'IconPlugConnected',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.accountingConnectionSyncOperations,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'connectionId',
      },
    },
  ],
});
