import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';

@Injectable()
@WorkspaceQueryHook('quotationLine.createMany')
export class QuotationLineCreateManyPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly quotationImmutabilityService: QuotationImmutabilityService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateManyResolverArgs<Record<string, unknown>>,
  ): Promise<CreateManyResolverArgs<Record<string, unknown>>> {
    const rows = Array.isArray(payload.data) ? payload.data : [];

    for (const row of rows) {
      const quotationId = row?.quotationId;

      if (typeof quotationId !== 'string' || quotationId.length === 0) {
        throw new QuotationQueryValidationException(
          'quotationId is required to create a quotation line',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      await this.quotationImmutabilityService.assertQuotationLineMutationAllowed({
        authContext,
        quotationId,
      });
    }

    return payload;
  }
}
