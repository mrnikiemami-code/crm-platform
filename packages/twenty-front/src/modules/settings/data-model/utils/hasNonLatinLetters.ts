import { isNonEmptyString } from '@sniptt/guards';

export const hasNonLatinLetters = (value: string | undefined | null) =>
  isNonEmptyString(value) && /(?!\p{Script=Latin})\p{Letter}/u.test(value);
