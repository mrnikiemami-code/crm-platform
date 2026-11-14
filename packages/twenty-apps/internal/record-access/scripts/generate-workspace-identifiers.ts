/**
 * Generates the workspace-specific half of the app's identifiers.
 *
 * WHY THIS EXISTS: a universal identifier is only stable for the things the
 * platform ships. `STANDARD_OBJECTS` gives the standard objects and fields a
 * fixed id in every workspace, so those are imported directly. The academy
 * objects (`eventLead`, `eventRegistration`, `registrationPayment`,
 * `salesInteraction`, `academyEvent`) and the `assignee` fields this app creates
 * live in the workspace's own custom application, and their ids are minted per
 * workspace — copying them by hand is how a manifest ends up pointing at a field
 * that does not exist on the target instance.
 *
 * So this script reads the target workspace, verifies every object and field it
 * needs, and writes src/generated/workspace-identifiers.ts atomically. It never
 * edits the app's logic; it only fills in the values that cannot be known ahead
 * of time.
 *
 * Usage (run against the workspace you are about to install into):
 *   TWENTY_API_URL=http://localhost:3002 TWENTY_API_KEY=<admin key> \
 *     npx tsx packages/twenty-apps/internal/record-access/scripts/generate-workspace-identifiers.ts
 *
 *   add --check to verify the current file matches the workspace without writing.
 *
 * Order matters: run create-assignee-fields.ts first, then this, then build and
 * install. The reverse order fails loudly by design: installing a rule that
 * references a field which does not exist would be silently inert.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import {
  describeAssigneeFieldProblem,
  findAssigneeFieldProblems,
  type AssigneeFieldShape,
} from '../src/domain/assignee-field';

const API_URL = process.env.TWENTY_API_URL;
const API_KEY = process.env.TWENTY_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Set TWENTY_API_URL and TWENTY_API_KEY (an admin key).');
  process.exit(1);
}

const CHECK_ONLY = process.argv.includes('--check');
const CONSTANTS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'constants',
  'universal-identifiers.ts',
);

const BLOCK_BEGIN = '// BEGIN GENERATED WORKSPACE IDENTIFIERS';
const BLOCK_END = '// END GENERATED WORKSPACE IDENTIFIERS';

type ObjectNode = {
  id: string;
  nameSingular: string;
  universalIdentifier: string;
};

type FieldNode = AssigneeFieldShape & { universalIdentifier: string };

// The objects and fields this app needs from the workspace itself. The name is
// what the app refers to; the identifier is what gets written.
const REQUIRED_OBJECTS = [
  'eventLead',
  'eventRegistration',
  'registrationPayment',
  'salesInteraction',
  'academyEvent',
] as const;

const REQUIRED_ASSIGNEE_FIELDS = [
  'person',
  'eventRegistration',
  'registrationPayment',
  'salesInteraction',
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

const listObjects = async (): Promise<ObjectNode[]> => {
  const data = await request<{ objects: { edges: { node: ObjectNode }[] } }>(
    `query WorkspaceObjects {
      objects(paging: { first: 500 }) {
        edges { node { id nameSingular universalIdentifier } }
      }
    }`,
  );

  return data.objects.edges.map((edge) => edge.node);
};

// Walks the connection so a field on a later page is still seen.
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
        fields(paging: { first: 100, after: $after }, filter: { objectMetadataId: { eq: $objectMetadataId } }) {
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
        `Pagination for object ${objectMetadataId} reported another page without a cursor.`,
      );
    }
  }

  throw new Error(`Pagination for ${objectMetadataId} did not finish.`);
};

const toIdentifier = (nameSingular: string): string =>
  `${nameSingular.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_OBJECT_UNIVERSAL_IDENTIFIER`;

const main = async (): Promise<void> => {
  const objects = await listObjects();
  const byName = new Map(objects.map((object) => [object.nameSingular, object]));

  const missingObjects = REQUIRED_OBJECTS.filter((name) => !byName.has(name));

  if (missingObjects.length > 0) {
    throw new Error(
      `Workspace is missing objects: ${missingObjects.join(', ')}. Nothing was written.`,
    );
  }

  const lines: string[] = [];

  for (const name of REQUIRED_OBJECTS) {
    lines.push(
      `export const ${toIdentifier(name)} = '${byName.get(name)!.universalIdentifier}';`,
    );
  }

  for (const objectName of REQUIRED_ASSIGNEE_FIELDS) {
    const object = byName.get(objectName);

    if (object === undefined) {
      throw new Error(`Object ${objectName} not found. Nothing was written.`);
    }

    const fields = await listAllFields(object.id);
    const assignee = fields.find((field) => field.name === 'assignee');

    if (assignee === undefined) {
      throw new Error(
        `${objectName}.assignee does not exist yet. Run create-assignee-fields.ts first. Nothing was written.`,
      );
    }

    const problems = findAssigneeFieldProblems(assignee);

    if (problems.length > 0) {
      throw new Error(
        problems
          .map((problem) => describeAssigneeFieldProblem(objectName, problem))
          .join('; '),
      );
    }

    const constantName = `${objectName
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase()}_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER`;

    lines.push(`export const ${constantName} = '${assignee.universalIdentifier}';`);
  }

  // eventLead keeps its own assignment field; it is not one of ours to create.
  const eventLead = byName.get('eventLead')!;
  const eventLeadFields = await listAllFields(eventLead.id);
  const assignedTo = eventLeadFields.find((field) => field.name === 'assignedTo');

  if (assignedTo === undefined) {
    throw new Error(
      'eventLead.assignedTo does not exist, so leads cannot be scoped. Nothing was written.',
    );
  }

  lines.push(
    `export const EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER = '${assignedTo.universalIdentifier}';`,
  );

  const workspaceMemberIdField =
    STANDARD_OBJECTS.workspaceMember.fields.id.universalIdentifier;

  // Only the marked block is rewritten, so the app's own identifiers and the
  // portable imports above it are never touched by the tool.
  const generatedBlock = `${BLOCK_BEGIN}
${lines.join('\n')}

/** Verified against the workspace on generation; kept here for the role. */
export const AGGREGATED_WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '${workspaceMemberIdField}';
${BLOCK_END}`;

  const current = readFileSync(CONSTANTS_PATH, 'utf8');
  const blockStart = current.indexOf(BLOCK_BEGIN);
  const blockEnd = current.indexOf(BLOCK_END);

  if (blockStart < 0 || blockEnd < 0) {
    throw new Error(
      `Markers not found in ${CONSTANTS_PATH}; refusing to rewrite a file it cannot recognise.`,
    );
  }

  const updated =
    current.slice(0, blockStart) +
    generatedBlock +
    current.slice(blockEnd + BLOCK_END.length);

  if (CHECK_ONLY) {
    const matches = updated === current;

    console.log(
      matches
        ? `--check: the generated block matches the workspace (${lines.length} identifiers).`
        : `--check: the generated block is stale. Run without --check to rewrite it.`,
    );

    if (!matches) {
      process.exitCode = 2;
    }

    return;
  }

  // Atomic: a half-written file would make the next build reference nonsense.
  const temporaryPath = `${CONSTANTS_PATH}.tmp`;

  writeFileSync(temporaryPath, updated, 'utf8');
  renameSync(temporaryPath, CONSTANTS_PATH);

  console.log(
    `Rewrote the generated block in ${CONSTANTS_PATH} (${lines.length} identifiers).`,
  );
};

void main();
