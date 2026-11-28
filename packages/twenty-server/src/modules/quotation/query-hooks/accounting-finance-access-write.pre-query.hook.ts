import { Injectable } from '@nestjs/common';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateOneResolverArgs, type CreateManyResolverArgs, type UpdateOneResolverArgs, type UpdateManyResolverArgs, type DeleteOneResolverArgs, type DeleteManyResolverArgs, type DestroyOneResolverArgs, type DestroyManyResolverArgs, type RestoreOneResolverArgs, type RestoreManyResolverArgs, type MergeManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationQueryValidationException, QuotationQueryValidationExceptionCode } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.createOne')
export class AccountingFinanceAccessCreateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: CreateOneResolverArgs): Promise<CreateOneResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.createMany')
export class AccountingFinanceAccessCreateManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: CreateManyResolverArgs): Promise<CreateManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.updateOne')
export class AccountingFinanceAccessUpdateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: UpdateOneResolverArgs): Promise<UpdateOneResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.updateMany')
export class AccountingFinanceAccessUpdateManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: UpdateManyResolverArgs): Promise<UpdateManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.deleteOne')
export class AccountingFinanceAccessDeleteOnePreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: DeleteOneResolverArgs): Promise<DeleteOneResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.deleteMany')
export class AccountingFinanceAccessDeleteManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: DeleteManyResolverArgs): Promise<DeleteManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.destroyOne')
export class AccountingFinanceAccessDestroyOnePreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: DestroyOneResolverArgs): Promise<DestroyOneResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.destroyMany')
export class AccountingFinanceAccessDestroyManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: DestroyManyResolverArgs): Promise<DestroyManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.restoreOne')
export class AccountingFinanceAccessRestoreOnePreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: RestoreOneResolverArgs): Promise<RestoreOneResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.restoreMany')
export class AccountingFinanceAccessRestoreManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: RestoreManyResolverArgs): Promise<RestoreManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}

@Injectable()
@WorkspaceQueryHook('accountingFinanceAccess.mergeMany')
export class AccountingFinanceAccessMergeManyPreQueryHook implements WorkspacePreQueryHookInstance {
  async execute(_authContext: WorkspaceAuthContext, _objectName: string, _payload: MergeManyResolverArgs): Promise<MergeManyResolverArgs> {
    throw new QuotationQueryValidationException('ACCOUNTING_FINANCE_ACCESS_WRITE_FORBIDDEN', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}
