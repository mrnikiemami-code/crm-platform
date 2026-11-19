import { QuotationQueryValidationException } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationCustomerLinkService } from 'src/modules/quotation/services/quotation-customer-link.service';

describe('QuotationCustomerLinkService authz', () => {
  const permissionService = {
    resolveHeldPermissions: jest.fn(),
  };
  const twentyConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3002'),
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };

  const service = new QuotationCustomerLinkService(
    workspaceOrmManager as never,
    permissionService as never,
    twentyConfigService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses application tokens even before permission lookup', async () => {
    await expect(
      service.createCustomerLink({
        authContext: {
          type: 'application',
          workspace: { id: 'ws' },
          application: { id: 'app' },
        } as never,
        quotationId: 'q-1',
      }),
    ).rejects.toBeInstanceOf(QuotationQueryValidationException);

    expect(permissionService.resolveHeldPermissions).not.toHaveBeenCalled();
  });

  it('refuses users who lack quotation.send', async () => {
    permissionService.resolveHeldPermissions.mockResolvedValue([
      'quotation.edit',
      'quotation.submitForApproval',
    ]);

    await expect(
      service.createCustomerLink({
        authContext: {
          type: 'user',
          workspace: { id: 'ws' },
          userWorkspaceId: 'uw',
          user: { id: 'u' },
          workspaceMemberId: 'wm',
          workspaceMember: { id: 'wm' },
        } as never,
        quotationId: 'q-1',
      }),
    ).rejects.toThrow(/PERMISSION_MISSING/);
  });

  it('refuses revoke when the link belongs to another quotation', async () => {
    permissionService.resolveHeldPermissions.mockResolvedValue([
      'quotation.send',
    ]);
    workspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
    workspaceOrmManager.getRepository.mockImplementation((objectName: string) => {
      if (objectName === 'quotation') {
        return {
          findOne: async () => ({
            id: 'q-1',
            status: 'SENT',
            quotationNumber: 'QF-1',
            name: 'a',
          }),
        };
      }

      return {
        findOne: async () => ({
          id: 'link-1',
          quotationId: 'q-OTHER',
          revokedAt: null,
        }),
        update: jest.fn(),
      };
    });

    await expect(
      service.revokeCustomerLink({
        authContext: {
          type: 'apiKey',
          workspace: { id: 'ws' },
          apiKey: { id: 'key' },
        } as never,
        quotationId: 'q-1',
        linkId: 'link-1',
      }),
    ).rejects.toThrow(/CUSTOMER_LINK_QUOTATION_MISMATCH/);
  });
});
