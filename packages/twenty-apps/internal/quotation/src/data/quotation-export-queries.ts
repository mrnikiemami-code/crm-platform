import { toGraphqlLiteral } from 'src/data/graphql-literal';

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
