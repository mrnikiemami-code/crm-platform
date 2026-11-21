import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { TAX_POLICIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildCurrentUserPermissionFlagsQuery } from 'src/data/caller-identity-queries';
import { RecordApiError, executeMetadataGraphql } from 'src/data/record-api';
import {
  formatBasisPointsAsPercent,
  selectDefaultTaxPolicy,
  type TaxPolicyCatalogEntry,
} from 'src/domain/money/tax-policy';
import {
  mayChangeTaxSettings,
  readCallerPermissionFlags,
} from 'src/domain/tax-settings/settings-access';
import {
  countQuotationsPerTaxPolicy,
  deactivateTaxPolicy,
  loadTaxPoliciesWithBaseline,
  saveTaxPolicy,
  setDefaultTaxPolicy,
} from 'src/services/tax-policy.service';
import {
  appNotInstalled,
  asRecord,
  failure,
  isAppInstalled,
  readBody,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

// The settings page and the quotation form read the same catalog through this route,
// so a rate can never be shown in one place and applied from another. Validation of
// what the operator typed happens on the server; the panel only renders.
const describePolicy = (
  entry: TaxPolicyCatalogEntry,
  usage: Map<string, number>,
) => ({
  recordId: entry.recordId,
  code: entry.id,
  name: entry.label,
  rateBasisPoints: entry.rateBasisPoints.toString(),
  ratePercent: formatBasisPointsAsPercent(entry.rateBasisPoints),
  isActive: entry.isActive,
  isDefault: entry.isDefault,
  isExempt: entry.isExempt,
  quotationCount: usage.get(entry.id) ?? 0,
});

const describeCatalog = (
  entries: TaxPolicyCatalogEntry[],
  usage: Map<string, number>,
) => ({
  policies: entries.map((entry) => describePolicy(entry, usage)),
  defaultCode: selectDefaultTaxPolicy(entries)?.id ?? null,
});

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readOptionalId = (value: unknown): string | null => {
  const text = readString(value);

  return text === '' ? null : text;
};

const MUTATING_ACTIONS = ['save', 'set-default', 'deactivate'] as const;

const isMutatingAction = (action: string): boolean =>
  (MUTATING_ACTIONS as readonly string[]).includes(action);

// The caller's own bearer token, forwarded by the route. Asking `currentUser` with
// the app token would always answer "no person", which would let any signed-in user
// change a tax rate.
const readCallerToken = (
  headers: Record<string, string | undefined>,
): string | null => {
  const authorization = headers.authorization;

  if (typeof authorization !== 'string') {
    return null;
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  return token.length > 0 ? token : null;
};

// `true` means the request carries no person (application/API-key path, trusted),
// or carries a person holding a settings-level flag. A signed-in non-admin is
// refused before any write reaches the policy table.
const callerMayChangeSettings = async (
  headers: Record<string, string | undefined>,
): Promise<boolean> => {
  const token = readCallerToken(headers);

  if (token === null) {
    return true;
  }

  try {
    const identity = await executeMetadataGraphql(
      buildCurrentUserPermissionFlagsQuery(),
      token,
    );

    return mayChangeTaxSettings(readCallerPermissionFlags(identity));
  } catch (error) {
    // An API key or the app runtime has no person behind it: the metadata layer
    // answers FORBIDDEN for that token. That is the trusted platform path, not a
    // failed check. Any other failure is treated as "not proven an admin".
    if (
      error instanceof RecordApiError &&
      (error.code === 'FORBIDDEN' || error.code === 'AUTH_REQUIRED')
    ) {
      return true;
    }

    console.error('tax-policies: caller identity failed', error);

    return false;
  }
};

const handler = async (event: RoutePayload<unknown>) => {
  const body = readBody(event);
  const action = readString(body.action);

  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  try {
    const entries = await loadTaxPoliciesWithBaseline();
    const usage = await countQuotationsPerTaxPolicy();

    if (action === 'list' || action === '') {
      return { success: true, ...describeCatalog(entries, usage) };
    }

    if (
      isMutatingAction(action) &&
      !(await callerMayChangeSettings(event.headers))
    ) {
      return failure(
        'TAX_SETTINGS_FORBIDDEN',
        'تغییر تنظیمات مالیات فقط برای مدیر فضای کاری مجاز است',
      );
    }

    if (action === 'save') {
      const saved = await saveTaxPolicy({
        recordId: readOptionalId(body.recordId),
        name: readString(body.name),
        ratePercentText: readString(body.ratePercentText),
        isActive: readBoolean(body.isActive, true),
        isDefault: body.isDefault === true,
        isExempt: body.isExempt === true,
      });

      if (!saved.ok) {
        return failure(saved.refusal.code, saved.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(saved.value, usage),
        message: 'سیاست مالیات ذخیره شد',
      };
    }

    if (action === 'set-default') {
      const recordId = readOptionalId(body.recordId);

      if (recordId === null) {
        return failure('TAX_POLICY_REQUIRED', 'سیاست مالیات را انتخاب کنید');
      }

      const updated = await setDefaultTaxPolicy(recordId);

      if (!updated.ok) {
        return failure(updated.refusal.code, updated.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(updated.value, usage),
        message: 'سیاست پیش‌فرض تغییر کرد',
      };
    }

    if (action === 'deactivate') {
      const recordId = readOptionalId(body.recordId);

      if (recordId === null) {
        return failure('TAX_POLICY_REQUIRED', 'سیاست مالیات را انتخاب کنید');
      }

      const updated = await deactivateTaxPolicy(recordId);

      if (!updated.ok) {
        return failure(updated.refusal.code, updated.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(updated.value, usage),
        message: 'سیاست مالیات غیرفعال شد',
      };
    }

    return failure('INVALID_INPUT', 'درخواست تنظیمات مالیات شناسایی نشد');
  } catch (error) {
    console.error('tax-policies: request failed', error);

    return failure(
      'PERSISTENCE_FAILED',
      'ذخیرهٔ تنظیمات مالیات انجام نشد؛ دوباره تلاش کنید',
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: TAX_POLICIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'tax-policies',
  description:
    'فهرست، ذخیره، تعیین پیش‌فرض و غیرفعال‌سازی سیاست‌های مالیات و عوارض',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/tax-policies',
    httpMethod: 'POST',
    isAuthRequired: true,
    // The admin check asks `currentUser` with the caller's session; the app token
    // belongs to no person, so the route must hand the authorization header over.
    forwardedRequestHeaders: ['authorization'],
  },
});
