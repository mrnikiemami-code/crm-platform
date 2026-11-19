import { defineFrontComponent } from 'twenty-sdk/define';

import { CatalogItemForm } from 'src/components/catalog-item-form';
import { CATALOG_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier: CATALOG_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'catalog-item-form',
  description: 'فرم افزودن و ویرایش کالا یا خدمت با قیمت پیش‌فرض اختیاری',
  component: CatalogItemForm,
});
