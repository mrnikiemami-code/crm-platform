import { type TaxSettingsAuthority } from 'src/modules/quotation/types/tax-policy.type';

export type WorkspaceQuotationUnitRow = {
  id: string;
  code: string | null;
  name: string | null;
  isActive: boolean | null;
  accountingCode: string | null;
};

export type WorkspaceQuotationUnitView = {
  recordId: string;
  code: string;
  name: string;
  isActive: boolean;
  accountingCode: string;
  catalogItemCount: number;
};

export type QuotationUnitMutationOutcome =
  | {
      kind: 'OK';
      units: WorkspaceQuotationUnitView[];
      message: string;
    }
  | { kind: 'REFUSED'; code: string; message: string };

export type SaveQuotationUnitInput = {
  recordId: string | null;
  name: string;
  accountingCodeText: string;
  isActive: boolean;
};

export type { TaxSettingsAuthority };