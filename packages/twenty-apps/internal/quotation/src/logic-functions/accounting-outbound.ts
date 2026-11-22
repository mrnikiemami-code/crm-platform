import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import {
  ACCOUNTING_OUTBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildCatalogItemPushQuery } from 'src/data/accounting-queries';
import { executeRecordGraphql } from 'src/data/record-api';
import { persianAccountingMessage } from 'src/domain/accounting/errors';
import { asanUnitsToCrmMicros } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { formatMicrosExact } from 'src/domain/money/micros';
import {
  executeItemPush,
  executeQuotationExport,
  loadOperations,
  outboundFailureMessage,
  previewItemPush,
  previewQuotationExport,
} from 'src/services/accounting-outbound.service';
import { resolveConnection } from 'src/services/accounting-connection.service';
import {
  adapterForConnection,
  appNotInstalled,
  asRecord,
  failure,
  isAppInstalled,
  readBody,
  readOutboundFlags,
  readRouteSecrets,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const asRow = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// The amount published to accounting is read from the CRM record, never from the browser.
// A caller that could name its own price could publish one that no quotation ever showed.
const loadPushItem = async (
  itemId: string,
): Promise<
  | {
      ok: true;
      item: {
        code: string;
        name: string;
        secondaryName: string | null;
        sellPriceMicros: string;
        salesPriceMicros: string[];
        externalItemId: string | null;
      };
    }
  | { ok: false; code: string; detail: string }
> => {
  const data = await executeRecordGraphql(buildCatalogItemPushQuery(itemId));
  const node = asRecord(data.catalogItem);

  if (Object.keys(node).length === 0) {
    return { ok: false, code: 'ITEM_NOT_FOUND', detail: 'no catalog item' };
  }

  const edges = asRecord(node.prices)?.edges;

  if (!Array.isArray(edges)) {
    return { ok: false, code: 'PRICE_NOT_SET', detail: 'no prices on the item' };
  }

  const prices = edges.flatMap((edge) => {
    const price = asRecord(asRow(edge).node);
    const unitPriceExact = readString(price.unitPriceExact);

    return unitPriceExact === ''
      ? []
      : [
          {
            unitPriceExact,
            isDefault: asRecord(price.priceList)?.isDefault === true,
          },
        ];
  });

  const chosen = prices.find((price) => price.isDefault) ?? prices[0];

  if (chosen === undefined) {
    return { ok: false, code: 'PRICE_NOT_SET', detail: 'no price value' };
  }

  return {
    ok: true,
    item: {
      code: readString(node.sku),
      name: readString(node.name),
      secondaryName: readString(node.description) || null,
      sellPriceMicros: chosen.unitPriceExact,
      salesPriceMicros: [],
      externalItemId: null,
    },
  };
};

// Asan zeroes price tiers 2 and 3 when `SalesPrice` is omitted on an EDIT, so the current
// remote tiers are carried through unchanged instead of being cleared by a price push.
const preserveSalesPriceTiers = async ({
  adapter,
  externalItemId,
  moneyUnit,
}: {
  adapter: Awaited<ReturnType<typeof adapterForConnection>>;
  externalItemId: string;
  moneyUnit: string;
}): Promise<string[]> => {
  if (!adapter.ok) {
    return [];
  }

  const remote = await adapter.value.listItems();

  if (!remote.ok) {
    return [];
  }

  const current = remote.value.find(
    (item) => item.externalItemId === externalItemId,
  );

  if (current === undefined) {
    return [];
  }

  return current.salesPriceUnits.flatMap((units) => {
    const micros = asanUnitsToCrmMicros(
      units,
      moneyUnit === 'RIAL' || moneyUnit === 'TOMAN' ? moneyUnit : 'UNCONFIRMED',
    );

    return micros.ok ? [formatMicrosExact(micros.value)] : [];
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

    const flags = readOutboundFlags(body);

    if (action === 'operations') {
      return {
        success: true,
        operations: await loadOperations(
          connectionId,
          {},
          readString(body.quotationId) || readString(body.internalEntityId) || undefined,
        ),
      };
    }

    if (action === 'preview-item-push') {
      const itemId = readString(body.itemId);
      const linkExternalItemId = readString(body.externalItemId);
      const preview = await previewItemPush({
        connectionId,
        internalItemId: itemId,
        changedFields: Array.isArray(body.changedFields)
          ? body.changedFields.filter(
              (field): field is string => typeof field === 'string',
            )
          : [],
        adapter: adapter.value,
        settings: resolved.value.settings,
        observedRemoteVersion: readString(body.observedRemoteVersion) || null,
        flags,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      return {
        success: true,
        preview: preview.value,
        linkExternalItemId: linkExternalItemId || null,
        flags,
      };
    }

    if (action === 'execute-item-push') {
      const itemId = readString(body.itemId);
      const loaded = await loadPushItem(itemId);

      if (!loaded.ok) {
        return failure(loaded.code, persianAccountingMessage(loaded.code));
      }

      const preview = await previewItemPush({
        connectionId,
        internalItemId: itemId,
        changedFields: Array.isArray(body.changedFields)
          ? body.changedFields.filter(
              (field): field is string => typeof field === 'string',
            )
          : [],
        adapter: adapter.value,
        settings: resolved.value.settings,
        observedRemoteVersion: readString(body.observedRemoteVersion) || null,
        flags,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      const externalItemId = preview.value.link?.externalItemId ?? null;

      if (externalItemId !== null) {
        loaded.item.externalItemId = externalItemId;
        loaded.item.salesPriceMicros = await preserveSalesPriceTiers({
          adapter,
          externalItemId,
          moneyUnit: resolved.value.settings.moneyUnit,
        });
      }

      const outcome = await executeItemPush({
        connectionId,
        internalItemId: itemId,
        changedFields: Array.isArray(body.changedFields)
          ? body.changedFields.filter(
              (field): field is string => typeof field === 'string',
            )
          : [],
        adapter: adapter.value,
        settings: resolved.value.settings,
        flags,
        item: loaded.item,
        observedRemoteVersion: readString(body.observedRemoteVersion) || null,
      });

      if (!outcome.ok) {
        return failure(
          outcome.refusal.code,
          persianAccountingMessage(outcome.refusal.code),
        );
      }

      return { success: true, outcome: outcome.value };
    }

    if (action === 'preview-quotation-export') {
      const quotationId = readString(body.quotationId);
      const preview = await previewQuotationExport({
        connectionId,
        quotationId,
        adapter: adapter.value,
        settings: resolved.value.settings,
        flags,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      return { success: true, preview: preview.value, flags };
    }

    if (action === 'execute-quotation-export') {
      const outcome = await executeQuotationExport({
        connectionId,
        quotationId: readString(body.quotationId),
        adapter: adapter.value,
        settings: resolved.value.settings,
        flags,
      });

      if (!outcome.ok) {
        return failure(
          outcome.refusal.code,
          persianAccountingMessage(outcome.refusal.code),
        );
      }

      return { success: true, outcome: outcome.value };
    }

    return failure('INVALID_INPUT', persianAccountingMessage('INVALID_INPUT'));
  } catch (error) {
    return failure('QUERY_ERROR', outboundFailureMessage(error));
  }
};

export default defineLogicFunction({
  universalIdentifier: ACCOUNTING_OUTBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accounting-outbound-action',
  description:
    'پیش‌نمایش و ارسال کالا/خدمت و ثبت پیش‌فاکتور تأییدشده در نرم‌افزار حسابداری',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/accounting-outbound',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
