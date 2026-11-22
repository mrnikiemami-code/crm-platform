import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// The connection record has exactly one writer: `AccountingConnectionAuthorityService`.
//
// WHY EVERY PRINCIPAL IS CLOSED, INCLUDING THE OWNING APP: `accountingConnection` is a
// normal workspace object, so the platform generates create/update/delete/destroy/restore/
// merge for it. A write through those mutations skips the adapter contract, the transport
// policy and the settings-role decision; letting the owning application through would make
// the "one writer" claim false, because any member's front component can borrow the app's
// identity. The app therefore writes through the REST settings route too, where the
// person's workspace role is resolved.
//
// WHY THE PLATFORM RUNTIME IS CLOSED: nothing in installation or metadata sync writes
// connection records; the only system caller would be a future one, and it must make the
// same policy decision instead of bypassing it.
@Injectable()
export class AccountingConnectionWriteGuardService {
  async assertMachineWriter(
    _authContext: WorkspaceAuthContext,
    operation: string,
  ): Promise<void> {
    throw new QuotationQueryValidationException(
      `ACCOUNTING_CONNECTION_WRITE_FORBIDDEN: ${operation} on accountingConnection is not an API operation; the accounting destination changes only through the accounting-settings action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
