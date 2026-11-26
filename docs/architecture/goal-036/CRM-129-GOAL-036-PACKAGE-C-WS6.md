# CRM-129-GOAL-036 — Package C / WS6 evidence

**Status:** TECHNICALLY_VERIFIED (not USER_ACCEPTED)  
**App:** `quotation@0.1.68`  
**Parent:** Goal 023 ACTIVE

## Initial issue

Mock vs Asan chrome used scattered `adapterId === 'mock'` branches for labels and help copy, risking provider-name forks alongside an otherwise capability-driven form (`connectionFormFields(modes)`).

## Architecture finding

Shared structure already existed: sections ۱–۴ identical; money/tax/advanced gated by `FinancialModes` / `AdapterCapabilities`. Mock profiles change tax/currency/special-row requirements through `resolveFinancialModes`.

## Changes

| Area | Change |
| --- | --- |
| `adapterDisplayLabel` / `adapterBadgeTone` | Descriptor/`isLive`-driven labels |
| Connection form | Test-profile UI when `testProfiles.length > 0`; live URL when `isLive`; help from descriptor summary |
| Connections list | Same label helper; URL vs “بدون سرور” from `isLive` |
| Tests | Profile switch CODED→NO_TAX capability regression |

## Contracts preserved

- No real vendor calls
- Outbound remains off
- No credential logging
- WS5 catalog ownership unchanged
- Money Domain untouched

## Tests

| Suite | Result |
| --- | --- |
| `accounting-connections-section.test.tsx` | **46 PASS** |

## Remaining (honest)

- Overview list still has one cosmetic provider ternary (low risk)
- Asan live call / credential rotation / retire-inflight risks from prior architecture notes remain open outside WS6
