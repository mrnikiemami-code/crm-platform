import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_ITEM_LINK_FIELDS,
  ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// The mapping between one CRM catalog item and its counterpart in one accounting
// package.
//
// IDENTITY IS (connection, externalItemId). A SKU or a name is never used to match:
// names get edited and SKUs collide across suppliers, so matching on either is how two
// different products become one. `externalCode` is kept for display only.
//
// `remoteVersion` is the remote's own change marker. Comparing it before a write is
// what stops the CRM from overwriting an edit the accounting user made in between.
export default defineObject({
  universalIdentifier: ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'accountingItemLink',
  namePlural: 'accountingItemLinks',
  labelSingular: 'Accounting item link',
  labelPlural: 'Accounting item links',
  description:
    'Maps a catalog item to its counterpart in one accounting connection. Identity is the connection plus the external id.',
  icon: 'IconLink',
  labelIdentifierFieldMetadataUniversalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.name,
  fields: [
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Human-readable label, for example KT6 @ holoo.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.externalItemId,
      type: FieldType.TEXT,
      name: 'externalItemId',
      label: 'External item id',
      description:
        'Identifier inside the accounting package. Together with the connection this is the item identity; it is never a name or a SKU.',
      icon: 'IconHash',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.externalCode,
      type: FieldType.TEXT,
      name: 'externalCode',
      label: 'External code',
      description:
        'The vendor-facing code, kept for display only. Not used for matching.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.remoteVersion,
      type: FieldType.TEXT,
      name: 'remoteVersion',
      label: 'Remote version',
      description:
        'The remote change marker (etag, version or updatedAt) observed at the last successful sync. A different value means the record moved under us.',
      icon: 'IconVersions',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.lastSyncedAt,
      type: FieldType.DATE_TIME,
      name: 'lastSyncedAt',
      label: 'Last synced at',
      description: 'When this link last agreed with the remote.',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.syncStatus,
      type: FieldType.SELECT,
      name: 'syncStatus',
      label: 'Sync status',
      description:
        'Where the link stands. MANUAL_EXPORT_REQUIRED is a normal outcome for a vendor that cannot create items, not an error.',
      icon: 'IconProgress',
      isNullable: false,
      defaultValue: `'PENDING_PUSH'`,
      options: [
        {
          id: SELECT_OPTION_IDS.syncStatusLinked,
          value: 'LINKED',
          label: 'متصل',
          color: 'green',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.syncStatusPendingPush,
          value: 'PENDING_PUSH',
          label: 'در انتظار ارسال',
          color: 'orange',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.syncStatusPendingImport,
          value: 'PENDING_IMPORT',
          label: 'در انتظار دریافت',
          color: 'turquoise',
          position: 2,
        },
        {
          id: SELECT_OPTION_IDS.syncStatusConflict,
          value: 'CONFLICT',
          label: 'تعارض',
          color: 'red',
          position: 3,
        },
        {
          id: SELECT_OPTION_IDS.syncStatusManualExport,
          value: 'MANUAL_EXPORT_REQUIRED',
          label: 'نیازمند خروجی دستی',
          color: 'yellow',
          position: 4,
        },
        {
          id: SELECT_OPTION_IDS.syncStatusRemoteDeleted,
          value: 'REMOTE_DELETED',
          label: 'حذف شده در مقصد',
          color: 'gray',
          position: 5,
        },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.connection,
      type: FieldType.RELATION,
      name: 'connection',
      label: 'Accounting connection',
      description: 'The destination this link points into.',
      icon: 'IconPlugConnected',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.accountingConnectionItemLinks,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'connectionId',
      },
    },
    {
      universalIdentifier: ACCOUNTING_ITEM_LINK_FIELDS.item,
      type: FieldType.RELATION,
      name: 'item',
      label: 'Catalog item',
      description: 'The CRM item this link describes.',
      icon: 'IconBox',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.catalogItemAccountingLinks,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'itemId',
      },
    },
  ],
});
