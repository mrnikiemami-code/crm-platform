import { Injectable } from '@nestjs/common';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// The tax-policy table has exactly one writer: `TaxPolicyAuthorityService`.
//
// WHY THE API IS CLOSED: `taxPolicy` is a normal workspace object, so the platform
// generates create/update/delete/destroy/restore mutations for it. Those mutations do
// not know about the workspace role, the single-default invariant or the transaction
// that keeps a stored document's rate coherent, and the object's `isUIEditable:false`
// flag only hides the editor in the browser. Every such mutation is turned away here,
// before a repository is touched. Internal writes are unaffected: the authority
// service goes straight to the ORM inside its own transaction and never calls the API.
@Injectable()
export class TaxPolicyWriteGuardService {
  refuseWrite(operation: string): never {
    throw new QuotationQueryValidationException(
      `TAX_POLICY_WRITE_FORBIDDEN: ${operation} on taxPolicy is not an API operation; tax policies change only through the tax-settings action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
