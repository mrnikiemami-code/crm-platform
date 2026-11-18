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
  labelSingular: 'پیش‌فاکتور',
  labelPlural: 'پیش‌فاکتورها',
  description:
    'پیش‌فاکتور کالا و خدمات. سند مالی قطعی نیست؛ فاکتور رسمی در سیستم حسابداری ثبت می‌شود.',
  icon: 'IconFileInvoice',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'عنوان',
      description: 'نام کوتاه برای فهرست و جست‌وجو.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_FIELDS.quotationNumber,
      type: FieldType.TEXT,
      name: 'quotationNumber',
      label: 'شماره پیش‌فاکتور',
      description:
        'تخصیص‌یافته از توالی سال مالی. یکتا؛ فاصلهٔ شماره‌ها مجاز است.',
      icon: 'IconHash',
      isNullable: true,
      isUnique: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.status,
      type: FieldType.SELECT,
      name: 'status',
      label: 'وضعیت',
      description: 'مرحلهٔ چرخهٔ عمر پیش‌فاکتور.',
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
      label: 'نوع مشتری',
      description:
        'شخص یا شرکت. هر پیش‌فاکتور دقیقاً به یکی از دو رابطه وصل می‌شود.',
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
      label: 'ارز ذخیره',
      description:
        'ارز ذخیره‌سازی همهٔ مبالغ (IRR). تبدیل نرخ ارز انجام نمی‌شود؛ تومان فقط برای ورود/نمایش است.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: `'IRR'`,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.taxPolicy,
      type: FieldType.TEXT,
      name: 'taxPolicy',
      label: 'سیاست مالیات',
      description:
        'شناسهٔ قاعدهٔ مالیات، مثلاً IR_VAT_9. نرخ و مبنای قانونی تصمیم کسب‌وکار است.',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.paymentTerms,
      type: FieldType.TEXT,
      name: 'paymentTerms',
      label: 'شرایط پرداخت',
      description: 'متن نمایش‌داده‌شده به مشتری، مثلاً ۳۰ روز.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.expiresAt,
      type: FieldType.DATE,
      name: 'expiresAt',
      label: 'اعتبار تا',
      description:
        'پس از این تاریخ ممکن است به منقضی برود. تایمر خودکار نیست.',
      icon: 'IconCalendarStats',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'جمع کل (دقیق، ریال)',
      description:
        'جمع کل به‌صورت اعشار دقیق شش‌رقمی به ریال. تنها نسخهٔ معتبر مبلغ؛ ستون عددی موازی وجود ندارد.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.version,
      type: FieldType.NUMBER,
      name: 'version',
      label: 'نسخه',
      description:
        'شمارهٔ نسخهٔ جاری. پیش‌فاکتور ارسال‌شده ویرایش نمی‌شود؛ نسخهٔ جدید صادر می‌شود.',
      icon: 'IconVersions',
      isNullable: false,
      defaultValue: 1,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.sentAt,
      type: FieldType.DATE_TIME,
      name: 'sentAt',
      label: 'زمان ارسال',
      description: 'زمان رسیدن پیش‌فاکتور به مشتری.',
      icon: 'IconSend',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.decidedAt,
      type: FieldType.DATE_TIME,
      name: 'decidedAt',
      label: 'زمان تصمیم مشتری',
      description: 'زمان قبول یا رد توسط مشتری.',
      icon: 'IconCircleCheck',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.person,
      type: FieldType.RELATION,
      name: 'person',
      label: 'شخص',
      description: 'مشتری حقیقی.',
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
      label: 'شرکت',
      description: 'مشتری حقوقی.',
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
      label: 'فرصت',
      description:
        'فرصت اختیاری مرتبط. تبدیل به سند حسابداری از وضعیت فرصت استنباط نمی‌شود.',
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
      label: 'ردیف‌ها',
      description: 'ردیف‌های قیمت‌گذاری‌شدهٔ این پیش‌فاکتور.',
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
      label: 'نسخه‌ها',
      description: 'همهٔ نسخه‌های مهروموم‌شده، از قدیم به جدید.',
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
