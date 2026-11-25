export const buildRoundingRulesQuery = (): string => `
query RoundingRulesCatalog {
  roundingRules(first: 200, orderBy: [{ createdAt: AscNullsLast }]) {
    edges {
      node {
        id
        name
        code
        stepRials
        isDefault
        isActive
      }
    }
  }
}
`;

export const buildQuotationsUsingRoundingRuleQuery = (): string => `
query QuotationsUsingRoundingRule {
  quotations(first: 500) {
    edges {
      node {
        id
        roundingRuleCode
      }
    }
  }
}
`;
