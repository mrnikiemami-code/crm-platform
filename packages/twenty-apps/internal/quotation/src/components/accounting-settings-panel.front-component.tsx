import { defineFrontComponent } from 'twenty-sdk/define';

import { AccountingSettingsPanel } from 'src/components/accounting/accounting-settings-panel';
import { ACCOUNTING_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier:
    ACCOUNTING_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'accounting-settings-page',
  description:
    'تنظیمات حسابداری فضای کاری: نرم‌افزار مقصد، اتصال، واحد پول، نگاشت مالیات و وضعیت ارسال',
  component: AccountingSettingsPanel,
});
