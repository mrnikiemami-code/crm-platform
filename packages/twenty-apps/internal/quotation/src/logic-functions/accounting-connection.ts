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
  loadConnectionsThroughServer,
  persistHealthThroughServer,
  readAccountingSettingsAuthority,
  resolveConnection,
  saveConnectionThroughServer,
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

// The caller's own bearer token, forwarded to the server boundary. The workspace role is
// decided there; this route never infers a privilege from a missing header, and never
// substitutes the app token for a caller header the server rejected.
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

  const secrets = readRouteSecrets();
  const authorizationHeader = readCallerAuthorization(event.headers);

  try {
    if (action === 'list') {
      // The list is read through the same boundary that decides who may change it, so
      // the page learns `canManage` and the rows from one authoritative answer.
      const connections = await loadConnectionsThroughServer({
        authorizationHeader,
      });

      if (!connections.ok) {
        return failure(connections.refusal.code, connections.refusal.detail);
      }

      const authority = await readAccountingSettingsAuthority({
        authorizationHeader,
      });

      return {
        success: true,
        connections: connections.value.map((connection) => ({
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
        canManage: authority.ok ? authority.value : false,
      };
    }

    if (action === 'save') {
      const saved = await saveConnectionThroughServer(
        {
          id: readString(body.id) || null,
          name: readString(body.name),
          adapterId: readString(body.adapterId),
          settings: asRecord(body.settings),
        },
        { authorizationHeader },
      );

      if (!saved.ok) {
        return failure(
          saved.refusal.code,
          persianAccountingMessage(saved.refusal.code) ||
            saved.refusal.detail,
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
        flags: readFlags(),
        canManage: true,
      };
    }

    if (action === 'test') {
      // A probe emits network traffic and records its answer, so it is an operator
      // action, not a read. Refused before a single request leaves the workspace.
      const authority = await readAccountingSettingsAuthority({
        authorizationHeader,
      });

      if (!authority.ok) {
        return failure(authority.refusal.code, authority.refusal.detail);
      }

      if (!authority.value) {
        return failure(
          'ACCOUNTING_SETTINGS_FORBIDDEN',
          persianAccountingMessage('ACCOUNTING_SETTINGS_FORBIDDEN'),
        );
      }

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

      // The probe is read-only by contract; only its result is stored, and through the
      // same guarded boundary as a settings save.
      const persisted = await persistHealthThroughServer(
        resolved.value.id,
        health.value,
        { authorizationHeader },
      );

      if (!persisted.ok) {
        return failure(persisted.refusal.code, persisted.refusal.detail);
      }

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
    // The server boundary checks the human caller's workspace role, so the route must
    // hand the caller's own authorization header over.
    forwardedRequestHeaders: ['authorization'],
  },
});
