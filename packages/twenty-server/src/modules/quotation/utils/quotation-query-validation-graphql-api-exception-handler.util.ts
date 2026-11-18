import { assertUnreachable } from 'twenty-shared/utils';

import { ForbiddenError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import {
  type QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

export const quotationQueryValidationGraphqlApiExceptionHandler = (
  exception: QuotationQueryValidationException,
) => {
  switch (exception.code) {
    case QuotationQueryValidationExceptionCode.FORBIDDEN:
      throw new ForbiddenError(exception);
    default: {
      assertUnreachable(exception.code);
    }
  }
};
