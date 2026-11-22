import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

// The connection record has exactly one writer: the quotation app's connection service,
// which validates the adapter, the address and the amount unit before anything is stored.
//
// WHY THE PUBLIC MUTATIONS ARE CLOSED: `accountingConnection` is a normal workspace
// object, so the platform generates create/update/delete/destroy/restore/merge for it.
// Those mutations would let a caller store an arbitrary base URL, flip the connection
// back to a "verified" state, or point the workspace at a destination whose adapter does
// not exist — none of which the settings surface allows. Writes therefore reach the
// record only through the app identity that owns the object, while a person's save goes
// through the settings route, where the workspace role is decided.
//
// The refusal names the allowed route, because "forbidden" without a next step is not an
// operator message.
@Injectable()
export class AccountingConnectionWriteGuardService {
  constructor(
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async assertMachineWriter(
    authContext: WorkspaceAuthContext,
    operation: string,
  ): Promise<void> {
    const authority = await this.quotationPermissionService.resolveSettingsAuthority(
      authContext,
      'accountingConnection',
    );

    // Only the owning application (the agent that builds and validates the record) and
    // the platform itself may write. A user or API key — however privileged — is turned
    // away: a direct write skips the adapter contract and the transport policy.
    if (authority === 'APPLICATION' || authority === 'SYSTEM') {
      return;
    }

    throw new QuotationQueryValidationException(
      `ACCOUNTING_CONNECTION_WRITE_FORBIDDEN: ${operation} on accountingConnection is not an API operation; the accounting destination changes only through the accounting-settings action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
