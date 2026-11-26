import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_PARTY_LINK_FIELDS,
  ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// The mapping between one CRM person/company and its counterpart in one accounting package.
//
// WHY A SEPARATE OBJECT AND NOT A REUSED ITEM LINK: identity is (connection, external id) and
// the entity on this side is a CUSTOMER. Storing a customer id in a catalog-item link would
// make "what is this item over there" and "what is this customer over there" the same question,
// and the first catalog lookup would answer with a customer code.
//
// `internalPartyId` is text, not a relation, because the target is a person OR a company and a
// nullable pair of relations would let a row claim both. `partyType` says which table the id
// belongs to; the app never guesses.
export default defineObject({
  universalIdentifier: ACCOUNTING_PARTY_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'accountingPartyLink',
  namePlural: 'accountingPartyLinks',
  labelSingular: 'Accounting party link',
  labelPlural: 'Accounting party links',
  description:
    'Maps a CRM person or company to its counterpart in one accounting connection.',
  icon: 'IconUsers',
  labelIdentifierFieldMetadataUniversalIdentifier:
    ACCOUNTING_PARTY_LINK_FIELDS.name,
  fields: [
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Human-readable label, for example شرکت نمونه @ آسان.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.externalPartyId,
      type: FieldType.TEXT,
      name: 'externalPartyId',
      label: 'External party id',
      description:
        'Customer identity inside the accounting package. Together with the connection this is the customer identity; it is never a name.',
      icon: 'IconHash',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.externalCode,
      type: FieldType.TEXT,
      name: 'externalCode',
      label: 'External code',
      description: 'Vendor-facing code kept for display only. Not used for matching.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.sourceProfile,
      type: FieldType.TEXT,
      name: 'sourceProfile',
      label: 'اطلاعات اختصاصی مقصد حسابداری',
      description: 'Optional vendor-owned ledger and commercial attributes, connection scoped. Not the CRM accountingCode.',
      icon: 'IconFileText',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.remoteVersion,
      type: FieldType.TEXT,
      name: 'remoteVersion',
      label: 'Remote version',
      description:
        'Change marker observed at the last successful sync. A different value means the record moved under us.',
      icon: 'IconVersions',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.lastSyncedAt,
      type: FieldType.DATE_TIME,
      name: 'lastSyncedAt',
      label: 'Last synced at',
      description: 'When this link last agreed with the remote.',
      icon: 'IconClock',
      isNullable: true,
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.syncStatus,
      type: FieldType.SELECT,
      name: 'syncStatus',
      label: 'Sync status',
      description:
        'Where the link stands. MANUAL_EXPORT_REQUIRED is a normal outcome, not an error.',
      icon: 'IconProgress',
      isNullable: false,
      defaultValue: `'PENDING_IMPORT'`,
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
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.partyType,
      type: FieldType.SELECT,
      name: 'partyType',
      label: 'Party type',
      description:
        'Which CRM table internalPartyId points at. Asan has no separate company entity, so this distinction lives in the CRM.',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: `'COMPANY'`,
      options: [
        {
          id: SELECT_OPTION_IDS.accountingPartyTypePerson,
          value: 'PERSON',
          label: 'شخص',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.accountingPartyTypeCompany,
          value: 'COMPANY',
          label: 'شرکت',
          color: 'purple',
          position: 1,
        },
      ],
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.internalPartyId,
      type: FieldType.TEXT,
      name: 'internalPartyId',
      label: 'Internal party id',
      description:
        'The CRM person or company id. Text because the target table depends on partyType.',
      icon: 'IconId',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ACCOUNTING_PARTY_LINK_FIELDS.connection,
      type: FieldType.RELATION,
      name: 'connection',
      label: 'Accounting connection',
      description: 'The destination this link points into.',
      icon: 'IconPlugConnected',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_CONNECTION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.accountingConnectionPartyLinks,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'connectionId',
      },
    },
  ],
});
