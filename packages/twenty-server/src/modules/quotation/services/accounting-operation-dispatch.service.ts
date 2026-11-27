import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { LogicFunctionExecutionStatus } from 'src/engine/metadata-modules/logic-function/dtos/logic-function-execution-result.dto';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { AccountingPartyApplyService, parseAccountingPartySelections } from 'src/modules/quotation/services/accounting-party-apply.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

// These are the installed Quotation application's existing, stable metadata identifiers.
// No caller chooses a function identifier, app, workspace, URL, or execution credentials.
const QUOTATION_APPLICATION = 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const FUNCTIONS = {
  import: 'b257fa8c-38a4-5cec-ba65-0cf27634abf9',
  outbound: 'f55e7a5a-81af-562c-b96b-1f95fb102ec7',
} as const;

const OPERATIONS = {
  'accounting-import-preview-items-page': { function: 'import', action: 'preview-items-page' },
  'accounting-import-preview-parties-page': { function: 'import', action: 'preview-parties-page' },
  'accounting-import-search-party-candidates': { function: 'import', action: 'search-party-candidates' },
  'accounting-import-preview-items': { function: 'import', action: 'preview-items' },
  'accounting-import-apply-items': { function: 'import', action: 'apply-items' },
  'accounting-import-preview-parties': { function: 'import', action: 'preview-parties' },
  'accounting-import-apply-parties': { function: 'import', action: 'apply-parties' },
  'accounting-outbound-operations': { function: 'outbound', action: 'operations' },
  'accounting-outbound-preview-item-push': { function: 'outbound', action: 'preview-item-push' },
  'accounting-outbound-execute-item-push': { function: 'outbound', action: 'execute-item-push' },
  'accounting-outbound-preview-quotation-export': { function: 'outbound', action: 'preview-quotation-export' },
  'accounting-outbound-execute-quotation-export': { function: 'outbound', action: 'execute-quotation-export' },
  'accounting-outbound-list-exportable-quotations': { function: 'outbound', action: 'list-exportable-quotations' },
} as const;

export const ACCOUNTING_OPERATION_ACTIONS = Object.keys(OPERATIONS);

const failure = (code: string, message: string) => ({
  success: false as const,
  code,
  message,
});

const forbidden = () => failure('FORBIDDEN', 'برای این عملیات حسابداری دسترسی کافی ندارید.');
const unavailable = () => failure('ACCOUNTING_RUNTIME_UNAVAILABLE', 'اجرای عملیات حسابداری در دسترس نیست. دوباره بررسی کنید.');
const invalid = () => failure('INVALID_INPUT', 'اطلاعات عملیات حسابداری معتبر نیست.');

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

