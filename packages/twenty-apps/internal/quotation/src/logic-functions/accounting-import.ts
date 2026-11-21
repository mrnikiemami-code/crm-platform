import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import {
  ACCOUNTING_IMPORT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { persianAccountingMessage } from 'src/domain/accounting/errors';
import {
  applyItemImport,
  applyPartyImport,
  importFailureMessage,
  previewItemImport,
  previewPartyImport,
  type PartyApplySelection,
} from 'src/services/accounting-import.service';
import { resolveConnection } from 'src/services/accounting-connection.service';
import {
  adapterForConnection,
  appNotInstalled,
  asRecord,
  failure,
  isAppInstalled,
  readBody,
  readRouteSecrets,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const readSelections = (
  value: unknown,
): { externalItemId: string; internalItemId?: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const externalItemId = readString(row.externalItemId);

    if (externalItemId === '') {
      return [];
    }

    const internalItemId = readString(row.internalItemId);

    return [
      {
        externalItemId,
        ...(internalItemId === '' ? {} : { internalItemId }),
      },
    ];
  });
};

const readPartySelections = (value: unknown): PartyApplySelection[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const externalPartyId = readString(row.externalPartyId);
    const internalPartyId = readString(row.internalPartyId);
    const partyType = readString(row.partyType) === 'PERSON' ? 'PERSON' : 'COMPANY';

    return externalPartyId === '' || internalPartyId === ''
      ? []
      : [{ externalPartyId, internalPartyId, partyType }];
  });
};

const handler = async (event: RoutePayload<unknown>) => {
  const body = readBody(event);
  const action = readString(body.action);
  const connectionId = readString(body.connectionId);

  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  if (connectionId === '') {
    return failure('INVALID_INPUT', persianAccountingMessage('INVALID_INPUT'));
  }

  try {
    const resolved = await resolveConnection({ connectionId });

    if (!resolved.ok) {
      return failure(
        resolved.refusal.code,
        persianAccountingMessage(resolved.refusal.code),
      );
    }

    const adapter = adapterForConnection(resolved.value, readRouteSecrets());

    if (!adapter.ok) {
      return failure(
        adapter.refusal.code,
        persianAccountingMessage(adapter.refusal.code),
      );
    }

    if (action === 'preview-items') {
      const preview = await previewItemImport({
        connectionId,
        adapter: adapter.value,
        moneyUnit: resolved.value.settings.moneyUnit,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      return { success: true, preview: preview.value };
    }

    if (action === 'apply-items') {
      // The preview is regenerated here instead of trusting the caller's copy: the rows
      // carry amounts and versions that become CRM records, so a stale or edited preview
      // must not be able to write a price that was never previewed.
      const preview = await previewItemImport({
        connectionId,
        adapter: adapter.value,
        moneyUnit: resolved.value.settings.moneyUnit,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      const outcome = await applyItemImport({
        connectionId,
        preview: preview.value,
        selections: readSelections(body.selections),
        allowRemoteVersionUpdate: body.allowRemoteVersionUpdate === true,
        applyPrices: body.applyPrices === true,
      });

      return { success: true, outcome };
    }

    if (action === 'preview-parties') {
      const preview = await previewPartyImport({
        connectionId,
        adapter: adapter.value,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      return { success: true, preview: preview.value };
    }

    if (action === 'apply-parties') {
      const outcome = await applyPartyImport({
        connectionId,
        selections: readPartySelections(body.selections),
        allowRemoteVersionUpdate: body.allowRemoteVersionUpdate === true,
      });

      return { success: true, outcome };
    }

    return failure('INVALID_INPUT', persianAccountingMessage('INVALID_INPUT'));
  } catch (error) {
    return failure('QUERY_ERROR', importFailureMessage(error));
  }
};

export default defineLogicFunction({
  universalIdentifier: ACCOUNTING_IMPORT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accounting-import-action',
  description:
    'پیش‌نمایش و اعمال دریافت کالا، خدمت، قیمت و مشتری از نرم‌افزار حسابداری',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/accounting-import',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
