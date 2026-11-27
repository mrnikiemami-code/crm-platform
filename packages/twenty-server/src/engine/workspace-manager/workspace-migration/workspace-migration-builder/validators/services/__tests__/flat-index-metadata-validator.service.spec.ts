import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { fromFieldManifestToUniversalFlatFieldMetadata } from 'src/engine/core-modules/application/application-manifest/converters/from-field-manifest-to-universal-flat-field-metadata.util';
import { FlatFieldMetadataTypeValidatorService } from 'src/engine/metadata-modules/flat-field-metadata/services/flat-field-metadata-type-validator.service';
import { FlatFieldMetadataValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-field-metadata-validator.service';
import { FlatIndexValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-index-metadata-validator.service';

const INDEX_UNIVERSAL_IDENTIFIER = '11111111-1111-4111-8111-111111111111';
const OBJECT_UNIVERSAL_IDENTIFIER = '22222222-2222-4222-8222-222222222222';
const FIELD_UNIVERSAL_IDENTIFIER = '33333333-3333-4333-8333-333333333333';

const buildCreationArgs = (relationType: RelationType) =>
  ({
    flatEntityToValidate: {
      universalIdentifier: INDEX_UNIVERSAL_IDENTIFIER,
      name: 'targetUniqueIndex',
      objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
      isUnique: true,
      universalFlatIndexFieldMetadatas: [
        {
          indexMetadataUniversalIdentifier: INDEX_UNIVERSAL_IDENTIFIER,
          fieldMetadataUniversalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
        },
      ],
    },
    optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
      flatIndexMaps: { byUniversalIdentifier: {} },
      flatObjectMetadataMaps: {
        byUniversalIdentifier: {
          [OBJECT_UNIVERSAL_IDENTIFIER]: {
            universalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
          },
        },
      },
      flatFieldMetadataMaps: {
        byUniversalIdentifier: {
          [FIELD_UNIVERSAL_IDENTIFIER]: {
            universalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
            objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
            name: 'targetPerson',
            type: FieldMetadataType.MORPH_RELATION,
            defaultValue: null,
            isUnique: false,
            universalSettings: { relationType },
          },
        },
      },
    },
  }) as unknown as Parameters<
    FlatIndexValidatorService['validateFlatIndexCreation']
  >[0];

describe('FlatIndexValidatorService', () => {
  const service = new FlatIndexValidatorService();

  it('accepts a unique index on a many-to-one morph member join column', () => {
    const result = service.validateFlatIndexCreation(
      buildCreationArgs(RelationType.MANY_TO_ONE),
    );

    expect(result.errors).toEqual([]);
  });

  it('rejects a unique index on an inverse morph relation', () => {
    const result = service.validateFlatIndexCreation(
      buildCreationArgs(RelationType.ONE_TO_MANY),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            'Unique index cannot be created for field targetPerson of type MORPH_RELATION',
        }),
      ]),
    );
  });
});

describe('required unique text manifest installation and upgrade', () => {
  const applicationUniversalIdentifier = '44444444-4444-4444-8444-444444444444';
  const fieldService = new FlatFieldMetadataValidatorService(new FlatFieldMetadataTypeValidatorService());
  const indexService = new FlatIndexValidatorService();
  const field = (name: string, isUnique: boolean, defaultValue: string | null) =>
    fromFieldManifestToUniversalFlatFieldMetadata({
      fieldManifest: {
        universalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
        objectUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
        type: FieldMetadataType.TEXT,
        name, label: name, isNullable: false, isUnique, defaultValue,
      },
      applicationUniversalIdentifier,
      now: '2026-11-27T00:00:00.000Z',
    });

  const maps = (f: ReturnType<typeof field>) => ({
    ...buildCreationArgs(RelationType.MANY_TO_ONE).optimisticFlatEntityMapsAndRelatedFlatEntityMaps,
    flatFieldMetadataMaps: { byUniversalIdentifier: { [FIELD_UNIVERSAL_IDENTIFIER]: f } },
    flatObjectMetadataMaps: { byUniversalIdentifier: { [OBJECT_UNIVERSAL_IDENTIFIER]: {
      universalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
      labelIdentifierFieldMetadataUniversalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
    } } },
  });
  const indexErrors = (f: ReturnType<typeof field>) =>
    indexService.validateFlatIndexCreation({
      ...buildCreationArgs(RelationType.MANY_TO_ONE),
      optimisticFlatEntityMapsAndRelatedFlatEntityMaps: maps(f),
    } as unknown as Parameters<FlatIndexValidatorService['validateFlatIndexCreation']>[0]).errors;
  const updateErrors = (f: ReturnType<typeof field>) =>
    fieldService.validateFlatFieldMetadataUpdate({
      universalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
      flatEntityUpdate: { defaultValue: null },
      optimisticFlatEntityMapsAndRelatedFlatEntityMaps: maps(f),
      buildOptions: { isSystemBuild: false, applicationUniversalIdentifier },
      workspaceId: '55555555-5555-4555-8555-555555555555',
      additionalCacheDataMaps: {},
    } as unknown as Parameters<FlatFieldMetadataValidatorService['validateFlatFieldMetadataUpdate']>[0]).errors;

  it.each(['tokenHash', 'scopeKey'])('accepts a required unique %s with no default; rejects the old manifest and permits upgrade', (name) => {
    const oldField = field(name, true, "''");
    const newField = field(name, true, null);
    expect(newField).toMatchObject({ isNullable: false, isUnique: true, defaultValue: null });
    expect(indexErrors(oldField)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INDEX_FIELD_INVALID_DEFAULT_VALUE' }),
    ]));
    expect(indexErrors(newField)).toEqual([]);
    expect(updateErrors(oldField)).toEqual([]);
  });

  it('still rejects clearing the default of a non-unique required text field', () => {
    expect(updateErrors(field('name', false, "''"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Default value cannot be null for non-nullable fields' }),
    ]));
  });
});
