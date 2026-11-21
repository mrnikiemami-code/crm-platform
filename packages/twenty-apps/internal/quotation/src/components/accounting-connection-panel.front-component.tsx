import { defineFrontComponent } from 'twenty-sdk/define';

import { AccountingConnectionPanel } from 'src/components/accounting-connection-panel';
import { ACCOUNTING_CONNECTION_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier:
    ACCOUNTING_CONNECTION_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'accounting-connection-panel',
  description:
    'تنظیم و آزمایش اتصال نرم‌افزار حسابداری، قابلیت‌ها، پیش‌نمایش دریافت داده و ثبت پیش‌فاکتور تأییدشده',
  component: AccountingConnectionPanel,
});
