import { Injectable } from '@nestjs/common';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// quotationCurrency has exactly one writer: QuotationCurrencyAuthorityService.
@Injectable()
export class QuotationCurrencyWriteGuardService {
  refuseWrite(operation: string): never {
    throw new QuotationQueryValidationException(
      `QUOTATION_CURRENCY_WRITE_FORBIDDEN: ${operation} on quotationCurrency is not an API operation; currencies change only through the quotation-currency action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
