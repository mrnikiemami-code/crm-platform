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
  // `person` is a singular workspace field that accepts a `filter` argument.
  // It is NOT a connection, so it must never be queried with `first`/`edges`;
  // doing so is rejected by the server with `Argument not allowed: first`.
  const result = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      id: true,
      phones: {
        primaryPhoneNumber: true,
        primaryPhoneCallingCode: true,
        additionalPhones: { number: true },
      },
    },
  });

  const node = result.person;

  if (node === undefined || node === null) {
    return null;
  }

  return buildPersonPhoneOptions(node.phones as PersonPhones);
};
