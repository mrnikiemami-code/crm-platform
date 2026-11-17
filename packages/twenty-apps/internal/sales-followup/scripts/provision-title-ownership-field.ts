/**
 * Adds the `titleIsAuto` field this app owns on `salesInteraction`.
 *
 * WHY A SCRIPT AND NOT A FIELD MANIFEST: `salesInteraction` belongs to the
 * workspace's CUSTOM application. An app cannot declare fields on objects it does
 * not own, so the field is created once per workspace through the platform's own
 * data-model API — the same mutation the data-model settings use. This is the
 * established pattern in this repository (`record-access/scripts/
 * create-assignee-fields.ts`).
 *
 * The field is a nullable BOOLEAN with default `false`. Conservative on purpose:
 * every title that exists before this app was written by a person, so `false`
 * means "hand-written, never overwrite". A mistake in the other direction would
 * destroy text somebody typed.
 *
 * Idempotent and verifying: an existing field is checked for the exact shape the
 * title logic needs (BOOLEAN, nullable). A same-named field of another type stops
 * the run instead of leaving ownership decisions silently wrong. Pagination is
 * walked to the end so a field on page two is not mistaken for a missing one.
 *
 * Usage (Dev only):
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/sales-followup/scripts/provision-title-ownership-field.ts [--check]
 */

import {
  describeTitleOwnershipFieldProblem,
  findTitleOwnershipFieldProblems,
  TITLE_OWNERSHIP_DEFAULT,
  TITLE_OWNERSHIP_FIELD_DESCRIPTION,
  TITLE_OWNERSHIP_FIELD_LABEL,
  TITLE_OWNERSHIP_FIELD_NAME,
  type TitleOwnershipFieldShape,
} from '../src/domain/title-ownership';
import { SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER } from '../src/constants/universal-identifiers';

const API_URL = process.env.TWENTY_API_URL;
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Set TWENTY_API_URL and TWENTY_API_KEY (an admin key).');
  process.exit(1);
}

const PAGE_SIZE = 100;

type ObjectNode = {
  id: string;
  nameSingular: string;
  universalIdentifier: string;
};

type FieldNode = TitleOwnershipFieldShape & {
  universalIdentifier?: string | null;
  defaultValue?: unknown;
};

const request = async <TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> => {
  const response = await fetch(`${API_URL}/metadata`, {
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

const findObject = async (
  objectUniversalIdentifier: string,
): Promise<ObjectNode> => {
  const data = await request<{ objects: { edges: { node: ObjectNode }[] } }>(
    `query FindObject($universalIdentifier: UUID!) {
      objects(paging: { first: 1 }, filter: { universalIdentifier: { eq: $universalIdentifier } }) {
        edges { node { id nameSingular universalIdentifier } }
      }
    }`,
    { universalIdentifier: objectUniversalIdentifier },
  );

  const node = data.objects.edges[0]?.node;

  if (node === undefined) {
    throw new Error(
      `Object ${objectUniversalIdentifier} not found in this workspace. Check that the identifiers in src/constants/universal-identifiers.ts belong to THIS workspace.`,
    );
  }

  return node;
};

type FieldPage = {
  fields: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: FieldNode }[];
  };
};

const listAllFields = async (
  objectMetadataId: string,
): Promise<FieldNode[]> => {
  const fields: FieldNode[] = [];
  let after: string | null = null;

  for (let page = 0; page < 50; page += 1) {
    // Annotated so the cursor assignment below cannot make `data` infer from
    // itself through `after`.
    const data: FieldPage = await request<FieldPage>(
      `query FieldsOfObject($objectMetadataId: UUID!, $after: ConnectionCursor) {
        fields(
          paging: { first: ${PAGE_SIZE}, after: $after }
          filter: { objectMetadataId: { eq: $objectMetadataId } }
        ) {
          pageInfo { hasNextPage endCursor }
          edges { node { name type isNullable defaultValue universalIdentifier } }
        }
      }`,
      { objectMetadataId, after },
    );

    fields.push(...data.fields.edges.map((edge) => edge.node));

    if (!data.fields.pageInfo.hasNextPage) {
      return fields;
    }

    after = data.fields.pageInfo.endCursor;

    if (after === null) {
      throw new Error(
        `Pagination for object ${objectMetadataId} reported another page without a cursor; refusing to guess what is missing.`,
      );
    }
  }

  throw new Error(
    `Pagination for object ${objectMetadataId} did not finish; refusing to act on an incomplete field list.`,
  );
};

const createField = async (objectMetadataId: string): Promise<FieldNode> => {
  const data = await request<{ createOneField: FieldNode }>(
    `mutation CreateTitleOwnership($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        name
        type
        isNullable
        defaultValue
        universalIdentifier
      }
    }`,
    {
      input: {
        field: {
          objectMetadataId,
          type: 'BOOLEAN',
          name: TITLE_OWNERSHIP_FIELD_NAME,
          label: TITLE_OWNERSHIP_FIELD_LABEL,
          description: TITLE_OWNERSHIP_FIELD_DESCRIPTION,
          icon: 'IconToggleLeft',
          isNullable: true,
          // No `universalIdentifier` here: this server's `CreateFieldInput` does
          // not accept one, so the platform generates it. That is acceptable —
          // nothing in the logic keys off the field's UID; it resolves the field
          // by NAME on this object.
          defaultValue: TITLE_OWNERSHIP_DEFAULT,
        },
      },
    },
  );

  return data.createOneField;
};

const main = async (): Promise<void> => {
  const checkOnly = process.argv.includes('--check');
  const object = await findObject(
    SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
  );
  const fields = await listAllFields(object.id);
  const existing = fields.find(
    (field) => field.name === TITLE_OWNERSHIP_FIELD_NAME,
  );

  console.log(`object: ${object.nameSingular} (${object.id})`);
  console.log(`field : ${TITLE_OWNERSHIP_FIELD_NAME}`);

  if (existing !== undefined) {
    const problems = findTitleOwnershipFieldProblems(existing);

    if (problems.length > 0) {
      const details = problems.map((problem) =>
        describeTitleOwnershipFieldProblem(object.nameSingular, problem),
      );

      console.error(`INVALID SHAPE -> ${details.join('; ')}`);
      process.exitCode = 2;
      return;
    }

    console.log(
      `status: PRESENT, shape verified -> ${existing.universalIdentifier ?? '(no uid)'}`,
    );
    return;
  }

  if (checkOnly) {
    console.log('status: MISSING (check only, nothing created)');
    process.exitCode = 1;
    return;
  }

  const created = await createField(object.id);

  console.log(
    `status: CREATED -> ${created.universalIdentifier ?? '(no uid)'}`,
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
