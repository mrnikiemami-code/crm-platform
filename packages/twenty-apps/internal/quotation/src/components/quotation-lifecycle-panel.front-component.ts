import { defineFrontComponent } from 'twenty-sdk/define';

import { QuotationLifecyclePanel } from 'src/components/quotation-lifecycle-panel';
import { QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier: QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'quotation-lifecycle-panel',
  description:
    'دکمه‌های گردش وضعیت پیش‌فاکتور، قفل محتوا و دانلود PDF فارسی روی صفحهٔ رکورد',
  component: QuotationLifecyclePanel,
});
