import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { LogicFunctionExecutionStatus } from 'src/engine/metadata-modules/logic-function/dtos/logic-function-execution-result.dto';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { AccountingItemApplyService, parseAccountingItemSelections } from 'src/modules/quotation/services/accounting-item-apply.service';
import { AccountingCustomerFinanceService, parseCustomerFinanceRequest } from 'src/modules/quotation/services/accounting-customer-finance.service';
import { AccountingPartyOutboundService, parsePartyOutboundRequest } from 'src/modules/quotation/services/accounting-party-outbound.service';
import { AccountingPartyApplyService, parseAccountingPartySelections } from 'src/modules/quotation/services/accounting-party-apply.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { acquireAccountingConnectionWorkLock } from 'src/modules/quotation/utils/accounting-connection-lock.util';

// These are the installed Quotation application's existing, stable metadata identifiers.
// No caller chooses a function identifier, app, workspace, URL, or execution credentials.
const QUOTATION_APPLICATION = 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const FUNCTIONS = {
  import: 'b257fa8c-38a4-5cec-ba65-0cf27634abf9',
  outbound: 'f55e7a5a-81af-562c-b96b-1f95fb102ec7',
} as const;

const OPERATIONS = {
  'accounting-internal-probe-connection': { function: 'import', action: 'probe-connection' },
  'accounting-import-preview-items-page': { function: 'import', action: 'preview-items-page' },
  'accounting-import-preview-parties-page': { function: 'import', action: 'preview-parties-page' },
  'accounting-import-search-party-candidates': { function: 'import', action: 'search-party-candidates' },
  'accounting-import-preview-items': { function: 'import', action: 'preview-items' },
  'accounting-import-apply-items': { function: 'import', action: 'apply-items' },
  'accounting-import-preview-parties': { function: 'import', action: 'preview-parties' },
  'accounting-import-apply-parties': { function: 'import', action: 'apply-parties' },
  'accounting-outbound-customer-finance': { function: 'outbound', action: 'customer-finance' },
  'accounting-outbound-preview-party-push': { function: 'outbound', action: 'preview-party-push' },
  'accounting-outbound-execute-party-push': { function: 'outbound', action: 'execute-party-push' },
  'accounting-outbound-operations': { function: 'outbound', action: 'operations' },
  'accounting-outbound-preview-item-push': { function: 'outbound', action: 'preview-item-push' },
  'accounting-outbound-execute-item-push': { function: 'outbound', action: 'execute-item-push' },
  'accounting-outbound-preview-quotation-export': { function: 'outbound', action: 'preview-quotation-export' },
  'accounting-outbound-reconcile-quotation': { function: 'outbound', action: 'reconcile-quotation' },
  'accounting-outbound-execute-quotation-export': { function: 'outbound', action: 'execute-quotation-export' },
  'accounting-outbound-list-exportable-quotations': { function: 'outbound', action: 'list-exportable-quotations' },
} as const;

