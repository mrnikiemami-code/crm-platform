import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { t } from '@lingui/core/macro';
import camelCase from 'lodash.camelcase';
import { RESERVED_METADATA_NAME_KEYWORDS } from 'twenty-shared/metadata';
import { themeColorSchema } from 'twenty-ui/utilities';
import { type ZodType, z } from 'zod';
import { type ReadonlyKeysArray } from '~/types/ReadonlyKeysArray';
import { zodNonEmptyString } from '~/types/ZodNonEmptyString';

type ZodTypeSettingsDataModelFormFields = ZodType<
  Pick<
    EnrichedObjectMetadataItem,
    | 'color'
    | 'labelSingular'
    | 'labelPlural'
    | 'description'
    | 'icon'
    | 'namePlural'
    | 'nameSingular'
    | 'isLabelSyncedWithName'
  > & { skipNameField?: boolean }
>;

const getInvalidTechnicalNameMessage = () =>
  t`Use only Latin letters and digits in camelCase, starting with a lowercase letter (e.g. academyEvent)`;

// Mirrors the server-side object name validation
const objectTechnicalNameSchema = z
  .string()
  .min(1, { error: () => t`Technical name is required` })
  .regex(/^[a-z][a-zA-Z0-9]*$/, { error: getInvalidTechnicalNameMessage })
  .refine((value) => camelCase(value) === value, {
    error: getInvalidTechnicalNameMessage,
  })
  .refine((value) => !RESERVED_METADATA_NAME_KEYWORDS.includes(value), {
    error: () => t`This technical name is reserved, choose another one`,
  });

const settingsDataModelFormFieldsSchema = z.object({
  color: themeColorSchema.optional(),
  description: z.string().nullish(),
  icon: z.string().optional(),
  labelSingular: zodNonEmptyString,
  labelPlural: zodNonEmptyString,
  namePlural: objectTechnicalNameSchema,
  nameSingular: objectTechnicalNameSchema,
  isLabelSyncedWithName: z.boolean(),
  skipNameField: z.boolean().optional(),
}) satisfies ZodTypeSettingsDataModelFormFields;

export const settingsDataModelObjectAboutFormSchema =
  settingsDataModelFormFieldsSchema.superRefine(
    ({ namePlural, nameSingular }, ctx) => {
      const nameAreDifferent =
        nameSingular.toLowerCase() !== namePlural.toLowerCase();
      if (!nameAreDifferent) {
        const nameFields: ReadonlyKeysArray<EnrichedObjectMetadataItem> = [
          'nameSingular',
          'namePlural',
        ];
        nameFields.forEach((field) =>
          ctx.addIssue({
            code: 'custom',
            message: t`Singular and plural names must be different`,
            path: [field],
          }),
        );
      }
    },
  );
export type SettingsDataModelObjectAboutFormValues = z.infer<
  typeof settingsDataModelObjectAboutFormSchema
>;
