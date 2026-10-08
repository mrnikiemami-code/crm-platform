import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type BulkPersonRecord } from 'src/bulk/resolve-bulk-recipients';
import { type PersonPhones } from 'src/logic-functions/types/person-phone.type';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

// The connection node shape this read relies on. The generated client schema is
// intentionally untyped (`CoreSchema = {}`), so the node is typed locally from
// the fields the query selects.
type RawBulkPersonNode = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  company?: { name?: string | null } | null;
  phones?: PersonPhones;
};

type ConnectionEdge<TNode> = { node?: TNode | null } | null;

// Reads the authorized Person records for a multi-record selection in ONE
// workspace-scoped query. The server returns only the records the caller is
// permitted to read, so any requested id missing from the result is honestly
// "not accessible" rather than an error. `people` is a connection, so it is
// queried with `first` + `edges { node { … } }`.
export const findPersonsForBulk = async ({
  client,
  personIds,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personIds: string[];
}): Promise<BulkPersonRecord[]> => {
  const uniquePersonIds = [...new Set(personIds.filter((id) => id.length > 0))];

  if (uniquePersonIds.length === 0) {
    return [];
  }

  const result = await client.query({
    people: {
      __args: {
        filter: { id: { in: uniquePersonIds } },
        first: uniquePersonIds.length,
      },
      edges: {
        node: {
          id: true,
          name: { firstName: true, lastName: true },
          company: { name: true },
          phones: {
            primaryPhoneNumber: true,
            primaryPhoneCallingCode: true,
            additionalPhones: { number: true },
          },
        },
      },
    },
  });

  const edges: ConnectionEdge<RawBulkPersonNode>[] =
    result.people?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter(
      (node): node is RawBulkPersonNode => node !== undefined && node !== null,
    )
    .map((node) => ({
      id: node.id,
      name: node.name ?? null,
      company: node.company ?? null,
      phones: node.phones ?? null,
    }));
};

// Maps a fetched Person onto the closed recipient-data shape the interpolation
// engine consumes. Only allow-listed fields are exposed; nothing else on the
// record can be referenced by a template.
export const toTemplateRecipientData = (
  record: BulkPersonRecord,
): TemplateRecipientData => {
  const firstName = record.name?.firstName?.trim() ?? '';
  const lastName = record.name?.lastName?.trim() ?? '';
  const fullNameParts = [firstName, lastName].filter(
    (part) => part.length > 0,
  );

  return {
    firstName: firstName.length > 0 ? firstName : null,
    lastName: lastName.length > 0 ? lastName : null,
    fullName: fullNameParts.length > 0 ? fullNameParts.join(' ') : null,
    companyName: record.company?.name?.trim() || null,
  };
};
