import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type StudioPerson } from 'src/studio/template-studio-logic';

// Reads a BOUNDED list of the People this caller may read, for the studio's
// sample-recipient picker.
//
// Why bounded: the app can only build a filter from field names it has verified
// are queryable, and the studio must never risk a runtime failure it cannot
// test. This read therefore asks for a page of accessible records, ordered by a
// scalar the app already orders by elsewhere, and the picker filters that list
// in the UI. The platform still decides ACCESS: it returns only records the
// caller is permitted to read, so the list is server-authoritative.
export const STUDIO_PEOPLE_LIMIT = 50;

type RawPersonNode = {
  id?: string | null;
  name?: { firstName?: string | null; lastName?: string | null } | null;
};

export const findStudioPeople = async ({
  client,
  limit = STUDIO_PEOPLE_LIMIT,
}: {
  client: Pick<CoreApiClient, 'query'>;
  limit?: number;
}): Promise<StudioPerson[]> => {
  const result = await client.query({
    people: {
      __args: {
        first: limit,
        orderBy: [{ createdAt: 'DescNullsLast' }],
      },
      edges: {
        node: {
          id: true,
          name: { firstName: true, lastName: true },
        },
      },
    },
  });

  const edges: { node?: RawPersonNode | null }[] = result.people?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter(
      (node): node is RawPersonNode =>
        node !== undefined && node !== null && typeof node.id === 'string',
    )
    .map((node) => {
      const parts = [
        node.name?.firstName?.trim() ?? '',
        node.name?.lastName?.trim() ?? '',
      ].filter((part) => part.length > 0);

      return {
        id: node.id as string,
        displayName: parts.join(' '),
      };
    });
};
