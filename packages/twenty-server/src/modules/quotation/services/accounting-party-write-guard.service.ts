import { Injectable } from '@nestjs/common';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { QuotationQueryValidationException, QuotationQueryValidationExceptionCode } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

const QUOTATION_APP = 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const COMMON = ['name', 'nationalCode', 'economicCode', 'accountingPhone', 'accountingSecondPhone', 'accountingFax'];
const FIELDS = {
  person: new Set([...COMMON, 'phones', 'emails', 'address']),
  company: new Set([...COMMON, 'accountingMobile', 'address', 'registrationNumber', 'accountingEmail']),
};

@Injectable()
export class AccountingPartyWriteGuardService {
  constructor(private readonly permissions: QuotationPermissionService) {}

  async assertAllowed(auth: WorkspaceAuthContext, object: 'person' | 'company', action: string, payload: { data?: unknown; upsert?: boolean; shareWith?: unknown }): Promise<void> {
    const app = auth.type === 'application' ? auth.application : auth.type === 'user' ? auth.application ?? auth.viaApplication : undefined;
    if (app?.universalIdentifier !== QUOTATION_APP) return;
    const data = payload.data;
    if (auth.type !== 'user' ||
        (action !== 'createOne' && action !== 'updateOne') ||
        payload.upsert === true || (payload.shareWith != null && (!Array.isArray(payload.shareWith) || payload.shareWith.length > 0)) ||
        data === null || typeof data !== 'object' || Array.isArray(data) ||
        Object.keys(data).some((key) => !FIELDS[object].has(key) && !(action === 'createOne' && (key === 'id' || (key === 'position' && typeof (data as Record<string, unknown>).position === 'number' && Number.isFinite((data as Record<string, unknown>).position))))) ||
        await this.permissions.resolveSettingsAuthority(auth, 'accountingConnection') === null) {
      throw new QuotationQueryValidationException(
        'ACCOUNTING_PARTY_WRITE_FORBIDDEN: delegated accounting customer write required',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
        { userFriendlyMessage: { id: 'دسترسی ثبت یا ویرایش مشتری حسابداری وجود ندارد.', message: 'دسترسی ثبت یا ویرایش مشتری حسابداری وجود ندارد.' } },
      );
    }
    // The standard ORM subsequently enforces the user/application role
    // intersection, field permissions and row visibility.
  }
}
