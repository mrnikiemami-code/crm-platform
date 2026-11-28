import {
  Body,
  Controller,
  Headers,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { ApiPath } from 'twenty-shared/types';
import { isNonEmptyString } from 'twenty-shared/utils';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { QuotationCustomerLinkService } from 'src/modules/quotation/services/quotation-customer-link.service';
import { AccountingOperationDispatchService, ACCOUNTING_OPERATION_ACTIONS } from 'src/modules/quotation/services/accounting-operation-dispatch.service';
import { AccountingConnectionAuthorityService } from 'src/modules/quotation/services/accounting-connection-authority.service';
import { QuotationDraftPersistenceService } from 'src/modules/quotation/services/quotation-draft-persistence.service';
import { QuotationPdfService } from 'src/modules/quotation/services/quotation-pdf.service';
import { QuotationShareService } from 'src/modules/quotation/services/quotation-share.service';
import { QuotationUiService } from 'src/modules/quotation/services/quotation-ui.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { QuotationCurrencyAuthorityService } from 'src/modules/quotation/services/quotation-currency-authority.service';
import { QuotationUnitAuthorityService } from 'src/modules/quotation/services/quotation-unit-authority.service';
import { TaxPolicyAuthorityService } from 'src/modules/quotation/services/tax-policy-authority.service';
import { RoundingRuleAuthorityService } from 'src/modules/quotation/services/rounding-rule-authority.service';
import { type TaxPolicyMutationOutcome } from 'src/modules/quotation/types/tax-policy.type';
import { type RoundingRuleMutationOutcome } from 'src/modules/quotation/types/rounding-rule.type';
import { type QuotationCurrencyMutationOutcome } from 'src/modules/quotation/types/quotation-currency.type';
import { type QuotationUnitMutationOutcome } from 'src/modules/quotation/types/quotation-unit.type';
import { type AccountingConnectionOutcome } from 'src/modules/quotation/types/accounting-connection.type';
import { accountingAdapterContract } from 'src/modules/quotation/utils/accounting-adapter-contract.util';
import { persianMessageForQuotationCode } from 'src/modules/quotation/utils/quotation-ui-messages.util';

type QuotationUiActionBody = {
  action?: unknown;
  quotationId?: unknown;
  toStatus?: unknown;
  version?: unknown;
  linkId?: unknown;
  ttlHours?: unknown;
  channel?: unknown;
  chatId?: unknown;
  recordId?: unknown;
  name?: unknown;
  ratePercentText?: unknown;
  dutyRatePercentText?: unknown;
  accountingCodeText?: unknown;
  stepRialsText?: unknown;
  isActive?: unknown;
  isDefault?: unknown;
  isExempt?: unknown;
  connectionId?: unknown;
  adapterId?: unknown;
  settings?: unknown;
  datasetId?: unknown;
  partyType?: unknown;
  internalPartyId?: unknown;
  priceListId?: unknown;
  expectedGroupId?: unknown;
  expectedBaseUrl?: unknown;
  expectedRemoteUserId?: unknown;
  confirmed?: unknown;
};

const ALLOWED_ACTIONS = new Set([
  ...ACCOUNTING_OPERATION_ACTIONS,
  'get-lifecycle',
  'transition',
  'generate-pdf',
  'create-customer-link',
  'revoke-customer-link',
  'share-quotation',
  'save-draft',
  'tax-policy-list',
  'tax-policy-bootstrap',
  'tax-policy-save',
  'tax-policy-set-default',
  'tax-policy-deactivate',
  'tax-policy-delete',
  'rounding-rule-list',
  'rounding-rule-bootstrap',
  'rounding-rule-save',
  'rounding-rule-set-default',
  'rounding-rule-deactivate',
  'rounding-rule-delete',
  'quotation-currency-list',
  'quotation-currency-bootstrap',
  'quotation-currency-save',
  'quotation-currency-set-default',
  'quotation-unit-list',
  'quotation-unit-save',
  'quotation-unit-deactivate',
  'accounting-settings-authority',
  'accounting-connection-list',
  'accounting-connection-save',
  'accounting-connection-bind-dataset',
  'accounting-connection-customer-price-list',
  'accounting-connection-map-customer-price-group',
  'accounting-connection-test',
  'accounting-connection-set-default',
  'accounting-connection-deactivate',
  'accounting-connection-reactivate',
]);

const TAX_POLICY_MUTATING_ACTIONS = new Set([
  'tax-policy-bootstrap',
  'tax-policy-save',
  'tax-policy-set-default',
  'tax-policy-deactivate',
  'tax-policy-delete',
]);

const ROUNDING_RULE_MUTATING_ACTIONS = new Set([
  'rounding-rule-bootstrap',
  'rounding-rule-save',
  'rounding-rule-set-default',
  'rounding-rule-deactivate',
  'rounding-rule-delete',
]);

const QUOTATION_CURRENCY_MUTATING_ACTIONS = new Set([
  'quotation-currency-bootstrap',
  'quotation-currency-save',
  'quotation-currency-set-default',
]);

const QUOTATION_UNIT_MUTATING_ACTIONS = new Set([
  'quotation-unit-save',
  'quotation-unit-deactivate',
]);

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

@Controller(`${ApiPath.Rest}/quotation`)
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(AuthRestApiExceptionFilter)
export class QuotationUiController {
  constructor(
    private readonly quotationUiService: QuotationUiService,
    private readonly quotationPdfService: QuotationPdfService,
    private readonly quotationCustomerLinkService: QuotationCustomerLinkService,
    private readonly quotationShareService: QuotationShareService,
    private readonly quotationDraftPersistenceService: QuotationDraftPersistenceService,
    private readonly taxPolicyAuthorityService: TaxPolicyAuthorityService,
    private readonly roundingRuleAuthorityService: RoundingRuleAuthorityService,
    private readonly quotationCurrencyAuthorityService: QuotationCurrencyAuthorityService,
    private readonly quotationUnitAuthorityService: QuotationUnitAuthorityService,
    private readonly quotationPermissionService: QuotationPermissionService,
    private readonly accountingConnectionAuthorityService: AccountingConnectionAuthorityService,
    private readonly accountingOperationDispatchService: AccountingOperationDispatchService,
  ) {}

  @Post('actions')
  async actions(
    @Body() body: QuotationUiActionBody,
    @Headers('authorization') authorizationHeader?: string,
  ): Promise<unknown> {
    const action = typeof body.action === 'string' ? body.action : '';

    if (!ALLOWED_ACTIONS.has(action)) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: persianMessageForQuotationCode('INVALID_INPUT'),
      };
    }

    const authContext = getWorkspaceAuthContext();

    if (action.startsWith('tax-policy-')) {
      return this.handleTaxPolicyAction({ action, body, authContext });
    }

    if (action.startsWith('rounding-rule-')) {
      return this.handleRoundingRuleAction({ action, body, authContext });
    }

    if (action.startsWith('quotation-currency-')) {
      return this.handleQuotationCurrencyAction({ action, body, authContext });
    }

    if (action.startsWith('quotation-unit-')) {
      return this.handleQuotationUnitAction({ action, body, authContext });
    }

    // Read-only authority probe for the standalone settings page. It answers whether the
    // current caller may edit the accounting destination at all; the page hides the form
    // on a refusal, and every write route re-checks on its own.
    if (action === 'accounting-settings-authority') {
      return this.handleAccountingSettingsAuthority(authContext);
    }

    if (ACCOUNTING_OPERATION_ACTIONS.includes(action)) {
      return this.accountingOperationDispatchService.dispatch(action, body, authContext);
    }

    if (action.startsWith('accounting-connection-')) {
      return this.handleAccountingConnectionAction({ action, body, authContext });
    }

    // A new draft has no id yet, so this action cannot sit behind the shared
    // quotationId requirement below.
    if (action === 'save-draft') {
      try {
        const outcome =
          await this.quotationDraftPersistenceService.saveDraft({
            authContext,
            body,
          });

        if (outcome.kind !== 'SAVED') {
          return {
            success: false,
            code: outcome.code,
            message: outcome.message,
          };
        }

        return {
          success: true,
          quotationId: outcome.quotationId,
          version: outcome.version,
          status: outcome.status,
          message: 'پیش‌نویس پیش‌فاکتور ذخیره شد',
        };
      } catch (error) {
        return this.quotationUiService.toPersianFailure(error);
      }
    }

    const quotationId =
      typeof body.quotationId === 'string' ? body.quotationId.trim() : '';

    if (!isNonEmptyString(quotationId)) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: persianMessageForQuotationCode('INVALID_INPUT'),
      };
    }

    try {
      if (action === 'get-lifecycle') {
        const lifecycle = await this.quotationUiService.getLifecycle({
          authContext,
          quotationId,
        });

        return { success: true, lifecycle };
      }

      if (action === 'transition') {
        const toStatus =
          typeof body.toStatus === 'string' ? body.toStatus.trim() : '';
        const version =
          typeof body.version === 'number'
            ? body.version
            : typeof body.version === 'string' && /^\d+$/.test(body.version)
              ? Number(body.version)
              : null;

        if (!isNonEmptyString(toStatus) || version === null) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const result = await this.quotationUiService.transition({
          authContext,
          quotationId,
          toStatus,
          version,
        });

        return { success: true, ...result };
      }

      if (action === 'create-customer-link') {
        const ttlHours =
          typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)
            ? body.ttlHours
            : undefined;
        const created =
          await this.quotationCustomerLinkService.createCustomerLink({
            authContext,
            quotationId,
            ttlHours,
          });

        return { success: true, ...created };
      }

      if (action === 'revoke-customer-link') {
        const linkId =
          typeof body.linkId === 'string' ? body.linkId.trim() : '';

        if (!isNonEmptyString(linkId)) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const revoked =
          await this.quotationCustomerLinkService.revokeCustomerLink({
            authContext,
            quotationId,
            linkId,
          });

        return { success: true, ...revoked };
      }

      if (action === 'share-quotation') {
        const channel =
          typeof body.channel === 'string' ? body.channel.trim() : '';
        const chatId =
          typeof body.chatId === 'string' ? body.chatId.trim() : undefined;
        const ttlHours =
          typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)
            ? body.ttlHours
            : undefined;

        if (!isNonEmptyString(channel)) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const shared = await this.quotationShareService.shareQuotation({
          authContext,
          quotationId,
          channel,
          ttlHours,
          chatId,
          authorizationHeader:
            typeof authorizationHeader === 'string'
              ? authorizationHeader
              : null,
        });

        return { success: true, ...shared };
      }

      const pdf = await this.quotationPdfService.generateQuotationPdf({
        authContext,
        quotationId,
      });

      return {
        success: true,
        fileName: pdf.fileName,
        pdfBase64: pdf.buffer.toString('base64'),
        // Generation uses the same ZWNJ-preserving stack as the S1 spike.
        // Browser pdf.js copy may still drop ZWNJ; MuPDF/Acrobat are fine.
        zwnjBrowserCopyLimitation: true,
        message: 'فایل PDF آمادهٔ دانلود است.',
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  // Tax settings authority is decided here, at the server boundary, from the
  // workspace role — not from a browser claim and not from a logic function that
  // may have failed to recover an identity. A read is open to any authenticated
  // member; a mutation without proven settings authority is refused before any
  // repository is touched.
  private async handleTaxPolicyAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<unknown> {
    try {
      if (TAX_POLICY_MUTATING_ACTIONS.has(action)) {
        const authority =
          await this.taxPolicyAuthorityService.resolveAuthority(authContext);

        if (authority === null) {
          return {
            success: false,
            code: 'TAX_SETTINGS_FORBIDDEN',
            message: persianMessageForQuotationCode('TAX_SETTINGS_FORBIDDEN'),
          };
        }
      }

      const outcome = await this.runTaxPolicyAction({
        action,
        body,
        authContext,
      });

      if (outcome.kind !== 'OK') {
        return {
          success: false,
          code: outcome.code,
          message: outcome.message,
        };
      }

      const defaultPolicy =
        outcome.policies.find(
          (policy) => policy.isActive && policy.isDefault,
        ) ??
        outcome.policies.find((policy) => policy.isActive) ??
        null;

      return {
        success: true,
        policies: outcome.policies,
        defaultCode: defaultPolicy?.code ?? null,
        message: outcome.message,
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  private runTaxPolicyAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<TaxPolicyMutationOutcome> {
    if (action === 'tax-policy-list') {
      return this.taxPolicyAuthorityService.listPolicies(authContext);
    }

    if (action === 'tax-policy-bootstrap') {
      return this.taxPolicyAuthorityService.bootstrap(authContext);
    }

    if (action === 'tax-policy-save') {
      return this.taxPolicyAuthorityService.savePolicy(
        {
          recordId: readText(body.recordId) || null,
          name: readText(body.name),
          ratePercentText: readText(body.ratePercentText),
          dutyRatePercentText: readText(body.dutyRatePercentText),
          accountingCodeText: readText(body.accountingCodeText),
          isActive: readBoolean(body.isActive, true),
          isDefault: body.isDefault === true,
        },
        authContext,
      );
    }

    const recordId = readText(body.recordId);

    if (recordId === '') {
      return Promise.resolve({
        kind: 'REFUSED',
        code: 'TAX_POLICY_REQUIRED',
        message: 'سیاست مالیات را انتخاب کنید',
      });
    }

    if (action === 'tax-policy-set-default') {
      return this.taxPolicyAuthorityService.setDefaultPolicy(recordId, authContext);
    }

    if (action === 'tax-policy-delete') {
      return this.taxPolicyAuthorityService.deletePolicy(recordId, authContext);
    }

    return this.taxPolicyAuthorityService.deactivatePolicy(recordId, authContext);
  }

  private async handleRoundingRuleAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<unknown> {
    try {
      if (ROUNDING_RULE_MUTATING_ACTIONS.has(action)) {
        const authority =
          await this.roundingRuleAuthorityService.resolveAuthority(authContext);

        if (authority === null) {
          return {
            success: false,
            code: 'ROUNDING_SETTINGS_FORBIDDEN',
            message:
              'تغییر قواعد رُند فقط برای مدیر فضای کاری مجاز است',
          };
        }
      }

      const outcome = await this.runRoundingRuleAction({
        action,
        body,
        authContext,
      });

      if (outcome.kind !== 'OK') {
        return {
          success: false,
          code: outcome.code,
          message: outcome.message,
        };
      }

      const defaultRule =
        outcome.rules.find((rule) => rule.isActive && rule.isDefault) ??
        outcome.rules.find((rule) => rule.isActive) ??
        null;

      return {
        success: true,
        rules: outcome.rules,
        defaultCode: defaultRule?.code ?? null,
        message: outcome.message,
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  private runRoundingRuleAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<RoundingRuleMutationOutcome> {
    if (action === 'rounding-rule-list') {
      return this.roundingRuleAuthorityService.listRules(authContext);
    }

    if (action === 'rounding-rule-bootstrap') {
      return this.roundingRuleAuthorityService.bootstrap(authContext);
    }

    if (action === 'rounding-rule-save') {
      return this.roundingRuleAuthorityService.saveRule(
        {
          recordId: readText(body.recordId) || null,
          name: readText(body.name),
          stepRialsText: readText(body.stepRialsText),
          isActive: readBoolean(body.isActive, true),
          isDefault: body.isDefault === true,
        },
        authContext,
      );
    }

    const recordId = readText(body.recordId);

    if (recordId === '') {
      return Promise.resolve({
        kind: 'REFUSED',
        code: 'ROUNDING_RULE_REQUIRED',
        message: 'قاعده رُند را انتخاب کنید',
      });
    }

    if (action === 'rounding-rule-set-default') {
      return this.roundingRuleAuthorityService.setDefaultRule(
        recordId,
        authContext,
      );
    }

    if (action === 'rounding-rule-delete') {
      return this.roundingRuleAuthorityService.deleteRule(recordId, authContext);
    }

    return this.roundingRuleAuthorityService.deactivateRule(
      recordId,
      authContext,
    );
  }

  private async handleQuotationUnitAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<unknown> {
    try {
      if (QUOTATION_UNIT_MUTATING_ACTIONS.has(action)) {
        const authority =
          await this.quotationUnitAuthorityService.resolveAuthority(authContext);

        if (authority === null) {
          return {
            success: false,
            code: 'FORBIDDEN',
            message: persianMessageForQuotationCode('FORBIDDEN'),
          };
        }
      }

      const outcome = await this.runQuotationUnitAction({
        action,
        body,
        authContext,
      });

      if (outcome.kind !== 'OK') {
        return {
          success: false,
          code: outcome.code,
          message: outcome.message,
        };
      }

      return {
        success: true,
        units: outcome.units,
        message: outcome.message,
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  private runQuotationUnitAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<QuotationUnitMutationOutcome> {
    if (action === 'quotation-unit-list') {
      return this.quotationUnitAuthorityService.listUnits(authContext);
    }

    if (action === 'quotation-unit-save') {
      return this.quotationUnitAuthorityService.saveUnit(
        {
          recordId: readText(body.recordId) || null,
          name: readText(body.name),
          accountingCodeText: readText(body.accountingCodeText),
          isActive: readBoolean(body.isActive, true),
        },
        authContext,
      );
    }

    if (action === 'quotation-unit-deactivate') {
      const recordId = readText(body.recordId);

      if (recordId === '') {
        return Promise.resolve({
          kind: 'REFUSED',
          code: 'QUOTATION_UNIT_REQUIRED',
          message: 'واحد را انتخاب کنید',
        });
      }

      return this.quotationUnitAuthorityService.deactivateUnit(
        recordId,
        authContext,
      );
    }

    return Promise.resolve({
      kind: 'REFUSED',
      code: 'INVALID_INPUT',
      message: 'عملیات واحد شناخته نشد',
    });
  }

  private async handleQuotationCurrencyAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<unknown> {
    try {
      if (QUOTATION_CURRENCY_MUTATING_ACTIONS.has(action)) {
        const authority =
          await this.quotationCurrencyAuthorityService.resolveAuthority(
            authContext,
          );

        if (authority === null) {
          return {
            success: false,
            code: 'TAX_SETTINGS_FORBIDDEN',
            message: persianMessageForQuotationCode('TAX_SETTINGS_FORBIDDEN'),
          };
        }
      }

      const outcome = await this.runQuotationCurrencyAction({
        action,
        body,
        authContext,
      });

      if (outcome.kind !== 'OK') {
        return {
          success: false,
          code: outcome.code,
          message: outcome.message,
        };
      }

      const defaultCurrency =
        outcome.currencies.find(
          (currency) => currency.isActive && currency.isDefault,
        ) ??
        outcome.currencies.find((currency) => currency.isActive) ??
        null;

      return {
        success: true,
        currencies: outcome.currencies,
        defaultCode: defaultCurrency?.code ?? null,
        message: outcome.message,
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  private runQuotationCurrencyAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<QuotationCurrencyMutationOutcome> {
    if (action === 'quotation-currency-list') {
      return this.quotationCurrencyAuthorityService.listCurrencies(authContext);
    }

    if (action === 'quotation-currency-bootstrap') {
      return this.quotationCurrencyAuthorityService.bootstrap(authContext);
    }

    if (action === 'quotation-currency-save') {
      return this.quotationCurrencyAuthorityService.saveCurrency(
        {
          recordId: readText(body.recordId) || null,
          name: readText(body.name),
          accountingCodeText: readText(body.accountingCodeText),
          isActive: readBoolean(body.isActive, true),
          isDefault: body.isDefault === true,
        },
        authContext,
      );
    }

    const recordId = readText(body.recordId);

    if (recordId === '') {
      return Promise.resolve({
        kind: 'REFUSED',
        code: 'QUOTATION_CURRENCY_REQUIRED',
        message: 'ارز را انتخاب کنید',
      });
    }

    return this.quotationCurrencyAuthorityService.setDefaultCurrency(
      recordId,
      authContext,
    );
  }

  // The accounting surface separates two questions: "may this caller see the
  // destination?" (any member) and "may this caller change it?" (settings authority
  // only). This probe answers the second one so the page does not paint a form that
  // the server would reject, and returns the authority so the UI can explain why.
  private async handleAccountingSettingsAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<unknown> {
    try {
      const authority =
        await this.quotationPermissionService.resolveSettingsAuthority(
          authContext,
          'accountingConnection',
        );

      return {
        success: true,
        canManage: authority !== null,
        authority,
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  // The settings write for the accounting destination. A read is open to any member;
  // save and health persist re-decide the workspace role inside the service, so hiding
  // the form on the page is presentation, never the gate.
  private async handleAccountingConnectionAction({
    action,
    body,
    authContext,
  }: {
    action: string;
    body: QuotationUiActionBody;
    authContext: WorkspaceAuthContext;
  }): Promise<unknown> {
    try {
      if (action === 'accounting-connection-list') {
        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.listConnections(
            authContext,
          ),
          authContext,
        );
      }

      if (action === 'accounting-connection-save') {
        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.saveConnection(
            {
              recordId: readText(body.recordId) || readText(body.connectionId) || null,
              name: readText(body.name),
              adapterId: readText(body.adapterId),
              settings: body.settings,
            },
            authContext,
          ),
          authContext,
        );
      }

      if (action === 'accounting-connection-customer-price-list') {
        return this.accountingConnectionAuthorityService.resolveCustomerPriceList({
          partyType: readText(body.partyType), internalPartyId: readText(body.internalPartyId), connectionId: readText(body.connectionId) || undefined,
        }, authContext);
      }
      if (action === 'accounting-connection-map-customer-price-group') {
        return this.accountingConnectionAuthorityService.mapCustomerPriceGroup({
          connectionId: readText(body.connectionId), partyType: readText(body.partyType), internalPartyId: readText(body.internalPartyId),
          priceListId: readText(body.priceListId), expectedGroupId: readText(body.expectedGroupId),
        }, authContext);
      }

      if (action === 'accounting-connection-bind-dataset') {
        return this.describeAccountingOutcome(await this.accountingConnectionAuthorityService.bindDataset({
          recordId: readText(body.recordId), datasetId: readText(body.datasetId), expectedBaseUrl: readText(body.expectedBaseUrl),
          expectedRemoteUserId: readText(body.expectedRemoteUserId), confirmed: body.confirmed === true,
        }, authContext), authContext);
      }

      if (action === 'accounting-connection-set-default') {
        const recordId =
          readText(body.recordId) || readText(body.connectionId);

        if (recordId === '') {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: 'اتصال حسابداری را انتخاب کنید',
          };
        }

        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.setDefaultConnection(
            recordId,
            authContext,
          ),
          authContext,
        );
      }

      if (action === 'accounting-connection-deactivate') {
        const recordId =
          readText(body.recordId) || readText(body.connectionId);

        if (recordId === '') {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: 'اتصال حسابداری را انتخاب کنید',
          };
        }

        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.deactivateConnection(
            recordId,
            authContext,
          ),
          authContext,
        );
      }

      if (action === 'accounting-connection-reactivate') {
        const recordId =
          readText(body.recordId) || readText(body.connectionId);

        if (recordId === '') {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: 'اتصال حسابداری را انتخاب کنید',
          };
        }

        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.reactivateConnection(
            recordId,
            authContext,
          ),
          authContext,
        );
      }

      if (action === 'accounting-connection-test') {
        // The probe runs on the server. No `healthState`, message or timestamp is read from
        // the request, so an authorized caller cannot post a green result.
        return this.describeAccountingOutcome(
          await this.accountingConnectionAuthorityService.testConnection(
            readText(body.recordId) || readText(body.connectionId),
            authContext,
          ),
          authContext,
        );
      }

      return {
        success: false,
        code: 'INVALID_INPUT',
        message: 'عملیات اتصال حسابداری ناشناخته است',
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }

  private async describeAccountingOutcome(
    outcome: AccountingConnectionOutcome,
    authContext: WorkspaceAuthContext,
  ): Promise<unknown> {
    if (outcome.kind !== 'OK') {
      return {
        success: false,
        code: outcome.code,
        message: outcome.message,
      };
    }

    const authority =
      await this.accountingConnectionAuthorityService.resolveAuthority(
        authContext,
      );

    return {
      success: true,
      canManage: authority !== null,
      authority,
      connections: outcome.connections,
      // Only the server decides which adapters exist. The app supplies Persian
      // presentation labels after verifying this id/version/live contract.
      supportedAdapters: (['asan', 'mock'] as const).flatMap((id) => {
        const contract = accountingAdapterContract(id);

        return contract === null
          ? []
          : [{
              id,
              contractVersion: contract.contractVersion,
              isLive: contract.isLive,
            }];
      }),
      ...(outcome.affectedRecordId === undefined
        ? {}
        : { affectedRecordId: outcome.affectedRecordId }),
      ...(outcome.health === undefined ? {} : { health: outcome.health }),
      message: outcome.message,
    };
  }
}
