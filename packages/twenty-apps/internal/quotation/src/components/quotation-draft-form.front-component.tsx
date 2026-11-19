import { defineFrontComponent } from 'twenty-sdk/define';

import { QuotationDraftForm } from 'src/components/quotation-draft-form';
import { QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier: QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'quotation-draft-form',
  description: 'فرم ایجاد و ویرایش پیش‌نویس پیش‌فاکتور با ردیف‌های کالا و خدمت',
  component: QuotationDraftForm,
});
