import { describe, expect, it } from 'vitest';

import {
  connectionFormFields,
  orderConnections,
  validateConnectionForm,
} from 'src/components/accounting/accounting-connection-rules';
import {
  EMPTY_FORM,
  type FinancialModes,
} from 'src/components/accounting/accounting-shared';

const modes = (overrides: Partial<FinancialModes> = {}): FinancialModes => ({
  taxHandling: 'TAX_RATE',
  dutyHandling: 'DUTY_RATE',
  currencyHandling: 'SINGLE_CURRENCY',
  baseCurrency: 'IRR',
  requiresSpecialItemCodes: false,
  ...overrides,
});

describe('connection list order', () => {
  const connections = [
    { id: 'a', name: 'اول' },
    { id: 'b', name: 'دوم' },
    { id: 'c', name: 'سوم' },
  ];

  it('pins the selected connection first and keeps the rest in server order', () => {
    expect(orderConnections(connections, 'c').map((entry) => entry.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('leaves the order untouched when nothing is selected', () => {
    expect(orderConnections(connections, null).map((entry) => entry.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('does not invent a row for a selection that no longer exists', () => {
    expect(orderConnections(connections, 'gone').map((entry) => entry.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps every connection, so nothing disappears when one is selected', () => {
    expect(orderConnections(connections, 'b')).toHaveLength(3);
  });
});

describe('fields rendered for each capability', () => {
  it('asks a single-currency destination for a base currency and no code table', () => {
    const fields = connectionFormFields(modes());

    expect(fields.baseCurrency).toBe(true);
    expect(fields.currencyCodeTable).toBe(false);
    expect(fields.conversionRate).toBe(false);
  });

  it('asks a code destination for a mapping and no base currency', () => {
    const fields = connectionFormFields(
      modes({ currencyHandling: 'CURRENCY_CODE' }),
    );

    expect(fields.baseCurrency).toBe(false);
    expect(fields.currencyCodeTable).toBe(true);
  });

  it('asks a name destination for a name table, not a code table', () => {
    const fields = connectionFormFields(
      modes({ currencyHandling: 'CURRENCY_NAME' }),
    );

    expect(fields.currencyNameTable).toBe(true);
    expect(fields.currencyCodeTable).toBe(false);
  });

  it('adds a conversion rate only when the contract reads one', () => {
    expect(
      connectionFormFields(modes({ currencyHandling: 'CURRENCY_CODE_AND_RATE' }))
        .conversionRate,
    ).toBe(true);
  });

  it('shows rates, not codes, to a rate destination', () => {
    const fields = connectionFormFields(modes({ taxHandling: 'TAX_RATE' }));

    expect(fields.taxCodeTable).toBe(false);
    expect(fields.taxRateTable).toBe(true);
  });

  it('shows rates, not codes, to an amount destination', () => {
    const fields = connectionFormFields(modes({ taxHandling: 'TAX_AMOUNT' }));

    expect(fields.taxCodeTable).toBe(false);
    expect(fields.taxRateTable).toBe(true);
  });

  it('shows the code table to both code destinations', () => {
    expect(
      connectionFormFields(modes({ taxHandling: 'TAX_CODE' })).taxCodeTable,
    ).toBe(true);
    expect(
      connectionFormFields(modes({ taxHandling: 'TAX_CODE_AND_AMOUNT' }))
        .taxCodeTable,
    ).toBe(true);
  });

  it('shows neither a rate table nor a code table when tax is unsupported', () => {
    const fields = connectionFormFields(modes({ taxHandling: 'UNSUPPORTED' }));

    expect(fields.taxUnsupported).toBe(true);
    expect(fields.taxCodeTable).toBe(false);
    expect(fields.taxRateTable).toBe(false);
    expect(fields.specialRowCodes).toBe(false);
  });

  it('asks for the installation row codes only when the destination posts such rows', () => {
    expect(
      connectionFormFields(
        modes({ taxHandling: 'TAX_AMOUNT', requiresSpecialItemCodes: true }),
      ).specialRowCodes,
    ).toBe(true);

    expect(
      connectionFormFields(
        modes({ taxHandling: 'TAX_RATE', requiresSpecialItemCodes: false }),
      ).specialRowCodes,
    ).toBe(false);
  });

  it('never asks for a second code table for duty', () => {
    // A code-based destination maps ONE code per policy; there is no duty-code field to
    // render for any contract.
    const fields = connectionFormFields(
      modes({ taxHandling: 'TAX_CODE', dutyHandling: 'DUTY_WITHIN_POLICY' }),
    );

    expect(fields.taxCodeTable).toBe(true);
    expect(fields.dutyWithinPolicy).toBe(true);
    expect(fields.dutyRateTable).toBe(false);
    expect(fields).not.toHaveProperty('dutyCodeTable');
  });
});

describe('duty fields rendered for each duty contract', () => {
  it('shows a duty rate table, and no code table, to a rate destination', () => {
    const fields = connectionFormFields(modes({ dutyHandling: 'DUTY_RATE' }));

    expect(fields.dutyRateTable).toBe(true);
    expect(fields.dutyUnsupported).toBe(false);
    expect(fields.dutyWithinPolicy).toBe(false);
  });

  it('shows a duty amount destination the rate table it reads the amount under', () => {
    const fields = connectionFormFields(modes({ dutyHandling: 'DUTY_AMOUNT' }));

    expect(fields.dutyRateTable).toBe(true);
    expect(fields.dutyWithinPolicy).toBe(false);
  });

  it('explains that one policy code covers duty instead of asking for a duty code', () => {
    const fields = connectionFormFields(
      modes({ dutyHandling: 'DUTY_WITHIN_POLICY' }),
    );

    expect(fields.dutyWithinPolicy).toBe(true);
    expect(fields.dutyRateTable).toBe(false);
    expect(fields.dutyAggregate).toBe(false);
    expect(fields).not.toHaveProperty('dutyCodeTable');
  });

  it('tells an aggregate destination about the combined field instead of a rate', () => {
    const fields = connectionFormFields(modes({ dutyHandling: 'AGGREGATE' }));

    expect(fields.dutyAggregate).toBe(true);
    expect(fields.dutyRateTable).toBe(false);
    expect(fields.dutyWithinPolicy).toBe(false);
  });

  it('marks duty unsupported without offering any duty field', () => {
    const fields = connectionFormFields(modes({ dutyHandling: 'UNSUPPORTED' }));

    expect(fields.dutyUnsupported).toBe(true);
    expect(fields.dutyRateTable).toBe(false);
    expect(fields.dutyWithinPolicy).toBe(false);
    expect(fields.specialRowCodes).toBe(false);
  });

  it('keeps the duty contract independent of the tax contract', () => {
    const fields = connectionFormFields(
      modes({ taxHandling: 'TAX_RATE', dutyHandling: 'DUTY_AMOUNT' }),
    );

    expect(fields.taxCodeTable).toBe(false);
    expect(fields.dutyRateTable).toBe(true);
  });
});

describe('saving a connection', () => {
  const form = (overrides: Partial<typeof EMPTY_FORM> = {}) => ({
    ...EMPTY_FORM,
    name: 'اتصال آسان',
    baseUrl: 'https://accounting.example',
    ...overrides,
  });

  it('refuses a blank name', () => {
    expect(
      validateConnectionForm({
        form: form({ name: '  ' }),
        adapterIsLive: true,
        modes: modes({ taxHandling: 'TAX_CODE' }),
      }).name,
    ).toBe('نام اتصال را وارد کنید.');
  });

  it('requires an absolute service address for a live adapter', () => {
    expect(
      validateConnectionForm({
        form: form({ baseUrl: 'accounting.example' }),
        adapterIsLive: true,
        modes: modes(),
      }).baseUrl,
    ).toContain('http://');
  });

  it('does not require a service address for the mock adapter', () => {
    expect(
      validateConnectionForm({
        form: form({ baseUrl: '' }),
        adapterIsLive: false,
        modes: modes(),
      }).baseUrl,
    ).toBeUndefined();
  });

  it('requires a base currency only where the destination reads one', () => {
    expect(
      validateConnectionForm({
        form: form({ baseCurrency: '' }),
        adapterIsLive: true,
        modes: modes({ currencyHandling: 'SINGLE_CURRENCY' }),
      }).baseCurrency,
    ).toBeDefined();

    expect(
      validateConnectionForm({
        form: form({ baseCurrency: '' }),
        adapterIsLive: true,
        modes: modes({ currencyHandling: 'CURRENCY_CODE' }),
      }).baseCurrency,
    ).toBeUndefined();
  });

  it('checks a conversion rate only where the destination reads one', () => {
    expect(
      validateConnectionForm({
        form: form({ conversionRate: '1.2345678' }),
        adapterIsLive: true,
        modes: modes({ currencyHandling: 'CURRENCY_CODE_AND_RATE' }),
      }).conversionRate,
    ).toBeDefined();

    expect(
      validateConnectionForm({
        form: form({ conversionRate: '1.2345678' }),
        adapterIsLive: true,
        modes: modes({ currencyHandling: 'SINGLE_CURRENCY' }),
      }).conversionRate,
    ).toBeUndefined();
  });

  it('never blocks a save on a missing tax mapping, which is a send-time refusal', () => {
    expect(
      validateConnectionForm({
        form: form({ taxPolicyMappingsText: '' }),
        adapterIsLive: true,
        modes: modes({ taxHandling: 'TAX_CODE' }),
      }),
    ).toEqual({});
  });
});
