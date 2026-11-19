import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-update-one.pre-query.hook';
import { type QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';

describe('QuotationUpdateOnePreQueryHook', () => {
  it('delegates freeze checks and bumps the observed version', async () => {
    const assertQuotationUpdateAllowed = jest
      .fn()
      .mockResolvedValue(undefined);
    const hook = new QuotationUpdateOnePreQueryHook({
      assertQuotationUpdateAllowed,
    } as unknown as QuotationImmutabilityService);

    const payload = {
      id: 'q-1',
      data: { name: 'x', version: 4 },
    };

    await expect(
      hook.execute({} as never, 'quotation', payload),
    ).resolves.toEqual({
      id: 'q-1',
      data: { name: 'x', version: 5 },
    });

    expect(assertQuotationUpdateAllowed).toHaveBeenCalledWith({
      authContext: {},
      quotationId: 'q-1',
      patch: { name: 'x', version: 4 },
    });
  });

  it('surfaces immutability refusals', async () => {
    const hook = new QuotationUpdateOnePreQueryHook({
      assertQuotationUpdateAllowed: jest.fn().mockRejectedValue(
        new QuotationQueryValidationException(
          'QUOTATION_IMMUTABLE: frozen',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        ),
      ),
    } as unknown as QuotationImmutabilityService);

    await expect(
      hook.execute({} as never, 'quotation', {
        id: 'q-1',
        data: { name: 'x', version: 1 },
      }),
    ).rejects.toBeInstanceOf(QuotationQueryValidationException);
  });
});
