import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';
// Record access for the accounting surfaces. Same inline-literal technique as the rest of
// the app, for the same reason: the workspace's generated input type names are not part of
// the SDK this app compiles against.
const CONNECTION_FIELDS = `
  id
  name
  adapterId
  adapterVersion
  isActive
  baseUrl
  remoteUserId
  defaultStorageId
  moneyUnit
  transportApproved
  specialCodes
  healthState
  lastHealthCheckAt
  lastHealthMessage
  verificationState
`;

export const buildAccountingConnectionsQuery = ({
  connectionId,
  activeOnly,
}: {
  connectionId?: string;
  activeOnly?: boolean;
} = {}): string => {
  const clauses: string[] = [];

  if (connectionId !== undefined && connectionId.trim() !== '') {
    clauses.push(`id: { eq: ${toGraphqlLiteral(connectionId)} }`);
  }

  if (activeOnly === true) {
    clauses.push('isActive: { eq: true }');
  }

  const filter =
    clauses.length === 0 ? '' : `filter: { ${clauses.join(', ')} }, `;

  return `query AccountingConnections { accountingConnections(${filter}first: 50) { edges { node { ${CONNECTION_FIELDS} } } } }`;
};

export const buildCreateAccountingConnectionMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateAccountingConnection { createAccountingConnection(data: ${toGraphqlLiteral(data)}) { ${CONNECTION_FIELDS} } }`;

export const buildUpdateAccountingConnectionMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateAccountingConnection { updateAccountingConnection(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { ${CONNECTION_FIELDS} } }`;

export const buildAccountingItemLinksQuery = ({
  connectionId,
  limit = 200,
}: {
  connectionId: string;
  limit?: number;
}): string =>
  `query AccountingItemLinks {
    accountingItemLinks(
      filter: { connectionId: { eq: ${toGraphqlLiteral(connectionId)} } }
      first: ${limit}
    ) {
      edges {
        node {
          id
          name
          externalItemId
          externalCode
          remoteVersion
          lastSyncedAt
          syncStatus
          item { id }
        }
      }
    }
  }`;

export const buildCreateAccountingItemLinkMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateAccountingItemLink { createAccountingItemLink(data: ${toGraphqlLiteral(data)}) { id externalItemId syncStatus item { id } } }`;

export const buildUpdateAccountingItemLinkMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateAccountingItemLink { updateAccountingItemLink(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { id remoteVersion syncStatus } }`;

export const buildAccountingPartyLinksQuery = ({
  connectionId,
  limit = 200,
}: {
  connectionId: string;
  limit?: number;
}): string =>
  `query AccountingPartyLinks {
    accountingPartyLinks(
      filter: { connectionId: { eq: ${toGraphqlLiteral(connectionId)} } }
      first: ${limit}
    ) {
      edges {
        node {
          id
          name
          externalPartyId
          externalCode
          remoteVersion
          lastSyncedAt
          syncStatus
          partyType
          internalPartyId
        }
      }
    }
  }`;

export const buildCreateAccountingPartyLinkMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateAccountingPartyLink { createAccountingPartyLink(data: ${toGraphqlLiteral(data)}) { id externalPartyId syncStatus } }`;

export const buildUpdateAccountingPartyLinkMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateAccountingPartyLink { updateAccountingPartyLink(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { id remoteVersion syncStatus } }`;

const OPERATION_FIELDS = `
  id
  name
  kind
  state
  internalEntityId
  internalRevision
  attempts
  externalDocumentId
  errorCode
  correlationId
  createdAt
  updatedAt
`;

export const buildAccountingOperationsQuery = ({
  connectionId,
  internalEntityId,
  limit = 100,
}: {
  connectionId: string;
  internalEntityId?: string;
  limit?: number;
}): string => {
  const clauses = [`connectionId: { eq: ${toGraphqlLiteral(connectionId)} }`];

  if (internalEntityId !== undefined && internalEntityId.trim() !== '') {
    clauses.push(
      `internalEntityId: { eq: ${toGraphqlLiteral(internalEntityId)} }`,
    );
  }

  return `query AccountingOperations {
    accountingSyncOperations(
      filter: { ${clauses.join(', ')} }
      orderBy: [{ createdAt: DescNullsLast }]
      first: ${limit}
    ) {
      edges { node { ${OPERATION_FIELDS} } }
    }
  }`;
};

export const buildCreateAccountingOperationMutation = (
  data: Record<string, GraphqlValue>,
): string =>
  `mutation CreateAccountingOperation { createAccountingSyncOperation(data: ${toGraphqlLiteral(data)}) { ${OPERATION_FIELDS} } }`;

export const buildUpdateAccountingOperationMutation = (
  id: string,
  data: Record<string, GraphqlValue>,
): string =>
  `mutation UpdateAccountingOperation { updateAccountingSyncOperation(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { ${OPERATION_FIELDS} } }`;

export const buildAccountingCatalogItemsQuery = (limit = 500): string =>
  `query AccountingCatalogItems {
    catalogItems(first: ${limit}) {
      edges { node { id name sku } }
    }
  }`;

// The item AND its price, read server-side before an outbound push. The browser must not
// decide the amount that is published to accounting.
export const buildCatalogItemPushQuery = (itemId: string): string =>
  `query CatalogItemForAccountingPush {
    catalogItem(filter: { id: { eq: ${toGraphqlLiteral(itemId)} } }) {
      id
      name
      sku
      description
      prices(first: 20) {
        edges {
          node { unitPriceExact priceList { id isDefault } }
        }
      }
    }
  }`;

export const buildQuotationForAccountingQuery = (
  quotationId: string,
): string =>
  `query QuotationForAccounting {
    quotation(filter: { id: { eq: ${toGraphqlLiteral(quotationId)} } }) {
      id
      name
      status
      version
      currencyCode
      person { id }
      company { id }
    }
    quotationLines(
      filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} } }
      orderBy: [{ sortOrder: AscNullsLast }]
      first: 200
    ) {
      edges { node { id item { id } } }
    }
  }`;

export const buildQuotationRevisionForAccountingQuery = (
  quotationId: string,
): string =>
  `query QuotationRevisionForAccounting {
    quotationRevisions(
      filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} }, status: { eq: "ISSUED" } }
      orderBy: [{ version: DescNullsLast }]
      first: 1
    ) {
      edges { node { id version snapshotJson snapshotHash totalExact issuedAt } }
    }
  }`;
