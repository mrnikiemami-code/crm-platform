import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  buildPersonPhoneOptions,
  type PersonPhoneOption,
  type PersonPhones,
} from 'src/logic-functions/types/person-phone.type';

// Reads a Person's phone numbers through the workspace-scoped API. Returns
// `null` when the Person does not exist or is not accessible with the current
// permissions, which the caller reports as an explicit failure rather than
// treating as "no phone number".
export const findPersonPhoneOptions = async ({
  client,
  personId,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personId: string;
}): Promise<PersonPhoneOption[] | null> => {
  const result = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } }, first: 1 },
      edges: { node: { id: true, phones: true } },
    },
  });

  const node = result.person?.edges?.[0]?.node;

  if (node === undefined || node === null) {
    return null;
  }

  return buildPersonPhoneOptions(node.phones as PersonPhones);
};
