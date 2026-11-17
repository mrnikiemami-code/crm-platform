/**
 * Fills the empty sales follow-up titles, once, under review.
 *
 * DEFAULT IS A DRY RUN. It reads, plans and prints; it writes only with `--apply`.
 * That is the whole point: 190 titles on production are being described here, and
 * a plan a person can read is what makes the write safe.
 *
 * Rules (see `src/domain/backfill-plan.ts`):
 *  - an EMPTY title is filled from the attempt and the customer name, and the row
 *    is marked automatic so later edits follow it;
 *  - a NON-EMPTY title is preserved untouched, including the legacy ones whose
 *    ownership flag is `null` — those are the hand-written titles this must never
 *    destroy.
 *
 * Re-running is safe: a filled title no longer reads as empty, and the plan reports
 * it as unchanged.
 *
 * Usage:
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/sales-followup/scripts/backfill-titles.ts [--apply] [--limit=500]
 */

import {
  planTitleBackfill,
  type BackfillRecord,
} from '../src/domain/backfill-plan';

const API_URL = process.env.TWENTY_API_URL;
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Set TWENTY_API_URL and TWENTY_API_KEY (an admin key).');
  process.exit(1);
}

const DEFAULT_LIMIT = 500;
const PAGE_SIZE = 100;

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT =
  limitArg === undefined ? DEFAULT_LIMIT : Number(limitArg.split('=')[1]);

if (!Number.isInteger(LIMIT) || LIMIT <= 0) {
  console.error('--limit must be a positive integer.');
  process.exit(1);
}

type GraphqlNode = Record<string, unknown>;

const request = async <TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> => {
  const response = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as { data?: TData; errors?: unknown };

  if (payload.errors !== undefined) {
    throw new Error(JSON.stringify(payload.errors));
  }

  if (payload.data === undefined) {
    throw new Error('No data in the response');
  }

  return payload.data;
};

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

type RawInteraction = {
  id: string;
  name: string | null;
  callAttempt: string | null;
  titleIsAuto: boolean | null;
  eventLeadId: string | null;
};

type InteractionPage = {
  salesInteractions: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: GraphqlNode }[];
  };
};

const listInteractions = async (): Promise<RawInteraction[]> => {
  const collected: RawInteraction[] = [];
  let after: string | null = null;

  for (let page = 0; page < 200 && collected.length < LIMIT; page += 1) {
    // Annotated so the cursor assignment below cannot make `data` infer from
    // itself through `after`.
    const data: InteractionPage = await request<InteractionPage>(
      `query Interactions($first: Int!, $after: ConnectionCursor) {
        salesInteractions(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges {
            node { id name callAttempt titleIsAuto eventLead { personId } }
          }
        }
      }`,
      { first: PAGE_SIZE, after },
    );

    for (const edge of data.salesInteractions.edges) {
      const lead = edge.node['eventLead'] as { personId?: unknown } | null;

      collected.push({
        id: String(edge.node['id']),
        name: asText(edge.node['name']),
        callAttempt: asText(edge.node['callAttempt']),
        titleIsAuto: asBoolean(edge.node['titleIsAuto']),
        eventLeadId: asText(lead?.personId),
      });

      if (collected.length >= LIMIT) {
        break;
      }
    }

    if (!data.salesInteractions.pageInfo.hasNextPage) {
      return collected;
    }

    after = data.salesInteractions.pageInfo.endCursor;

    if (after === null) {
      throw new Error(
        'Pagination reported another page without a cursor; refusing to guess what is missing.',
      );
    }
  }

  return collected;
};

// Names are read in ONE bulk query rather than per record: the API allows 100
// requests per minute, and a per-record read would exceed that on a workspace of
// this size — turning a dry run into a rate-limit error instead of a report.
type PersonName = { first: string | null; last: string | null };

const findPersonNames = async (
  personIds: readonly string[],
): Promise<Map<string, PersonName>> => {
  const unique = [...new Set(personIds.filter((id) => id.length > 0))];
  const byId = new Map<string, PersonName>();

  for (let start = 0; start < unique.length; start += PAGE_SIZE) {
    const batch = unique.slice(start, start + PAGE_SIZE);

    if (batch.length === 0) {
      continue;
    }

    const data = await request<{
      people: { edges: { node: GraphqlNode }[] };
    }>(
      `query People($ids: [UUID!]) {
        people(first: ${PAGE_SIZE}, filter: { id: { in: $ids } }) {
          edges { node { id nameFirstName nameLastName } }
        }
      }`,
      { ids: batch },
    );

    for (const edge of data.people.edges) {
      const id = asText(edge.node['id']);

      if (id === null) {
        continue;
      }

      byId.set(id, {
        first: asText(edge.node['nameFirstName']),
        last: asText(edge.node['nameLastName']),
      });
    }
  }

  return byId;
};

const applyTitle = async (id: string, title: string): Promise<void> => {
  await request(
    `mutation SetTitle($id: UUID!, $name: String!) {
      updateSalesInteraction(id: $id, data: { name: $name, titleIsAuto: true }) { id }
    }`,
    { id, name: title },
  );
};

const main = async (): Promise<void> => {
  const apply = process.argv.includes('--apply');

  console.log(`mode : ${apply ? 'APPLY' : 'DRY RUN (no writes)'}`);
  console.log(`url  : ${API_URL}`);
  console.log(`limit: ${LIMIT}`);

  const raw = await listInteractions();
  const namesByPersonId = await findPersonNames(
    raw.map((interaction) => interaction.eventLeadId ?? ''),
  );
  const records: BackfillRecord[] = raw.map((interaction) => {
    const name =
      interaction.eventLeadId === null
        ? undefined
        : namesByPersonId.get(interaction.eventLeadId);

    return {
      id: interaction.id,
      callAttempt: interaction.callAttempt,
      customerFirstName: name?.first ?? null,
      customerLastName: name?.last ?? null,
      title: interaction.name,
      titleIsAuto: interaction.titleIsAuto,
    };
  });

  const plan = planTitleBackfill(records);

  console.log('');
  console.log(`scanned          : ${records.length}`);
  console.log(`would fill       : ${plan.fill}`);
  console.log(`preserve         : ${plan.preserve}`);
  console.log(`  hand-written   : ${plan.preserveManual}`);
  console.log(`  unbuildable    : ${plan.preserveUnbuildable}`);

  const samples = plan.items
    .filter((item) => item.action === 'FILL')
    .slice(0, 8);

  if (samples.length > 0) {
    console.log('');
    console.log('sample of the titles it would write:');

    for (const sample of samples) {
      if (sample.action === 'FILL') {
        console.log(`  ${sample.id}  ${sample.title}`);
      }
    }
  }

  const preserved = plan.items
    .filter(
      (item) => item.action === 'PRESERVE' && item.because === 'TITLE_MANUAL',
    )
    .slice(0, 5);

  if (preserved.length > 0) {
    console.log('');
    console.log('hand-written titles that stay untouched:');

    for (const item of preserved) {
      console.log(`  ${item.id}  ${item.title ?? '(null)'}`);
    }
  }

  if (!apply) {
    console.log('');
    console.log(
      'Nothing was written. Re-run with --apply to perform this plan.',
    );
    return;
  }

  let written = 0;

  for (const item of plan.items) {
    if (item.action !== 'FILL') {
      continue;
    }

    await applyTitle(item.id, item.title);
    written += 1;
  }

  console.log('');
  console.log(`written: ${written}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
