import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { TAX_POLICIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  formatBasisPointsAsPercent,
  selectDefaultTaxPolicy,
  totalRateBasisPoints,
  type TaxPolicyCatalogEntry,
} from 'src/domain/money/tax-policy';
import {
  bootstrapTaxPolicies,
  countQuotationsPerTaxPolicy,
  deactivateTaxPolicy,
  deleteTaxPolicy,
  loadTaxPolicies,
  saveTaxPolicy,
  setDefaultTaxPolicy,
} from 'src/services/tax-policy.service';
import {
  appNotInstalled,
  failure,
  isAppInstalled,
  readBody,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

// The settings page and the quotation form read the same catalog through this route,
// so a rate can never be shown in one place and applied from another. Validation of
// what the operator typed happens on the server boundary; the panel only renders.
const describePolicy = (
  entry: TaxPolicyCatalogEntry,
  usage: Map<string, number>,
) => ({
  recordId: entry.recordId,
  code: entry.id,
  name: entry.label,
  rateBasisPoints: entry.rateBasisPoints.toString(),
  ratePercent: formatBasisPointsAsPercent(entry.rateBasisPoints),
  dutyRateBasisPoints: entry.dutyRateBasisPoints.toString(),
  dutyRatePercent: formatBasisPointsAsPercent(entry.dutyRateBasisPoints),
  // The total is what the list shows; it is a sum of the two components and is never
  // written back as a rate.
  totalRatePercent: formatBasisPointsAsPercent(
    totalRateBasisPoints(entry),
  ),
  isActive: entry.isActive,
  isDefault: entry.isDefault,
  isExempt: entry.isExempt,
  accountingCode: entry.accountingCode ?? '',
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

// The caller's own bearer token, forwarded to the server boundary. Authority is
// decided there from the workspace role; this route never infers a privilege from a
// missing header or a failed identity lookup, and never substitutes the app token
// for a caller header that the server rejected.
const readCallerAuthorization = (
  headers: Record<string, string | undefined>,
): string | null => {
  const authorization = headers.authorization;

  return typeof authorization === 'string' && authorization.trim() !== ''
    ? authorization
    : null;
};

const handler = async (event: RoutePayload<unknown>) => {
  const body = readBody(event);
  const action = readString(body.action);

  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  const authorizationHeader = readCallerAuthorization(event.headers);

  try {
    if (action === 'list' || action === '') {
      const entries = await loadTaxPolicies();
      const usage = await countQuotationsPerTaxPolicy();

      return { success: true, ...describeCatalog(entries, usage) };
    }

    if (action === 'save') {
      const saved = await saveTaxPolicy(
        {
          recordId: readOptionalId(body.recordId),
          name: readString(body.name),
          ratePercentText: readString(body.ratePercentText),
          dutyRatePercentText: readString(body.dutyRatePercentText),
          accountingCodeText: readString(body.accountingCodeText),
          isActive: readBoolean(body.isActive, true),
          isDefault: body.isDefault === true,
        },
        { authorizationHeader },
      );

      if (!saved.ok) {
        return failure(saved.refusal.code, saved.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(
          saved.value,
          await countQuotationsPerTaxPolicy(),
        ),
        message: 'سیاست مالیات ذخیره شد',
      };
    }

    if (action === 'bootstrap') {
      const bootstrapped = await bootstrapTaxPolicies({ authorizationHeader });

      if (!bootstrapped.ok) {
        return failure(bootstrapped.refusal.code, bootstrapped.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(
          bootstrapped.value,
          await countQuotationsPerTaxPolicy(),
        ),
        message: 'سیاست پایه آماده شد',
      };
    }

    if (action === 'set-default') {
      const recordId = readOptionalId(body.recordId);

      if (recordId === null) {
        return failure('TAX_POLICY_REQUIRED', 'سیاست مالیات را انتخاب کنید');
      }

      const updated = await setDefaultTaxPolicy(recordId, {
        authorizationHeader,
      });

      if (!updated.ok) {
        return failure(updated.refusal.code, updated.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(updated.value, await countQuotationsPerTaxPolicy()),
        message: 'سیاست پیش‌فرض تغییر کرد',
      };
    }

    if (action === 'deactivate') {
      const recordId = readOptionalId(body.recordId);

      if (recordId === null) {
        return failure('TAX_POLICY_REQUIRED', 'سیاست مالیات را انتخاب کنید');
      }

      const updated = await deactivateTaxPolicy(recordId, {
        authorizationHeader,
      });

      if (!updated.ok) {
        return failure(updated.refusal.code, updated.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(updated.value, await countQuotationsPerTaxPolicy()),
        message: 'سیاست مالیات غیرفعال شد',
      };
    }

    if (action === 'delete') {
      const recordId = readOptionalId(body.recordId);

      if (recordId === null) {
        return failure('TAX_POLICY_REQUIRED', 'سیاست مالیات را انتخاب کنید');
      }

      const removed = await deleteTaxPolicy(recordId, {
        authorizationHeader,
      });

      if (!removed.ok) {
        return failure(removed.refusal.code, removed.refusal.detail);
      }

      return {
        success: true,
        ...describeCatalog(removed.value, await countQuotationsPerTaxPolicy()),
        message: 'سیاست مالیات حذف شد',
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
    // The server boundary checks the human caller's workspace role, so the route
    // must hand the caller's own authorization header over.
    forwardedRequestHeaders: ['authorization'],
  },
});
