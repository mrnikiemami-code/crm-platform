import { defineFrontComponent } from 'twenty-sdk/define';

import { TaxPolicySettingsPanel } from 'src/components/tax-policy-settings-panel';
import { TAX_POLICY_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Standalone-page host for the tax settings panel. The panel itself is the single
// implementation; this wrapper exists only because this fork's Settings area hides
// the Applications surface that would otherwise render the settings component.
export default defineFrontComponent({
  universalIdentifier: TAX_POLICY_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'مالیات و عوارض',
  description:
    'تعریف و مدیریت سیاست‌های مالیات و ارزش افزوده، تعیین سیاست پیش‌فرض و معافیت',
  component: TaxPolicySettingsPanel,
});