// Connection tests enter through the existing settings authority, not an
// additional public controller action.
export const ACCOUNTING_OPERATION_ACTIONS = Object.keys(OPERATIONS)
  .filter((action) => action !== 'accounting-internal-probe-connection');

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
    private readonly itemApply: AccountingItemApplyService,
    private readonly partyOutbound: AccountingPartyOutboundService,
    private readonly customerFinance: AccountingCustomerFinanceService,
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
    if (['apply-parties', 'apply-items', 'reconcile-quotation', 'preview-party-push', 'execute-party-push', 'customer-finance'].includes(operation.action) && authContext.type !== 'user') {
      return forbidden();
    }

    if (operation.action === 'reconcile-quotation' && !readText(input.operationId)) return invalid();
    const isCustomerFinance = operation.action === 'customer-finance';
    const financeRequest = isCustomerFinance ? parseCustomerFinanceRequest(input) : null;
    if (isCustomerFinance && !financeRequest) return invalid();
    const isPartyOutbound = operation.action === 'preview-party-push' || operation.action === 'execute-party-push';
    const partyRequest = isPartyOutbound ? parsePartyOutboundRequest(input) : null;
    if (isPartyOutbound && !partyRequest) return invalid();
    const partySelections = operation.action === 'apply-parties' ? parseAccountingPartySelections(input.selections) : null;
    if (operation.action === 'apply-parties' && partySelections === null) return invalid();
    const itemSelections = operation.action === 'apply-items' ? parseAccountingItemSelections(input.selections) : null;
    if (operation.action === 'apply-items' && itemSelections === null) return invalid();

    try {
      const quotationId = readText(input.quotationId);
      const isRecordScoped =
        operation.action === 'preview-quotation-export' ||
        operation.action === 'execute-quotation-export' ||
        operation.action === 'reconcile-quotation' ||
        (operation.action === 'operations' && quotationId !== '');
      const isRecordRead =
        isRecordScoped && operation.action !== 'execute-quotation-export' && operation.action !== 'reconcile-quotation';

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

      if (isCustomerFinance && financeRequest) {
        return this.customerFinance.read(financeRequest, authContext, async command => {
          const result = await this.executor.execute({
            logicFunctionId: fn.id, workspaceId,
            payload: {
              body: { ...command, action: 'customer-finance' }, headers: {}, pathParameters: {},
              queryStringParameters: {}, isBase64Encoded: false,
              requestContext: { http: { method: 'POST', path: '/rest/quotation/actions' } },
              userWorkspaceId: null,
            },
          });
          const data = asRecord(result.data);
          return result.status === LogicFunctionExecutionStatus.SUCCESS && !result.error && typeof data?.success === 'boolean' ? data : null;
        });
      }

      if (isPartyOutbound && partyRequest) {
        // Only the server-built command reaches the private worker. The
        // browser cannot inject a customer profile, destination URL or receipt.
        return this.partyOutbound.run(partyRequest, operation.action === 'execute-party-push', authContext, async (workerAction, commandBody) => {
          const result = await this.executor.execute({
            logicFunctionId: fn.id, workspaceId,
            payload: {
              body: { ...commandBody, action: workerAction }, headers: {}, pathParameters: {},
              queryStringParameters: {}, isBase64Encoded: false,
              requestContext: { http: { method: 'POST', path: '/rest/quotation/actions' } },
              userWorkspaceId: null,
            },
          });
          const data = asRecord(result.data);
          return result.status === LogicFunctionExecutionStatus.SUCCESS && !result.error && typeof data?.success === 'boolean' ? data : null;
        });
      }

      const execute = async () => {
      const result = await this.executor.execute({
        logicFunctionId: fn.id,
        workspaceId,
        ...(authContext.type === 'user' && operation.action !== 'apply-parties'
          ? { userId: authContext.user.id, userWorkspaceId: authContext.userWorkspaceId }
          : {}),
        payload: {
          body: operation.action === 'apply-parties'
            ? { connectionId: readText(input.connectionId), selections: partySelections, allowRemoteVersionUpdate: input.allowRemoteVersionUpdate === true, action: 'prepare-parties' }
            : operation.action === 'apply-items'
              ? { connectionId: readText(input.connectionId), selections: itemSelections, applyPrices: input.applyPrices === true, allowRemoteVersionUpdate: input.allowRemoteVersionUpdate === true, action: 'prepare-items' }
              : operation.action === 'reconcile-quotation'
                ? { connectionId: readText(input.connectionId), quotationId, operationId: readText(input.operationId), action: 'reconcile-quotation' }
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
      if (operation.action === 'apply-items' && data.success === true) {
        if (!itemSelections) return invalid();
        return this.itemApply.apply({ connectionId: readText(input.connectionId), selections: itemSelections, applyPrices: input.applyPrices === true,
          allowUpdate: input.allowRemoteVersionUpdate === true, plan: data.plan, authContext });
      }
      return data;
      };

      // Keep lifecycle mutations out of the window from dispatch to durable apply.
      // The worker still rechecks active state, and each operation owns its own claim.
      if (['apply-items', 'apply-parties', 'execute-item-push', 'execute-quotation-export', 'reconcile-quotation'].includes(operation.action)) {
        return await this.workspaceOrmManager.executeInWorkspaceContext(
          () => this.workspaceOrmManager.runInWorkspaceTransaction(async (scope) => {
            await acquireAccountingConnectionWorkLock(scope);
            return execute();
          }),
          authContext,
        );
      }
      return await execute();
    } catch {
      // Never disclose worker stack traces, application tokens or vendor credentials.
      return unavailable();
    }
  }
}
