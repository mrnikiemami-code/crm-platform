import { QuotationQueryValidationException } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationShareService } from 'src/modules/quotation/services/quotation-share.service';

describe('QuotationShareService authz', () => {
  const permissionService = {
    resolveHeldPermissions: jest.fn(),
  };
  const customerLinkService = {
    createCustomerLink: jest.fn(),
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };

  const service = new QuotationShareService(
    workspaceOrmManager as never,
    permissionService as never,
    customerLinkService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses application tokens before permission lookup', async () => {
    await expect(
      service.shareQuotation({
        authContext: {
          type: 'application',
          workspace: { id: 'ws' },
          application: { id: 'app' },
        } as never,
        quotationId: 'q-1',
        channel: 'BALE',
      }),
    ).rejects.toBeInstanceOf(QuotationQueryValidationException);

    expect(permissionService.resolveHeldPermissions).not.toHaveBeenCalled();
  });

  it('refuses users who lack quotation.send', async () => {
    permissionService.resolveHeldPermissions.mockResolvedValue([
      'quotation.edit',
    ]);

    await expect(
      service.shareQuotation({
        authContext: {
          type: 'user',
          workspace: { id: 'ws' },
          userWorkspaceId: 'uw',
          user: { id: 'u' },
          workspaceMemberId: 'wm',
          workspaceMember: { id: 'wm' },
        } as never,
        quotationId: 'q-1',
        channel: 'TELEGRAM',
      }),
    ).rejects.toThrow(/PERMISSION_MISSING/);
  });

  it('refuses unknown channels', async () => {
    permissionService.resolveHeldPermissions.mockResolvedValue([
      'quotation.send',
    ]);

    await expect(
      service.shareQuotation({
        authContext: {
          type: 'apiKey',
          workspace: { id: 'ws' },
          apiKey: { id: 'k', name: 'k' },
        } as never,
        quotationId: 'q-1',
        channel: 'SMS',
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });
});
