export type RoundingSettingsAuthority =
  | 'SYSTEM'
  | 'APPLICATION'
  | 'SETTINGS_ROLE';

export type WorkspaceRoundingRuleRow = {
  id: string;
  code: string | null;
  name: string | null;
  stepRials: string | null;
  isActive: boolean | null;
  isDefault: boolean | null;
};

export type WorkspaceRoundingRuleView = {
  recordId: string;
  code: string;
  name: string;
  stepRials: string;
  isActive: boolean;
  isDefault: boolean;
  quotationCount: number;
};

export type RoundingRuleMutationOutcome =
  | { kind: 'OK'; rules: WorkspaceRoundingRuleView[]; message: string }
  | { kind: 'REFUSED'; code: string; message: string };

export type SaveRoundingRuleInput = {
  recordId: string | null;
  name: string;
  stepRialsText: string;
  isActive: boolean;
  isDefault: boolean;
};
