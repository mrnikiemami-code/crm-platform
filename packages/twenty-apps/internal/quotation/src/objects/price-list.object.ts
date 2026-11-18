import {
  defineObject,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  PRICE_FIELDS,
  PRICE_LIST_FIELDS,
  PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// A named price list in ONE currency. Keeping the currency on the list rather than on
// each price is what prevents an implicit conversion: a price is meaningful only
// inside its list's currency, and there is no exchange rate anywhere in this app.
export default defineObject({
  universalIdentifier: PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'priceList',
  namePlural: 'priceLists',
  labelSingular: 'Price list',
  labelPlural: 'Price lists',
  description:
    'A named set of prices in a single currency. No currency conversion is performed anywhere.',
  icon: 'IconCurrencyIranianRial',
  labelIdentifierFieldMetadataUniversalIdentifier: PRICE_LIST_FIELDS.name,
  fields: [
    {
      universalIdentifier: PRICE_LIST_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'For example نرخ فروش ۱۴۰۳.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: PRICE_LIST_FIELDS.currencyCode,
      type: FieldType.TEXT,
      name: 'currencyCode',
      label: 'Currency code',
      description:
        'ISO 4217 code of every price in this list, for example IRR. Deliberately text: the workspace uses a small, stable set and a 154-option select would be a maintenance trap.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: PRICE_LIST_FIELDS.isDefault,
      type: FieldType.BOOLEAN,
      name: 'isDefault',
      label: 'Default list',
      description: 'The list a new quotation line starts from.',
      icon: 'IconCircleCheck',
      isNullable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: RELATION_FIELDS.priceListPrices,
      type: FieldType.RELATION,
      name: 'prices',
      label: 'Prices',
      description: 'Every price in this list.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: PRICE_FIELDS.priceList,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
