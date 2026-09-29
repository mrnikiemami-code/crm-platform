import { settingsDataModelFieldDescriptionFormSchema } from '@/settings/data-model/fields/forms/components/SettingsDataModelFieldDescriptionForm';
import { settingsDataModelFieldIconLabelFormSchema } from '@/settings/data-model/fields/forms/components/SettingsDataModelFieldIconLabelForm';
import { fieldTechnicalNameSchema } from '@/settings/data-model/fields/forms/validation-schemas/fieldTechnicalNameSchema';
import { settingsDataModelFieldSettingsFormSchema } from '@/settings/data-model/fields/forms/validation-schemas/settingsDataModelFieldSettingsFormSchema';
import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { settingsDataModelFieldTypeFormSchema } from '~/pages/settings/data-model/new-field/SettingsObjectNewFieldSelect';
import { camelCaseStringSchema } from '~/utils/validation-schemas/camelCaseStringSchema';

type SettingsFieldFormSchemaOptions = {
  existingOtherLabels?: string[];
  sourceObjectMetadataId?: string;
  isCreationMode?: boolean;
  initialName?: string;
  otherFieldNames?: string[];
};

export const settingsFieldFormSchema = (
  options: SettingsFieldFormSchemaOptions = {},
) => {
  const {
    existingOtherLabels,
    sourceObjectMetadataId,
    isCreationMode = false,
    initialName,
    otherFieldNames = [],
  } = options;

  const isEditingStoredName = !isCreationMode && isDefined(initialName);

  const baseSchema = z
    .object({})
    .extend(
      settingsDataModelFieldIconLabelFormSchema(existingOtherLabels).shape,
    )
    // The name is validated below, so it gets the technical name messages
    // instead of the generic camel case one
    .extend(
      isCreationMode || isEditingStoredName
        ? { name: z.string().optional() }
        : {},
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

      if (isEditingStoredName) {
        // Stored names are kept as is, even when they predate these rules
        if (!isDefined(name) || name === initialName) return;

        const editedNameResult =
          fieldTechnicalNameSchema(otherFieldNames).safeParse(name);

        if (!editedNameResult.success) {
          ctx.addIssue({
            code: 'custom',
            message: editedNameResult.error.issues[0]?.message,
            path: ['name'],
          });
        }
        return;
      }

      if (!isCreationMode) return;

      const technicalNameResult = hasNonLatinLetters(label)
        ? fieldTechnicalNameSchema(existingOtherLabels).safeParse(name ?? '')
        : camelCaseStringSchema.optional().safeParse(name);

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
