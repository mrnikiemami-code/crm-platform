import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { ApplicationRegistrationSourceType } from 'src/engine/core-modules/application/application-registration/enums/application-registration-source-type.enum';
import { ApplicationState } from 'src/engine/core-modules/application/enums/application-state.enum';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import {
  fromCreateFieldInputToFlatFieldMetadatasToCreate,
  type FromCreateFieldInputToFlatObjectMetadataArgs,
} from 'src/engine/metadata-modules/flat-field-metadata/utils/from-create-field-input-to-flat-field-metadatas-to-create.util';
import { COMPANY_FLAT_OBJECT_MOCK } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/company-flat-object.mock';
import { PET_FLAT_OBJECT_MOCK } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/pet-flat-object.mock';
import { ROCKET_FLAT_OBJECT_MOCK } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/rocket-flat-object.mock';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

const MOCK_FLAT_APPLICATION: FlatApplication = {
  id: '20202020-81ee-42da-a281-668632f32fe7',
  universalIdentifier: '20202020-81ee-42da-a281-668632f32fe7',
  name: 'Workspace Custom Application',
  description: null,
  logo: null,
  logoFileId: null,
  workspaceId: 'workspace-id',
  version: null,
  sourceType: ApplicationRegistrationSourceType.LOCAL,
  state: ApplicationState.INSTALLED,
  sourcePath: '',
  packageJsonChecksum: null,
  packageJsonFileId: null,
  yarnLockChecksum: null,
  yarnLockFileId: null,
  availablePackages: {},
  billing: {},
  logicFunctionLayerId: null,
  defaultRoleId: null,
  defaultRole: null,
  settingsCustomTabFrontComponentId: null,
  uninstallLogicFunctionId: null,
  uninstallHookCompletedForRequestedAt: null,
  canBeUninstalled: false,
  autoUpgrade: false,
  applicationRegistrationId: null,
  primaryPublicDomainId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  isSdkLayerStale: true,
  sdkClientCoreChecksum: null,
  frontComponentSharedDependenciesChecksum: null,
  frontComponentSharedDependenciesBuiltPath: null,
};

const EXISTING_PET_ROCKET_FIELD_ID = '6b0f4d8e-5a0e-4f63-9a51-0d4b7c2f9a11';

const buildMaps = ({
  withExistingRocketField,
}: {
  withExistingRocketField: boolean;
}) => {
  const petFlatObjectMetadata: FlatObjectMetadata = {
    ...PET_FLAT_OBJECT_MOCK,
    fieldIds: withExistingRocketField ? [EXISTING_PET_ROCKET_FIELD_ID] : [],
  };

  const flatObjectMetadataMaps = [
    COMPANY_FLAT_OBJECT_MOCK,
    ROCKET_FLAT_OBJECT_MOCK,
    petFlatObjectMetadata,
  ].reduce(
    (maps, flatObjectMetadata) =>
      addFlatEntityToFlatEntityMapsOrThrow({
        flatEntity: flatObjectMetadata,
        flatEntityMaps: maps,
      }),
    createEmptyFlatEntityMaps() as FlatEntityMaps<FlatObjectMetadata>,
  );

  const emptyFlatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata> =
    createEmptyFlatEntityMaps();

  const flatFieldMetadataMaps = withExistingRocketField
    ? addFlatEntityToFlatEntityMapsOrThrow({
        flatEntity: getFlatFieldMetadataMock({
          id: EXISTING_PET_ROCKET_FIELD_ID,
          universalIdentifier: EXISTING_PET_ROCKET_FIELD_ID,
          objectMetadataId: PET_FLAT_OBJECT_MOCK.id,
          type: FieldMetadataType.TEXT,
          name: 'rocket',
        }),
        flatEntityMaps: emptyFlatFieldMetadataMaps,
      })
    : emptyFlatFieldMetadataMaps;

  return { flatObjectMetadataMaps, flatFieldMetadataMaps };
};

const buildInput = ({
  targetFieldLabel,
  withExistingRocketField = false,
}: {
  targetFieldLabel: string;
  withExistingRocketField?: boolean;
}): FromCreateFieldInputToFlatObjectMetadataArgs => ({
  flatApplication: MOCK_FLAT_APPLICATION,
  createFieldInput: {
    name: 'pets',
    label: 'حیوانات',
    type: FieldMetadataType.RELATION,
    objectMetadataId: ROCKET_FLAT_OBJECT_MOCK.id,
    relationCreationPayload: {
      type: RelationType.ONE_TO_MANY,
      targetObjectMetadataId: PET_FLAT_OBJECT_MOCK.id,
      targetFieldLabel,
      targetFieldIcon: 'IconRocket',
    },
  },
  ...buildMaps({ withExistingRocketField }),
});

const getCounterpartField = async (
  input: FromCreateFieldInputToFlatObjectMetadataArgs,
) => {
  const result = await fromCreateFieldInputToFlatFieldMetadatasToCreate(input);

  if (result.status !== 'success') {
    throw new Error('Relation creation should succeed');
  }

  const counterpartField = result.result.flatFieldMetadatas.find(
    (flatFieldMetadata) =>
      flatFieldMetadata.objectMetadataUniversalIdentifier ===
      PET_FLAT_OBJECT_MOCK.universalIdentifier,
  );

  if (counterpartField === undefined) {
    throw new Error('Counterpart field should be created');
  }

  return counterpartField;
};

describe('fromCreateFieldInputToFlatFieldMetadatasToCreate RELATION counterpart field name', () => {
  it('should create a valid ASCII counterpart name for a Persian target label', async () => {
    const counterpartField = await getCounterpartField(
      buildInput({ targetFieldLabel: 'موشک' }),
    );

    expect(counterpartField.name).toBe('rocket');
    expect(counterpartField.name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    expect(counterpartField.label).toBe('موشک');
    expect(counterpartField.universalSettings).toMatchObject({
      relationType: RelationType.MANY_TO_ONE,
      joinColumnName: 'rocketId',
    });
  });

  it('should suffix the counterpart name when it collides with an existing field', async () => {
    const counterpartField = await getCounterpartField(
      buildInput({ targetFieldLabel: 'موشک', withExistingRocketField: true }),
    );

    expect(counterpartField.name).toBe('rocket2');
    expect(counterpartField.universalSettings).toMatchObject({
      joinColumnName: 'rocket2Id',
    });
  });

  it('should keep the label based counterpart name for a Latin target label', async () => {
    const counterpartField = await getCounterpartField(
      buildInput({ targetFieldLabel: 'Launch vehicle' }),
    );

    expect(counterpartField.name).toBe('launchVehicle');
    expect(counterpartField.label).toBe('Launch vehicle');
  });
});
