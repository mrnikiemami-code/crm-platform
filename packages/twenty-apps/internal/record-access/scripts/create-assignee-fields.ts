/**
 * Creates the three `assignee` fields this app's policy depends on.
 *
 * WHY A SCRIPT AND NOT A FIELD MANIFEST: person is a standard object, while
 * eventLead, eventRegistration and registrationPayment belong to the workspace's
 * custom application. An app cannot declare fields on objects it does not own, so
 * these are created once per workspace through the platform's own data-model API
 * — the same mutation the data-model settings use.
 *
 * Idempotent: a field that already exists is left alone, so a second run only
 * reports what it found. Prints the universal identifiers to record in
 * src/constants/universal-identifiers.ts.
 *
 * Usage:
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/record-access/scripts/create-assignee-fields.ts
 */

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
    objectNameSingular: 'person',
    reverseLabel: 'اشخاص تخصیص‌یافته',
    reverseIcon: 'IconUsers',
  },
  {
    objectNameSingular: 'eventRegistration',
    reverseLabel: 'ثبت‌نام‌های تخصیص‌یافته',
    reverseIcon: 'IconClipboardList',
  },
  {
    objectNameSingular: 'registrationPayment',
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

const findObject = async (nameSingular: string): Promise<ObjectNode> => {
  const data = await request<{
    objects: { edges: { node: ObjectNode }[] };
  }>(
    `query FindObject($nameSingular: String!) {
      objects(filter: { nameSingular: { eq: $nameSingular } }) {
        edges { node { id nameSingular } }
      }
    }`,
    { nameSingular },
  );

  const node = data.objects.edges[0]?.node;

  if (node === undefined) {
    throw new Error(`Object "${nameSingular}" not found in this workspace`);
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

const workspaceMember = await findObject('workspaceMember');

for (const target of TARGETS) {
  const object = await findObject(target.objectNameSingular);
  const fields = await listFields(object.id);
  const existing = fields.find((field) => field.name === 'assignee');

  if (existing !== undefined) {
    console.log(
      `${target.objectNameSingular}: exists -> ${existing.universalIdentifier}`,
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
    `${target.objectNameSingular}: created -> ${created.universalIdentifier}`,
  );
}
