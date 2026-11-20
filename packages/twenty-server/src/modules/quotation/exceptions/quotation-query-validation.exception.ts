import { type MessageDescriptor } from '@lingui/core';

import {
  extractQuotationErrorCode,
  persianMessageForQuotationCode,
} from 'src/modules/quotation/utils/quotation-ui-messages.util';
import { CustomException } from 'src/utils/custom-exception';

export enum QuotationQueryValidationExceptionCode {
  FORBIDDEN = 'FORBIDDEN',
}

// Twenty renders userFriendlyMessage in the toast and keeps `message` for the
// logs, so the two must not be the same string: the message stays English with
// its machine-readable code, the toast is Persian without that code.
const FALLBACK_PERSIAN_MESSAGE =
  'این پیش‌فاکتور قابل تغییر نیست. برای تغییر، نسخهٔ جدید صادر کنید.';

const getQuotationQueryValidationExceptionUserFriendlyMessage = (
  message: string,
): MessageDescriptor => {
  const semanticCode = extractQuotationErrorCode(message);
  const persianMessage =
    semanticCode === null
      ? FALLBACK_PERSIAN_MESSAGE
      : persianMessageForQuotationCode(semanticCode, FALLBACK_PERSIAN_MESSAGE);

  return { id: persianMessage, message: persianMessage };
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
        getQuotationQueryValidationExceptionUserFriendlyMessage(message),
    });
  }
}
