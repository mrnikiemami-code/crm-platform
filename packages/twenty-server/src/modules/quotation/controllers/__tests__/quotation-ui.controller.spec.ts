import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { QuotationUiController } from 'src/modules/quotation/controllers/quotation-ui.controller';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({ getWorkspaceAuthContext: jest.fn() }),
);

// The PDF stack is ESM-only and unrelated to the authorization decision under test.
jest.mock('src/modules/quotation/services/quotation-pdf.service', () => ({
  QuotationPdfService: class QuotationPdfService {},
}));

const mockedGetAuthContext = getWorkspaceAuthContext as unknown as jest.Mock;

const userAuthContext = {
  type: 'user',
  workspace: { id: 'workspace-1' },
  userWorkspaceId: 'uw-1',
  user: { id: 'user-1' },
  workspaceMemberId: 'wm-1',
  workspaceMember: { id: 'wm-1' },
} as unknown as WorkspaceAuthContext;

const buildController = ({
  authority,
  savePolicy,
  listPolicies,
  bootstrap,
  setDefaultPolicy,
  saveDraft,
}: {
  authority: string | null;
  savePolicy?: jest.Mock;
  listPolicies?: jest.Mock;
  bootstrap?: jest.Mock;
  setDefaultPolicy?: jest.Mock;
  saveDraft?: jest.Mock;
}) => {
  const taxPolicyAuthorityService = {
    resolveAuthority: jest.fn(async () => authority),
    savePolicy: savePolicy ?? jest.fn(async () => ({ kind: 'OK', policies: [], message: '' })),
    listPolicies:
      listPolicies ?? jest.fn(async () => ({ kind: 'OK', policies: [], message: '' })),
    bootstrap:
      bootstrap ?? jest.fn(async () => ({ kind: 'OK', policies: [], message: '' })),
    setDefaultPolicy:
      setDefaultPolicy ?? jest.fn(async () => ({ kind: 'OK', policies: [], message: '' })),
    deactivatePolicy: jest.fn(async () => ({ kind: 'OK', policies: [], message: '' })),
  };

  const controller = new QuotationUiController(
    { toPersianFailure: jest.fn(() => ({ success: false, code: 'PERSISTENCE_FAILED' })) } as never,
    {} as never,
    {} as never,
    {} as never,
    { saveDraft: saveDraft ?? jest.fn() } as never,
    taxPolicyAuthorityService as never,
    { resolveSettingsAuthority: jest.fn(async () => authority) } as never,
    {} as never,
  );

  return { controller, taxPolicyAuthorityService };
};

const policy = {
  recordId: 'tp-1',
  code: 'IR_VAT_9',
  name: 'مالیات ۹٪',
  rateBasisPoints: '900',
  ratePercent: '9',
  isActive: true,
  isDefault: true,
  isExempt: false,
  quotationCount: 0,
};

describe('QuotationUiController tax settings boundary', () => {
  beforeEach(() => {
    mockedGetAuthContext.mockReturnValue(userAuthContext);
  });

  it('refuses a tax mutation from a caller without settings authority, without writing', async () => {
    const savePolicy = jest.fn();
    const { controller, taxPolicyAuthorityService } = buildController({
      authority: null,
      savePolicy,
    });

    const response = await controller.actions({
      action: 'tax-policy-save',
      name: 'مالیات ۱۰٪',
      ratePercentText: '10',
    });

    expect(response).toMatchObject({
      success: false,
      code: 'TAX_SETTINGS_FORBIDDEN',
    });
    expect(taxPolicyAuthorityService.resolveAuthority).toHaveBeenCalledWith(
      userAuthContext,
    );
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('refuses the bootstrap action without settings authority', async () => {
    const bootstrap = jest.fn();
    const { controller } = buildController({ authority: null, bootstrap });

    const response = await controller.actions({ action: 'tax-policy-bootstrap' });

    expect(response).toMatchObject({ success: false, code: 'TAX_SETTINGS_FORBIDDEN' });
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('lets an authorized caller save and returns the catalog with its default code', async () => {
    const savePolicy = jest.fn(async () => ({
      kind: 'OK',
      policies: [policy],
      message: 'سیاست مالیات ذخیره شد',
    }));
    const { controller } = buildController({
      authority: 'SETTINGS_ROLE',
      savePolicy,
    });

    const response = await controller.actions({
      action: 'tax-policy-save',
      name: 'مالیات ۹٪',
      ratePercentText: '۹',
      isActive: true,
      isDefault: true,
    });

    expect(savePolicy).toHaveBeenCalledWith(
      {
        recordId: null,
        name: 'مالیات ۹٪',
        ratePercentText: '۹',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: true,
      },
      userAuthContext,
    );
    expect(response).toMatchObject({
      success: true,
      defaultCode: 'IR_VAT_9',
    });
  });

  it('keeps the list readable for any authenticated member', async () => {
    const listPolicies = jest.fn(async () => ({
      kind: 'OK',
      policies: [policy],
      message: '',
    }));
    const { controller, taxPolicyAuthorityService } = buildController({
      authority: null,
      listPolicies,
    });

    const response = await controller.actions({ action: 'tax-policy-list' });

    expect(listPolicies).toHaveBeenCalledTimes(1);
    expect(taxPolicyAuthorityService.resolveAuthority).not.toHaveBeenCalled();
    expect(response).toMatchObject({ success: true, defaultCode: 'IR_VAT_9' });
  });

  it('refuses set-default without a record id instead of guessing one', async () => {
    const setDefaultPolicy = jest.fn();
    const { controller } = buildController({
      authority: 'SETTINGS_ROLE',
      setDefaultPolicy,
    });

    const response = await controller.actions({ action: 'tax-policy-set-default' });

    expect(response).toMatchObject({
      success: false,
      code: 'TAX_POLICY_REQUIRED',
    });
    expect(setDefaultPolicy).not.toHaveBeenCalled();
  });

  it('does not treat an unknown tax action as authorized', async () => {
    const { controller, taxPolicyAuthorityService } = buildController({
      authority: null,
    });

    const response = await controller.actions({ action: 'tax-policy-anything' });

    expect(response).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(taxPolicyAuthorityService.resolveAuthority).not.toHaveBeenCalled();
  });
});
