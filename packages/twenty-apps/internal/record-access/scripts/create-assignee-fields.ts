/**
 * Creates the four `assignee` fields this app's policy depends on.
 *
 * WHY A SCRIPT AND NOT A FIELD MANIFEST: person is a standard object, while
 * eventLead, eventRegistration, registrationPayment and salesInteraction belong
 * to the workspace's CUSTOM application. An app cannot declare fields on objects
 * it does not own, so these are created once per workspace through the platform's
 * own data-model API — the same mutation the data-model settings use.
 *
 * Idempotent and verifying: an existing field is checked for the exact shape the
 * triggers and the role need (RELATION, target workspaceMember, MANY_TO_ONE,
 * join column assigneeId, nullable). A same-named field of any other shape stops
 * the run instead of leaving a rule that silently never matches.
 *
 * Pagination is walked to the end: the metadata connection pages at 10 by default,
 * so a field on page two would otherwise look absent and the run would try to
 * create a field that already exists.
 *
 * Prints the universal identifiers to record — use
 * scripts/generate-workspace-identifiers.ts, which does this and writes the
 * workspace file for you.
 *
 * Usage:
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/record-access/scripts/create-assignee-fields.ts
 */

import {
  ASSIGNEE_FIELD_NAME,
  describeAssigneeFieldProblem,
  findAssigneeFieldProblems,
  type AssigneeFieldShape,
} from '../src/domain/assignee-field';
import {
  EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
} from '../src/constants/universal-identifiers';

const API_URL = process.env.TWENTY_API_URL;
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Set TWENTY_API_URL and TWENTY_API_KEY (an admin key).');
  process.exit(1);
}

const PAGE_SIZE = 100;

type ObjectNode = { id: string; nameSingular: string; universalIdentifier: string };

type FieldNode = AssigneeFieldShape & { universalIdentifier: string };

const TARGETS = [
  {
    objectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
    reverseLabel: 'اشخاص تخصیص‌یافته',
    reverseIcon: 'IconUsers',
  },
  {
    objectUniversalIdentifier: EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
    reverseLabel: 'ثبت‌نام‌های تخصیص‌یافته',
    reverseIcon: 'IconClipboardList',
  },
  {
    objectUniversalIdentifier: REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    reverseLabel: 'پرداخت‌های تخصیص‌یافته',
    reverseIcon: 'IconCreditCard',
  },
  {
    objectUniversalIdentifier: SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
    reverseLabel: 'پیگیری‌های تخصیص‌یافته',
    reverseIcon: 'IconPhone',
  },
] as const;

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
      `Object ${objectUniversalIdentifier} not found in this workspace. Check that the field identifiers in src/constants/universal-identifiers.ts belong to THIS workspace.`,
    );
  }

  return node;
};

// Walks the connection to the end. A field that lives past the first page would
// otherwise look absent, and the run would try to create a duplicate.
const listAllFields = async (objectMetadataId: string): Promise<FieldNode[]> => {
  const fields: FieldNode[] = [];
  let after: string | null = null;

  for (let page = 0; page < 50; page += 1) {
    const data = await request<{
      fields: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: { node: FieldNode }[];
      };
    }>(
      `query FieldsOfObject($objectMetadataId: UUID!, $after: ConnectionCursor) {
        fields(
          paging: { first: ${PAGE_SIZE}, after: $after }
          filter: { objectMetadataId: { eq: $objectMetadataId } }
        ) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              name
              type
              universalIdentifier
              isNullable
              settings
              relation { targetObjectMetadata { nameSingular } }
            }
          }
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

const createField = async ({
  objectMetadataId,
  targetObjectMetadataId,
  reverseLabel,
  reverseIcon,
}: {
  objectMetadataId: string;
  targetObjectMetadataId: string;
  reverseLabel: string;
  reverseIcon: string;
}): Promise<FieldNode> => {
  const data = await request<{ createOneField: FieldNode }>(
    `mutation CreateAssignee($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        name
        type
        universalIdentifier
        isNullable
        settings
        relation { targetObjectMetadata { nameSingular } }
      }
    }`,
    {
      input: {
        field: {
          objectMetadataId,
          type: 'RELATION',
          name: ASSIGNEE_FIELD_NAME,
          label: 'مسئول',
          icon: 'IconUserCheck',
          isNullable: true,
          relationCreationPayload: {
            type: 'MANY_TO_ONE',
            targetObjectMetadataId,
            targetFieldLabel: reverseLabel,
            targetFieldIcon: reverseIcon,
          },
        },
      },
    },
  );

  return data.createOneField;
};

const main = async (): Promise<void> => {
  // Verification only: report what exists and what is missing without creating
  // anything. Useful on a workspace that must not be modified yet.
  const checkOnly = process.argv.includes('--check');

  const workspaceMember = await findObject(
    WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
  );

  for (const target of TARGETS) {
    const object = await findObject(target.objectUniversalIdentifier);
    const fields = await listAllFields(object.id);
    const existing = fields.find((field) => field.name === ASSIGNEE_FIELD_NAME);

    if (existing !== undefined) {
      const problems = findAssigneeFieldProblems(existing);

      if (problems.length > 0) {
        throw new Error(
          problems
            .map((problem) =>
              describeAssigneeFieldProblem(object.nameSingular, problem),
            )
            .join('; '),
        );
      }

      console.log(
        `${object.nameSingular}: verified -> ${existing.universalIdentifier}`,
      );
      continue;
    }

    if (checkOnly) {
      console.log(`${object.nameSingular}: MISSING (--check made no change)`);
      continue;
    }

    const created = await createField({
      objectMetadataId: object.id,
      targetObjectMetadataId: workspaceMember.id,
      reverseLabel: target.reverseLabel,
      reverseIcon: target.reverseIcon,
    });

    const problems = findAssigneeFieldProblems(created);

    if (problems.length > 0) {
      throw new Error(
        `Created field does not have the expected shape: ${problems
          .map((problem) =>
            describeAssigneeFieldProblem(object.nameSingular, problem),
          )
          .join('; ')}`,
      );
    }

    console.log(
      `${object.nameSingular}: created -> ${created.universalIdentifier}`,
    );
  }
};

void main();
