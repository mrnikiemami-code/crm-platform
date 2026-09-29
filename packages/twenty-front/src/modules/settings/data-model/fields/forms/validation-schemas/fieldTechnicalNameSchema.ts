import { t } from '@lingui/core/macro';
import camelCase from 'lodash.camelcase';
import {
  IDENTIFIER_MAX_CHAR_LENGTH,
  RESERVED_METADATA_NAME_KEYWORDS,
} from 'twenty-shared/metadata';
import { z } from 'zod';

const getInvalidFieldTechnicalNameMessage = () =>
  t`Use only Latin letters and digits in camelCase, starting with a lowercase letter (e.g. eventTitle)`;

// Mirrors the server-side field name validation
export const fieldTechnicalNameSchema = (existingFieldNames: string[] = []) =>
  z
    .string()
    .min(1, { error: () => t`Technical name is required` })
    .max(IDENTIFIER_MAX_CHAR_LENGTH, {
      error: getInvalidFieldTechnicalNameMessage,
    })
    .regex(/^[a-zA-Z]/, {
      error: () => t`Technical name must start with a Latin letter`,
    })
    .regex(/^[a-z][a-zA-Z0-9]*$/, {
      error: getInvalidFieldTechnicalNameMessage,
    })
    .refine((value) => camelCase(value) === value, {
      error: getInvalidFieldTechnicalNameMessage,
    })
    .refine((value) => !RESERVED_METADATA_NAME_KEYWORDS.includes(value), {
      error: () => t`This technical name is reserved, choose another one`,
    })
    .refine((value) => !existingFieldNames.includes(value), {
      error: () => t`This technical name is already used by another field`,
    });
