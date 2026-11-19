import { QuotationQueryValidationException } from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationShareService } from 'src/modules/quotation/services/quotation-share.service';

describe('QuotationShareService authz', () => {
  const permissionService = {
    resolveHeldPermissions: jest.fn(),
  };
  const customerLinkService = {
    createCustomerLink: jest.fn(),
  };
  const outboundService = {
    sendOutbound: jest.fn(),
  };
  const workspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(),
    getRepository: jest.fn(),
  };

  const service = new QuotationShareService(
    workspaceOrmManager as never,
    permissionService as never,
    customerLinkService as never,
    outboundService as never,
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

  it('refuses BALE without a numeric chat_id', async () => {
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
            status: 'READY_TO_SEND',
            quotationNumber: 'QF-1',
            name: 'a',
            personId: 'p-1',
            companyId: null,
          }),
        };
      }

      if (objectName === 'person') {
        return {
          findOne: async () => ({
            id: 'p-1',
            nameFirstName: 'Ali',
            nameLastName: 'A',
          }),
        };
      }

      if (objectName === 'quotationShare') {
        return { findOne: async () => null };
      }

      return { findOne: async () => null };
    });

    await expect(
      service.shareQuotation({
        authContext: {
          type: 'apiKey',
          workspace: { id: 'ws' },
          apiKey: { id: 'k', name: 'k' },
        } as never,
        quotationId: 'q-1',
        channel: 'BALE',
        chatId: 'not-numeric',
      }),
    ).rejects.toThrow(/chat_id/);
  });
});
