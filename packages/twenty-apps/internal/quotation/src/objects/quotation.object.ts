import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  QUOTATION_FIELDS,
  QUOTATION_LINE_FIELDS,
  QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_REVISION_FIELDS,
  QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// A pro-forma quotation: the CRM owns its lifecycle, the accounting system owns
// posted invoices. Being a quotation and not an invoice is the whole point of the
// object, so nothing here books revenue.
//
// THE STATUS OPTIONS MIRROR THE STATE MACHINE in src/domain/quotation. A status
// exists here because a transition can reach it; the machine is the authority and a
// test asserts every declared status is reachable.
//
// MONEY IS STORED TWICE, deliberately — see price.object.ts. `total` is the display
// and aggregation view; `totalExact` is the authoritative exact decimal string.
export default defineObject({
  universalIdentifier: QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotation',
  namePlural: 'quotations',
  labelSingular: 'Quotation',
  labelPlural: 'Quotations',
  description:
    'A pro-forma quotation for products and services. Not a fiscal invoice; posted documents live in the accounting system.',
  icon: 'IconFileInvoice',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Short label used in lists and search.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: QUOTATION_FIELDS.quotationNumber,
      type: FieldType.TEXT,
      name: 'quotationNumber',
      label: 'Quotation number',
      description:
        'Allocated by the app from a compare-and-set sequence per fiscal year. Unique; gaps are possible and allowed.',
      icon: 'IconHash',
      isNullable: true,
      isUnique: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.status,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      description: 'Where the quotation is in its lifecycle.',
      icon: 'IconProgress',
      isNullable: false,
      defaultValue: `'DRAFT'`,
      options: [
        {
          id: SELECT_OPTION_IDS.quotationStatusDraft,
          value: 'DRAFT',
          label: 'پیش‌نویس',
          color: 'gray',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusPendingApproval,
          value: 'PENDING_INTERNAL_APPROVAL',
          label: 'در انتظار تأیید',
          color: 'orange',
          position: 1,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusReadyToSend,
          value: 'READY_TO_SEND',
          label: 'آماده ارسال',
          color: 'turquoise',
          position: 2,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusSent,
          value: 'SENT',
          label: 'ارسال شده',
          color: 'blue',
          position: 3,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusAccepted,
          value: 'CUSTOMER_ACCEPTED',
          label: 'مورد قبول مشتری',
          color: 'green',
          position: 4,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusRejected,
          value: 'CUSTOMER_REJECTED',
          label: 'رد شده توسط مشتری',
          color: 'red',
          position: 5,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusExpired,
          value: 'EXPIRED',
          label: 'منقضی شده',
          color: 'gray',
          position: 6,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusCancelled,
          value: 'CANCELLED',
          label: 'لغو شده',
          color: 'red',
          position: 7,
        },
        {
          id: SELECT_OPTION_IDS.quotationStatusConverted,
          value: 'CONVERTED',
          label: 'تبدیل به سند حسابداری',
          color: 'green',
          position: 8,
        },
      ],
    },
    {
      universalIdentifier: QUOTATION_FIELDS.customerType,
      type: FieldType.SELECT,
      name: 'customerType',
      label: 'Customer type',
      description:
        'Whether the customer is a person or a company. A quotation targets exactly one of the two relations.',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: `'COMPANY'`,
      options: [
        {
          id: SELECT_OPTION_IDS.quotationCustomerTypePerson,
          value: 'PERSON',
          label: 'شخص',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.quotationCustomerTypeCompany,
          value: 'COMPANY',
          label: 'شرکت',
          color: 'purple',
          position: 1,
        },
      ],
    },
    {
      universalIdentifier: QUOTATION_FIELDS.currencyCode,
      type: FieldType.TEXT,
      name: 'currencyCode',
      label: 'Currency code',
      description:
        'Currency of every amount on this quotation, for example IRR. No conversion is ever applied.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: `'IRR'`,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.taxPolicy,
      type: FieldType.TEXT,
      name: 'taxPolicy',
      label: 'Tax policy',
      description:
        'Identifier of the tax rule applied, for example IR_VAT_9. Rates and legality are a business decision, not a default.',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.paymentTerms,
      type: FieldType.TEXT,
      name: 'paymentTerms',
      label: 'Payment terms',
      description: 'Free text shown to the customer, for example ۳۰ روز.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.expiresAt,
      type: FieldType.DATE,
      name: 'expiresAt',
      label: 'Valid until',
      description:
        'After this date the quotation may move to EXPIRED. A date, not a timer: nothing expires on its own.',
      icon: 'IconCalendarStats',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.total,
      type: FieldType.CURRENCY,
      name: 'total',
      label: 'Total',
      description:
        'Grand total for display and aggregation. Exact only within 2^53-1 micros; the exact decimal column is authoritative.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'Total (exact)',
      description:
        'Authoritative grand total as an exact decimal with six fraction digits, written by the same code that writes the number.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.version,
      type: FieldType.NUMBER,
      name: 'version',
      label: 'Version',
      description:
        'Current revision version. Increments only; a sent quotation is never edited, it is re-issued.',
      icon: 'IconVersions',
      isNullable: false,
      defaultValue: 1,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.sentAt,
      type: FieldType.DATE_TIME,
      name: 'sentAt',
      label: 'Sent at',
      description: 'When the quotation actually reached the customer.',
      icon: 'IconSend',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.decidedAt,
      type: FieldType.DATE_TIME,
      name: 'decidedAt',
      label: 'Customer decision at',
      description: 'When the customer accepted or rejected.',
      icon: 'IconCircleCheck',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.person,
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      description: 'Customer, when the customer is an individual.',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.personQuotations,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
    },
    {
      universalIdentifier: QUOTATION_FIELDS.company,
      type: FieldType.RELATION,
      name: 'company',
      label: 'Company',
      description: 'Customer, when the customer is an organization.',
      icon: 'IconBuildingSkyscraper',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT.company.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.companyQuotations,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'companyId',
      },
    },
    {
      universalIdentifier: QUOTATION_FIELDS.opportunity,
      type: FieldType.RELATION,
      name: 'opportunity',
      label: 'Opportunity',
      description:
        'Optional deal this quotation belongs to. Conversion is NOT inferred from the opportunity stage, which has no WON value in this workspace.',
      icon: 'IconTargetArrow',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT.opportunity.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.opportunityQuotations,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'opportunityId',
      },
    },
    {
      // The "one" side of the line relation. A relation is declared on both objects,
      // so this exists to complete quotation <-> quotationLine.
      universalIdentifier: RELATION_FIELDS.quotationLines,
      type: FieldType.RELATION,
      name: 'lines',
      label: 'Lines',
      description: 'The priced lines of this quotation.',
      icon: 'IconListDetails',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        QUOTATION_LINE_FIELDS.quotation,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.quotationRevisions,
      type: FieldType.RELATION,
      name: 'revisions',
      label: 'Revisions',
      description: 'Every sealed revision of this quotation, oldest first.',
      icon: 'IconVersions',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        QUOTATION_REVISION_FIELDS.quotation,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
