import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

// Every query names the objects and fields of the workspace's existing data
// model. None of these strings define anything: they only read and write the
// records the dashboard already reads.
export const buildLeadQuery = (
  sourceObjectNameSingular: string,
  leadRelation: string | null,
  sourceRecordId: string,
): string => {
  if (leadRelation === null) {
    return `query RegistrationLead { eventLead(filter: { id: { eq: ${toGraphqlLiteral(sourceRecordId)} } }) { id name person { id } academyEvent { id } } }`;
  }

  // The interaction also exposes WHO made the call, which is the authoritative
  // seller when the registration is opened from an interaction rather than a
  // lead. It is read here so attribution never needs a browser-supplied name.
  return `query RegistrationInteraction { ${sourceObjectNameSingular}(filter: { id: { eq: ${toGraphqlLiteral(sourceRecordId)} } }) { id ${leadRelation} { id name person { id } academyEvent { id } } performedBy { id name { firstName lastName } } } }`;
};

export const buildExistingRegistrationQuery = (leadId: string): string =>
  `query ExistingRegistration { eventRegistrations(filter: { eventLeadId: { eq: ${toGraphqlLiteral(leadId)} } }) { edges { node { id registrationStatus } } } }`;

/**
 * The signed-in operator, resolved by the platform from the request's token.
 *
 * `currentUser` is guarded by `UserAuthGuard`, which only passes when the
 * request carries a real person. An application-only request therefore fails
 * HERE, before any write — that is the fail-closed check, not a convention.
 */
export const buildCurrentOperatorQuery = (): string =>
  'query CurrentOperator { currentUser { workspaceMember { id name { firstName lastName } userWorkspaceId } } }';

export const buildCreateRegistrationMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateRegistration { createEventRegistration(data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildCreatePaymentMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateRegistrationPayment { createRegistrationPayment(data: ${toGraphqlLiteral(data)}) { id } }`;
