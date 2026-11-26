import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type TaxSettingsAuthority } from 'src/modules/quotation/types/tax-policy.type';
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

  // Whether the caller may change a financial setting such as a tax rate. A user or
  // API key must hold the role capability from the workspace cache; a failed lookup
  // is a refusal, never an implicit grant.
  //
  // An application token is not trusted for being an application: any workspace app
  // can present one. It qualifies only when either
  //   1. it is the application that owns the settings object (the quotation app that
  //      defines `taxPolicy` / `accountingConnection` in the workspace), or
  //   2. its platform default role carries `canUpdateAllSettings`.
  // The identity in (1) comes from the object metadata the platform already stores,
  // and (2) is the same role capability users and API keys are held to.
  //
  // `objectNameSingular` names WHICH settings surface is being authorized: owning the
  // tax catalog must not also qualify an app to rewrite the accounting destination.
  async resolveSettingsAuthority(
    authContext: WorkspaceAuthContext,
    objectNameSingular: string = 'taxPolicy',
  ): Promise<TaxSettingsAuthority | null> {
    if (authContext.type === 'system') {
      return 'SYSTEM';
    }

    if (authContext.type === 'application') {
      return this.resolveApplicationSettingsAuthority(
        authContext,
        objectNameSingular,
      );
    }

    if (authContext.type === 'pendingActivationUser') {
      return null;
    }

    const roleId = await this.resolveRoleId(authContext);

    if (!isDefined(roleId)) {
      return null;
    }

    const { flatRoleMaps } = await this.workspaceCacheService.getOrRecompute(
      authContext.workspace.id,
      ['flatRoleMaps'],
    );

    const roleUniversalIdentifier =
      flatRoleMaps.universalIdentifierById[roleId];
    const role = isDefined(roleUniversalIdentifier)
      ? flatRoleMaps.byUniversalIdentifier[roleUniversalIdentifier]
      : undefined;

    return role?.canUpdateAllSettings === true ? 'SETTINGS_ROLE' : null;
  }

  private async resolveApplicationSettingsAuthority(
    authContext: Extract<WorkspaceAuthContext, { type: 'application' }>,
    objectNameSingular: string,
  ): Promise<TaxSettingsAuthority | null> {
    const { flatObjectMetadataMaps, flatRoleMaps } =
      await this.workspaceCacheService.getOrRecompute(authContext.workspace.id, [
        'flatObjectMetadataMaps',
        'flatRoleMaps',
      ]);

    const settingsObjectMetadata = Object.values(
      flatObjectMetadataMaps.byUniversalIdentifier,
    ).find(
      (objectMetadata) =>
        isDefined(objectMetadata) &&
        objectMetadata.nameSingular === objectNameSingular,
    );
    const owningApplicationUniversalIdentifier =
      settingsObjectMetadata?.applicationUniversalIdentifier;

    if (
      isDefined(owningApplicationUniversalIdentifier) &&
      owningApplicationUniversalIdentifier ===
        authContext.application.universalIdentifier
    ) {
      return 'APPLICATION';
    }

    const defaultRoleId = authContext.application.defaultRoleId;
    const roleUniversalIdentifier = isDefined(defaultRoleId)
      ? flatRoleMaps.universalIdentifierById[defaultRoleId]
      : undefined;
    const role = isDefined(roleUniversalIdentifier)
      ? flatRoleMaps.byUniversalIdentifier[roleUniversalIdentifier]
      : undefined;

    return role?.canUpdateAllSettings === true ? 'SETTINGS_ROLE' : null;
  }

  async resolveRoleId(
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
