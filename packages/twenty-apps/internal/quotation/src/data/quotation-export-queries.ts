import { toGraphqlLiteral, type GraphqlValue } from 'src/data/graphql-literal';

// Export-only queries are separate from inbound catalog mapping queries.
export const buildExportHeaderAndLinesQuery = (quotationId: string, after: string | null = null): string =>
  `query QuotationForAccounting {
    quotation(filter: { id: { eq: ${toGraphqlLiteral(quotationId)} } }) {
      id name status version currencyCode person { id } company { id }
    }
    quotationLines(filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} } },
      orderBy: [{ sortOrder: AscNullsLast }], first: 100${after === null ? '' : ', after: ' + toGraphqlLiteral(after)}) {
      edges { node { id item { id } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

export const buildExportIssuedRevisionQuery = (quotationId: string): string =>
  `query QuotationRevisionForAccounting {
    quotationRevisions(filter: { quotationId: { eq: ${toGraphqlLiteral(quotationId)} }, status: { eq: "ISSUED" } }, first: 2) {
      edges { node { id version snapshotJson snapshotHash issuedAt } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

export const buildExportLinksQuery = ({
  connectionId, kind, ids, byExternal, after,
}: { connectionId: string; kind: 'item' | 'party'; ids: string[]; byExternal: boolean; after: string | null }): string => {
  const root = kind === 'item' ? 'accountingItemLinks' : 'accountingPartyLinks';
  const key = kind === 'item' ? (byExternal ? 'externalItemId' : 'itemId') :
    (byExternal ? 'externalPartyId' : 'internalPartyId');
  const fields = kind === 'item' ? 'externalItemId item { id }' : 'externalPartyId internalPartyId partyType';
  return `query ExportScopedLinks { ${root}(
      filter: { connectionId: { eq: ${toGraphqlLiteral(connectionId)} }, ${key}: { in: ${toGraphqlLiteral(ids)} } },
      first: 100${after === null ? '' : ', after: ' + toGraphqlLiteral(after)}) {
      edges { node { id connection { id } syncStatus remoteVersion ${fields} } }
      pageInfo { hasNextPage endCursor }
    } }`;
};

const CLAIM_RECEIPT = 'id kind state internalEntityId internalRevision attempts externalDocumentId errorCode correlationId payloadFingerprint payloadSnapshot connection { id }';
export const buildQuotationClaimReadQuery = (id: string, connectionId: string): string =>
  `query ReadQuotationClaim { accountingSyncOperations(
    filter: { id: { eq: ${toGraphqlLiteral(id)} }, connectionId: { eq: ${toGraphqlLiteral(connectionId)} } }, first: 2) {
    edges { node { ${CLAIM_RECEIPT} } }
    pageInfo { hasNextPage endCursor }
  } }`;
export const buildQuotationClaimMutation = (data: Record<string, GraphqlValue>): string =>
  `mutation CreateQuotationClaim { createAccountingSyncOperation(data: ${toGraphqlLiteral(data)}) { ${CLAIM_RECEIPT} } }`;
export const buildQuotationFinishMutation = (id: string, data: Record<string, GraphqlValue>): string =>
  `mutation FinishQuotationClaim { updateAccountingSyncOperation(id: ${toGraphqlLiteral(id)}, data: ${toGraphqlLiteral(data)}) { ${CLAIM_RECEIPT} } }`;
export const buildSealedRevisionListQuery = (quotationIds: string[]): string =>
  `query IssuedRevisionsForQuotations {
    quotationRevisions(filter: { quotationId: { in: ${toGraphqlLiteral(quotationIds)} }, status: { eq: "ISSUED" } },
      first: ${Math.max(50, quotationIds.length * 2)}) {
      edges { node { id version quotationId snapshotJson snapshotHash issuedAt status } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
