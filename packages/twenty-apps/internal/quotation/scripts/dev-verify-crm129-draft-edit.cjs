// Verifies that saving a draft from the record panel updates the same record in place.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const token = remote.apiKey;

const gql = async (query) => {
  const response = await fetch(`${apiBase}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  const payload = await response.json();
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors));
  }
  return payload.data;
};

const quotationId = process.argv[2];
if (!quotationId) {
  console.error('usage: node dev-verify-crm129-draft-edit.cjs <quotationId>');
  process.exit(2);
}

const FIELDS = `
  id
  name
  status
  version
  quotationNumber
  grossExact
  documentDiscountKind
  documentDiscountInputExact
  documentDiscountExact
  netExact
  taxExact
  roundingExact
  totalExact
  updatedAt
`;

const round = (value) => Math.round(Number(value) * 1000) / 1000;

const main = async () => {
  const data = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) { ${FIELDS} }
    quotations(first: 1) { totalCount }
    quotationLines(filter: { quotationId: { eq: "${quotationId}" } }) {
      edges { node { name quantityExact unitPriceExact grossExact totalExact sortOrder } }
    }
  }`);

  const quotation = data.quotation;
  const lines = data.quotationLines.edges.map((edge) => edge.node);

  const report = {
    apiBase,
    quotationId: quotation.id,
    name: quotation.name,
    status: quotation.status,
    version: quotation.version,
    quotationNumber: quotation.quotationNumber,
    grossExact: round(quotation.grossExact),
    documentDiscountKind: quotation.documentDiscountKind,
    documentDiscountInputExact: round(quotation.documentDiscountInputExact),
    documentDiscountExact: round(quotation.documentDiscountExact),
    netExact: round(quotation.netExact),
    taxExact: round(quotation.taxExact),
    roundingExact: round(quotation.roundingExact),
    totalExact: round(quotation.totalExact),
    totalCount: data.quotations.totalCount,
    lines: lines.map((line) => ({
      name: line.name,
      quantityExact: round(line.quantityExact),
      unitPriceExact: round(line.unitPriceExact),
      grossExact: round(line.grossExact),
      totalExact: round(line.totalExact),
    })),
  };

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error('FAIL', error.message);
  process.exit(1);
});
