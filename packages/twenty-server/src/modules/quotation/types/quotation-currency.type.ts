import { type TaxSettingsAuthority } from 'src/modules/quotation/types/tax-policy.type';

export type WorkspaceQuotationCurrencyRow = {
  id: string;
  code: string | null;
  name: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
  accountingCode: string | null;
};

export type WorkspaceQuotationCurrencyView = {
  recordId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  accountingCode: string;
};

export type QuotationCurrencyMutationOutcome =
  | {
      kind: 'OK';
      currencies: WorkspaceQuotationCurrencyView[];
      message: string;
    }
  | { kind: 'REFUSED'; code: string; message: string };

export type SaveQuotationCurrencyInput = {
  recordId: string | null;
  name: string;
  accountingCodeText: string;
  isActive: boolean;
  isDefault: boolean;
};

export type { TaxSettingsAuthority };
