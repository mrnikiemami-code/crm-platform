import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  QUOTATION_CUSTOMER_LINK_FIELDS,
  QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_FIELDS,
  QUOTATION_LINE_FIELDS,
  QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_REVISION_FIELDS,
  QUOTATION_REVISION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_SHARE_FIELDS,
  QUOTATION_SHARE_OBJECT_UNIVERSAL_IDENTIFIER,
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
      // The list table cannot render a null as a label, and a draft is a real
      // state a person has to read at a glance. Derived server-side from
      // quotationNumber, never typed.
      universalIdentifier: QUOTATION_FIELDS.quotationNumberLabel,
      type: FieldType.TEXT,
      name: 'quotationNumberLabel',
      label: 'شماره سند',
      description:
        'نمایش خوانا شماره سند؛ تا پیش از صدور «بدون شماره». محاسبه‌شده، قابل ویرایش نیست.',
      icon: 'IconHash',
      isNullable: true,
      isUIEditable: false,
    },
    {
      // Derived from the actual related record (person or company), so the list
      // never shows a name somebody typed.
      universalIdentifier: QUOTATION_FIELDS.customerName,
      type: FieldType.TEXT,
      name: 'customerName',
      label: 'مشتری',
      description:
        'نام شخص یا شرکت مرتبط، خوانده‌شده از خود رکورد. محاسبه‌شده، قابل ویرایش نیست.',
      icon: 'IconUser',
      isNullable: true,
      isUIEditable: false,
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
      description: 'پس از این تاریخ ممکن است به منقضی برود. تایمر خودکار نیست.',
      icon: 'IconCalendarStats',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.grossExact,
      type: FieldType.TEXT,
      name: 'grossExact',
      label: 'ناخالص (دقیق، ریال)',
      description: 'جمع ناخالص ردیف‌ها قبل از هر تخفیف، به ریال دقیق.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.lineDiscountExact,
      type: FieldType.TEXT,
      name: 'lineDiscountExact',
      label: 'تخفیف ردیف‌ها (دقیق، ریال)',
      description: 'جمع تخفیف‌های سطح ردیف.',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.documentDiscountExact,
      type: FieldType.TEXT,
      name: 'documentDiscountExact',
      label: 'تخفیف کل سند (دقیق، ریال)',
      description: 'مبلغ تخفیف سطح سند پس از تخصیص به ردیف‌ها.',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.documentDiscountKind,
      type: FieldType.TEXT,
      name: 'documentDiscountKind',
      label: 'نوع تخفیف کل',
      description: 'NONE یا RATE یا AMOUNT — ورودی اپراتور برای تخفیف سند.',
      icon: 'IconList',
      isNullable: true,
      defaultValue: "'NONE'",
    },
    {
      universalIdentifier: QUOTATION_FIELDS.documentDiscountInputExact,
      type: FieldType.TEXT,
      name: 'documentDiscountInputExact',
      label: 'ورودی تخفیف کل (دقیق)',
      description:
        'برای RATE درصد به‌صورت اعشار دقیق؛ برای AMOUNT مبلغ ریال دقیق؛ برای NONE صفر.',
      icon: 'IconHash',
      isNullable: true,
      defaultValue: "'0.000000'",
    },
    {
      universalIdentifier: QUOTATION_FIELDS.netExact,
      type: FieldType.TEXT,
      name: 'netExact',
      label: 'خالص (دقیق، ریال)',
      description: 'ناخالص منهای همهٔ تخفیف‌ها، قبل از مالیات.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.taxExact,
      type: FieldType.TEXT,
      name: 'taxExact',
      label: 'مالیات (دقیق، ریال)',
      description:
        'جمع مالیات ردیف‌ها بر اساس سیاست مالیات سند (بدون تعدیل گردکردن).',
      icon: 'IconPercentage',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_FIELDS.roundingExact,
      type: FieldType.TEXT,
      name: 'roundingExact',
      label: 'تعدیل گردکردن (دقیق، ریال)',
      description: 'payable − (net + tax)؛ مستقل از مالیات. می‌تواند منفی باشد.',
      icon: 'IconAdjustments',
      isNullable: true,
      defaultValue: "'0.000000'",
    },
    {
      universalIdentifier: QUOTATION_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'جمع کل قابل پرداخت (ریال صحیح)',
      description:
        'خالص + مالیات + تعدیل گردکردن، به ریال صحیح. تنها نسخهٔ معتبر مبلغ قابل پرداخت.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
    },
    {
      // The table shows money, not storage. Rendered by the shared money
      // formatter (Persian digits, grouping, unit) and derived from totalExact;
      // totalExact remains the authority for every calculation.
      universalIdentifier: QUOTATION_FIELDS.totalDisplay,
      type: FieldType.TEXT,
      name: 'totalDisplay',
      label: 'مبلغ کل',
      description:
        'جمع کل قابل پرداخت برای نمایش: اعداد فارسی، جداکننده هزارگان و واحد ریال. محاسبه‌شده از totalExact.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
      isUIEditable: false,
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
    {
      universalIdentifier: RELATION_FIELDS.quotationCustomerLinks,
      type: FieldType.RELATION,
      name: 'customerLinks',
      label: 'لینک‌های مشتری',
      description: 'لینک‌های امن مشاهدهٔ فقط‌خواندنی برای مشتری.',
      icon: 'IconLink',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        QUOTATION_CUSTOMER_LINK_FIELDS.quotation,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.quotationShares,
      type: FieldType.RELATION,
      name: 'shares',
      label: 'اشتراک‌گذاری‌ها',
      description: 'تاریخچهٔ واقعی اشتراک یا ارسال پیش‌فاکتور.',
      icon: 'IconShare',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_SHARE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        QUOTATION_SHARE_FIELDS.quotation,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
