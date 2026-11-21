import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { TaxPolicySettingsPanel } from 'src/components/tax-policy-settings-panel';
import { TAX_POLICY_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The settings page of the quotation app. It lives in Settings → Applications →
// پیش‌فاکتور because changing a tax rate is an administrative act: the Settings area
// is already the surface the workspace restricts to administrators.
export default defineSettingsFrontComponent({
  universalIdentifier: TAX_POLICY_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'مالیات و عوارض',
  description:
    'تعریف و مدیریت سیاست‌های مالیات و ارزش افزوده، تعیین سیاست پیش‌فرض و معافیت',
  component: TaxPolicySettingsPanel,
});
