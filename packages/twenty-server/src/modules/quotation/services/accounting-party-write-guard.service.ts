import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { QuotationQueryValidationException, QuotationQueryValidationExceptionCode } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

const QUOTATION_APP = 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const COMMON = ['name', 'nationalCode', 'economicCode', 'accountingPhone', 'accountingSecondPhone', 'accountingFax'];
export const ACCOUNTING_PARTY_CUSTOMER_FIELDS = {
  person: new Set([...COMMON, 'phones', 'emails', 'accountingAddress']),
  company: new Set([...COMMON, 'accountingMobile', 'address', 'registrationNumber', 'accountingEmail']),
};

type CustomerObject = keyof typeof ACCOUNTING_PARTY_CUSTOMER_FIELDS;
type NativeWriteScope = {
  authContext: Extract<WorkspaceAuthContext, { type: 'user' }>;
  object: CustomerObject;
  action: 'createOne' | 'updateOne';
  recordId: string;
};
const nativeWriteScope = new AsyncLocalStorage<NativeWriteScope>();

// Only the native business command can establish this in-process scope. It
// is bound to the exact authenticated context, object, operation and record;
// it is neither a header, a JWT claim nor a user-controlled payload field.
export const withAccountingPartyWriteScope = <T>(
  scope: NativeWriteScope,
  work: () => Promise<T>,
): Promise<T> => nativeWriteScope.run(scope, work);

// Compare the actor's data contract, not realm-specific prototypes. Jest's
// structuredClone can produce objects from a different realm. No missing,
// additional or altered stamp fields are accepted.
export const matchesAccountingActorStamp = (value: unknown, expected: ReturnType<typeof buildCreatedByFromFullNameMetadata>): boolean => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = value as Record<string, unknown>;
  const keys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (keys.length !== expectedKeys.length || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(actual, key))) return false;
  const context = actual.context;
  return actual.workspaceMemberId === expected.workspaceMemberId &&
    actual.name === expected.name && actual.source === expected.source &&
    context !== null && typeof context === 'object' && !Array.isArray(context) &&
    Object.keys(context).length === 0;
};

type GuardReason =
  | 'NATIVE_SCOPE_REQUIRED'
  | 'INVALID_MUTATION'
  | 'FIELD_NOT_ALLOWED'
  | 'ACTOR_MISMATCH'
  | 'SETTINGS_AUTHORITY_REQUIRED';

export class AccountingPartyWriteGuardException extends QuotationQueryValidationException {
  constructor(readonly reason: GuardReason) {
    super(
      'ACCOUNTING_PARTY_WRITE_FORBIDDEN: ' + reason,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
      { userFriendlyMessage: { id: 'دسترسی ثبت یا ویرایش مشتری حسابداری وجود ندارد.', message: 'دسترسی ثبت یا ویرایش مشتری حسابداری وجود ندارد.' } },
    );
  }
}

@Injectable()
export class AccountingPartyWriteGuardService {
  constructor(private readonly permissions: QuotationPermissionService) {}

  async assertAllowed(
    auth: WorkspaceAuthContext,
    object: CustomerObject,
    action: string,
    payload: { id?: unknown; data?: unknown; upsert?: boolean; shareWith?: unknown },
  ): Promise<void> {
    const app = auth.type === 'application' ? auth.application : auth.type === 'user' ? auth.application ?? auth.viaApplication : undefined;
    if (app?.universalIdentifier !== QUOTATION_APP) return;

    const scope = nativeWriteScope.getStore();
    if (auth.type !== 'user' || !scope || scope.authContext !== auth ||
        scope.object !== object || scope.action !== action) {
      throw new AccountingPartyWriteGuardException('NATIVE_SCOPE_REQUIRED');
    }
    const data = payload.data;
    if ((action !== 'createOne' && action !== 'updateOne') ||
        payload.upsert === true || (payload.shareWith != null && (!Array.isArray(payload.shareWith) || payload.shareWith.length > 0)) ||
        data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new AccountingPartyWriteGuardException('INVALID_MUTATION');
    }
    const fields = data as Record<string, unknown>;
    if ((action === 'createOne' ? fields.id : payload.id) !== scope.recordId) {
      throw new AccountingPartyWriteGuardException('INVALID_MUTATION');
    }

    // WorkspaceQueryHookStorage executes wildcard hooks first. The core
    // ActorFromAuthContextService has already populated these fields, so the
    // guard must distinguish its authentic actor stamp from business input.
    // The raw native plan explicitly prohibits both audit and owner fields.
    const expectedActor = buildCreatedByFromFullNameMetadata({
      fullNameMetadata: auth.workspaceMember.name,
      workspaceMemberId: auth.workspaceMemberId,
    });
    for (const [key, value] of Object.entries(fields)) {
      if (ACCOUNTING_PARTY_CUSTOMER_FIELDS[object].has(key)) continue;
      if (key === 'updatedBy' || (key === 'createdBy' && action === 'createOne')) {
        if (!matchesAccountingActorStamp(value, expectedActor)) throw new AccountingPartyWriteGuardException('ACTOR_MISMATCH');
        continue;
      }
      if (action === 'createOne' && (key === 'id' ||
          (key === 'position' && typeof value === 'number' && Number.isFinite(value)) ||
          // If the record-access hook runs first, its only permitted owner
          // stamp is the acting member on a newly created Person.
          (object === 'person' && key === 'assigneeId' && value === auth.workspaceMemberId))) continue;
      throw new AccountingPartyWriteGuardException('FIELD_NOT_ALLOWED');
    }
    if (await this.permissions.resolveSettingsAuthority(auth, 'accountingConnection') === null) {
      throw new AccountingPartyWriteGuardException('SETTINGS_AUTHORITY_REQUIRED');
    }
    // Native runners still enforce the real user/app role intersection, field
    // writability, record sharing and RLS. No generic app write is authorized.
  }
}
