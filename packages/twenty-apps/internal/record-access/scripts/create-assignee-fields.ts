/**
 * Creates the three `assignee` fields this app's policy depends on.
 *
 * WHY A SCRIPT AND NOT A FIELD MANIFEST: person is a standard object, while
 * eventRegistration and registrationPayment belong to the workspace's custom
 * application. An app cannot declare fields on objects it does not own, so these
 * are created once per workspace through the platform's own data-model API — the
 * same mutation the data-model settings use.
 *
 * Idempotent: a field that already exists is left alone, so a second run only
 * reports what it found. It prints the universal identifiers to record in
 * src/constants/universal-identifiers.ts (and the role needs them, so bump the
 * app version and reinstall afterwards).
 *
 * Usage:
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/record-access/scripts/create-assignee-fields.ts
 */

import {
  EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
} from '../src/constants/universal-identifiers';

const API_URL = process.env.TWENTY_API_URL;
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Set TWENTY_API_URL and TWENTY_API_KEY (an admin key).');
  process.exit(1);
}

type FieldNode = {
  name: string;
  universalIdentifier: string;
};

type ObjectNode = {
  id: string;
  nameSingular: string;
};

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
  const payload = (await response.json()) as {
    data?: TData;
    errors?: unknown;
  };

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
  const data = await request<{
    objects: { edges: { node: ObjectNode }[] };
  }>(
    `query FindObject($universalIdentifier: UUID!) {
      objects(filter: { universalIdentifier: { eq: $universalIdentifier } }) {
        edges { node { id nameSingular } }
      }
    }`,
    { universalIdentifier: objectUniversalIdentifier },
  );

  const node = data.objects.edges[0]?.node;

  if (node === undefined) {
    throw new Error(
      `Object ${objectUniversalIdentifier} not found in this workspace`,
    );
  }

  return node;
};

const listFields = async (objectMetadataId: string): Promise<FieldNode[]> => {
  const data = await request<{
    fields: { edges: { node: FieldNode }[] };
  }>(
    `query FieldsOfObject($objectMetadataId: UUID!) {
      fields(filter: { objectMetadataId: { eq: $objectMetadataId } }) {
        edges { node { name universalIdentifier } }
      }
    }`,
    { objectMetadataId },
  );

  return data.fields.edges.map((edge) => edge.node);
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
      createOneField(input: $input) { name universalIdentifier }
    }`,
    {
      input: {
        field: {
          objectMetadataId,
          type: 'RELATION',
          name: 'assignee',
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
  const workspaceMember = await findObject(
    WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
  );

  for (const target of TARGETS) {
    const object = await findObject(target.objectUniversalIdentifier);
    const fields = await listFields(object.id);
    const existing = fields.find((field) => field.name === 'assignee');

    if (existing !== undefined) {
      console.log(
        `${object.nameSingular}: exists -> ${existing.universalIdentifier}`,
      );
      continue;
    }

    const created = await createField({
      objectMetadataId: object.id,
      targetObjectMetadataId: workspaceMember.id,
      reverseLabel: target.reverseLabel,
      reverseIcon: target.reverseIcon,
    });

    console.log(
      `${object.nameSingular}: created -> ${created.universalIdentifier}`,
    );
  }
};

void main();
