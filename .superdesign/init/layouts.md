# layouts.md — application shell the panel sits in

The panel is rendered by a host front component inside Twenty's own shell (sidebar +
top bar). The iframe only owns the content area, so the redesign must not draw app
chrome; it draws one content surface with its own header.

## `src/components/tax-policy-settings.front-component.tsx` (Settings surface)

```tsx
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
```

## `src/components/tax-policy-settings-page.front-component.tsx` (standalone page)

```tsx
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
```

## Widths that matter

- Standalone page: Twenty content column, ~`1120px` max, page padding ~`24px`.
- Settings surface: narrower column, ~`720px`.
- Mobile: the iframe becomes full width; 390px is the tested breakpoint and there must
  be no horizontal scroll at that width.
