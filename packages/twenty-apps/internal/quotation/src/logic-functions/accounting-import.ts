import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import {
  ACCOUNTING_IMPORT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { persianAccountingMessage } from 'src/domain/accounting/errors';
import { readPageRequest } from 'src/domain/accounting/pagination';
import {
  applyItemImport,
  applyPartyImport,
  importFailureMessage,
  previewItemImport,
  previewPartyImport,
  type PartyApplySelection,
} from 'src/services/accounting-import.service';
import {
  loadItemMappingPage,
  loadPartyMappingPage,
  searchPartyCandidates,
  SnapshotRefusal,
} from 'src/services/accounting-mapping.service';
import { createKvSnapshotStorage } from 'src/services/accounting-snapshot-storage';
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

// An unpaged destination is read once into the app's workspace key-value store, so the next
// page request reuses the snapshot instead of re-reading the destination. Built per
// invocation because the client is bound at call time; the data itself is durable.
const mappingStorage = () => createKvSnapshotStorage({ client: kv });

const readSelections = (  value: unknown,
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

    // The paginated path the screens actually use. Every response is one bounded page plus
    // the snapshot's honest limits; nothing here can grow with the size of either side.
    if (action === 'preview-items-page') {
      const page = await loadItemMappingPage(
        {
          connectionId,
          adapterId: resolved.value.adapterId,
          baseUrl: resolved.value.settings.baseUrl,
          remoteUserId: resolved.value.settings.remoteUserId ?? '',
          moneyUnit: resolved.value.settings.moneyUnit,
          adapter: adapter.value,
          request: readPageRequest(body),
          refresh: body.refresh === true,
        },
        { storage: mappingStorage() },
      );

      return { success: true, page };
    }

    if (action === 'preview-parties-page') {
      const page = await loadPartyMappingPage(
        {
          connectionId,
          adapterId: resolved.value.adapterId,
          baseUrl: resolved.value.settings.baseUrl,
          remoteUserId: resolved.value.settings.remoteUserId ?? '',
          moneyUnit: resolved.value.settings.moneyUnit,
          adapter: adapter.value,
          request: readPageRequest(body),
          refresh: body.refresh === true,
        },
        { storage: mappingStorage() },
      );

      return { success: true, page };
    }

    if (action === 'search-party-candidates') {
      const partyType = readString(body.partyType) === 'PERSON' ? 'PERSON' : 'COMPANY';
      const candidates = await searchPartyCandidates({
        partyType,
        search: readString(body.search),
        cursor: readString(body.cursor) || null,
        pageSize: readPageRequest(body).pageSize,
      });

      return { success: true, candidates };
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
      const selections = readSelections(body.selections);
      const preview = await previewItemImport({
        connectionId,
        adapter: adapter.value,
        moneyUnit: resolved.value.settings.moneyUnit,
        // Only the confirmed rows are resolved against the CRM: a confirmation of three
        // rows must not read a catalog of a hundred thousand.
        onlyExternalIds: selections.map((selection) => selection.externalItemId),
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
        selections,
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
    // A destination that refused the read is a message about the connection, not a crash:
    // the screen keeps working and says what the vendor answered.
    if (error instanceof SnapshotRefusal) {
      return failure(
        error.code,
        persianAccountingMessage(error.code) || error.detail,
      );
    }

    return failure('QUERY_ERROR', importFailureMessage(error));
  }
};

export default defineLogicFunction({
  universalIdentifier: ACCOUNTING_IMPORT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accounting-import-action',
  description:
    'پیش‌نمایش صفحه‌به‌صفحه و اعمال دریافت کالا، خدمت، قیمت و مشتری از نرم‌افزار حسابداری',
  timeoutSeconds: 60,
  handler,
});
