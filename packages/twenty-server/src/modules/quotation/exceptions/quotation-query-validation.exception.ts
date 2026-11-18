import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { assertUnreachable } from 'twenty-shared/utils';

import { CustomException } from 'src/utils/custom-exception';

export enum QuotationQueryValidationExceptionCode {
  FORBIDDEN = 'FORBIDDEN',
}

const getQuotationQueryValidationExceptionUserFriendlyMessage = (
  code: QuotationQueryValidationExceptionCode,
) => {
  switch (code) {
    case QuotationQueryValidationExceptionCode.FORBIDDEN:
      return msg`This quotation can no longer be changed. Create a new revision instead.`;
    default:
      assertUnreachable(code);
  }
};

export class QuotationQueryValidationException extends CustomException<QuotationQueryValidationExceptionCode> {
  constructor(
    message: string,
    code: QuotationQueryValidationExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: MessageDescriptor } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ??
        getQuotationQueryValidationExceptionUserFriendlyMessage(code),
    });
  }
}
