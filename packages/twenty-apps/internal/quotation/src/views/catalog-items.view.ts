import { defineView, ViewType } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELDS,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEMS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Default table for کالا و خدمات. Search/filter/sort come from the platform.
export default defineView({
  universalIdentifier: CATALOG_ITEMS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'همهٔ کالا و خدمات',
  objectUniversalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconBox',
  position: 0,
  fields: [
    {
      universalIdentifier: '1010a0a0-0001-4000-8000-000000000001',
      fieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.name,
      position: 0,
      isVisible: true,
      size: 220,
    },
    {
      universalIdentifier: '1010a0a0-0002-4000-8000-000000000002',
      fieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.kind,
      position: 1,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: '1010a0a0-0003-4000-8000-000000000003',
      fieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.sku,
      position: 2,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: '1010a0a0-0004-4000-8000-000000000004',
      fieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.unit,
      position: 3,
      isVisible: true,
      size: 90,
    },
    {
      universalIdentifier: '1010a0a0-0005-4000-8000-000000000005',
      fieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.isActive,
      position: 4,
      isVisible: true,
      size: 80,
    },
  ],
});
