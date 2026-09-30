import { isDefined } from 'twenty-shared/utils';

import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

let standardFieldOptionCanonicalLabelById: Map<string, string> | undefined;

// Standard select options carry fixed ids across workspaces, so the id plus
// the untouched source label is what proves an option is still the standard
// default rather than a user-authored or renamed one.
export const getStandardFieldOptionCanonicalLabelById = (): Map<
  string,
  string
> => {
  if (isDefined(standardFieldOptionCanonicalLabelById)) {
    return standardFieldOptionCanonicalLabelById;
  }

  const { allFlatEntityMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      now: new Date(0).toISOString(),
      workspaceId: '20202020-0000-4000-8000-000000000000',
      twentyStandardApplicationId: '20202020-0000-4000-8000-000000000001',
    });

  const canonicalLabelById = new Map<string, string>();

  for (const flatFieldMetadata of Object.values(
    allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier,
  )) {
    const options = flatFieldMetadata?.options;

    if (!Array.isArray(options)) {
      continue;
    }

    for (const option of options) {
      if (
        isDefined(option) &&
        typeof option.id === 'string' &&
        typeof option.label === 'string'
      ) {
        canonicalLabelById.set(option.id, option.label);
      }
    }
  }

  standardFieldOptionCanonicalLabelById = canonicalLabelById;

  return canonicalLabelById;
};
