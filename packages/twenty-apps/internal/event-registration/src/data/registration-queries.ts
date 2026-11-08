import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';

// Every query names the objects and fields of the workspace's existing data
// model. None of these strings define anything: they only read and write the
// records the dashboard already reads.
export const buildLeadQuery = (sourceObjectNameSingular: string, leadRelation: string | null, sourceRecordId: string): string => {
  if (leadRelation === null) {
    return `query RegistrationLead { eventLead(filter: { id: { eq: ${toGraphqlLiteral(sourceRecordId)} } }) { id person { id } academyEvent { id } } }`;
  }

  return `query RegistrationInteraction { ${sourceObjectNameSingular}(filter: { id: { eq: ${toGraphqlLiteral(sourceRecordId)} } }) { id ${leadRelation} { id person { id } academyEvent { id } } } }`;
};

export const buildExistingRegistrationQuery = (leadId: string): string =>
  `query ExistingRegistration { eventRegistrations(filter: { eventLeadId: { eq: ${toGraphqlLiteral(leadId)} } }) { edges { node { id registrationStatus } } } }`;

export const buildCreateRegistrationMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateRegistration { createEventRegistration(data: ${toGraphqlLiteral(data)}) { id } }`;

export const buildCreatePaymentMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateRegistrationPayment { createRegistrationPayment(data: ${toGraphqlLiteral(data)}) { id } }`;
