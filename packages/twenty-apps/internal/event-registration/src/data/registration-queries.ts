import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

// Every query names the objects and fields of the workspace's existing data
// model. None of these strings define anything: they only read and write the
// records the dashboard already reads.
//
// RELATION READS ARE ONE LEVEL DEEP, ON PURPOSE. Reading a relation's relation
// in a single query (`salesInteraction { eventLead { person { id } } }`) returns
// `null` from this server even when the row has a value, while the SAME lead
// read directly returns it. The interaction path therefore reads the lead's id
// first and then reads the lead itself — two supported requests rather than one
// silently-empty nested one. This was observed against real data, not assumed.
export const buildLeadQuery = (
  leadId: string,
): string =>
  `query RegistrationLead { eventLead(filter: { id: { eq: ${toGraphqlLiteral(leadId)} } }) { id name person { id name { firstName lastName } } academyEvent { id name } } }`;

export const buildInteractionHeadQuery = (
  interactionId: string,
): string =>
  `query RegistrationInteractionHead { salesInteraction(filter: { id: { eq: ${toGraphqlLiteral(interactionId)} } }) { id eventLead { id name } performedBy { id name { firstName lastName } } } }`;

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
