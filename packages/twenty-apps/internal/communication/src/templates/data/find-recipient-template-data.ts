import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type PersonPhones } from 'src/logic-functions/types/person-phone.type';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

// The connection node shape this read relies on. Typed locally from the fields
// the query selects, because the generated client schema is intentionally
// untyped.
type RawRecipientNode = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  jobTitle?: string | null;
  company?: { name?: string | null } | null;
};

// Reads the authorized template fields for ONE Person, through the same
// workspace-scoped API the rest of the app uses. Returns `null` when the Person
// does not exist or is not readable with the current permissions — the caller
// reports that as an explicit failure, never as "empty fields".
export const findRecipientTemplateData = async ({
  client,
  personId,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personId: string;
}): Promise<TemplateRecipientData | null> => {
  const result = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      id: true,
      name: { firstName: true, lastName: true },
      jobTitle: true,
      company: { name: true },
    },
  });

  const node = result.person as RawRecipientNode | null | undefined;

  if (node === undefined || node === null) {
    return null;
  }

  const firstName = node.name?.firstName?.trim() ?? '';
  const lastName = node.name?.lastName?.trim() ?? '';
  const fullNameParts = [firstName, lastName].filter(
    (part) => part.length > 0,
  );

  return {
    firstName: firstName.length > 0 ? firstName : null,
    lastName: lastName.length > 0 ? lastName : null,
    fullName: fullNameParts.length > 0 ? fullNameParts.join(' ') : null,
    jobTitle: node.jobTitle?.trim() || null,
    companyName: node.company?.name?.trim() || null,
  };
};

// Re-exported so callers that only need the phone shape do not import the
// phone type module directly.
export type { PersonPhones };
