import { toGraphqlLiteral } from 'src/data/graphql-literal';
// Record access for the tax settings. Same inline-literal technique as the rest of
// the app, for the same reason: the generated input types of a workspace's custom
// objects are not part of the SDK this app compiles against.

const TAX_POLICY_FIELDS = `
  id
  name
  code
  rateBasisPoints
  dutyRateBasisPoints
  isDefault
  isActive
  isExempt
`;

export const buildTaxPoliciesQuery = (): string =>
  `query TaxPolicies { taxPolicies(first: 100) { edges { node { ${TAX_POLICY_FIELDS} } } } }`;

export const buildTaxPolicyByIdQuery = (id: string): string =>
  `query TaxPolicyById { taxPolicy(filter: { id: { eq: ${toGraphqlLiteral(id)} } }) { ${TAX_POLICY_FIELDS} } }`;

// There is deliberately no create/update mutation here. The only writer of a tax
// policy is the server boundary, which owns the role check and the single
// transaction that keeps exactly one default.

// Which policy code each quotation names. Read as a list so the settings page can
// show usage counts without a query per policy.
export const buildQuotationsUsingTaxPolicyQuery = (): string =>
  `query QuotationsUsingTaxPolicy { quotations(first: 500) { edges { node { id taxPolicy } } } }`;
