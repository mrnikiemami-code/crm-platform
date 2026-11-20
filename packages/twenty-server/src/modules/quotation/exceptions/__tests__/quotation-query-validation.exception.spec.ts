import { i18n } from '@lingui/core';

import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// The toast renders the descriptor, so what it will say is what i18n._ returns.
const toastOf = (exception: QuotationQueryValidationException): string =>
  i18n._(exception.userFriendlyMessage);

const lockException = (message: string) =>
  new QuotationQueryValidationException(
    message,
    QuotationQueryValidationExceptionCode.FORBIDDEN,
  );

describe('QuotationQueryValidationException', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  it('shows Persian copy for a locked quotation without the machine code', () => {
    const toast = toastOf(
      lockException(
        'QUOTATION_IMMUTABLE: quotation content is immutable after send readiness; create a new revision instead',
      ),
    );

    expect(toast).toContain('قفل');
    expect(toast).not.toContain('QUOTATION_IMMUTABLE');
  });

  it('keeps the English message with its code for the logs', () => {
    const exception = lockException(
      'QUOTATION_VERSION_CONFLICT: quotation was changed concurrently; reload the current version and retry',
    );

    expect(exception.message).toContain('QUOTATION_VERSION_CONFLICT');
    expect(toastOf(exception)).toContain('هم‌زمان');
    expect(toastOf(exception)).not.toContain('QUOTATION_VERSION_CONFLICT');
  });

  it('answers in Persian when the failure carries no recognisable code', () => {
    const toast = toastOf(lockException('something nobody classified'));

    expect(toast).toContain('پیش‌فاکتور');
  });

  it('lets a caller override the toast copy', () => {
    const exception = new QuotationQueryValidationException(
      'QUOTATION_NOT_FOUND: quotation not found',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
      { userFriendlyMessage: { id: 'پیش‌فاکتور حذف شده است.', message: 'پیش‌فاکتور حذف شده است.' } },
    );

    expect(toastOf(exception)).toBe('پیش‌فاکتور حذف شده است.');
  });
});
