import { Injectable } from '@nestjs/common';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// roundingRule has exactly one writer: RoundingRuleAuthorityService.
@Injectable()
export class RoundingRuleWriteGuardService {
  refuseWrite(operation: string): never {
    throw new QuotationQueryValidationException(
      `ROUNDING_RULE_WRITE_FORBIDDEN: ${operation} on roundingRule is not an API operation; rules change only through the rounding-rule action`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
