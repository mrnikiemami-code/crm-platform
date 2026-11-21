import { Injectable } from '@nestjs/common';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// A sealed revision is written by the approval transaction and by nothing else. The
// database keeps no immutability rule, so the API is where a stray mutation is turned
// away; the hash on the stored row makes any bypass that reaches the table detectable.
@Injectable()
export class QuotationRevisionWriteGuardService {
  refuseWrite(operation: string): never {
    throw new QuotationQueryValidationException(
      `REVISION_IMMUTABLE: a sealed revision cannot be ${operation}; issue the quotation again to seal a new revision`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
