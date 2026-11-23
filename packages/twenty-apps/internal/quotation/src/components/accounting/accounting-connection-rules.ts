import {
  type FinancialModes,
  type FormState,
} from 'src/components/accounting/accounting-shared';

// The decisions the connections screen makes, kept out of the markup so each one can be
// tested without rendering the panel.
//
// Nothing here decides a capability: `modes` is resolved from what the server declared for
// the adapter (or from the mock profile stored on the connection). These functions only turn
// that declaration into what the form shows and refuses, so a screen can never invent a
// requirement the destination does not have.

// The selected destination is always the first row. Decided by id, never by position, so a
// refresh cannot move the «انتخاب‌شده» word onto a different row.
export const orderConnections = <TConnection extends { id: string }>(
  connections: readonly TConnection[],
  selectedId: string | null,
): TConnection[] => {
  if (selectedId === null) {
    return [...connections];
  }

  const selected = connections.filter((entry) => entry.id === selectedId);
  const rest = connections.filter((entry) => entry.id !== selectedId);

  return [...selected, ...rest];
};

// Which fields exist for this destination. A field that is absent for the adapter is not
// rendered at all: a disabled box invites someone to believe a value will be read.
export type ConnectionFormFields = {
  baseCurrency: boolean;
  currencyCodeTable: boolean;
  currencyNameTable: boolean;
  conversionRate: boolean;
  taxCodeTable: boolean;
  taxRateTable: boolean;
  specialTaxRowCode: boolean;
  taxUnsupported: boolean;
  currencyUnsupported: boolean;
};

export const connectionFormFields = (
  modes: FinancialModes,
): ConnectionFormFields => {
  const needsCode =
    modes.taxHandling === 'TAX_CODE' ||
    modes.taxHandling === 'TAX_CODE_AND_AMOUNT';

  return {
    // A rate or amount destination books rial and needs no code; only a code mode has no
    // fixed base to declare.
    baseCurrency: modes.currencyHandling === 'SINGLE_CURRENCY',
    currencyCodeTable: modes.currencyHandling === 'CURRENCY_CODE',
    currencyNameTable: modes.currencyHandling === 'CURRENCY_NAME',
    conversionRate: modes.currencyHandling === 'CURRENCY_CODE_AND_RATE',
    taxCodeTable: needsCode,
    // A rate/amount destination reads the figure from the CRM policy or the sealed
    // document, so the panel shows those figures rather than asking for a mapping.
    taxRateTable: !needsCode && modes.taxHandling !== 'UNSUPPORTED',
    specialTaxRowCode:
      modes.requiresSpecialItemCodes && modes.taxHandling !== 'UNSUPPORTED',
    taxUnsupported: modes.taxHandling === 'UNSUPPORTED',
    currencyUnsupported: modes.currencyHandling === 'UNSUPPORTED',
  };
};

export type ConnectionFormIssueField =
  | 'name'
  | 'baseUrl'
  | 'baseCurrency'
  | 'conversionRate';

// Only what a save must refuse. A missing mapping is a send-time refusal with its own
// explanation next to the readiness row, not a reason to hide a record an operator is still
// filling in.
export const validateConnectionForm = ({
  form,
  adapterIsLive,
  modes,
}: {
  form: FormState;
  adapterIsLive: boolean;
  modes: FinancialModes;
}): Partial<Record<ConnectionFormIssueField, string>> => {
  const issues: Partial<Record<ConnectionFormIssueField, string>> = {};
  const fields = connectionFormFields(modes);

  if (form.name.trim() === '') {
    issues.name = 'نام اتصال را وارد کنید.';
  }

  if (adapterIsLive) {
    const address = form.baseUrl.trim();

    if (address === '') {
      issues.baseUrl = 'آدرس سرویس نرم‌افزار حسابداری را وارد کنید.';
    } else if (!/^https?:\/\/[^\s]+$/i.test(address)) {
      issues.baseUrl = 'آدرس باید کامل و با http:// یا https:// شروع شود.';
    }
  }

  // A base currency is only required where the destination reads one. Requiring it on a
  // code-based destination would demand a value nothing consumes.
  if (fields.baseCurrency && !/^[A-Z]{3}$/.test(form.baseCurrency.trim().toUpperCase())) {
    issues.baseCurrency = 'ارز پایه باید یک کد سه‌حرفی مانند IRR باشد.';
  }

  if (
    fields.conversionRate &&
    form.conversionRate.trim() !== '' &&
    !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(form.conversionRate.trim())
  ) {
    issues.conversionRate =
      'نرخ تبدیل باید عددی مثبت با حداکثر شش رقم اعشار باشد.';
  }

  return issues;
};
