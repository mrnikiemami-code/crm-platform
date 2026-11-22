import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

const workspace = { id: 'workspace-1' } as never;

const buildService = ({
  userWorkspaceRoleId = 'role-limited',
  apiKeyRoleId = 'role-limited',
  roleCanUpdateAllSettings = false,
  applicationOwnsTaxPolicy = false,
  applicationDefaultRoleId = null,
}: {
  userWorkspaceRoleId?: string | null;
  apiKeyRoleId?: string | null;
  roleCanUpdateAllSettings?: boolean;
  applicationOwnsTaxPolicy?: boolean;
  applicationDefaultRoleId?: string | null;
} = {}) => {
  const flatRoleMaps = {
    universalIdentifierById: {
      'role-limited': 'role-uid-limited',
      'role-settings': 'role-uid-settings',
      'role-app': 'role-uid-app',
    },
    byUniversalIdentifier: {
      'role-uid-limited': { canUpdateAllSettings: roleCanUpdateAllSettings },
      'role-uid-settings': { canUpdateAllSettings: true },
      'role-uid-app': { canUpdateAllSettings: false },
    },
  };
  const flatObjectMetadataMaps = {
    byUniversalIdentifier: {
      'object-tax-policy': {
        nameSingular: 'taxPolicy',
        applicationUniversalIdentifier: 'application-quotation',
      },
    },
  };
  const workspaceCacheService = {
    getOrRecompute: jest.fn(
      async (
        _workspaceId: string,
        keys: string[],
      ): Promise<Record<string, unknown>> => {
        if (keys.includes('userWorkspaceRoleMap')) {
          return { userWorkspaceRoleMap: { 'uw-1': userWorkspaceRoleId } };
        }

        if (keys.includes('apiKeyRoleMap')) {
          return { apiKeyRoleMap: { 'api-key-1': apiKeyRoleId } };
        }

        return { flatRoleMaps, flatObjectMetadataMaps };
      },
    ),
  };

  return {
    service: new QuotationPermissionService(workspaceCacheService as never),
    application: {
      type: 'application' as const,
      workspace,
      application: {
        universalIdentifier: applicationOwnsTaxPolicy
          ? 'application-quotation'
          : 'application-unrelated',
        defaultRoleId: applicationDefaultRoleId,
      },
    } as unknown as WorkspaceAuthContext,
  };
};

describe('QuotationPermissionService.resolveSettingsAuthority', () => {
  it('trusts the application that owns the taxPolicy object', async () => {
    const { service, application } = buildService({
      applicationOwnsTaxPolicy: true,
      applicationDefaultRoleId: 'role-app',
    });

    await expect(service.resolveSettingsAuthority(application)).resolves.toBe(
      'APPLICATION',
    );
  });

  it('refuses an unrelated application whose role has no settings capability', async () => {
    const { service, application } = buildService({
      applicationDefaultRoleId: 'role-app',
    });

    await expect(
      service.resolveSettingsAuthority(application),
    ).resolves.toBeNull();
  });

  it('accepts an unrelated application only through the platform settings role', async () => {
    const { service, application } = buildService({
      roleCanUpdateAllSettings: true,
      applicationDefaultRoleId: 'role-limited',
    });

    await expect(service.resolveSettingsAuthority(application)).resolves.toBe(
      'SETTINGS_ROLE',
    );
  });

  it('keeps the user and API-key branch on the role capability', async () => {
    const limited = buildService();

    await expect(
      limited.service.resolveSettingsAuthority({
        type: 'user',
        workspace,
        userWorkspaceId: 'uw-1',
        user: {},
        workspaceMemberId: 'wm-1',
        workspaceMember: {},
      } as unknown as WorkspaceAuthContext),
    ).resolves.toBeNull();

    const settings = buildService({ roleCanUpdateAllSettings: true });

    await expect(
      settings.service.resolveSettingsAuthority({
        type: 'apiKey',
        workspace,
        apiKey: { id: 'api-key-1' },
      } as unknown as WorkspaceAuthContext),
    ).resolves.toBe('SETTINGS_ROLE');
  });

  it('never grants the system authority to a pending activation user', async () => {
    const { service } = buildService();

    await expect(
      service.resolveSettingsAuthority({
        type: 'pendingActivationUser',
        workspace,
        userWorkspaceId: 'uw-1',
        user: {},
      } as unknown as WorkspaceAuthContext),
    ).resolves.toBeNull();
  });
});
