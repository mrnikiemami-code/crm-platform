import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  STUDIO_PEOPLE_PAGE_SIZE,
  type StudioPeoplePageInfo,
  type StudioPerson,
} from 'src/studio/template-studio-logic';
import { buildPersonPhoneOptions, type PersonPhones } from 'src/logic-functions/types/person-phone.type';

// Reads ONE page of the People this caller may read, for the studio's
// sample-recipient picker.
//
// Why paged and not "first: 50": a real workspace can hold ~100k People, so the
// picker must never ask for the whole table. It walks the connection with a
// cursor and the browser appends each page, which keeps every request small and
// bounded no matter how large the table is.
//
// Why the search is server-side: filtering only the page already in the browser
// would make a Person outside the first page unfindable. The filter is applied
// by the workspace API, so the search covers the whole authorized table while
// still returning only what this caller is allowed to read — access control
// stays entirely server-authoritative.
//
// The platform still decides ACCESS: the API returns only records the caller is
// permitted to read, so an empty page means "nothing readable matches", never
// "no such record exists".

type RawPersonNode = {
  id?: string | null;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  phones?: PersonPhones;
};

type RawPageInfo = {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
};

export type StudioPeoplePage = {
  people: StudioPerson[];
  pageInfo: StudioPeoplePageInfo;
};

/**
 * Escapes the characters that carry meaning inside a SQL `LIKE` pattern, so a
 * name or phone that contains `%` or `_` is searched for literally instead of
 * being treated as a wildcard.
 */
const toLikePattern = (value: string): string =>
  `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

/**
 * Builds the search filter.
 *
 * The name clauses are always safe. The phone clause depends on the workspace's
 * `phones` composite being filterable, which is a property of the platform
 * build rather than of this app, so it is added LAST and the caller falls back
 * to a name-only search when the platform rejects it. A phone search therefore
 * degrades to "no phone match" instead of failing the whole picker.
 */
const buildSearchFilter = (
  search: string,
  { includePhone }: { includePhone: boolean },
): Record<string, unknown> => {
  const pattern = toLikePattern(search);

  const clauses: Record<string, unknown>[] = [
    { name: { firstName: { ilike: pattern } } },
    { name: { lastName: { ilike: pattern } } },
  ];

  if (includePhone) {
    clauses.push({ phones: { primaryPhoneNumber: { ilike: pattern } } });
  }

  return { or: clauses };
};

/** True when the query can only be a phone number, so the name search is skipped. */
const looksLikePhoneQuery = (search: string): boolean => {
  const digits = search.replace(/\D+/g, '');

  // At least three digits, and no letters at all: `0912` is a phone search
  // while `0912 ali` is a name search that also happens to contain digits.
  return digits.length >= 3 && !/[A-Za-z\u0600-\u06FF]/.test(search);
};

const readPage = async ({
  client,
  search,
  after,
  limit,
}: {
  client: Pick<CoreApiClient, 'query'>;
  search: string;
  after: string | null;
  limit: number;
}): Promise<StudioPeoplePage> => {
  const isPhoneOnly = looksLikePhoneQuery(search);

  // A phone-only query cannot match a name, so the name clauses are pointless
  // and requesting them would only slow the query down.
  const filter =
    search.length === 0
      ? undefined
      : buildSearchFilter(search, { includePhone: true });

  const runQuery = async (nextFilter: Record<string, unknown> | undefined) =>
    client.query({
      people: {
        __args: {
          first: limit,
          // Cursor paging, never OFFSET: it stays cheap on a 100k-row table and
          // cannot skip or double-count rows that are inserted while scrolling.
          after: after ?? undefined,
          orderBy: [{ createdAt: 'DescNullsLast' }],
          ...(nextFilter === undefined ? {} : { filter: nextFilter }),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: {
          node: {
            id: true,
            name: { firstName: true, lastName: true },
            phones: {
              primaryPhoneNumber: true,
              primaryPhoneCallingCode: true,
              additionalPhones: { number: true },
            },
          },
        },
      },
    });

  let result: Awaited<ReturnType<typeof runQuery>>;

  try {
    result = await runQuery(filter);
  } catch (error) {
    // The phone clause is the only field-dependent part of the filter. When the
    // platform refuses it, retry name-only so the picker still works and the
    // phone search simply reports no match.
    if (filter === undefined || !looksLikePhoneQuery(search)) {
      throw error;
    }

    result = await runQuery(
      buildSearchFilter(search, { includePhone: false }),
    );
  }

  const edges: { node?: RawPersonNode | null }[] =
    (result as { people?: { edges?: { node?: RawPersonNode | null }[] } })
      .people?.edges ?? [];
  const pageInfo: RawPageInfo =
    (result as { people?: { pageInfo?: RawPageInfo } }).people?.pageInfo ?? {};

  const people = edges
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

      // Reuse the phone pipeline the rest of the app already trusts, so the
      // picker shows the same number the sender would actually use.
      const phoneOptions = buildPersonPhoneOptions(node.phones ?? null);
      const phone = phoneOptions[0]?.value ?? '';

      return {
        id: node.id as string,
        displayName: parts.join(' '),
        phone,
      };
    })
    // A phone-only search must not list rows whose phone did not match.
    .filter((person) =>
      isPhoneOnly
        ? person.phone
            .replace(/\D+/g, '')
            .includes(search.replace(/\D+/g, ''))
        : true,
    );

  return {
    people,
    pageInfo: {
      hasMore: pageInfo.hasNextPage === true,
      endCursor:
        typeof pageInfo.endCursor === 'string' ? pageInfo.endCursor : null,
    },
  };
};

export const findStudioPeople = async ({
  client,
  search = '',
  after = null,
  limit = STUDIO_PEOPLE_PAGE_SIZE,
}: {
  client: Pick<CoreApiClient, 'query'>;
  search?: string;
  after?: string | null;
  limit?: number;
}): Promise<StudioPeoplePage> =>
  readPage({
    client,
    search: search.trim(),
    after,
    // Clamp the page size: a client may ask for less, never for an unbounded
    // page.
    limit: Math.min(Math.max(limit, 1), STUDIO_PEOPLE_PAGE_SIZE),
  });
