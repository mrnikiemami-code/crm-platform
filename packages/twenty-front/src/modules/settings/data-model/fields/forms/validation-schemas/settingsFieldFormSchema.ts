import { settingsDataModelFieldDescriptionFormSchema } from '@/settings/data-model/fields/forms/components/SettingsDataModelFieldDescriptionForm';
import { settingsDataModelFieldIconLabelFormSchema } from '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIconLabelForm';
import { fieldTechnicalNameSchema } from '@/settings/data-model/fields/forms/validation-schemas/fieldTechnicalNameSchema';
import { settingsDataModelFieldSettingsFormSchema } from '@/settings/data-model/fields/forms/validation-schemas/settingsDataModelFieldSettingsFormSchema';
import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { settingsDataModelFieldTypeFormSchema } from '~/pages/settings/data-model/new-field/SettingsObjectNewFieldSelect';

type SettingsFieldFormSchemaOptions = {
  existingOtherLabels?: string[];
  sourceObjectMetadataId?: string;
  isCreationMode?: boolean;
};

export const settingsFieldFormSchema = (
  options: SettingsFieldFormSchemaOptions = {},
) => {
  const {
    existingOtherLabels,
    sourceObjectMetadataId,
    isCreationMode = false,
  } = options;

  const baseSchema = z
    .object({})
    .extend(
      settingsDataModelFieldIconLabelFormSchema(existingOtherLabels).shape,
    )
    .extend(settingsDataModelFieldDescriptionFormSchema().shape)
    .extend(settingsDataModelFieldTypeFormSchema.shape)
    .and(settingsDataModelFieldSettingsFormSchema)
    .refine((data) => {
      const formData = data as {
        type?: FieldMetadataType;
        morphRelationObjectMetadataIds?: string[];
      };
      if (formData.type !== FieldMetadataType.MORPH_RELATION) return true;
      if (!isDefined(sourceObjectMetadataId)) return true;
      if (
        !isDefined(formData.morphRelationObjectMetadataIds) ||
        formData.morphRelationObjectMetadataIds.length <= 1
      )
        return true;
      if (
        formData.morphRelationObjectMetadataIds.includes(sourceObjectMetadataId)
      )
        return false;
      return true;
    })
    .superRefine((data, ctx) => {
      const { label, name } = data as { label?: string; name?: string };

      if (!isCreationMode || !hasNonLatinLetters(label)) return;

      const technicalNameResult = fieldTechnicalNameSchema(
        existingOtherLabels,
      ).safeParse(name ?? '');

      if (!technicalNameResult.success) {
        ctx.addIssue({
          code: 'custom',
          message: technicalNameResult.error.issues[0]?.message,
          path: ['name'],
        });
      }
    });

  return baseSchema;
};
