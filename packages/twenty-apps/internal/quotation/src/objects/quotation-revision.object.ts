import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_REVISION_FIELDS,
  QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// The immutable record of what a customer was shown.
//
// `snapshotJson` holds the canonical snapshot and `snapshotHash` is the sha256 of its
// canonical form. The platform offers no immutability guarantee, so the guarantee is
// the hash: a stored revision is never edited, and any proposed change is compared
// against the hash and refused (see checkRevisionUnchanged).
//
// Not editable and not creatable from the UI: a revision is produced by issuing the
// quotation, never typed.
export default defineObject({
  universalIdentifier: QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationRevision',
  namePlural: 'quotationRevisions',
  labelSingular: 'Quotation revision',
  labelPlural: 'Quotation revisions',
  description:
    'An issued, sealed version of a quotation: canonical snapshot plus its hash. Never edited.',
  icon: 'IconVersions',
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_REVISION_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'For example QT-1403-000123 v2.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.version,
      type: FieldType.NUMBER,
      name: 'version',
      label: 'Version',
      description: 'Increments from one; the highest existing version plus one.',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: 0,
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.status,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      description:
        'ISSUED while this is the revision the customer holds; SUPERSEDED once a newer one was issued.',
      icon: 'IconProgress',
      isNullable: false,
      defaultValue: `'ISSUED'`,
      options: [
        {
          id: SELECT_OPTION_IDS.revisionStatusIssued,
          value: 'ISSUED',
          label: 'صادر شده',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.revisionStatusSuperseded,
          value: 'SUPERSEDED',
          label: 'جایگزین شده',
          color: 'gray',
          position: 1,
        },
      ],
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.snapshotJson,
      type: FieldType.RAW_JSON,
      name: 'snapshotJson',
      label: 'Snapshot',
      description:
        'Canonical snapshot of the quotation content, with every amount as an exact decimal string.',
      icon: 'IconBraces',
      isNullable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.snapshotHash,
      type: FieldType.TEXT,
      name: 'snapshotHash',
      label: 'Snapshot hash',
      description:
        'sha256 of the canonical snapshot. Any attempt to change a stored revision is detectable against this value.',
      icon: 'IconFingerprint',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'Total (exact)',
      description: 'Grand total at issue time, as an exact decimal.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.issuedAt,
      type: FieldType.DATE_TIME,
      name: 'issuedAt',
      label: 'Issued at',
      description: 'When the revision was sealed.',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.issuedBy,
      type: FieldType.TEXT,
      name: 'issuedBy',
      label: 'Issued by',
      description:
        'Workspace member id that issued the revision. Text, not a relation, so the record survives a member being removed.',
      icon: 'IconUser',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_REVISION_FIELDS.quotation,
      type: FieldType.RELATION,
      name: 'quotation',
      label: 'Quotation',
      description: 'The quotation this revision belongs to.',
      icon: 'IconFileInvoice',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.quotationRevisions,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'quotationId',
      },
    },
  ],
});
