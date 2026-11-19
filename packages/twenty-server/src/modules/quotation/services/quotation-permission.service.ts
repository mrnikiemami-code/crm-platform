import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  type QuotationPermission,
  resolveQuotationPermissionsFromRoleCapabilities,
} from 'src/modules/quotation/utils/quotation-immutability.util';

@Injectable()
export class QuotationPermissionService {
  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async resolveHeldPermissions(
    authContext: WorkspaceAuthContext,
  ): Promise<readonly QuotationPermission[]> {
    // System and application runtimes are trusted platform paths (logic functions
    // already sit behind their own role). Users and API keys are confined by role.
    if (authContext.type === 'system') {
      return resolveQuotationPermissionsFromRoleCapabilities({
        canUpdateAllObjectRecords: true,
        canUpdateAllSettings: true,
        canUpdateQuotationObject: true,
      });
    }

    if (authContext.type === 'application') {
      return resolveQuotationPermissionsFromRoleCapabilities({
        canUpdateAllObjectRecords: false,
        canUpdateAllSettings: false,
        canUpdateQuotationObject: true,
      });
    }

    const roleId = await this.resolveRoleId(authContext);

    if (!isDefined(roleId)) {
      return [];
    }

    const {
      flatRoleMaps,
      rolesPermissions,
      flatObjectMetadataMaps,
    } = await this.workspaceCacheService.getOrRecompute(
      authContext.workspace.id,
      ['flatRoleMaps', 'rolesPermissions', 'flatObjectMetadataMaps'],
    );

    const roleUniversalIdentifier =
      flatRoleMaps.universalIdentifierById[roleId];
    const role = isDefined(roleUniversalIdentifier)
      ? flatRoleMaps.byUniversalIdentifier[roleUniversalIdentifier]
      : undefined;

    if (!isDefined(role)) {
      return [];
    }

    const { idByNameSingular } = buildObjectIdByNameMaps(flatObjectMetadataMaps);
    const quotationObjectId = idByNameSingular.quotation;
    const quotationObjectPermission = isDefined(quotationObjectId)
      ? rolesPermissions[roleId]?.[quotationObjectId]
      : undefined;

    return resolveQuotationPermissionsFromRoleCapabilities({
      canUpdateAllObjectRecords: role.canUpdateAllObjectRecords === true,
      canUpdateAllSettings: role.canUpdateAllSettings === true,
      canUpdateQuotationObject:
        quotationObjectPermission?.canUpdateObjectRecords === true ||
        role.canUpdateAllObjectRecords === true,
    });
  }

  private async resolveRoleId(
    authContext: WorkspaceAuthContext,
  ): Promise<string | null> {
    if (authContext.type === 'user') {
      const { userWorkspaceRoleMap } =
        await this.workspaceCacheService.getOrRecompute(
          authContext.workspace.id,
          ['userWorkspaceRoleMap'],
        );

      return userWorkspaceRoleMap[authContext.userWorkspaceId] ?? null;
    }

    if (authContext.type === 'apiKey') {
      const { apiKeyRoleMap } = await this.workspaceCacheService.getOrRecompute(
        authContext.workspace.id,
        ['apiKeyRoleMap'],
      );

      return apiKeyRoleMap[authContext.apiKey.id] ?? null;
    }

    return null;
  }
}
