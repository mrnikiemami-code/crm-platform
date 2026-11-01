export const SALES_FUNNEL_MARKER_KEY = '__salesFunnel';

export const SALES_FUNNEL_STAGE_OPTION = {
  ALL: 'S1_LEAD',
  CONTACTED: 'S2_CONTACTED',
  REGISTERED: 'S3_REGISTERED',
} as const;

export type SalesFunnelMarker = {
  // Option field the cumulative tiers are stored on (multi-select).
  optionFieldMetadataId: string;
  // Existing verified view listing leads with no linked interaction.
  uncontactedViewId?: string;
};

export const getSalesFunnelMarker = (
  configuration: unknown,
): SalesFunnelMarker | null => {
  const filter = (configuration as { filter?: unknown } | null | undefined)
    ?.filter;

  if (!filter || typeof filter !== 'object') {
    return null;
  }

  const marker = (filter as Record<string, unknown>)[SALES_FUNNEL_MARKER_KEY];

  if (!marker || typeof marker !== 'object') {
    return null;
  }

  const optionFieldMetadataId = (marker as Record<string, unknown>)
    .optionFieldMetadataId;

  if (typeof optionFieldMetadataId !== 'string') {
    return null;
  }

  const uncontactedViewId = (marker as Record<string, unknown>)
    .uncontactedViewId;

  return {
    optionFieldMetadataId,
    uncontactedViewId:
      typeof uncontactedViewId === 'string' ? uncontactedViewId : undefined,
  };
};
