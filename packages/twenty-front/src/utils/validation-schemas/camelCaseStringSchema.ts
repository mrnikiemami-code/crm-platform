import { t } from '@lingui/core/macro';
import camelCase from 'lodash.camelcase';
import { z } from 'zod';

export const camelCaseStringSchema = z
  .string()
  .refine((value) => camelCase(value) === value, {
    error: () => t`String should be camel case`,
  });
