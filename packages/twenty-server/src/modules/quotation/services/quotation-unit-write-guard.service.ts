import { Injectable } from '@nestjs/common';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// quotationUnit has exactly one writer: QuotationUnitAuthorityService.
@Injectable()
export class QuotationUnitWriteGuardService {
  refuseWrite(operation: string): never {
    throw new QuotationQueryValidationException(
      `QUOTATION_UNIT_WRITE_FORBIDDEN: ${operation} on quotationUnit is not an API operation; units change only through the quotation-unit action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}