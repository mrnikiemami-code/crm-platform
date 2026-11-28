import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  QUOTATION_CUSTOMER_LINK_FIELDS,
  QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// Opaque customer-view grant for one quotation.
//
// The raw token is shown once at mint time and never stored. Only sha256(token)
// is persisted (`tokenHash`). Expiry and revoke are independent: either fails closed.
export default defineObject({
  universalIdentifier: QUOTATION_CUSTOMER_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationCustomerLink',
  namePlural: 'quotationCustomerLinks',
  labelSingular: 'لینک مشتری پیش‌فاکتور',
  labelPlural: 'لینک‌های مشتری پیش‌فاکتور',
  description:
    'لینک امن مشاهده فقط‌خواندنی برای مشتری. توکن خام ذخیره نمی‌شود؛ فقط هش.',
  icon: 'IconLink',
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    QUOTATION_CUSTOMER_LINK_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'عنوان',
      description: 'برچسب داخلی کوتاه برای فهرست لینک‌ها.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.tokenHash,
      type: FieldType.TEXT,
      name: 'tokenHash',
      label: 'هش توکن',
      description: 'sha256 هگزادسیمال توکن خام. توکن خام هرگز ذخیره نمی‌شود.',
      icon: 'IconFingerprint',
      isNullable: false,
      isUnique: true,
      // The mint service supplies the hash. A required unique key must
      // never acquire an implicit empty string.
      defaultValue: null,
    },
    {
      universalIdentifier: '5f3a1d02-951c-56c5-8d5b-0105c4304003',
      type: FieldType.TEXT,
      name: 'revisionHash',
      label: 'هش نسخه قطعی',
      description: 'این لینک فقط همین نسخه قطعی را نمایش می‌دهد.',
      icon: 'IconFingerprint',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.expiresAt,
      type: FieldType.DATE_TIME,
      name: 'expiresAt',
      label: 'انقضا',
      description: 'پس از این زمان لینک بی‌اعتبار است.',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.revokedAt,
      type: FieldType.DATE_TIME,
      name: 'revokedAt',
      label: 'لغو',
      description: 'اگر پر باشد لینک عمداً باطل شده است.',
      icon: 'IconBan',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.issuedAt,
      type: FieldType.DATE_TIME,
      name: 'issuedAt',
      label: 'صدور',
      description: 'زمان ایجاد لینک.',
      icon: 'IconCalendar',
      isNullable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: QUOTATION_CUSTOMER_LINK_FIELDS.quotation,
      type: FieldType.RELATION,
      name: 'quotation',
      label: 'پیش‌فاکتور',
      description: 'پیش‌فاکتوری که این لینک اجازهٔ مشاهدهٔ آن را می‌دهد.',
      icon: 'IconFileInvoice',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.quotationCustomerLinks,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'quotationId',
      },
    },
  ],
});
