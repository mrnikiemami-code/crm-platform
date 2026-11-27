import { runInNewContext } from 'node:vm';
import { FieldMetadataType } from 'twenty-shared/types';
import { CommonQueryNames } from 'src/engine/api/common/types/common-query-args.type';
import { WorkspaceQueryHookStorage } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/storage/workspace-query-hook.storage';
import { WorkspaceQueryHookExplorer } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.explorer';
import { WorkspaceQueryHookService } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.service';
import { CreatedByCreateOnePreQueryHook } from 'src/engine/core-modules/actor/query-hooks/created-by.create-one.pre-query-hook';
import { UpdatedByUpdateOnePreQueryHook } from 'src/engine/core-modules/actor/query-hooks/updated-by.update-one.pre-query-hook';
import { ActorFromAuthContextService } from 'src/engine/core-modules/actor/services/actor-from-auth-context.service';
import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { type UserWorkspaceAuthContext, type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPersonCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-create-one.pre-query.hook';
import { AccountingPersonUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-person-update-one.pre-query.hook';
import { AccountingCompanyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-create-one.pre-query.hook';
import { AccountingCompanyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-company-update-one.pre-query.hook';
import { AccountingPartyWriteGuardService, matchesAccountingActorStamp, withAccountingPartyWriteScope } from 'src/modules/quotation/services/accounting-party-write-guard.service';

const app = { id: 'app-id', universalIdentifier: 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb' };
const user = { type: 'user', application: app, workspace: { id: 'workspace' }, userWorkspaceId: 'membership',
  workspaceMemberId: 'member', workspaceMember: { id: 'member', name: { firstName: 'Test', lastName: 'User' } } } as UserWorkspaceAuthContext;
const machine = { type: 'application', application: app, workspace: user.workspace } as WorkspaceAuthContext;
const id = '30000000-0000-4000-8000-000000000001';
const actor = buildCreatedByFromFullNameMetadata({ fullNameMetadata: user.workspaceMember.name, workspaceMemberId: user.workspaceMemberId });
const makeGuard = (authority: string | null = 'SETTINGS_ROLE') =>
  new AccountingPartyWriteGuardService({ resolveSettingsAuthority: jest.fn(async () => authority) } as never);
const within = <T>(object: 'person' | 'company', action: 'createOne' | 'updateOne', work: () => Promise<T>) =>
  withAccountingPartyWriteScope({ authContext: user, object, action, recordId: id }, work);

// The preceding 081 suite called the guard with raw business fields only.
// This fixture runs the real wildcard hooks in the real storage/dispatcher
// order, including the actual ActorFromAuthContextService.
const pipeline = () => {
  const guard = makeGuard();
  const maps = {
    flatObjectMetadataMaps: {
      byUniversalIdentifier: { person: { id: 'person', nameSingular: 'person', fieldIds: ['p-created', 'p-updated'] },
        company: { id: 'company', nameSingular: 'company', fieldIds: ['c-created', 'c-updated'] } },
      universalIdentifierById: { person: 'person', company: 'company' },
    },
    flatFieldMetadataMaps: {
      byUniversalIdentifier: Object.fromEntries(['p-created', 'p-updated', 'c-created', 'c-updated'].map((fieldId) => [
        fieldId, { id: fieldId, name: fieldId.endsWith('created') ? 'createdBy' : 'updatedBy', type: FieldMetadataType.ACTOR },
      ])),
      universalIdentifierById: Object.fromEntries(['p-created', 'p-updated', 'c-created', 'c-updated'].map((fieldId) => [fieldId, fieldId])),
    },
  };
  const actors = new ActorFromAuthContextService({
    getOrRecomputeManyOrAllFlatEntityMaps: jest.fn(async () => maps),
  } as never);
  const storage = new WorkspaceQueryHookStorage();
  const register = (key: Parameters<WorkspaceQueryHookStorage['registerWorkspaceQueryPreHookInstance']>[0],
    instance: Parameters<WorkspaceQueryHookStorage['registerWorkspaceQueryPreHookInstance']>[1]['instance']) =>
    storage.registerWorkspaceQueryPreHookInstance(key, { instance, host: {} as never, isRequestScoped: false });
  // Register specific hooks first: storage must nevertheless execute wildcards first.
  register('person.createOne', new AccountingPersonCreateOnePreQueryHook(guard));
  register('person.updateOne', new AccountingPersonUpdateOnePreQueryHook(guard));
  register('company.createOne', new AccountingCompanyCreateOnePreQueryHook(guard));
  register('company.updateOne', new AccountingCompanyUpdateOnePreQueryHook(guard));
  register('*.createOne', new CreatedByCreateOnePreQueryHook(actors));
  register('*.updateOne', new UpdatedByUpdateOnePreQueryHook(actors));
  return new WorkspaceQueryHookService(storage, new WorkspaceQueryHookExplorer({} as never, {} as never, {} as never, storage));
};

describe('accounting customer scoped writes', () => {
  it('validates the complete actor data across VM/structuredClone realms without accepting altered stamps', () => {
    const foreignActor: unknown = runInNewContext('JSON.parse(input)', { input: JSON.stringify(actor) });
    expect(matchesAccountingActorStamp(foreignActor, actor)).toBe(true);
    expect(matchesAccountingActorStamp(structuredClone(actor), actor)).toBe(true);
    expect(matchesAccountingActorStamp({ ...actor, context: { extra: true } }, actor)).toBe(false);
    expect(matchesAccountingActorStamp({ ...actor, context: new Date() }, actor)).toBe(false);
    expect(matchesAccountingActorStamp({ ...actor, name: 'Forged' }, actor)).toBe(false);
    expect(matchesAccountingActorStamp({ ...actor, source: 'API' }, actor)).toBe(false);
    expect(matchesAccountingActorStamp({ ...actor, extra: true }, actor)).toBe(false);
    expect(matchesAccountingActorStamp({ ...actor, workspaceMemberId: 'other' }, actor)).toBe(false);
  });
  it.each(['person', 'company'] as const)('accepts real core-generated audit fields on %s create and update', async (object) => {
    const hooks = pipeline();
    const name = object === 'person' ? { firstName: 'Fixture', lastName: 'Only' } : 'Fixture Company';
    const create = await within(object, 'createOne', () => hooks.executePreQueryHooks(user, object, CommonQueryNames.CREATE_ONE, {
      data: { id, name, position: 0 },
    } as never));
    expect(create).toMatchObject({ data: { id, name, createdBy: actor, updatedBy: actor } });
    const update = await within(object, 'updateOne', () => hooks.executePreQueryHooks(user, object, CommonQueryNames.UPDATE_ONE, {
      id, data: { name },
    } as never));
    expect(update).toMatchObject({ id, data: { name, updatedBy: actor } });
    expect(update).not.toHaveProperty('data.createdBy');
  });

  it('rejects direct app or delegated calls without the internal scope even with a genuine actor stamp', async () => {
    const guard = makeGuard();
    const data = { id, name: { firstName: 'Test' }, createdBy: actor, updatedBy: actor };
    await expect(guard.assertAllowed(user, 'person', 'createOne', { data })).rejects.toThrow('NATIVE_SCOPE_REQUIRED');
    await expect(guard.assertAllowed(machine, 'person', 'createOne', { data })).rejects.toThrow('NATIVE_SCOPE_REQUIRED');
    await expect(pipeline().executePreQueryHooks(user, 'person', CommonQueryNames.CREATE_ONE, { data: { id, name: {} } } as never)).rejects.toThrow('NATIVE_SCOPE_REQUIRED');
    // Ordinary CRM user operations are not owned by the accounting guard.
    await expect(guard.assertAllowed({ ...user, application: undefined }, 'person', 'createOne', { data })).resolves.toBeUndefined();
  });

  it('rejects forged actor/owner data, unrelated fields, wrong scope, update position, bulk and upsert', async () => {
    const guard = makeGuard();
    await expect(within('person', 'createOne', () => guard.assertAllowed(user, 'person', 'createOne', {
      data: { id, name: {}, createdBy: { ...actor, workspaceMemberId: 'other' } },
    }))).rejects.toThrow('ACTOR_MISMATCH');
    await expect(within('person', 'createOne', () => guard.assertAllowed(user, 'person', 'createOne', {
      data: { id, name: {}, assigneeId: 'other' },
    }))).rejects.toThrow('FIELD_NOT_ALLOWED');
    await expect(within('person', 'createOne', () => guard.assertAllowed(user, 'person', 'createOne', {
      data: { id, name: {}, assigneeId: user.workspaceMemberId, position: 0, updatedBy: actor },
    }))).resolves.toBeUndefined();
    await expect(within('company', 'updateOne', () => guard.assertAllowed(user, 'company', 'updateOne', {
      id, data: { accountOwnerId: 'other' },
    }))).rejects.toThrow('FIELD_NOT_ALLOWED');
    await expect(within('person', 'updateOne', () => guard.assertAllowed(user, 'person', 'updateOne', {
      id, data: { createdBy: actor },
    }))).rejects.toThrow('FIELD_NOT_ALLOWED');
    await expect(within('person', 'updateOne', () => guard.assertAllowed(user, 'person', 'updateOne', {
      id, data: { position: 0 },
    }))).rejects.toThrow('FIELD_NOT_ALLOWED');
    await expect(within('person', 'updateOne', () => guard.assertAllowed(user, 'person', 'updateOne', {
      id: 'other', data: { name: {} },
    }))).rejects.toThrow('INVALID_MUTATION');
    await expect(within('person', 'createOne', () => guard.assertAllowed(user, 'company', 'createOne', {
      data: { id, name: {} },
    }))).rejects.toThrow('NATIVE_SCOPE_REQUIRED');
    await expect(within('person', 'createOne', () => guard.assertAllowed(user, 'person', 'createOne', {
      data: { id, name: {} }, upsert: true,
    }))).rejects.toThrow('INVALID_MUTATION');
    await expect(guard.assertAllowed(user, 'person', 'mergeMany', {})).rejects.toThrow('NATIVE_SCOPE_REQUIRED');
    await expect(within('person', 'updateOne', () => makeGuard(null).assertAllowed(user, 'person', 'updateOne', {
      id, data: { name: {} },
    }))).rejects.toThrow('SETTINGS_AUTHORITY_REQUIRED');
  });
});
