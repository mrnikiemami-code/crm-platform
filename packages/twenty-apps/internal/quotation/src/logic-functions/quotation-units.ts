import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { QUOTATION_UNITS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  deactivateQuotationUnit,
  listQuotationUnits,
  saveQuotationUnit,
  type QuotationUnitView,
} from 'src/services/quotation-unit.service';
import {
  appNotInstalled,
  failure,
  isAppInstalled,
  readBody,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const describeCatalog = (units: QuotationUnitView[]) => ({
  units,
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

export const quotationUnitsHandler = async (event: RoutePayload<unknown>) => {
  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  const body = readBody(event);
  const action = readString(body.action) || 'list';
  const authorizationHeader = readCallerAuthorization(event.headers ?? {});

  if (action === 'list') {
    const listed = await listQuotationUnits({ authorizationHeader });

    if (!listed.ok) {
      return failure(listed.refusal.code, listed.refusal.detail);
    }

    return { success: true, ...describeCatalog(listed.value) };
  }

  if (action === 'save') {
    const saved = await saveQuotationUnit(
      {
        recordId: readOptionalId(body.recordId),
        name: readString(body.name),
        accountingCodeText: readString(body.accountingCodeText),
        isActive: readBoolean(body.isActive, true),
      },
      { authorizationHeader },
    );

    if (!saved.ok) {
      return failure(saved.refusal.code, saved.refusal.detail);
    }

    return {
      success: true,
      ...describeCatalog(saved.value),
      message: 'واحد ذخیره شد',
    };
  }

  if (action === 'deactivate') {
    const recordId = readOptionalId(body.recordId);

    if (recordId === null) {
      return failure('QUOTATION_UNIT_REQUIRED', 'واحد را انتخاب کنید');
    }

    const updated = await deactivateQuotationUnit(recordId, {
      authorizationHeader,
    });

    if (!updated.ok) {
      return failure(updated.refusal.code, updated.refusal.detail);
    }

    return {
      success: true,
      ...describeCatalog(updated.value),
      message: 'واحد غیرفعال شد',
    };
  }

  return failure('INVALID_INPUT', 'عملیات فهرست واحد شناخته نشد');
};

export default defineLogicFunction({
  universalIdentifier: QUOTATION_UNITS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'quotation-units',
  description: 'Workspace unit-of-measure catalog for quotation settings',
  timeoutSeconds: 15,
  handler: quotationUnitsHandler,
  httpRouteTriggerSettings: {
    path: '/quotation/units',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['authorization'],
  },
});