@Injectable()
export class AccountingOperationDispatchService {
  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly executor: LogicFunctionExecutorService,
    private readonly permissions: QuotationPermissionService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly partyApply: AccountingPartyApplyService,
  ) {}

  async dispatch(
    action: string,
    body: object,
    authContext: WorkspaceAuthContext,
  ): Promise<unknown> {
    if (!Object.prototype.hasOwnProperty.call(OPERATIONS, action)) {
      return invalid();
    }

    const input = asRecord(body);
    const operation = OPERATIONS[action as keyof typeof OPERATIONS];
    if (input === null || readText(input.connectionId) === '') {
      return invalid();
    }

    // The worker's app token can access the entire accounting catalog. Do not
    // let an ordinary workspace member use it to enumerate or mutate records.
    // Record-scoped preview/history instead use the caller's real quotation read gate.
    const isOwnerApp =
      authContext.type === 'application' &&
      authContext.application.universalIdentifier === QUOTATION_APPLICATION;

    if (
      authContext.type !== 'user' &&
      authContext.type !== 'apiKey' &&
      !isOwnerApp
    ) {
      return forbidden();
    }

    // A customer write must always have a real workspace user. API keys and
    // unattended app tokens have no delegated CRM authority.
    if (operation.action === 'apply-parties' && authContext.type !== 'user') {
      return forbidden();
    }

    const partySelections = operation.action === 'apply-parties' ? parseAccountingPartySelections(input.selections) : null;
    if (operation.action === 'apply-parties' && partySelections === null) return invalid();

    try {
      const quotationId = readText(input.quotationId);
      const isRecordScoped =
        operation.action === 'preview-quotation-export' ||
        operation.action === 'execute-quotation-export' ||
        (operation.action === 'operations' && quotationId !== '');
      const isRecordRead =
        isRecordScoped && operation.action !== 'execute-quotation-export';

      if (
        !isOwnerApp &&
        !isRecordRead &&
        (await this.permissions.resolveSettingsAuthority(
          authContext,
          'accountingConnection',
        )) === null
      ) {
        return forbidden();
      }

      if (isRecordScoped) {
        if (quotationId === '') {
          return invalid();
        }

        // Never bypass workspace record permissions here. The executor's later
        // application-role reads do not authorize the original caller.
        if (!isOwnerApp) {
          const roleId = await this.permissions.resolveRoleId(authContext);
          if (!roleId) {
            return forbidden();
          }
          const visible = await this.workspaceOrmManager.executeInWorkspaceContext(
            () => this.workspaceOrmManager
              .getRepository<{ id: string }>('quotation', { unionOf: [roleId] })
              .findOne({ where: { id: quotationId }, select: { id: true } }),
            authContext,
          );
          if (!visible) {
            return forbidden();
          }
        }
      }

      const workspaceId = authContext.workspace.id;
      const { flatLogicFunctionMaps, flatApplicationMaps } =
        await this.workspaceCacheService.getOrRecompute(workspaceId, [
          'flatLogicFunctionMaps',
          'flatApplicationMaps',
        ]);
      const fn = flatLogicFunctionMaps.byUniversalIdentifier[FUNCTIONS[operation.function]];
      const app = fn?.applicationId
        ? flatApplicationMaps.byId[fn.applicationId]
        : undefined;

      // Require the private-function installation. Old versions still expose an
      // alternate HTTP path, so don't claim the migration is complete with those.
      if (
        !fn || fn.deletedAt || fn.httpRouteTriggerSettings ||
        app?.universalIdentifier !== QUOTATION_APPLICATION
      ) {
        return unavailable();
      }

      const result = await this.executor.execute({
        logicFunctionId: fn.id,
        workspaceId,
        ...(authContext.type === 'user' && operation.action !== 'apply-parties'
          ? { userId: authContext.user.id, userWorkspaceId: authContext.userWorkspaceId }
          : {}),
        payload: {
          body: operation.action === 'apply-parties'
            ? { connectionId: readText(input.connectionId), selections: partySelections, allowRemoteVersionUpdate: input.allowRemoteVersionUpdate === true, action: 'prepare-parties' }
            : { ...input, action: operation.action },
          headers: {},
          pathParameters: {},
          queryStringParameters: {},
          isBase64Encoded: false,
          requestContext: { http: { method: 'POST', path: '/rest/quotation/actions' } },
          userWorkspaceId: authContext.type === 'user' && operation.action !== 'apply-parties' ? authContext.userWorkspaceId : null,
        },
      });

      const data = asRecord(result.data);
      if (result.status !== LogicFunctionExecutionStatus.SUCCESS || result.error || data === null || typeof data.success !== 'boolean') {
        return unavailable();
      }
      if (operation.action === 'apply-parties' && data.success === true) {
        if (!app || !partySelections) return unavailable();
        return await this.partyApply.apply({ connectionId: readText(input.connectionId), selections: partySelections,
          allowUpdate: input.allowRemoteVersionUpdate === true, plan: data.plan, authContext, app });
      }
      return data;
    } catch {
      // Never disclose worker stack traces, application tokens or vendor credentials.
      return unavailable();
    }
  }
}
