import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { QUOTATION_CURRENCIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  bootstrapQuotationCurrencies,
  listQuotationCurrencies,
  saveQuotationCurrency,
  setDefaultQuotationCurrency,
  type QuotationCurrencyView,
} from 'src/services/quotation-currency.service';
import {
  appNotInstalled,
  failure,
  isAppInstalled,
  readBody,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const describeCatalog = (currencies: QuotationCurrencyView[]) => ({
  currencies,
  defaultCode:
    currencies.find((currency) => currency.isActive && currency.isDefault)
      ?.code ??
    currencies.find((currency) => currency.isActive)?.code ??
    null,
});

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readOptionalId = (value: unknown): string | null => {
  const text = readString(value);

  return text === '' ? null : text;
};

const readCallerAuthorization = (
  headers: Record<string, string | undefined>,
): string | null => {
  const authorization = headers.authorization;

  return typeof authorization === 'string' && authorization.trim() !== ''
    ? authorization
    : null;
};

export const quotationCurrenciesHandler = async (
  request: RoutePayload['request'],
) => {
  if (!(await isAppInstalled())) {
    return appNotInstalled();
  }

  const body = readBody(request);
  const action = readString(body.action) || 'list';
  const authorizationHeader = readCallerAuthorization(request.headers ?? {});

  if (action === 'list') {
    const listed = await listQuotationCurrencies({ authorizationHeader });

    if (!listed.ok) {
      return failure(listed.refusal.code, listed.refusal.detail);
    }

    return { success: true, ...describeCatalog(listed.value) };
  }

  if (action === 'bootstrap') {
    const bootstrapped = await bootstrapQuotationCurrencies({
      authorizationHeader,
    });

    if (!bootstrapped.ok) {
      return failure(bootstrapped.refusal.code, bootstrapped.refusal.detail);
    }

    return {
      success: true,
      ...describeCatalog(bootstrapped.value),
      message: 'فهرست ارز آماده شد',
    };
  }

  if (action === 'save') {
    const recordId = readOptionalId(body.recordId);

    if (recordId === null) {
      return failure('QUOTATION_CURRENCY_REQUIRED', 'ارز را انتخاب کنید');
    }

    const saved = await saveQuotationCurrency(
      {
        recordId,
        name: readString(body.name),
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
      ...describeCatalog(saved.value),
      message: 'ارز ذخیره شد',
    };
  }

  if (action === 'set-default') {
    const recordId = readOptionalId(body.recordId);

    if (recordId === null) {
      return failure('QUOTATION_CURRENCY_REQUIRED', 'ارز را انتخاب کنید');
    }

    const updated = await setDefaultQuotationCurrency(recordId, {
      authorizationHeader,
    });

    if (!updated.ok) {
      return failure(updated.refusal.code, updated.refusal.detail);
    }

    return {
      success: true,
      ...describeCatalog(updated.value),
      message: 'ارز پیش‌فرض تغییر کرد',
    };
  }

  return failure('INVALID_INPUT', 'عملیات فهرست ارز شناخته نشد');
};

export default defineLogicFunction({
  universalIdentifier: QUOTATION_CURRENCIES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'quotation-currencies',
  description: 'Workspace currency catalog for quotation financial settings',
  timeoutSeconds: 15,
  handler: quotationCurrenciesHandler,
  httpRouteTriggerSettings: {
    path: '/quotation/currencies',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['authorization'],
  },
});
