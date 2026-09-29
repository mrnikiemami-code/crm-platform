import { getFieldUniversalIdentifier } from 'twenty-shared/application';
import { FieldMetadataType, MetadataWritability } from 'twenty-shared/types';

import { DEFAULT_NAME_FIELD_LABEL } from 'src/engine/metadata-modules/object-metadata/constants/default-name-field-label.constant';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { type UniversalFlatObjectMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-object-metadata.type';

type BuildNameFlatFieldMetadataForCustomObjectArgs = {
  flatObjectMetadata: Pick<
    UniversalFlatObjectMetadata,
    'universalIdentifier' | 'applicationUniversalIdentifier'
  >;
  label?: string;
};

export const buildNameFlatFieldMetadataForCustomObject = ({
  flatObjectMetadata: {
    applicationUniversalIdentifier,
    universalIdentifier: objectMetadataUniversalIdentifier,
  },
  label = DEFAULT_NAME_FIELD_LABEL,
}: BuildNameFlatFieldMetadataForCustomObjectArgs): UniversalFlatFieldMetadata<FieldMetadataType.TEXT> => {
  const now = new Date().toISOString();

  return {
    type: FieldMetadataType.TEXT,
    isLabelSyncedWithName: false,
    isUnique: false,
    isSearchable: true,
    isAuditLogged: true,
    universalIdentifier: getFieldUniversalIdentifier({
      applicationUniversalIdentifier,
      objectUniversalIdentifier: objectMetadataUniversalIdentifier,
      name: 'name',
    }),
    name: 'name',
    label,
    icon: 'IconAbc',
    description: label,
    isNullable: true,
    isActive: true,
    isSystem: false,
    isSystemSideEffect: false,
    isUIEditable: true,
    writability: MetadataWritability.OPEN,
    defaultValue: null,
    createdAt: now,
    updatedAt: now,
    options: null,
    overrides: null,
    morphId: null,
    applicationUniversalIdentifier,
    objectMetadataUniversalIdentifier,
    relationTargetObjectMetadataUniversalIdentifier: null,
    relationTargetFieldMetadataUniversalIdentifier: null,
    viewFilterUniversalIdentifiers: [],
    viewFieldUniversalIdentifiers: [],
    kanbanAggregateOperationViewUniversalIdentifiers: [],
    calendarViewUniversalIdentifiers: [],
    calendarEndViewUniversalIdentifiers: [],
    mainGroupByFieldMetadataViewUniversalIdentifiers: [],
    fieldPermissionUniversalIdentifiers: [],
    universalSettings: null,
    viewSortUniversalIdentifiers: [],
    searchFieldMetadataUniversalIdentifiers: [],
  };
};
