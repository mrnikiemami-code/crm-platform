import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import {
  ACCOUNTING_OUTBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { executePartyPush, previewPartyPush, type PartyPushCommand } from 'src/services/accounting-party-outbound.service';
import { buildCatalogItemPushQuery } from 'src/data/accounting-queries';
import { executeRecordGraphql } from 'src/data/record-api';
import { persianAccountingMessage } from 'src/domain/accounting/errors';
import { asanUnitsToCrmMicros } from 'src/domain/accounting/adapters/asan/asan-money-unit';
import { formatMicrosExact } from 'src/domain/money/micros';
import {
  executeItemPush,
  executeQuotationExport,
  listExportableQuotations,
  loadOperations,
  observeQuotationReconciliation,
  outboundFailureMessage,
  previewItemPush,
  previewQuotationExport,
} from 'src/services/accounting-outbound.service';
import {
  loadConnectionByIdForHistory,
  requireActiveAccountingConnection,
  resolveConnection,
} from 'src/services/accounting-connection.service';
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
    // History reads must not share the "new work" resolver: a retired connection still
    // owns its sync-operation ledger. Preview/execute stay on the active-only path.
    if (action === 'operations') {
      const historical = await loadConnectionByIdForHistory(connectionId);

      if (!historical.ok) {
        return failure(
          historical.refusal.code,
          persianAccountingMessage(historical.refusal.code),
        );
      }

      return {
        success: true,
        connectionId: historical.value.id,
        connectionIsActive: historical.value.isActive,
        operations: await loadOperations(
          historical.value.id,
          {},
          readString(body.quotationId) ||
            readString(body.internalEntityId) ||
            undefined,
        ),
      };
    }

    // New work only: workspace-default / explicit id must be active. A second active
    // check follows so a concurrent retire after the first resolve is still refused
    // before adapter construction. Without a shared lock with deactivate, work that
    // already passed this gate can still finish; see recovery R1 concurrency note.
    const resolved = await resolveConnection({ connectionId });

    if (!resolved.ok) {
      return failure(
        resolved.refusal.code,
        persianAccountingMessage(resolved.refusal.code),
      );
    }

    const stillActive = await requireActiveAccountingConnection(connectionId);

    if (!stillActive.ok) {
      return failure(
        stillActive.refusal.code,
        persianAccountingMessage(stillActive.refusal.code),
      );
    }

    const activeConnection = stillActive.value;
    const adapter = adapterForConnection(activeConnection, readRouteSecrets());

    if (!adapter.ok) {
      return failure(
        adapter.refusal.code,
        persianAccountingMessage(adapter.refusal.code),
      );
    }

    const flags = readOutboundFlags(body);

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
        settings: activeConnection.settings,
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
        settings: activeConnection.settings,
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
        // Asan's own exact single-item read owns the two tier positions.
        // Only legacy mock fixtures use the full-catalog helper.
        if (adapter.value.id !== 'asan') {
          loaded.item.salesPriceMicros = await preserveSalesPriceTiers({
            adapter, externalItemId, moneyUnit: activeConnection.settings.moneyUnit,
          });
        }
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
        settings: activeConnection.settings,
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

    // This command is assembled by Nest from the original user's visible
    // CRM record. There is no public HTTP trigger for this worker.
    if (action === 'preview-party-push' || action === 'execute-party-push') {
      const command = asRow(body.command);
      const profile = asRow(command.profile);
      if (!readString(command.operationId) || !['CREATE', 'UPDATE'].includes(readString(command.mode)) ||
          !readString(profile.fullName) || !['PERSON', 'COMPANY'].includes(readString(profile.partyType))) {
        return failure('INVALID_INPUT', persianAccountingMessage('INVALID_INPUT'));
      }
      if (action === 'preview-party-push') {
        const preview = await previewPartyPush(adapter.value, command as unknown as PartyPushCommand);
        if (!preview.ok) return failure(preview.refusal.code, persianAccountingMessage(preview.refusal.code));
        return { success: true, preview: preview.value,
          canExecute: flags.outboundEnabled && !adapter.value.isLive && adapter.value.writesEnabled !== false };
      }
      const outcome = await executePartyPush(adapter.value, command as unknown as PartyPushCommand, flags.outboundEnabled);
      if (!outcome.ok) return failure(outcome.refusal.code, persianAccountingMessage(outcome.refusal.code));
      return { success: true, outcome: outcome.value };
    }

    if (action === 'customer-finance') {
      // Only Nest supplies the linked customer id after original-user authorization.
      const externalPartyId = readString(body.externalPartyId);
      const report = readString(body.report);
      if (adapter.value.id !== 'asan' || !adapter.value.readAccessScope || !externalPartyId) {
        return failure('ASAN_TRANSPORT_UNAVAILABLE', persianAccountingMessage('ASAN_TRANSPORT_UNAVAILABLE'));
      }
      const observedAt = new Date().toISOString();
      const source = { adapterId: adapter.value.id, connectionId, moneyUnit: activeConnection.settings.moneyUnit,
        observedAt, certified: false, source: 'ASAN_REPORTED' };
      if (report === 'SUMMARY' && adapter.value.readCustomerFinance) {
        const result = await adapter.value.readCustomerFinance(externalPartyId);
        if (!result.ok) return failure(result.refusal.code, persianAccountingMessage(result.refusal.code));
        return { success: true, observation: { ...source, report, ...result.value } };
      }
      if (report === 'CARDEX' && adapter.value.readCustomerLedger) {
        const from = readString(body.from), to = readString(body.to);
        const result = await adapter.value.readCustomerLedger(externalPartyId, from, to);
        if (!result.ok) return failure(result.refusal.code, persianAccountingMessage(result.refusal.code));
        return { success: true, observation: { ...source, report, customerExternalId: externalPartyId, from, to,
          dateInterpretation: 'UTC_CALENDAR_UNVERIFIED_VENDOR_BOUNDS', rows: result.value } };
      }
      return failure('INVALID_INPUT', persianAccountingMessage('INVALID_INPUT'));
    }

    if (action === 'reconcile-quotation') {
      const observed = await observeQuotationReconciliation({
        connectionId, quotationId: readString(body.quotationId),
        operationId: readString(body.operationId), adapter: adapter.value,
        settings: activeConnection.settings,
      });
      if (!observed.ok) return failure(observed.refusal.code, persianAccountingMessage(observed.refusal.code));
      return { success: true, observation: observed.value };
    }

    if (action === 'preview-quotation-export') {
      const quotationId = readString(body.quotationId);
      const preview = await previewQuotationExport({
        connectionId,
        quotationId,
        adapter: adapter.value,
        settings: activeConnection.settings,
        flags,
      });

      if (!preview.ok) {
        return failure(
          preview.refusal.code,
          persianAccountingMessage(preview.refusal.code),
        );
      }

      const { claim: _privateClaim, ...publicPreview } = preview.value;
      return { success: true, preview: publicPreview, flags };
    }

    if (action === 'execute-quotation-export') {
      const outcome = await executeQuotationExport({
        connectionId,
        quotationId: readString(body.quotationId),
        adapter: adapter.value,
        settings: activeConnection.settings,
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

    if (action === 'list-exportable-quotations') {
      const page = await listExportableQuotations({
        connectionId,
        cursor: readString(body.cursor) || null,
        pageSize:
          typeof body.pageSize === 'number' && body.pageSize > 0
            ? Math.min(body.pageSize, 50)
            : 25,
      });

      return { success: true, page };
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
});
