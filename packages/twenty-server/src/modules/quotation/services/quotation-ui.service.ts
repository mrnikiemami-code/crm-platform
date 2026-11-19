import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  canEditQuotationContent,
  findQuotationTransition,
  isQuotationStatusTerminal,
  parseQuotationVersion,
  type QuotationPermission,
} from 'src/modules/quotation/utils/quotation-immutability.util';
import {
  extractQuotationErrorCode,
  persianMessageForQuotationCode,
} from 'src/modules/quotation/utils/quotation-ui-messages.util';

type QuotationLifecycleRow = {
  id: string;
  status: string;
  version: number | null;
  name: string | null;
  quotationNumber: string | null;
};

export type QuotationLifecycleAction = {
  toStatus: string;
  label: string;
  requiredPermission: QuotationPermission;
  enabled: boolean;
};

export type QuotationLifecycleSnapshot = {
  quotationId: string;
  status: string;
  version: number;
  name: string | null;
  quotationNumber: string | null;
  contentEditable: boolean;
  contentLocked: boolean;
  isTerminal: boolean;
  heldPermissions: QuotationPermission[];
  actions: QuotationLifecycleAction[];
  // SENT means "send recorded" — no outbound channel is claimed here.
  sentMeansRecordOnly: true;
};

const ACTION_LABELS: Record<string, string> = {
  'DRAFT->PENDING_INTERNAL_APPROVAL': 'ارسال برای تأیید',
  'PENDING_INTERNAL_APPROVAL->DRAFT': 'بازگرداندن برای اصلاح',
  'PENDING_INTERNAL_APPROVAL->READY_TO_SEND': 'تأیید و آماده ارسال',
  'READY_TO_SEND->SENT': 'ثبت ارسال به مشتری',
  'SENT->CUSTOMER_ACCEPTED': 'ثبت پذیرش مشتری',
  'SENT->CUSTOMER_REJECTED': 'ثبت رد مشتری',
  'DRAFT->CANCELLED': 'لغو',
  'PENDING_INTERNAL_APPROVAL->CANCELLED': 'لغو',
  'READY_TO_SEND->CANCELLED': 'لغو',
  'SENT->CANCELLED': 'لغو',
};

const LEGAL_TARGETS_BY_FROM: Record<string, string[]> = {
  DRAFT: ['PENDING_INTERNAL_APPROVAL', 'CANCELLED'],
  PENDING_INTERNAL_APPROVAL: ['DRAFT', 'READY_TO_SEND', 'CANCELLED'],
  READY_TO_SEND: ['SENT', 'CANCELLED'],
  SENT: ['CUSTOMER_ACCEPTED', 'CUSTOMER_REJECTED', 'CANCELLED'],
};

@Injectable()
export class QuotationUiService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
    private readonly quotationImmutabilityService: QuotationImmutabilityService,
  ) {}

  async getLifecycle({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<QuotationLifecycleSnapshot> {
    const [row, heldPermissions] = await Promise.all([
      this.readRow(authContext, quotationId),
      this.quotationPermissionService.resolveHeldPermissions(authContext),
    ]);

    const version = parseQuotationVersion(row.version);

    if (version === null) {
      throw new QuotationQueryValidationException(
        'QUOTATION_VERSION_REQUIRED: version is unreadable; reload and retry',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const contentEditable = canEditQuotationContent(row.status);
    const actions = this.buildActions(row.status, heldPermissions);

    return {
      quotationId: row.id,
      status: row.status,
      version,
      name: row.name,
      quotationNumber: row.quotationNumber,
      contentEditable,
      contentLocked: !contentEditable,
      isTerminal: isQuotationStatusTerminal(row.status),
      heldPermissions: [...heldPermissions],
      actions,
      sentMeansRecordOnly: true,
    };
  }

  async transition({
    authContext,
    quotationId,
    toStatus,
    version,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    toStatus: string;
    version: number;
  }): Promise<{
    quotationId: string;
    status: string;
    version: number;
    message: string;
  }> {
    const row = await this.readRow(authContext, quotationId);
    const observedVersion = parseQuotationVersion(version);

    if (observedVersion === null) {
      throw new QuotationQueryValidationException(
        'QUOTATION_VERSION_REQUIRED: version is required when changing a quotation; reload and retry',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const patch: Record<string, unknown> = {
      status: toStatus,
      version: observedVersion,
    };

    if (toStatus === 'SENT' && row.status === 'READY_TO_SEND') {
      patch.sentAt = new Date().toISOString();
    }

    if (
      (toStatus === 'CUSTOMER_ACCEPTED' || toStatus === 'CUSTOMER_REJECTED') &&
      row.status === 'SENT'
    ) {
      patch.decidedAt = new Date().toISOString();
    }

    await this.quotationImmutabilityService.assertQuotationUpdateAllowed({
      authContext,
      quotationId,
      patch,
    });

    const refreshed = await this.readRow(authContext, quotationId);
    const nextVersion = parseQuotationVersion(refreshed.version);

    if (nextVersion === null) {
      throw new QuotationQueryValidationException(
        'QUOTATION_VERSION_REQUIRED: version is unreadable after transition',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const actionKey = `${row.status}->${toStatus}`;
    const label = ACTION_LABELS[actionKey] ?? 'تغییر وضعیت';

    return {
      quotationId,
      status: refreshed.status,
      version: nextVersion,
      message: `${label} انجام شد.`,
    };
  }

  toPersianFailure(error: unknown): {
    success: false;
    code: string;
    message: string;
  } {
    if (error instanceof QuotationQueryValidationException) {
      const code =
        extractQuotationErrorCode(error.message) ??
        String(error.code ?? 'FORBIDDEN');

      return {
        success: false,
        code,
        message: persianMessageForQuotationCode(code, error.message),
      };
    }

    if (error instanceof Error) {
      const code = extractQuotationErrorCode(error.message) ?? 'UNEXPECTED';

      return {
        success: false,
        code,
        message: persianMessageForQuotationCode(code, error.message),
      };
    }

    return {
      success: false,
      code: 'UNEXPECTED',
      message: persianMessageForQuotationCode('UNEXPECTED'),
    };
  }

  private buildActions(
    fromStatus: string,
    heldPermissions: readonly QuotationPermission[],
  ): QuotationLifecycleAction[] {
    const targets = LEGAL_TARGETS_BY_FROM[fromStatus] ?? [];

    return targets.flatMap((toStatus) => {
      const transition = findQuotationTransition(fromStatus, toStatus);

      if (!isDefined(transition)) {
        return [];
      }

      const key = `${fromStatus}->${toStatus}`;

      return [
        {
          toStatus,
          label: ACTION_LABELS[key] ?? toStatus,
          requiredPermission: transition.requiredPermission,
          enabled: heldPermissions.includes(transition.requiredPermission),
        },
      ];
    });
  }

  private async readRow(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<QuotationLifecycleRow> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        this.workspaceOrmManager.getRepository<QuotationLifecycleRow>(
          'quotation',
          { shouldBypassPermissionChecks: true },
        );
      const row = await repository.findOne({
        where: { id: quotationId },
        select: {
          id: true,
          status: true,
          version: true,
          name: true,
          quotationNumber: true,
        },
      });

      if (!isDefined(row) || typeof row.status !== 'string') {
        throw new QuotationQueryValidationException(
          'QUOTATION_NOT_FOUND: quotation not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      return row;
    }, authContext);
  }
}
