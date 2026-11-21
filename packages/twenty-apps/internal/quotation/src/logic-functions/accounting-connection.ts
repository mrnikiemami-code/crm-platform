import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import {
  ACCOUNTING_CONNECTION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  ADAPTER_DESCRIPTORS,
  describeCapabilities,
  findAdapterDescriptor,
} from 'src/domain/accounting/adapter-registry';
import { persianAccountingMessage } from 'src/domain/accounting/errors';
import { connectionFailureMessage } from 'src/services/accounting-connection.service';
import {
  buildAdapter,
  describeSecretStatus,
  loadConnections,
  persistHealth,
  resolveConnection,
  saveConnection,
  testConnection,
} from 'src/services/accounting-connection.service';
import {
  appNotInstalled,
  asRecord,
  failure,
  isAppInstalled,
  readBody,
  readRouteSecrets,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const readFlags = () => ({
  outboundEnabled: process.env.ACCOUNTING_OUTBOUND_ENABLED === 'true',
  documentExportEnabled:
    process.env.ACCOUNTING_DOCUMENT_EXPORT_ENABLED === 'true',
});

const handler = async (event: RoutePayload<unknown>) => {
  const body = readBody(event);
  const action = readString(body.action);

  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  const secrets = readRouteSecrets();

  try {
    if (action === 'list') {
      const connections = await loadConnections();

      return {
        success: true,
        connections: connections.map((connection) => ({
          ...connection,
          capabilityRows: describeCapabilities(
            findAdapterDescriptor(connection.adapterId) ?? {
              transportIsSecure: false,
            },
          ),
        })),
        adapters: ADAPTER_DESCRIPTORS,
        credentials: describeSecretStatus(secrets),
        flags: readFlags(),
      };
    }

    if (action === 'save') {
      const saved = await saveConnection({
        id: readString(body.id) || null,
        name: readString(body.name),
        adapterId: readString(body.adapterId),
        settings: asRecord(body.settings),
      });

      if (!saved.ok) {
        return failure(
          saved.refusal.code,
          persianAccountingMessage(saved.refusal.code),
        );
      }

      return {
        success: true,
        connection: {
          ...saved.value.connection,
          capabilityRows: describeCapabilities(saved.value.adapter),
        },
        adapters: ADAPTER_DESCRIPTORS,
        credentials: describeSecretStatus(secrets),
      };
    }

    if (action === 'test') {
      const connectionId = readString(body.connectionId);
      const resolved = await resolveConnection({ connectionId });

      if (!resolved.ok) {
        return failure(
          resolved.refusal.code,
          persianAccountingMessage(resolved.refusal.code),
        );
      }

      // Testing an unsaved adapter id would build a different vendor than the one stored,
      // so the stored record is always the source of the adapter choice.
      const descriptor = findAdapterDescriptor(resolved.value.adapterId);

      if (descriptor === null) {
        return failure(
          'ADAPTER_UNKNOWN',
          persianAccountingMessage('ADAPTER_UNKNOWN'),
        );
      }

      const health = await testConnection(resolved.value, secrets);

      if (!health.ok) {
        return failure(
          health.refusal.code,
          persianAccountingMessage(health.refusal.code),
        );
      }

      await persistHealth(resolved.value.id, health.value);

      const adapter = buildAdapter(resolved.value, secrets);
      const transportIsSecure =
        resolved.value.settings.baseUrl
          .trim()
          .toLowerCase()
          .startsWith('https://') || secrets.allowInsecureTransport;

      return {
        success: true,
        connectionId: resolved.value.id,
        healthState: health.value.healthState,
        message: health.value.message,
        detail: health.value.detail,
        latencyMs: health.value.latencyMs,
        checkedAt: health.value.checkedAt,
        verificationState: health.value.verificationState,
        transportIsSecure,
        isLive: descriptor.isLive,
        declaredCapabilities: adapter.ok
          ? describeCapabilities(descriptor, adapter.value.capabilities)
          : describeCapabilities(descriptor),
      };
    }

    return failure(
      'INVALID_INPUT',
      persianAccountingMessage('INVALID_INPUT'),
    );
  } catch (error) {
    return failure('QUERY_ERROR', connectionFailureMessage(error));
  }
};

export default defineLogicFunction({
  universalIdentifier:
    ACCOUNTING_CONNECTION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accounting-connection-action',
  description:
    'مدیریت اتصال حسابداری: فهرست، ذخیرهٔ تنظیمات غیرحساس و آزمایش اتصال',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/accounting-connection',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
