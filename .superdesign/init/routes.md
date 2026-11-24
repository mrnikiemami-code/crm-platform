# routes.md — quotation app surfaces relevant to the tax page

| Surface | URL | Host component | Notes |
|---|---|---|---|
| Tax policy settings (page) | `http://localhost:3002/page/3eb639f7-d39c-4705-9685-c0330b1c7c0d` | `tax-policy-settings-page.front-component.tsx` | The redesign target. Standalone page that mounts `TaxPolicySettingsPanel`. |
| Tax policy settings (settings area) | Settings → Applications → پیش‌فاکتور | `tax-policy-settings.front-component.tsx` | Same panel, narrower column. |
| Accounting settings | `http://localhost:3002/page/20c28688-fc16-42f8-a231-9d5735d1b2c2` | `accounting-settings-panel.front-component.tsx` | Other page, must not change. |
| Quotation list | `http://localhost:3002/objects/quotations` | twenty-front object view | Consumes the catalog for the draft selector. |
| Draft form | quotation object page → «ویرایش پیش‌نویس» | `quotation-draft-form.front-component.tsx` | Reads the active default; must not change. |

## Data the tax page reads and writes

- `POST /s/tax-policies` with `{ action: 'list' }` → `{ success, policies[] }`.
  Each policy: `recordId, code, name, ratePercent, dutyRatePercent,
  totalRatePercent, isActive, isDefault, isExempt, quotationCount`.
- `{ action: 'save', recordId, name, ratePercentText, dutyRatePercentText, isActive }`
- `{ action: 'set-default', recordId }`
- `{ action: 'deactivate', recordId }`
- `{ action: 'delete', recordId }`
- `{ action: 'bootstrap' }` — only when the catalog is empty.
- Success is announced with `enqueueSnackbar` from `twenty-sdk/front-component`; a
  refusal comes back as `{ success: false, code, message }` in Persian.
