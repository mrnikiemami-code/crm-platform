import { isNonEmptyString } from '@sniptt/guards';

// COUNT widgets often aggregate on the UUID id field; the server axis then
// surfaces "Count all of ID" which is not a user-facing metric name.
const TECHNICAL_AGGREGATE_AXIS_PATTERN =
  /^(count(?:\s+all)?|sum|average|avg|min|max)\s+of\s+(id|uuid)$/i;

export const sanitizeChartAxisLabel = (
  label: string | null | undefined,
): string | undefined => {
  if (!isNonEmptyString(label)) {
    return undefined;
  }

  const trimmed = label.trim();

  if (TECHNICAL_AGGREGATE_AXIS_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
};
