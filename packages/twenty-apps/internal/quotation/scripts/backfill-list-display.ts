// Backfills the three list-table projections on quotations that predate them.
//
// This does NOT allocate document numbers: a draft stays «بدون شماره» and a number
// that was never issued is never invented. It only writes derived, read-only display
// columns (quotationNumberLabel, customerName, totalDisplay) computed from data the
// record already holds, using the same domain formatter the app uses.
//
// Usage (from packages/twenty-apps/internal/quotation):
//   npx tsx scripts/backfill-list-display.ts [--dry-run]
//
// DB access is passed explicitly so the file never hardcodes credentials:
//   CRM129_DATABASE_URL=postgres://postgres:...@localhost:5432/default
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Client } from 'pg';

import { buildQuotationTotalDisplay } from 'src/domain/quotation/list-display';
import { formatQuotationNumberForPrinting } from 'src/domain/quotation/numbering';

type QuotationRow = {
  id: string;
  quotationNumber: string | null;
  quotationNumberLabel: string | null;
  customerName: string | null;
  totalDisplay: string | null;
  totalExact: string | null;
  currencyCode: string | null;
  person: {
    name: { firstName: string | null; lastName: string | null } | null;
  } | null;
  company: { name: string | null } | null;
};

const DRAFT_LABEL = 'بدون شماره';
const REMOTE_NAME = 'dev-crm129';

const readRemote = (): { apiUrl: string; apiKey: string } => {
  const configPath = path.join(os.homedir(), '.twenty', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const remote = config.remotes?.[REMOTE_NAME];

  if (!remote?.apiUrl || !remote?.apiKey) {
    throw new Error(`remote ${REMOTE_NAME} is not configured`);
  }

  if (String(remote.apiUrl).includes('6080')) {
    throw new Error('refusing to touch the intranet remote');
  }

  return { apiUrl: String(remote.apiUrl), apiKey: String(remote.apiKey) };
};

const graphqlRequest = async ({
  apiUrl,
  apiKey,
  query,
}: {
  apiUrl: string;
  apiKey: string;
  query: string;
}): Promise<Record<string, unknown>> => {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: unknown;
  };

  if (payload.errors !== undefined || payload.data === undefined) {
    throw new Error(`GraphQL failed: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
};

const buildCustomerName = (row: QuotationRow): string | null => {
  const first = row.person?.name?.firstName?.trim() ?? '';
  const last = row.person?.name?.lastName?.trim() ?? '';
  const personName = `${first} ${last}`.trim();

  if (personName !== '') {
    return personName;
  }

  const companyName = row.company?.name?.trim() ?? '';

  return companyName === '' ? null : companyName;
};

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const { apiUrl, apiKey } = readRemote();
  const databaseUrl = process.env.CRM129_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('CRM129_DATABASE_URL is required');
  }

  const data = await graphqlRequest({
    apiUrl,
    apiKey,
    query: `query { quotations(first: 500) { edges { node {
      id
      quotationNumber
      quotationNumberLabel
      customerName
      totalDisplay
      totalExact
      currencyCode
      person { name { firstName lastName } }
      company { name }
    } } } }`,
  });

  const edges =
    (data.quotations as { edges?: { node: QuotationRow }[] }).edges ?? [];
  const rows = edges.map((edge) => edge.node);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const schemaResult = await client.query<{ table_schema: string }>(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = '_quotation'`,
    );
    const schema = schemaResult.rows[0]?.table_schema;

    if (!schema) {
      throw new Error('quotation table not found');
    }

    let updated = 0;

    for (const row of rows) {
      const number = row.quotationNumber?.trim() ?? '';
      const quotationNumberLabel =
        number === '' ? DRAFT_LABEL : formatQuotationNumberForPrinting(number);
      const customerName = buildCustomerName(row);
      const totalDisplay = buildQuotationTotalDisplay({
        totalExact: row.totalExact,
        currencyCode: row.currencyCode,
      });

      const unchanged =
        row.quotationNumberLabel === quotationNumberLabel &&
        row.customerName === customerName &&
        row.totalDisplay === totalDisplay;

      if (unchanged) {
        continue;
      }

      updated += 1;

      if (dryRun) {
        console.log(
          `DRY ${row.id} label=${quotationNumberLabel} customer=${customerName} total=${totalDisplay}`,
        );
        continue;
      }

      // Display columns only: no business field, no number, no version bump.
      await client.query(
        `UPDATE "${schema}"."_quotation"
            SET "quotationNumberLabel" = $2, "customerName" = $3, "totalDisplay" = $4
          WHERE id = $1`,
        [row.id, quotationNumberLabel, customerName, totalDisplay],
      );
    }

    console.log(
      `${dryRun ? 'would update' : 'updated'} ${updated} of ${rows.length} quotations`,
    );
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
