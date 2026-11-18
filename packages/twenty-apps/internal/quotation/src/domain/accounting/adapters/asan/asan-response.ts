// Asan answers every write with a BARE INTEGER, and the same integer means different things
// on different endpoints. The guide is explicit about three cases and silent about the
// rest, so the parser below classifies what is documented and refuses to guess at what is
// not.
//
// The dangerous property: `0` means "not registered", and a caller that treats a truthy
// check (`if (result)`) or a falsy check (`if (!result)`) without knowing this will either
// report a failed write as successful or a successful one as failed.
export const ASAN_RESPONSE_CODES = {
  // Factor and pro-forma registration: the registered document number, or 0 for failure.
  DOCUMENT_NOT_REGISTERED: 0,
  // Customer creation/update: 1 for automatic code, 0 for a caller-supplied code.
  CUSTOMER_OK: 1,
  // Customers2/postCustomer with PersonCode = 0: nothing to update.
  CUSTOMER_UPDATE_NO_CODE: -10,
  // ParentCustomers/postCustomer: the sub-group (last three digits 999) is full.
  CUSTOMER_GROUP_FULL: -1,
  // OriginalPrice was sent and at least one item code is not 3, 6 or 9 digits long.
  ORIGINAL_PRICE_ITEM_CODE_INVALID: -369,
} as const;

export type AsanOperation = 'REGISTER_PROFORMA' | 'CREATE_CUSTOMER' | 'UPDATE_CUSTOMER';

export type AsanResponseClassification =
  // A positive document number: the only proof the remote actually stored the document.
  | { kind: 'DOCUMENT_REGISTERED'; documentNumber: number }
  | { kind: 'SUCCEEDED_WITHOUT_IDENTIFIER'; note: string }
  | { kind: 'FAILED'; code: number; reason: AsanFailureReason; retrySafe: boolean }
  | { kind: 'UNEXPECTED'; code: number; detail: string };

export type AsanFailureReason =
  | 'DOCUMENT_NOT_REGISTERED'
  | 'CUSTOMER_LEADING_CODE_IGNORED'
  | 'CUSTOMER_GROUP_FULL'
  | 'ORIGINAL_PRICE_ITEM_CODE_INVALID';

// Whether re-sending the SAME request is safe. Everything that failed a validation is safe
// to retry after the data is corrected. A `0` from a registration is NOT safe: the guide
// gives the same answer for "customer missing" and for an unspecified failure, so the
// document may or may not exist and must be reconciled before a second attempt.
const RETRY_SAFETY: Record<AsanFailureReason, boolean> = {
  DOCUMENT_NOT_REGISTERED: false,
  CUSTOMER_LEADING_CODE_IGNORED: true,
  CUSTOMER_GROUP_FULL: true,
  ORIGINAL_PRICE_ITEM_CODE_INVALID: true,
};

const REASON_OF: Record<number, AsanFailureReason> = {
  0: 'DOCUMENT_NOT_REGISTERED',
  [-10]: 'CUSTOMER_LEADING_CODE_IGNORED',
  [-1]: 'CUSTOMER_GROUP_FULL',
  [-369]: 'ORIGINAL_PRICE_ITEM_CODE_INVALID',
};

export const classifyAsanResponse = ({
  operation,
  rawCode,
}: {
  operation: AsanOperation;
  // Asan returns a JSON number; a string is accepted too because some proxies and older
  // gateways quote numerics.
  rawCode: unknown;
}): AsanResponseClassification => {
  const code = typeof rawCode === 'string' ? Number(rawCode) : rawCode;

  if (typeof code !== 'number' || !Number.isFinite(code)) {
    return {
      kind: 'UNEXPECTED',
      code: Number.NaN,
      detail: 'the response was not a number',
    };
  }

  if (operation === 'REGISTER_PROFORMA') {
    if (code > 0 && Number.isSafeInteger(code)) {
      return { kind: 'DOCUMENT_REGISTERED', documentNumber: code };
    }

    const reason = REASON_OF[code];

    if (reason === undefined) {
      return {
        kind: 'UNEXPECTED',
        code,
        detail: 'an undocumented code came back from registration',
      };
    }

    return { kind: 'FAILED', code, reason, retrySafe: RETRY_SAFETY[reason] };
  }

  // Customer endpoints answer 1 or 0 for success, and a negative number for a refusal. The
  // response is a RESULT FLAG, never an identifier, which is exactly why the capabilities
  // declare `returnsAssignedCode: false`.
  if (code >= 0) {
    return {
      kind: 'SUCCEEDED_WITHOUT_IDENTIFIER',
      note:
        'the code is a result flag, not the assigned PersonCode; re-read the customer to learn it',
    };
  }

  const reason = REASON_OF[code];

  if (reason === undefined) {
    return {
      kind: 'UNEXPECTED',
      code,
      detail: 'an undocumented code came back from a customer write',
    };
  }

  return { kind: 'FAILED', code, reason, retrySafe: RETRY_SAFETY[reason] };
};

// Asan rejects a body carrying `OriginalPrice` unless EVERY item code is 3, 6 or 9 digits
// long (-369). Since special codes such as 999123 are 6 digits but a linked product code
// may be 4, the only safe policy is never to send OriginalPrice. Encoded as a decision so
// it is testable instead of a comment someone can miss.
export const shouldSendOriginalPrice = (): false => false;

export const isAsanItemCodeLengthValid = (code: string): boolean =>
  /^\d{3}$/.test(code) || /^\d{6}$/.test(code) || /^\d{9}$/.test(code);
